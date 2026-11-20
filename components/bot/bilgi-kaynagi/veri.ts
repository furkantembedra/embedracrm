// P2.4b bilgi kaynaklarının veri katmanı (Supabase tablo + özel Storage bucket'ı). Yalnızca sunucuda. Yazma işlemleri
// oturumdaki Yönetici'nin istemcisiyle (RLS ve Storage politikası da yalnızca Yönetici'ye izin verir).
import { db, sonuc } from "@/lib/supabase/db";
import type { BilgiKaynagi } from "../ayar-surumu";
import { isaretleriOku, type Isaret } from "./maskele";
import type { GirdiTuru } from "./dosya";

export const BUCKET = "bot-bilgi-kaynaklari";
/** Bu süreden eski, hâlâ ham dosyası duran kayıtlar yetim sayılır (eşleme yarım kaldı ya da işlem çöktü) */
export const YETIM_SURE_MS = 60 * 60 * 1000;

export type KaynakDurumu = "taslak" | "onayli" | "reddedildi" | "devre_disi";

export type KaynakKaydi = {
  id: number;
  baslik: string;
  hedef: BilgiKaynagi["hedef"];
  girdi: GirdiTuru;
  dosyaAdi: string | null;
  dosyaTuru: string | null;
  dosyaBoyutu: number | null;
  /** Ham dosya hâlâ Storage'da (CSV / Excel sütun eşlemesi bekliyor) */
  dosyaBekliyor: boolean;
  metin: string;
  isaretler: Isaret[];
  maskelenen: number;
  maliyetUsd: number;
  durum: KaynakDurumu;
  yukleyen: string | null;
  onaylayan: string | null;
  onayZamani: string | null;
  zaman: string;
};

const ALANLAR = `id, baslik, hedef, girdi_turu, dosya_adi, dosya_turu, dosya_boyutu, dosya_yolu, taslak_metin, isaretler, maskelenen,
  cikarim_maliyet_usd, durum, onay_zamani, created_at,
  yukleyen:kullanicilar!bot_bilgi_kaynaklari_yukleyen_id_fkey(k_ad), onaylayan:kullanicilar!bot_bilgi_kaynaklari_onaylayan_id_fkey(k_ad)`;

type Satir = {
  id: number; baslik: string; hedef: BilgiKaynagi["hedef"]; girdi_turu: GirdiTuru; dosya_adi: string | null; dosya_turu: string | null;
  dosya_boyutu: number | null; dosya_yolu: string | null; taslak_metin: string; isaretler: unknown; maskelenen: number;
  cikarim_maliyet_usd: number | string; durum: KaynakDurumu; onay_zamani: string | null; created_at: string;
  yukleyen: { k_ad: string } | null; onaylayan: { k_ad: string } | null;
};

const oku = (r: Satir): KaynakKaydi => ({
  id: Number(r.id), baslik: r.baslik, hedef: r.hedef, girdi: r.girdi_turu, dosyaAdi: r.dosya_adi, dosyaTuru: r.dosya_turu,
  dosyaBoyutu: r.dosya_boyutu, dosyaBekliyor: !!r.dosya_yolu, metin: r.taslak_metin, isaretler: isaretleriOku(r.isaretler),
  maskelenen: r.maskelenen, maliyetUsd: Number(r.cikarim_maliyet_usd), durum: r.durum, yukleyen: r.yukleyen?.k_ad ?? null,
  onaylayan: r.onaylayan?.k_ad ?? null, onayZamani: r.onay_zamani ? new Date(r.onay_zamani).toISOString() : null,
  zaman: new Date(r.created_at).toISOString(),
});

/** Tüm kaynaklar (yeniden eskiye) */
export async function kaynakListesi(limit = 200): Promise<KaynakKaydi[]> {
  const s = await db();
  const r = (sonuc(await s.from("bot_bilgi_kaynaklari").select(ALANLAR).order("id", { ascending: false }).limit(limit), "Bilgi kaynakları okunurken") ?? []) as unknown as Satir[];
  return r.map(oku);
}

export async function kaynakGetir(id: number): Promise<(KaynakKaydi & { dosyaYolu: string | null }) | null> {
  const s = await db();
  const r = sonuc(await s.from("bot_bilgi_kaynaklari").select(ALANLAR).eq("id", id).maybeSingle(), "Bilgi kaynağı okunurken") as unknown as Satir | null;
  return r ? { ...oku(r), dosyaYolu: r.dosya_yolu } : null;
}

export type YeniKaynak = {
  baslik: string; hedef: BilgiKaynagi["hedef"]; girdi: GirdiTuru; dosyaAdi: string | null; dosyaTuru: string | null;
  dosyaBoyutu: number | null; dosyaYolu: string | null; metin: string; isaretler: Isaret[]; maskelenen: number; yukleyenId: number | null;
};

export async function kaynakEkle(k: YeniKaynak): Promise<number> {
  const s = await db();
  const r = sonuc(
    await s.from("bot_bilgi_kaynaklari").insert({
      baslik: k.baslik, hedef: k.hedef, girdi_turu: k.girdi, dosya_adi: k.dosyaAdi, dosya_turu: k.dosyaTuru, dosya_boyutu: k.dosyaBoyutu,
      dosya_yolu: k.dosyaYolu, taslak_metin: k.metin, isaretler: k.isaretler, maskelenen: k.maskelenen, yukleyen_id: k.yukleyenId,
    }).select("id").single(),
    "Bilgi kaynağı kaydedilirken",
  ) as { id: number };
  return Number(r.id);
}

/** Taslağı günceller (yalnızca taslak durumdaki kayıt; RLS yalnızca Yönetici) */
export async function taslakYaz(
  id: number,
  y: { baslik?: string; metin?: string; isaretler?: Isaret[]; maskelenen?: number; maliyetEkle?: number; dosyaYoluSil?: boolean; durum?: "reddedildi" },
): Promise<boolean> {
  const s = await db();
  const guncelle: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (y.baslik !== undefined) guncelle.baslik = y.baslik;
  if (y.metin !== undefined) guncelle.taslak_metin = y.metin;
  if (y.isaretler !== undefined) guncelle.isaretler = y.isaretler;
  if (y.maskelenen !== undefined) guncelle.maskelenen = y.maskelenen;
  if (y.dosyaYoluSil) guncelle.dosya_yolu = null;
  if (y.durum) guncelle.durum = y.durum;
  if (y.maliyetEkle) {
    const eski = await kaynakGetir(id);
    guncelle.cikarim_maliyet_usd = Math.round(((eski?.maliyetUsd ?? 0) + y.maliyetEkle) * 1e6) / 1e6;
  }
  const r = sonuc(await s.from("bot_bilgi_kaynaklari").update(guncelle).eq("id", id).eq("durum", "taslak").select("id"), "Bilgi kaynağı güncellenirken") as { id: number }[];
  return r.length > 0;
}

/** Onay / ret / devre dışı (SQL: bot_bilgi_kaynagi_durumu). Açılan ayar sürümünün numarası ya da null. */
export async function kaynakDurumuYaz(
  id: number, durum: "onayli" | "reddedildi" | "devre_disi", y: { baslik?: string | null; metin?: string | null }, kullaniciId: number | null,
): Promise<number | null> {
  const s = await db();
  const r = sonuc(
    await s.rpc("bot_bilgi_kaynagi_durumu", { p_kaynak_id: id, p_durum: durum, p_baslik: y.baslik ?? null, p_metin: y.metin ?? null, p_kullanici_id: kullaniciId }),
    "Bilgi kaynağı durumu değiştirilirken",
  ) as number | null;
  return r == null ? null : Number(r);
}

/* ---------------- Storage (özel bucket) ---------------- */

export async function dosyaYukle(yol: string, veri: Uint8Array, mime: string): Promise<void> {
  const s = await db();
  const r = await s.storage.from(BUCKET).upload(yol, veri, { contentType: mime, upsert: false });
  if (r.error) throw new Error(`Dosya Storage'a yüklenemedi: ${r.error.message}`);
}

export async function dosyaIndir(yol: string): Promise<Uint8Array | null> {
  const s = await db();
  const r = await s.storage.from(BUCKET).download(yol);
  if (r.error || !r.data) return null;
  return new Uint8Array(await r.data.arrayBuffer());
}

/** Ham dosyayı siler (KVKK: metin çıkarıldıktan sonra yalnızca kayıt bilgisi kalır) */
export async function dosyaSil(yol: string): Promise<void> {
  const s = await db();
  const r = await s.storage.from(BUCKET).remove([yol]);
  if (r.error) throw new Error(`Dosya Storage'dan silinemedi: ${r.error.message}`);
}

/**
 * Yetim ham dosyalar: belirli süreden eski ve hâlâ dosyası olan kayıtların dosyası silinir, taslak reddedilir.
 * Her yüklemede çağrılır (Yönetici oturumuyla). Silinen kayıt sayısını döner.
 */
export async function yetimDosyalariTemizle(simdi = new Date()): Promise<number> {
  const s = await db();
  const sinir = new Date(simdi.getTime() - YETIM_SURE_MS).toISOString();
  const r = (sonuc(
    await s.from("bot_bilgi_kaynaklari").select("id, dosya_yolu").not("dosya_yolu", "is", null).lt("created_at", sinir).limit(50),
    "Yetim bilgi kaynağı dosyaları okunurken",
  ) ?? []) as { id: number; dosya_yolu: string }[];
  if (!r.length) return 0;
  const sil = await s.storage.from(BUCKET).remove(r.map((x) => x.dosya_yolu));
  if (sil.error) throw new Error(`Yetim dosyalar silinemedi: ${sil.error.message}`);
  sonuc(
    await s.from("bot_bilgi_kaynaklari").update({ dosya_yolu: null, durum: "reddedildi", updated_at: new Date().toISOString() })
      .in("id", r.map((x) => x.id)).eq("durum", "taslak"),
    "Yetim bilgi kaynakları kapatılırken",
  );
  // Durumu taslak olmayan (beklenmez) kayıtlarda yalnızca yol temizlenir
  sonuc(await s.from("bot_bilgi_kaynaklari").update({ dosya_yolu: null }).in("id", r.map((x) => x.id)), "Yetim dosya yolları temizlenirken");
  return r.length;
}

/** Bugünkü çıkarım maliyeti (bot_kullanim, tur = cikarim; İstanbul günü) */
export async function bugunkuCikarimMaliyeti(gunBasi: string): Promise<number> {
  const s = await db();
  const r = (sonuc(
    await s.from("bot_kullanim").select("maliyet_usd").eq("tur", "cikarim").gte("created_at", gunBasi).limit(10_000),
    "Çıkarım maliyeti okunurken",
  ) ?? []) as { maliyet_usd: number | string }[];
  return r.reduce((t, x) => t + Number(x.maliyet_usd), 0);
}
