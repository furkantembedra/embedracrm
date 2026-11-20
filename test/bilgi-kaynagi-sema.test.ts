// P2.4b şeması (20261120200000_bot_bilgi_kaynaklari.sql), gerçek Postgres 17'de (PGlite):
//  • RLS: CRM ekibi (Satış) listeyi okur, eklemez / değiştiremez; Yönetici ekler; kimse silemez; anon göremez
//  • bot_bilgi_kaynagi_durumu: taslak bota gitmez (aktif sürümde yok); onay aktif sürümün KOPYASI olan yeni sürüm açar
//    ve kaynağı ekler; devre dışı çıkarır; ret sürüm açmaz; geçersiz geçişler reddedilir; Satış çağıramaz
//  • P2.4 ile uyum: elle kayıtta kaynaklar taşınır, önceki sürüme dönüş o sürümdeki kaynaklara döner
//  • Storage: özel bucket (4 MB, tür listesi), yalnızca Yönetici dosya yazar / okur
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";
import { bilgiKaynaklariOku, VARSAYILAN_AYARLAR } from "@/components/bot/ayar-surumu";
import { sabitSistemIstemi } from "@/components/bot/istem";

const YONETICI = "11111111-1111-4111-8111-111111111111"; // kullanicilar.id = 1 (Yönetici)
const SATIS = "22222222-2222-4222-8222-222222222222"; // kullanicilar.id = 2 (Satış)

let db: PGlite;

beforeAll(async () => {
  db = await bosVeritabani();
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'y@embedra.com', now()), ($2, 's@embedra.com', now())`, [YONETICI, SATIS]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 1`, [YONETICI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 2`, [SATIS]);
  // Supabase'de authenticated rolü storage.objects üzerinde tablo yetkisine sahiptir; erişimi politikalar belirler
  await db.exec(`grant select, insert, update, delete on storage.objects to authenticated`);
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec(`update public.bot_ayarlari set aktif_surum_id = null; delete from public.bot_istem_surumleri; delete from public.bot_bilgi_kaynaklari; delete from storage.objects;`);
});

const tek = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

/** Yönetici oturumuyla, kalıcı (işlem içinde commit) */
async function yonetici<T>(sql: string, p: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [YONETICI]);
    await tx.exec(`set local role authenticated`);
    return (await tx.query<T>(sql, p)).rows;
  });
}

const kaynakEkle = async (baslik: string, metin: string, hedef = "bilgi_bankasi") =>
  (await yonetici<{ id: number }>(`insert into public.bot_bilgi_kaynaklari (baslik, hedef, girdi_turu, dosya_adi, dosya_turu, dosya_boyutu, taslak_metin, yukleyen_id)
    values ($1, $2, 'pdf', 'sss.pdf', 'application/pdf', 1200, $3, 1) returning id::int`, [baslik, hedef, metin]))[0].id;
const durum = async (id: number, d: string, baslik: string | null = null, metin: string | null = null) =>
  (await yonetici<{ r: number | null }>(`select public.bot_bilgi_kaynagi_durumu($1, $2, $3, $4, 1) r`, [id, d, baslik, metin]))[0].r;
const aktifKaynaklar = async () =>
  (await tek<{ k: unknown }>(`select s.bilgi_kaynaklari k from public.bot_ayarlari b left join public.bot_istem_surumleri s on s.id = b.aktif_surum_id`))?.k ?? null;
const elleKaydet = (botAdi: string, geri: number | null = null) =>
  yonetici(`select * from public.bot_istem_surumu_kaydet($1, 'Merhaba', '', 'Garanti 2 yıl', '', '', '{}'::jsonb, '', null, 1, $2)`, [botAdi, geri]);

describe("bilgi kaynağı kayıtları ve RLS", () => {
  it("Yönetici ekler; Satış okur ama ekleyemez / güncelleyemez; kimse silemez; anon göremez", async () => {
    const id = await kaynakEkle("SSS", "Garanti 2 yıldır.");
    expect(await rolIle(db, "authenticated", SATIS, `select baslik, durum from public.bot_bilgi_kaynaklari`)).toEqual([{ baslik: "SSS", durum: "taslak" }]);
    await expect(rolIle(db, "authenticated", SATIS, `insert into public.bot_bilgi_kaynaklari (baslik, hedef, girdi_turu) values ('x', 'itirazlar', 'metin')`)).rejects.toThrow(/row-level security/);
    expect(await rolIle(db, "authenticated", SATIS, `update public.bot_bilgi_kaynaklari set durum = 'onayli' returning id`)).toEqual([]);
    expect(await rolIle(db, "authenticated", YONETICI, `delete from public.bot_bilgi_kaynaklari returning id`)).toEqual([]);
    await expect(rolIle(db, "anon", null, `select * from public.bot_bilgi_kaynaklari`)).rejects.toThrow(/permission denied/);
    expect((await tek<{ d: string }>(`select durum d from public.bot_bilgi_kaynaklari where id = $1`, [id])).d).toBe("taslak");
  });

  it("kısıtlar: hedef / tür / durum listesi, boş başlık, taslak üst sınırı", async () => {
    await expect(db.query(`insert into public.bot_bilgi_kaynaklari (baslik, hedef, girdi_turu) values ('x', 'fiyat', 'pdf')`)).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.bot_bilgi_kaynaklari (baslik, hedef, girdi_turu) values ('x', 'itirazlar', 'docx')`)).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.bot_bilgi_kaynaklari (baslik, hedef, girdi_turu) values ('  ', 'itirazlar', 'pdf')`)).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.bot_bilgi_kaynaklari (baslik, hedef, girdi_turu, taslak_metin) values ('x', 'itirazlar', 'pdf', repeat('a', 60001))`)).rejects.toThrow(/check/);
  });
});

describe("onay, ret, devre dışı ve sürümler", () => {
  it("onaysız taslak bota girmez: aktif sürümde yok, sabit istemde yok; onaylanınca yeni sürümle girer", async () => {
    await elleKaydet("Asistan");
    const id = await kaynakEkle("Garanti SSS", "TASLAK-GIZLI garanti metni");
    const once = bilgiKaynaklariOku(await aktifKaynaklar());
    expect(once).toEqual([]);
    expect(sabitSistemIstemi(VARSAYILAN_AYARLAR, once)).not.toContain("TASLAK-GIZLI");

    const no = await durum(id, "onayli", "Garanti (düzenlendi)", "ONAYLI garanti metni");
    expect(no).toBe(2);
    const sonra = bilgiKaynaklariOku(await aktifKaynaklar());
    expect(sonra).toEqual([{ id, baslik: "Garanti (düzenlendi)", hedef: "bilgi_bankasi", metin: "ONAYLI garanti metni" }]);
    expect(sabitSistemIstemi(VARSAYILAN_AYARLAR, sonra)).toContain("ONAYLI garanti metni");
    // Yeni sürüm aktif sürümün ayarlarını taşır; açıklama ve onaylayan yazılır
    expect(await tek(`select bot_adi, bilgi_bankasi, aciklama, olusturan_id::int o from public.bot_istem_surumleri where surum_no = 2`))
      .toEqual({ bot_adi: "Asistan", bilgi_bankasi: "Garanti 2 yıl", aciklama: "Bilgi kaynağı onaylandı: Garanti (düzenlendi)", o: 1 });
    expect(await tek(`select durum, onaylayan_id::int o, taslak_metin from public.bot_bilgi_kaynaklari where id = $1`, [id]))
      .toEqual({ durum: "onayli", o: 1, taslak_metin: "ONAYLI garanti metni" });
  });

  it("devre dışı bırakma kaynağı aktif sürümden çıkarır (yeni sürüm); yeniden etkinleştirme geri ekler; ret sürüm açmaz", async () => {
    const a = await kaynakEkle("A", "metin a");
    const b = await kaynakEkle("B", "metin b", "itirazlar");
    const c = await kaynakEkle("C", "metin c");
    expect(await durum(a, "onayli")).toBe(1); // henüz sürüm yokken de çalışır (varsayılan ayarlarla)
    expect(await durum(b, "onayli")).toBe(2);
    expect(await durum(c, "reddedildi")).toBeNull();
    expect((bilgiKaynaklariOku(await aktifKaynaklar())).map((k) => k.id)).toEqual([a, b]);
    expect(await durum(a, "devre_disi")).toBe(3);
    expect((bilgiKaynaklariOku(await aktifKaynaklar())).map((k) => k.id)).toEqual([b]);
    expect(await durum(a, "onayli")).toBe(4);
    expect((bilgiKaynaklariOku(await aktifKaynaklar())).map((k) => k.id)).toEqual([b, a]);
    expect((await tek<{ n: number }>(`select count(*)::int n from public.bot_istem_surumleri`)).n).toBe(4);
  });

  it("geçersiz geçişler: reddedileni onaylama, taslağı devre dışı bırakma, dosyası bekleyeni onaylama, boş taslak, bilinmeyen durum", async () => {
    const r = await kaynakEkle("R", "x");
    await durum(r, "reddedildi");
    await expect(durum(r, "onayli")).rejects.toThrow(/onaylanamaz/);
    const t = await kaynakEkle("T", "x");
    await expect(durum(t, "devre_disi")).rejects.toThrow(/Yalnızca onaylı/);
    await expect(durum(t, "sil")).rejects.toThrow(/Geçersiz durum/);
    await yonetici(`update public.bot_bilgi_kaynaklari set dosya_yolu = 'abc.csv' where id = $1`, [t]);
    await expect(durum(t, "onayli")).rejects.toThrow(/metne çevrilmedi/);
    const bos = await kaynakEkle("Boş", "");
    await expect(durum(bos, "onayli")).rejects.toThrow(/Boş kaynak/);
    await expect(durum(999_999, "onayli")).rejects.toThrow(/bulunamadı/);
  });

  it("Satış durum değiştiremez (yetki hatası); kaba toplam sınırı SQL'de de var", async () => {
    const id = await kaynakEkle("S", "x");
    await expect(rolIle(db, "authenticated", SATIS, `select public.bot_bilgi_kaynagi_durumu(${id}, 'onayli', null, null, 2)`)).rejects.toThrow(/yetkiniz yok/);
    await expect(rolIle(db, "anon", null, `select public.bot_bilgi_kaynagi_durumu(${id}, 'onayli', null, null, 2)`)).rejects.toThrow(/permission denied/);
    const buyuk = await kaynakEkle("Büyük", "a".repeat(40_001));
    await expect(durum(buyuk, "onayli")).rejects.toThrow(/toplam sınırı/);
    expect((await tek<{ d: string }>(`select durum d from public.bot_bilgi_kaynaklari where id = $1`, [buyuk])).d).toBe("taslak"); // işlem geri alındı
  });

  it("P2.4 uyumu: elle kayıt kaynakları taşır; önceki sürüme dönüş o sürümdeki kaynaklara döner", async () => {
    await elleKaydet("A"); // 1
    const id = await kaynakEkle("SSS", "sss metni");
    await durum(id, "onayli"); // 2
    await elleKaydet("B"); // 3: kaynak taşınır
    expect(bilgiKaynaklariOku(await aktifKaynaklar()).map((k) => k.id)).toEqual([id]);
    await elleKaydet("x", 1); // 4: sürüm 1'e dönüş, kaynak yok
    expect(bilgiKaynaklariOku(await aktifKaynaklar())).toEqual([]);
    // Kaynak kaydı hâlâ "onayli" (arayüz "Aktif sürümde değil" gösterir); devre dışı bırakmak sürüm açmaz (dizi değişmez)
    expect(await durum(id, "devre_disi")).toBeNull();
    expect(await durum(id, "onayli")).toBe(5);
    expect(bilgiKaynaklariOku(await aktifKaynaklar()).map((k) => k.id)).toEqual([id]);
  });
});

describe("Storage", () => {
  it("özel bucket: public değil, 4 MB, yalnızca PDF / PNG / JPEG / CSV / XLSX", async () => {
    expect(await tek(`select public, file_size_limit::int s, allowed_mime_types m from storage.buckets where id = 'bot-bilgi-kaynaklari'`)).toEqual({
      public: false, s: 4 * 1024 * 1024,
      m: ["application/pdf", "image/png", "image/jpeg", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    });
  });

  it("dosyayı yalnızca Yönetici yazar ve okur; Satış ne yazar ne görür", async () => {
    await expect(rolIle(db, "authenticated", SATIS, `insert into storage.objects (bucket_id, name) values ('bot-bilgi-kaynaklari', 'a.pdf')`)).rejects.toThrow(/row-level security/);
    await yonetici(`insert into storage.objects (bucket_id, name) values ('bot-bilgi-kaynaklari', 'a.pdf')`);
    expect(await rolIle(db, "authenticated", SATIS, `select name from storage.objects where bucket_id = 'bot-bilgi-kaynaklari'`)).toEqual([]);
    expect(await rolIle(db, "authenticated", YONETICI, `select name from storage.objects where bucket_id = 'bot-bilgi-kaynaklari'`)).toEqual([{ name: "a.pdf" }]);
    expect(await rolIle(db, "authenticated", YONETICI, `delete from storage.objects where bucket_id = 'bot-bilgi-kaynaklari' returning name`)).toEqual([{ name: "a.pdf" }]);
  });
});
