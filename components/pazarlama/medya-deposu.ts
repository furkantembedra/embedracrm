// İçerik görselleri / videoları: dosya Supabase Storage'da ("pazarlama-medya" bucket, nesne yolu = medya_dosyalari.id),
// bilgisi medya_dosyalari tablosunda. Yalnızca sunucuda (api/medya rotaları, pazarlama action'ları) import edin.
import { db, sonuc } from "@/lib/supabase/db";

/** sonuc() + boş olmayan veri (select / insert…select sonuçları; maybeSingle için sonuc kullanılır) */
const kesin = <T,>(r: { data: T; error: { message: string; code?: string } | null }, ne?: string) => sonuc(r, ne) as NonNullable<T>;

export type MedyaDosyasi = { ad: string; tip: string; veri: Uint8Array };

const BUCKET = "pazarlama-medya";
export const MEDYA_SINIRI = 25 * 1024 * 1024; // 25 MB
export const MEDYA_TIPLERI = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"];

/** Dosyayı Storage'a yükler, medya_dosyalari satırını açar ve kimliğini (uuid) döner */
export async function medyaKaydet(d: MedyaDosyasi): Promise<string> {
  const s = await db();
  const id = crypto.randomUUID();
  const yukleme = await s.storage.from(BUCKET).upload(id, d.veri, { contentType: d.tip, upsert: false });
  if (yukleme.error) throw new Error(`Medya yüklenemedi: ${yukleme.error.message}`);
  const kayit = await s.from("medya_dosyalari").insert({ id, md_ad: d.ad, md_tip: d.tip, md_boyut: d.veri.byteLength });
  if (kayit.error) {
    await s.storage.from(BUCKET).remove([id]); // satır açılamadıysa yetim dosya kalmasın
    sonuc(kayit, "Medya kaydı açılıyor");
  }
  return id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dosyayı (bilgisiyle) okur; yoksa ya da erişim yoksa null */
export async function medyaGetir(id: string): Promise<MedyaDosyasi | null> {
  if (!UUID.test(id)) return null;
  const s = await db();
  const r = sonuc(await s.from("medya_dosyalari").select("md_ad, md_tip").eq("id", id).maybeSingle(), "Medya bilgisi okunuyor");
  if (!r) return null;
  const indirme = await s.storage.from(BUCKET).download(id);
  if (indirme.error || !indirme.data) return null;
  return { ad: r.md_ad, tip: r.md_tip, veri: new Uint8Array(await indirme.data.arrayBuffer()) };
}

/** Verilen kimliklerden veritabanında kaydı olanlar (içerik kaydederken yalnızca gerçekten yüklenmiş dosyalar kabul edilir) */
export async function medyaVarOlanlar(idler: string[]): Promise<Set<string>> {
  const gecerli = [...new Set(idler.filter((x) => UUID.test(x)))];
  if (!gecerli.length) return new Set();
  const s = await db();
  const satirlar = kesin(await s.from("medya_dosyalari").select("id").in("id", gecerli), "Medya kayıtları okunuyor");
  return new Set(satirlar.map((r) => r.id as string));
}
