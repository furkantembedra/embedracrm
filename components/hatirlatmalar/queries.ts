// Hatırlatmalar: elle eklenenler (fırsat, müşteri, bayi… detayından) + kurallardan otomatik üretilenler.
// Otomatik olanlar saklanmaz, her okumada güncel veriden hesaplanır; yalnızca "tamam / ertelendi" durumları tutulur.
// Veri Supabase'de: hatirlatmalar (elle eklenenler), hatirlatma_durumlari (otomatiklerin durumu), hatirlatma_okunanlar.
import { crmKullanicisi } from "@/lib/oturum";
import { db, sistemdeMi, kullaniciKimligi, kullaniciNo, sonuc, yerelZaman } from "@/lib/supabase/db";

/** sonuc() + boş olmayan veri (select / insert…select sonuçları; maybeSingle için sonuc kullanılır) */
const kesin = <T,>(r: { data: T; error: { message: string; code?: string } | null }, ne?: string) => sonuc(r, ne) as NonNullable<T>;

export type KayitTuru = "firsat" | "teklif" | "siparis" | "musteri" | "bayi" | "rma" | "stok" | "cihaz" | "destek";
export type Hatirlatma = {
  id: string; // elle: String(hatirlatmalar.id) · otomatik: "oto:<kural>:<kayıt>…"
  baslik: string;
  aciklama: string;
  kayit: { tur: KayitTuru; id: string; ad: string; href: string } | null;
  sorumluId: string; // Operasyon › Ekip kullanıcısı
  zaman: string; // "2026-11-10T09:00" (yerel)
  durum: "bekliyor" | "tamam";
  otomatik: boolean;
  onem: "normal" | "yuksek";
  tamamlanma?: string | null;
};

export type OtoDurum = { tamam?: string; ertelendi?: string }; // ertelendi: yeni zaman

/** Oturumdan kullanıcı bulunamazsa (ör. ekip kaydı auth hesabına bağlı değil) varsayılan: Operasyon › Ekip'teki ilk yönetici (u1). */
export const AKTIF_KULLANICI_ID = "u1";

/** Oturumdaki auth kullanıcısının ekip kaydı ("u" + kullanicilar.id); bulunamazsa (ör. zamanlayıcı) AKTIF_KULLANICI_ID.
 *  crmKullanicisi önbellekli ve yerel JWT doğrulamalı: Auth sunucusuna (getUser) ayrıca gidilmez. */
export async function aktifKullaniciId(): Promise<string> {
  if (sistemdeMi()) return AKTIF_KULLANICI_ID;
  try {
    return (await crmKullanicisi())?.id ?? AKTIF_KULLANICI_ID;
  } catch {
    return AKTIF_KULLANICI_ID;
  }
}

/* ---------- Satır → domain dönüşümleri ---------- */

type HatirlatmaSatiri = {
  id: number; h_baslik: string; h_aciklama: string; h_kayit_tur: KayitTuru | null; h_kayit_id: string | null; h_kayit_ad: string | null; h_kayit_href: string | null;
  sorumlu_id: number; h_zaman: string; h_durum: "bekliyor" | "tamam"; h_onem: "normal" | "yuksek"; h_tamamlanma: string | null;
};
const hatirlatmadan = (r: HatirlatmaSatiri): Hatirlatma => ({
  id: String(r.id),
  baslik: r.h_baslik,
  aciklama: r.h_aciklama,
  kayit: r.h_kayit_tur ? { tur: r.h_kayit_tur, id: r.h_kayit_id ?? "", ad: r.h_kayit_ad ?? "", href: r.h_kayit_href ?? "/" } : null,
  sorumluId: kullaniciKimligi(r.sorumlu_id),
  zaman: yerelZaman(r.h_zaman),
  durum: r.h_durum,
  otomatik: false,
  onem: r.h_onem,
  tamamlanma: r.h_tamamlanma ? yerelZaman(r.h_tamamlanma) : null,
});
const hatirlatmaSatiri = (h: Hatirlatma) => ({
  h_baslik: h.baslik,
  h_aciklama: h.aciklama,
  h_kayit_tur: h.kayit?.tur ?? null,
  h_kayit_id: h.kayit?.id ?? null,
  h_kayit_ad: h.kayit?.ad ?? null,
  h_kayit_href: h.kayit?.href ?? null,
  sorumlu_id: kullaniciNo(h.sorumluId),
  h_zaman: h.zaman,
  h_durum: h.durum,
  h_onem: h.onem,
  h_tamamlanma: h.tamamlanma || null,
});

/* ---------- Okuma ---------- */

export async function getElleHatirlatmalar(): Promise<Hatirlatma[]> {
  const s = await db();
  return (sonuc(await s.from("hatirlatmalar").select("*").order("id", { ascending: false }), "Hatırlatmalar okunuyor") as HatirlatmaSatiri[]).map(hatirlatmadan);
}
export async function getOtoDurumlar(): Promise<Record<string, OtoDurum>> {
  const s = await db();
  const satirlar = kesin(await s.from("hatirlatma_durumlari").select("anahtar, hd_tamam, hd_ertelendi"), "Hatırlatma durumları okunuyor");
  const sonucMap: Record<string, OtoDurum> = {};
  for (const r of satirlar) {
    const d: OtoDurum = {};
    if (r.hd_tamam) d.tamam = yerelZaman(r.hd_tamam);
    if (r.hd_ertelendi) d.ertelendi = yerelZaman(r.hd_ertelendi);
    sonucMap[r.anahtar] = d;
  }
  return sonucMap;
}
export async function getOkunanlar(): Promise<Set<string>> {
  const s = await db();
  const satirlar = kesin(await s.from("hatirlatma_okunanlar").select("anahtar").order("created_at", { ascending: false }).limit(500), "Okunan bildirimler okunuyor");
  return new Set(satirlar.map((r) => r.anahtar as string));
}

/* ---------- Yazma (actions.ts, otomasyon motoru ve portal işlemlerinden çağrılır) ---------- */

/** Hatırlatmayı ekler; veritabanının verdiği id nesnenin üstüne yazılır */
export async function hatirlatmaEkleDepo(h: Hatirlatma) {
  const s = await db();
  const r = await s.from("hatirlatmalar").insert(hatirlatmaSatiri(h)).select("id").single();
  // Bayi portalı temsilciye hatırlatma bırakabilir ama okuyamaz (RLS): returning'li insert reddedilir, id'siz yeniden yazılır
  if (r.error?.code === "42501") {
    sonuc(await s.from("hatirlatmalar").insert(hatirlatmaSatiri(h)), "Hatırlatma ekleniyor");
    return;
  }
  h.id = String(kesin(r, "Hatırlatma ekleniyor").id);
}
export async function elleGuncelle(id: string, f: (h: Hatirlatma) => void): Promise<Hatirlatma | null> {
  if (!/^\d+$/.test(id)) return null;
  const s = await db();
  const r = sonuc(await s.from("hatirlatmalar").select("*").eq("id", Number(id)).maybeSingle(), "Hatırlatma okunuyor") as HatirlatmaSatiri | null;
  if (!r) return null;
  const h = hatirlatmadan(r);
  f(h);
  sonuc(await s.from("hatirlatmalar").update(hatirlatmaSatiri(h)).eq("id", r.id), "Hatırlatma güncelleniyor");
  return h;
}
/** Otomatik hatırlatmanın durumu (anahtar = "oto:…" kimliği); null → kayıt silinir */
export async function otoDurumKaydet(id: string, d: OtoDurum | null) {
  const s = await db();
  if (!d || (!d.tamam && !d.ertelendi)) {
    sonuc(await s.from("hatirlatma_durumlari").delete().eq("anahtar", id), "Hatırlatma durumu siliniyor");
    return;
  }
  sonuc(
    await s.from("hatirlatma_durumlari").upsert({ anahtar: id, hd_tamam: d.tamam ?? null, hd_ertelendi: d.ertelendi ?? null, updated_at: new Date().toISOString() }),
    "Hatırlatma durumu kaydediliyor",
  );
}
/** Okundu işaretleri; en yeni 500 anahtar tutulur */
export async function okunduIsaretle(ids: string[]) {
  const temiz = [...new Set(ids)];
  if (!temiz.length) return;
  const s = await db();
  sonuc(
    await s.from("hatirlatma_okunanlar").upsert(temiz.map((anahtar) => ({ anahtar })), { onConflict: "anahtar", ignoreDuplicates: true }),
    "Bildirimler okundu işaretleniyor",
  );
  const sinir = kesin(await s.from("hatirlatma_okunanlar").select("created_at").order("created_at", { ascending: false }).range(499, 499), "Okunan bildirimler okunuyor");
  if (sinir.length) sonuc(await s.from("hatirlatma_okunanlar").delete().lt("created_at", sinir[0].created_at), "Eski okundu işaretleri siliniyor");
}
