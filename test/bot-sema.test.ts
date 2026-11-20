// P2.1 bot döngüsü şeması (20261120090000_bot_dongusu.sql), gerçek Postgres 17'de (PGlite): debounce zamanı
// (bot açık konuşmada müşteri mesajı 6 sn sonrasını yazar, yeni mesaj ileri iter), işleyicinin bot turu vadesi gelen
// konuşmayı kilitlemesi ve turu bir kez üstlenmesi, kanal bot modu, bot_ayarlari / bot_kullanim kısıtları ve RLS.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";

const YONETICI = "11111111-1111-4111-8111-111111111111"; // kullanicilar.id = 1
const SATIS = "22222222-2222-4222-8222-222222222222"; // kullanicilar.id = 2
const YABANCI = "33333333-3333-4333-8333-333333333333";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;
let sira = 0;

beforeAll(async () => {
  db = await bosVeritabani();
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'y@embedra.com', now()), ($2, 's@embedra.com', now()), ($3, 'x@example.com', now())`, [YONETICI, SATIS, YABANCI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 1`, [YONETICI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 2`, [SATIS]);
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec(`delete from public.konusmalar where kanal_hesap_id = 'BT'; delete from public.konusma_isleri;
    update public.konusmalar set kilit_sahibi = null, kilit_bitis = null, bot_cevap_zamani = null;
    update public.kanal_ayarlari set yeni_konusmada_bot = false, bot_modu = 'kapali';
    update public.bot_ayarlari set acil_durdurma = false, gunluk_maliyet_siniri_usd = 5, tur_siniri = 20;`);
});

const tek = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
const kaydet = async (kullanici: string, gonderen = "musteri") =>
  (await tek<{ konusma_id: number; mesaj_id: number }>(
    `select konusma_id::int, mesaj_id::int from public.gelen_mesaj_kaydet('whatsapp', 'BT', $1, $2, $3, 'Merhaba', 'metin', '{}'::jsonb, now(), null)`,
    [kullanici, `BT.${++sira}`, gonderen],
  ));
const botZamani = async (k: number) => (await tek<{ z: string | null }>(`select bot_cevap_zamani z from public.konusmalar where id = $1`, [k])).z;
const kilitAl = async (sahip: string, konusma: number | null = null, bot = true) =>
  (await tek<{ k: number | null }>(`select public.konusma_kilidi_al($1, 120, $2, $3)::int k`, [sahip, konusma, bot])).k;
const turAl = async (k: number, sahip: string) => (await tek<{ r: boolean }>(`select public.konusma_bot_turu_al($1, $2) r`, [k, sahip])).r;
const birak = async (k: number, sahip: string, bot = true) =>
  (await tek<{ r: string }>(`select public.konusma_kilidi_birak($1, $2, 120, $3) r`, [k, sahip, bot])).r;
/** Konuşmanın mesaj işlerini tamamlanmış say (işleyici işlemiş gibi) */
const islerBitti = (k: number) => db.query(`update public.konusma_isleri set durum = 'tamam' where konusma_id = $1`, [k]);
const vadeGecti = (k: number) => db.query(`update public.konusmalar set bot_cevap_zamani = now() - interval '1 second' where id = $1`, [k]);

describe("debounce: bot_cevap_zamani", () => {
  it("bot açık konuşmada müşteri mesajı 6 sn sonrasını yazar; yeni mesaj zamanı ileri iter", async () => {
    await db.exec(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'whatsapp'`);
    const { konusma_id: k } = await kaydet("+905330000001");
    const z1 = await botZamani(k);
    const fark = (await tek<{ s: number }>(`select extract(epoch from (bot_cevap_zamani - now()))::float s from public.konusmalar where id = $1`, [k])).s;
    expect(fark).toBeGreaterThan(5);
    expect(fark).toBeLessThanOrEqual(6.01);
    await db.query(`update public.konusmalar set bot_cevap_zamani = bot_cevap_zamani - interval '3 seconds' where id = $1`, [k]);
    await kaydet("+905330000001");
    expect(Date.parse((await botZamani(k))!)).toBeGreaterThanOrEqual(Date.parse(z1!) - 10);
  });

  it("bot kapalı konuşmada ve temsilci (echo) mesajında yazılmaz", async () => {
    const { konusma_id: k } = await kaydet("+905330000002");
    expect(await botZamani(k)).toBeNull();
    await db.query(`update public.konusmalar set bot_aktif = true where id = $1`, [k]);
    await kaydet("+905330000002", "temsilci");
    expect(await botZamani(k)).toBeNull();
  });
});

describe("işleyici: bot turu", () => {
  it("vadesi gelmemiş bot turu konuşmayı kilitletmez; gelince kilitlenir, tur bir kez üstlenilir", async () => {
    await db.exec(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'whatsapp'`);
    const { konusma_id: k } = await kaydet("+905330000003");
    expect(await kilitAl(A)).toBe(k); // mesaj işi
    await islerBitti(k);
    expect(await turAl(k, A)).toBe(false); // vade gelmedi
    expect(await birak(k, A)).toBe("birakildi");
    expect(await kilitAl(A)).toBeNull();

    await vadeGecti(k);
    expect(await kilitAl(A)).toBe(k);
    expect(await kilitAl(B)).toBeNull(); // kilit A'da
    expect(await turAl(k, B)).toBe(false); // kilit sahibi değil
    expect(await turAl(k, A)).toBe(true);
    expect(await botZamani(k)).toBeNull();
    expect(await turAl(k, A)).toBe(false); // bir kez
    expect(await birak(k, A)).toBe("birakildi");
  });

  it("tur sırasında yeni müşteri mesajı gelirse bırakırken 'devam' değil, yeni iş için 'devam'; vade gelince yeni tur", async () => {
    await db.exec(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'whatsapp'`);
    const { konusma_id: k } = await kaydet("+905330000004");
    await islerBitti(k);
    await vadeGecti(k);
    expect(await kilitAl(A)).toBe(k);
    expect(await turAl(k, A)).toBe(true);
    await kaydet("+905330000004"); // tur sürerken: yeni iş (hemen) + yeni bot zamanı (6 sn sonra)
    expect(await birak(k, A)).toBe("devam");
    await islerBitti(k);
    expect(await birak(k, A)).toBe("birakildi");
    expect(await botZamani(k)).not.toBeNull();
    await vadeGecti(k);
    expect(await kilitAl(B)).toBe(k);
    expect(await birak(k, B)).toBe("devam"); // vadesi gelmiş tur bekliyor
  });

  it("botu bilmeyen işleyici (p_bot verilmez: eski kod, webhook, simülasyon) bot turu bekleyen konuşmayı almaz, 'devam' döngüsüne girmez", async () => {
    await db.exec(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'whatsapp'`);
    const { konusma_id: k } = await kaydet("+905330000009");
    await islerBitti(k);
    await vadeGecti(k);
    // Eski imzayla, adlandırılmış argümanlarla (supabase-js rpc gibi) çağrı yeni işleve düşer
    expect((await tek<{ k: number | null }>(`select public.konusma_kilidi_al(p_sahip => $1, p_sure_sn => 120, p_konusma_id => null)::int k`, [A])).k).toBeNull();
    await db.query(`update public.konusmalar set kilit_sahibi = $1, kilit_bitis = now() + interval '1 minute' where id = $2`, [A, k]);
    expect((await tek<{ r: string }>(`select public.konusma_kilidi_birak(p_konusma_id => $1, p_sahip => $2, p_sure_sn => 120) r`, [k, A])).r).toBe("birakildi");
    expect(await kilitAl(B, null, true)).toBe(k);
  });

  it("p_konusma_id ile yalnızca o konuşmanın bot turuna bakar; en eski bekleyen önce", async () => {
    await db.exec(`update public.kanal_ayarlari set yeni_konusmada_bot = true where kanal = 'whatsapp'`);
    const { konusma_id: k1 } = await kaydet("+905330000005");
    const { konusma_id: k2 } = await kaydet("+905330000006");
    await islerBitti(k1);
    await islerBitti(k2);
    await db.query(`update public.konusmalar set bot_cevap_zamani = now() - interval '5 seconds' where id = $1`, [k2]);
    await db.query(`update public.konusmalar set bot_cevap_zamani = now() - interval '1 second' where id = $1`, [k1]);
    expect(await kilitAl(A, k1)).toBe(k1);
    await birak(k1, A);
    await db.query(`update public.konusmalar set kilit_sahibi = null, kilit_bitis = null`);
    expect(await kilitAl(B)).toBe(k2);
  });
});

describe("ayarlar ve kısıtlar", () => {
  it("kanal bot modu varsayılan kapalı, yalnızca kapali | golge | otomatik", async () => {
    expect((await db.query<{ bot_modu: string }>(`select bot_modu from public.kanal_ayarlari order by kanal`)).rows.map((r) => r.bot_modu)).toEqual(["kapali", "kapali", "kapali"]);
    await expect(db.query(`update public.kanal_ayarlari set bot_modu = 'acik'`)).rejects.toThrow(/bot_modu_check/);
  });

  it("bot_ayarlari tek satır, varsayılanlar: acil durdurma kapalı, 5 USD, 20 tur", async () => {
    expect(await tek(`select acil_durdurma, gunluk_maliyet_siniri_usd::float m, tur_siniri from public.bot_ayarlari`)).toEqual({ acil_durdurma: false, m: 5, tur_siniri: 20 });
    await expect(db.query(`insert into public.bot_ayarlari (id) values (2)`)).rejects.toThrow(/tek_satir/);
    await expect(db.query(`update public.bot_ayarlari set tur_siniri = 0`)).rejects.toThrow(/check/);
  });

  it("bot_kullanim: sonuc listesi; bot_kullanim_id yalnızca bot mesajında", async () => {
    const { konusma_id: k, mesaj_id: m } = await kaydet("+905330000007");
    await expect(db.query(`insert into public.bot_kullanim (konusma_id, kanal, model, istem_surumu, sonuc) values ($1, 'whatsapp', 'm', 'v', 'bilinmez')`, [k])).rejects.toThrow(/check/);
    const { id } = await tek<{ id: number }>(`insert into public.bot_kullanim (konusma_id, kanal, model, effort, istem_surumu, araclar, sonuc) values ($1, 'whatsapp', 'claude-haiku-5-5', 'low', 'p2.1-1', '{insana_devret}', 'devir') returning id::int`, [k]);
    await expect(db.query(`update public.konusma_mesajlari set bot_kullanim_id = $1 where id = $2`, [id, m])).rejects.toThrow(/bot_kullanim_check/);
  });
});

describe("RLS", () => {
  it("bot ayarlarını ve kanal bot modunu yalnızca Yönetici değiştirir; CRM ekibi okur, anon erişemez", async () => {
    const [s] = await rolIle<{ n: number }>(db, "authenticated", SATIS, `with g as (update public.bot_ayarlari set acil_durdurma = true returning 1) select count(*)::int n from g`);
    expect(s.n).toBe(0);
    const [y] = await rolIle<{ n: number }>(db, "authenticated", YONETICI, `with g as (update public.bot_ayarlari set acil_durdurma = true returning 1) select count(*)::int n from g`);
    expect(y.n).toBe(1);
    const [m] = await rolIle<{ n: number }>(db, "authenticated", SATIS, `with g as (update public.kanal_ayarlari set bot_modu = 'otomatik' returning 1) select count(*)::int n from g`);
    expect(m.n).toBe(0);
    expect(await rolIle(db, "authenticated", SATIS, `select tur_siniri from public.bot_ayarlari`)).toHaveLength(1);
    expect(await rolIle(db, "authenticated", YABANCI, `select tur_siniri from public.bot_ayarlari`)).toHaveLength(0);
    await expect(rolIle(db, "anon", null, `select * from public.bot_ayarlari`)).rejects.toThrow(/permission denied/);
  });

  it("bot_kullanim: CRM ekibi okur ve ekler (simülasyon), güncelleyemez / silemez; ekip dışı göremez; anon erişemez", async () => {
    const { konusma_id: k } = await kaydet("+905330000008");
    const ekle = `insert into public.bot_kullanim (konusma_id, kanal, model, istem_surumu, sonuc) values (${k}, 'whatsapp', 'm', 'v', 'cevap') returning id`;
    expect(await rolIle(db, "authenticated", SATIS, ekle)).toHaveLength(1);
    await expect(rolIle(db, "authenticated", YABANCI, ekle)).rejects.toThrow(/row-level security/);
    await db.query(`insert into public.bot_kullanim (konusma_id, kanal, model, istem_surumu, sonuc) values ($1, 'whatsapp', 'm', 'v', 'cevap')`, [k]);
    expect(await rolIle(db, "authenticated", SATIS, `select id from public.bot_kullanim where konusma_id = ${k}`)).toHaveLength(1);
    expect(await rolIle(db, "authenticated", YABANCI, `select id from public.bot_kullanim`)).toHaveLength(0);
    const [g] = await rolIle<{ n: number }>(db, "authenticated", YONETICI, `with g as (update public.bot_kullanim set maliyet_usd = 0 returning 1) select count(*)::int n from g`);
    expect(g.n).toBe(0);
    const [d] = await rolIle<{ n: number }>(db, "authenticated", YONETICI, `with g as (delete from public.bot_kullanim returning 1) select count(*)::int n from g`);
    expect(d.n).toBe(0);
    await expect(rolIle(db, "anon", null, `select * from public.bot_kullanim`)).rejects.toThrow(/permission denied/);
    await expect(rolIle(db, "anon", null, `select public.konusma_bot_turu_al(1, '${A}')`)).rejects.toThrow(/permission denied/);
  });
});
