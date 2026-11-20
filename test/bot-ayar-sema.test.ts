// P2.4 şeması (20261120170000_bot_ayar_surumleri.sql), gerçek Postgres 17'de (PGlite): ayar sürümü kaydetme ve geri
// dönme (yeni sürüm, sıralı numara, aktif sürüm), RLS (okuma CRM ekibi, ekleme / kaydetme yalnızca Yönetici, sürüm
// değiştirilemez / silinemez), bilgi kaynaklarının (P2.4b) elle kayıtta taşınması, maliyet bildiriminin günde bir
// kez alınması, son webhook zamanı (yalnızca gizli anahtar) ve bot_kullanim'in "deneme" satırları.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";

const YONETICI = "11111111-1111-4111-8111-111111111111"; // kullanicilar.id = 1 (Yönetici)
const SATIS = "22222222-2222-4222-8222-222222222222"; // kullanicilar.id = 2 (Satış)

let db: PGlite;

beforeAll(async () => {
  db = await bosVeritabani();
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'y@embedra.com', now()), ($2, 's@embedra.com', now())`, [YONETICI, SATIS]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 1`, [YONETICI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 2`, [SATIS]);
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec(`update public.bot_ayarlari set aktif_surum_id = null, maliyet_bildirim_gunu = null;
    delete from public.bot_istem_surumleri; update public.kanal_ayarlari set son_webhook_zamani = null;`);
});

const tek = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
const kaydetSql = (botAdi: string, geri: number | null = null) =>
  `select id::int, surum_no from public.bot_istem_surumu_kaydet('${botAdi}', 'Merhaba', '', 'Garanti 2 yıl', '', '',
    '{"pzt": ["09:00", "18:00"]}'::jsonb, '', 'not', 1, ${geri ?? "null"})`;

/** Yönetici oturumuyla, kalıcı (rolIle geri alır; burada işlem içinde commit) */
async function yoneticiKaydet(botAdi: string, geri: number | null = null) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [YONETICI]);
    await tx.exec(`set local role authenticated`);
    return (await tx.query<{ id: number; surum_no: number }>(kaydetSql(botAdi, geri))).rows[0];
  });
}

describe("ayar sürümleri", () => {
  it("Yönetici kaydeder: sıralı numara, aktif sürüm bot_ayarlari'nda, kaydeden ve not yazılır", async () => {
    const s1 = await yoneticiKaydet("Asistan A");
    const s2 = await yoneticiKaydet("Asistan B");
    expect([s1.surum_no, s2.surum_no]).toEqual([1, 2]);
    expect(await tek(`select aktif_surum_id::int a, guncelleyen_id::int g from public.bot_ayarlari`)).toEqual({ a: s2.id, g: 1 });
    expect(await tek(`select bot_adi, olusturan_id::int o, aciklama, mesai_saatleri from public.bot_istem_surumleri where surum_no = 2`))
      .toEqual({ bot_adi: "Asistan B", o: 1, aciklama: "not", mesai_saatleri: { pzt: ["09:00", "18:00"] } });
  });

  it("geri dönüş içeriği kopyalayan YENİ sürüm açar; eski sürüm değişmez", async () => {
    await yoneticiKaydet("Asistan A");
    await yoneticiKaydet("Asistan B");
    const s3 = await yoneticiKaydet("yok sayılır", 1);
    expect(s3.surum_no).toBe(3);
    expect(await tek(`select bot_adi, geri_donulen_surum, aciklama from public.bot_istem_surumleri where surum_no = 3`))
      .toEqual({ bot_adi: "Asistan A", geri_donulen_surum: 1, aciklama: "not" });
    expect((await tek<{ n: number }>(`select count(*)::int n from public.bot_istem_surumleri`)).n).toBe(3);
    expect((await tek<{ a: number }>(`select aktif_surum_id::int a from public.bot_ayarlari`)).a).toBe(s3.id);
    await expect(yoneticiKaydet("x", 99)).rejects.toThrow(/Sürüm bulunamadı/);
  });

  it("P2.4b bilgi kaynakları elle kayıtta aktif sürümden taşınır, geri dönüşte o sürümdeki hâline döner", async () => {
    const s1 = await yoneticiKaydet("A");
    await db.query(`update public.bot_istem_surumleri set bilgi_kaynaklari = '[{"id": 7, "baslik": "SSS", "hedef": "bilgi_bankasi", "metin": "x"}]' where id = $1`, [s1.id]);
    await yoneticiKaydet("B");
    expect((await tek<{ b: unknown }>(`select bilgi_kaynaklari b from public.bot_istem_surumleri where surum_no = 2`)).b).toEqual([{ id: 7, baslik: "SSS", hedef: "bilgi_bankasi", metin: "x" }]);
  });

  it("RLS: Satış okur ama kaydedemez / ekleyemez; kimse güncelleyemez / silemez; anon hiç göremez", async () => {
    await yoneticiKaydet("A");
    expect(await rolIle(db, "authenticated", SATIS, `select surum_no from public.bot_istem_surumleri`)).toEqual([{ surum_no: 1 }]);
    await expect(rolIle(db, "authenticated", SATIS, kaydetSql("Satış"))).rejects.toThrow(/yetkiniz yok|row-level security/);
    await expect(rolIle(db, "authenticated", SATIS, `insert into public.bot_istem_surumleri (surum_no) values (50)`)).rejects.toThrow(/row-level security/);
    expect(await rolIle(db, "authenticated", YONETICI, `update public.bot_istem_surumleri set bot_adi = 'x' returning id`)).toEqual([]);
    expect(await rolIle(db, "authenticated", YONETICI, `delete from public.bot_istem_surumleri returning id`)).toEqual([]);
    await expect(rolIle(db, "anon", null, `select * from public.bot_istem_surumleri`)).rejects.toThrow(/permission denied/);
    expect((await tek<{ n: number }>(`select count(*)::int n from public.bot_istem_surumleri where bot_adi = 'A'`)).n).toBe(1);
  });

  it("kaba üst sınırlar SQL'de de var", async () => {
    await expect(db.query(`insert into public.bot_istem_surumleri (surum_no, bot_adi) values (90, repeat('a', 61))`)).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.bot_istem_surumleri (surum_no, mesai_saatleri) values (91, '[]')`)).rejects.toThrow(/check/);
  });
});

describe("maliyet bildirimi, son webhook, deneme kullanımı", () => {
  it("bot_maliyet_bildirimi_al: aynı gün yalnızca ilk çağrı true; ertesi gün yeniden; Satış çağıramaz (RLS ile satır yok)", async () => {
    const al = async (gun: string) => (await tek<{ r: boolean }>(`select public.bot_maliyet_bildirimi_al($1::date) r`, [gun])).r;
    expect(await al("2026-11-20")).toBe(true);
    expect(await al("2026-11-20")).toBe(false);
    expect(await al("2026-11-21")).toBe(true);
    // service_role (işleyici) RLS'i atlar
    expect((await db.transaction(async (tx) => { await tx.exec(`set local role service_role`); return (await tx.query<{ r: boolean }>(`select public.bot_maliyet_bildirimi_al('2026-11-22') r`)).rows[0].r; }))).toBe(true);
    expect(await rolIle(db, "authenticated", SATIS, `select public.bot_maliyet_bildirimi_al('2026-11-23') r`)).toEqual([{ r: false }]);
  });

  it("kanal_webhook_isaretle: yalnızca service_role; 30 sn içinde tekrar yazmaz", async () => {
    await expect(rolIle(db, "authenticated", YONETICI, `select public.kanal_webhook_isaretle('whatsapp')`)).rejects.toThrow(/permission denied/);
    await db.transaction(async (tx) => {
      await tx.exec(`set local role service_role`);
      await tx.query(`select public.kanal_webhook_isaretle('instagram')`);
    });
    const ilk = (await tek<{ z: string }>(`select son_webhook_zamani z from public.kanal_ayarlari where kanal = 'instagram'`)).z;
    expect(ilk).not.toBeNull();
    await db.query(`update public.kanal_ayarlari set son_webhook_zamani = now() - interval '10 seconds' where kanal = 'instagram'`);
    const once = (await tek<{ z: string }>(`select son_webhook_zamani z from public.kanal_ayarlari where kanal = 'instagram'`)).z;
    await db.query(`select public.kanal_webhook_isaretle('instagram')`);
    expect((await tek<{ z: string }>(`select son_webhook_zamani z from public.kanal_ayarlari where kanal = 'instagram'`)).z).toEqual(once);
    await db.query(`update public.kanal_ayarlari set son_webhook_zamani = now() - interval '1 minute' where kanal = 'instagram'`);
    await db.query(`select public.kanal_webhook_isaretle('instagram')`);
    expect(Date.parse((await tek<{ z: string }>(`select son_webhook_zamani z from public.kanal_ayarlari where kanal = 'instagram'`)).z)).toBeGreaterThan(Date.now() - 5_000);
    expect((await tek<{ z: string | null }>(`select son_webhook_zamani z from public.kanal_ayarlari where kanal = 'whatsapp'`)).z).toBeNull();
  });

  it("bot_kullanim: deneme satırı konuşmasız ve kanalsız olabilir; konuşma turu konuşmasız olamaz; günlük toplamda sayılır", async () => {
    await db.query(`insert into public.bot_kullanim (tur, kanal, model, istem_surumu, maliyet_usd, sonuc) values ('deneme', 'whatsapp', 'm', 'p2.4-1/taslak', 0.25, 'cevap')`);
    await db.query(`insert into public.bot_kullanim (tur, model, istem_surumu, sonuc) values ('cikarim', 'm', 'x', 'cevap')`);
    await expect(db.query(`insert into public.bot_kullanim (model, istem_surumu, sonuc) values ('m', 'x', 'cevap')`)).rejects.toThrow(/tur_konusma_check/);
    await expect(db.query(`insert into public.bot_kullanim (tur, konusma_id, model, istem_surumu, sonuc) values ('deneme', 1, 'm', 'x', 'cevap')`)).rejects.toThrow(/check|foreign key/);
    expect((await tek<{ t: number }>(`select sum(maliyet_usd)::float t from public.bot_kullanim where created_at >= now() - interval '1 minute'`)).t).toBeCloseTo(0.25);
  });
});
