// P1.3 devral / bota geri ver / bot devretti şeması (20261119160000_devral_devret.sql), gerçek Postgres 17'de (PGlite):
// durum geçişleri ve sistem satırları (değişiklik yoksa satır yazılmaz), işlemi yapanın oturumdan okunması,
// bota notun tek kez alınması, yeni konuşmada kanal varsayılanı, kısıtlar ve RLS (kanal ayarını yalnızca Yönetici değiştirir).
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";

const YONETICI = "11111111-1111-4111-8111-111111111111"; // kullanicilar.id = 1
const SATIS = "22222222-2222-4222-8222-222222222222"; // kullanicilar.id = 2
const YABANCI = "33333333-3333-4333-8333-333333333333";

let db: PGlite;
let konusma: number;
let sira = 0;

beforeAll(async () => {
  db = await bosVeritabani();
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'deniz@embedra.com', now()), ($2, 'ayse@embedra.com', now()), ($3, 'x@example.com', now())`, [YONETICI, SATIS, YABANCI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 1`, [YONETICI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 2`, [SATIS]);
}, 60_000);
afterAll(() => db?.close());

/** Oturumdaki kullanıcıyla (authenticated) ya da oturumsuz sunucu olarak (uid null: tablo sahibi, service_role gibi) çalıştırır */
async function olarak<T>(uid: string | null, is: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (uid) {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
      await tx.exec(`set local role authenticated`);
    }
    return is(tx);
  });
}
const tek = async <T>(uid: string | null, sql: string, p: unknown[] = []) =>
  olarak(uid, async (tx) => (await tx.query<{ r: T }>(sql, p)).rows[0].r);

const devral = (uid: string | null, kaynak: string, kullanici: number | null = null) =>
  tek<boolean>(uid, `select public.konusma_devral($1, $2, $3) r`, [konusma, kaynak, kullanici]);
const botaVer = (uid: string | null, not: string | null = null) => tek<boolean>(uid, `select public.konusma_bota_ver($1, $2) r`, [konusma, not]);
const devretti = (sebep: string, aciklama: string | null = null) =>
  tek<boolean>(null, `select public.konusma_bot_devretti($1, $2, $3) r`, [konusma, sebep, aciklama]);

type Durum = { bot_aktif: boolean; devralan_id: number | null; devir_sebebi: string | null; bot_notu: string | null };
const durum = async () =>
  (await db.query<Durum>(`select bot_aktif, devralan_id::int, devir_sebebi, bot_notu from public.konusmalar where id = $1`, [konusma])).rows[0];
type Olay = { tur: string; kaynak: string | null; kullanici_id: number | null; sebep: string | null; aciklama: string | null };
const olaylar = async () =>
  (await db.query<Olay>(`select tur, kaynak, kullanici_id::int, sebep, aciklama from public.konusma_olaylari where konusma_id = $1 order by id`, [konusma])).rows;

async function yeniKonusma(kanal = "whatsapp") {
  const r = await db.query<{ k: number }>(
    `select konusma_id::int k from public.gelen_mesaj_kaydet($1, 'DV', $2, $3, 'musteri', 'Merhaba', 'metin', '{}'::jsonb, now(), null)`,
    [kanal, `+90533000${String(++sira).padStart(4, "0")}`, `DV.${sira}`],
  );
  return r.rows[0].k;
}

beforeEach(async () => {
  await db.exec(`delete from public.konusmalar where kanal_hesap_id = 'DV'; update public.kanal_ayarlari set yeni_konusmada_bot = false`);
  konusma = await yeniKonusma();
  await db.query(`update public.konusmalar set bot_aktif = true where id = $1`, [konusma]);
});

describe("devral / bota geri ver / bot devretti", () => {
  it("Devral: bot susar, devralan oturumdaki kişi olur, sistem satırı yazılır; ikinci tıklama bir şey yazmaz", async () => {
    expect(await devral(SATIS, "dugme")).toBe(true);
    expect(await durum()).toEqual({ bot_aktif: false, devralan_id: 2, devir_sebebi: null, bot_notu: null });
    expect(await devral(SATIS, "dugme")).toBe(false);
    expect(await olaylar()).toEqual([{ tur: "devralindi", kaynak: "dugme", kullanici_id: 2, sebep: null, aciklama: null }]);
    // Başkası da devralabilir
    expect(await devral(YONETICI, "dugme")).toBe(true);
    expect((await durum()).devralan_id).toBe(1);
  });

  it("CRM kullanıcısı başkası adına devralamaz: parametre yok sayılır, oturumdaki kişi yazılır", async () => {
    expect(await devral(SATIS, "dugme", 1)).toBe(true);
    expect((await durum()).devralan_id).toBe(2);
  });

  it("CRM'den cevap: bot açıksa susar ve yazan devralır; başkası devraldıysa devralan değişmez ve satır yazılmaz", async () => {
    expect(await devral(null, "cevap", 2)).toBe(true); // işleyici / sunucu: kullanıcı parametreden
    expect(await durum()).toMatchObject({ bot_aktif: false, devralan_id: 2 });
    expect(await devral(YONETICI, "cevap")).toBe(false);
    expect((await durum()).devralan_id).toBe(2);
    expect((await olaylar()).map((o) => o.kaynak)).toEqual(["cevap"]);
  });

  it("CRM dışından yazıldı (echo): bot susar, kim yazdığı bilinmez; bot zaten kapalıysa satır yazılmaz", async () => {
    expect(await devral(null, "kanal_disi", 5)).toBe(true);
    expect(await durum()).toMatchObject({ bot_aktif: false, devralan_id: null });
    expect(await devral(null, "kanal_disi")).toBe(false);
    expect(await olaylar()).toEqual([{ tur: "devralindi", kaynak: "kanal_disi", kullanici_id: null, sebep: null, aciklama: null }]);
  });

  it("Bota geri ver: bot açılır, devralan ve devir temizlenir, not saklanır ve bir kez alınır", async () => {
    await devral(SATIS, "dugme");
    expect(await botaVer(SATIS, "  Fiyatı ben verdim, demo için gün sor  ")).toBe(true);
    expect(await durum()).toEqual({ bot_aktif: true, devralan_id: null, devir_sebebi: null, bot_notu: "Fiyatı ben verdim, demo için gün sor" });
    expect((await olaylar()).at(-1)).toEqual({ tur: "bota_verildi", kaynak: null, kullanici_id: 2, sebep: null, aciklama: "Fiyatı ben verdim, demo için gün sor" });
    expect(await tek(null, `select public.konusma_bot_notu_al($1) r`, [konusma])).toBe("Fiyatı ben verdim, demo için gün sor");
    expect(await tek(null, `select public.konusma_bot_notu_al($1) r`, [konusma])).toBeNull();
    // Not yokken zaten açık bota geri vermek bir şey yazmaz
    expect(await botaVer(SATIS)).toBe(false);
  });

  it("Devralınca okunmamış bota not silinir (bot artık konuşmuyor)", async () => {
    await botaVer(SATIS, "not");
    await devral(YONETICI, "dugme");
    expect((await durum()).bot_notu).toBeNull();
    expect(await tek(null, `select public.konusma_bot_notu_al($1) r`, [konusma])).toBeNull();
  });

  it("Bot devretti: bot kapanır, sebep yazılır ('Cevap bekliyor'); tekrar çağrı ve bot kapalıyken çağrı bir şey yapmaz", async () => {
    expect(await devretti("fiyat_pazarligi", "İskonto istiyor")).toBe(true);
    expect(await durum()).toMatchObject({ bot_aktif: false, devir_sebebi: "fiyat_pazarligi", devralan_id: null });
    expect(await devretti("sikayet")).toBe(false);
    expect((await olaylar())).toEqual([{ tur: "bot_devretti", kaynak: null, kullanici_id: null, sebep: "fiyat_pazarligi", aciklama: "İskonto istiyor" }]);
    // Biri yazınca "Cevap bekliyor" biter, yazan devralır
    expect(await devral(SATIS, "cevap")).toBe(true);
    expect(await durum()).toMatchObject({ devir_sebebi: null, devralan_id: 2 });
  });

  it("geçersiz sebep ve kaynak reddedilir; bot açıkken devralan / devir olamaz", async () => {
    await expect(devretti("uydurma")).rejects.toThrow(/konusmalar_devir_sebebi_check/);
    await expect(devral(SATIS, "baska")).rejects.toThrow("Geçersiz devralma kaynağı");
    await expect(devral(null, "dugme")).rejects.toThrow("Devralan kullanıcı bilinmiyor");
    await expect(db.query(`update public.konusmalar set devralan_id = 1 where id = $1`, [konusma])).rejects.toThrow(/konusmalar_bot_devir_check/);
  });

  it("gelen_kutusu devir durumunu döner", async () => {
    await devretti("musteri_istedi");
    const r = await rolIle<{ bot_aktif: boolean; devir_sebebi: string }>(db, "authenticated", SATIS,
      `select bot_aktif, devir_sebebi from public.gelen_kutusu() where kanal_hesap_id = 'DV'`);
    expect(r).toEqual([{ bot_aktif: false, devir_sebebi: "musteri_istedi" }]);
  });
});

describe("kanal varsayılanı ve erişim", () => {
  it("yeni konuşma kanalın 'yeni konuşmada bot' ayarıyla açılır; var olan konuşma etkilenmez", async () => {
    await db.exec(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'whatsapp'`);
    const yeni = await yeniKonusma();
    const ig = await yeniKonusma("instagram");
    const r = await db.query<{ id: number; bot_aktif: boolean }>(`select id::int, bot_aktif from public.konusmalar where id = any($1) order by id`, [[konusma, yeni, ig]]);
    expect(r.rows).toEqual([{ id: konusma, bot_aktif: true }, { id: yeni, bot_aktif: true }, { id: ig, bot_aktif: false }]);
  });

  it("kanal ayarını ekip okur, yalnızca Yönetici değiştirir; ekip dışı ve anon göremez", async () => {
    const guncelle = (uid: string) =>
      olarak(uid, async (tx) => (await tx.query(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'messenger'`)).affectedRows);
    expect(await guncelle(SATIS)).toBe(0);
    expect(await guncelle(YONETICI)).toBe(1);
    const say = (rol: "anon" | "authenticated", uid: string | null) =>
      rolIle<{ n: number }>(db, rol, uid, `select count(*)::int n from public.kanal_ayarlari`).then((r) => r[0].n, () => -1);
    expect(await say("authenticated", SATIS)).toBe(3);
    expect(await say("authenticated", YABANCI)).toBe(0);
    expect(await say("anon", null)).toBe(-1);
  });

  it("sistem satırları ve fırsat notları yalnızca CRM ekibine açık", async () => {
    await devral(SATIS, "dugme");
    await db.query(`insert into public.firsat_notlari (satis_hatti_id, tur, metin) select id, 'bot_devretti', 'Bot devretti: Diğer' from public.satis_hatti limit 1`);
    for (const tablo of ["konusma_olaylari", "firsat_notlari"]) {
      const say = (rol: "anon" | "authenticated", uid: string | null) =>
        rolIle<{ n: number }>(db, rol, uid, `select count(*)::int n from public.${tablo}`).then((r) => r[0].n, () => -1);
      expect(await say("authenticated", SATIS)).toBeGreaterThan(0);
      expect(await say("authenticated", YABANCI)).toBe(0);
      expect(await say("anon", null)).toBe(-1);
    }
    await db.exec(`delete from public.firsat_notlari`);
  });
});
