"use server";
// CRM: bayi dokümanı yükleme / silme, duyuru yayınlama / silme.
// Yalnızca Yönetici ve Pazarlama rolleri (rolEksik; oturum yoksa hata fırlatır).
import { rolEksik } from "@/lib/oturum";

const ROLLER = ["Yönetici", "Pazarlama"] as const;
import { revalidatePath } from "next/cache";
import { getAktifBayiler } from "@/components/bayiler/queries";
import { simdiYerel } from "@/components/rma/islemler";
import { dokumanEkle, dokumanSilDepo, duyuruEkle, duyuruSilDepo } from "./queries";
import { DOKUMAN_KATEGORILERI, DOKUMAN_SINIRI, DOSYA_TIPLERI, type BayiDokumani, type DokumanKategorisi, type Duyuru } from "./ortak";

export type DokumanFormDurumu = { hatalar?: Record<string, string>; tamam?: string; zaman?: number };

const yenile = () => { revalidatePath("/bayiler/dokumanlar"); revalidatePath("/portal/dokumanlar"); revalidatePath("/portal"); };
const kirp = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);

async function hedefOku(form: FormData): Promise<"hepsi" | string[] | null> {
  if (form.get("hedefTur") !== "secili") return "hepsi";
  const gecerli = new Set((await getAktifBayiler()).map((b) => b.id));
  const secilen = form.getAll("bayi").map(String).filter((x) => gecerli.has(x));
  return secilen.length ? secilen : null;
}

export async function dokumanYukle(_o: DokumanFormDurumu, form: FormData): Promise<DokumanFormDurumu> {
  const yetki = await rolEksik(ROLLER);
  if (yetki) return { hatalar: { genel: yetki } };
  const baslik = kirp(form.get("baslik"), 120);
  const kategori = kirp(form.get("kategori"), 40) as DokumanKategorisi;
  const dosya = form.get("dosya");
  const hatalar: Record<string, string> = {};
  if (baslik.length < 3) hatalar.baslik = "Başlık girin.";
  if (!DOKUMAN_KATEGORILERI.includes(kategori)) hatalar.kategori = "Kategori seçin.";
  if (!(dosya instanceof File) || dosya.size === 0) hatalar.dosya = "Dosya seçin.";
  else if (!(dosya.type in DOSYA_TIPLERI)) hatalar.dosya = "PDF, görsel (JPG, PNG, WEBP) ya da video (MP4, WEBM) yükleyin.";
  else if (dosya.size > DOKUMAN_SINIRI) hatalar.dosya = "Dosya 4 MB'tan büyük olamaz.";
  const hedef = await hedefOku(form);
  if (!hedef) hatalar.hedef = "En az bir bayi seçin.";
  if (Object.keys(hatalar).length || !(dosya instanceof File) || !hedef) return { hatalar };

  const d: BayiDokumani = {
    id: crypto.randomUUID(), baslik, aciklama: kirp(form.get("aciklama"), 300), kategori, tur: DOSYA_TIPLERI[dosya.type],
    dosyaAdi: dosya.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 100), mime: dosya.type, boyut: dosya.size,
    tarih: simdiYerel().slice(0, 10), hedef, sure: kategori === "Eğitim" ? kirp(form.get("sure"), 20) || undefined : undefined,
  };
  await dokumanEkle(d, new Uint8Array(await dosya.arrayBuffer()));
  yenile();
  return { tamam: `${baslik} yüklendi ve ${hedef === "hepsi" ? "tüm bayilerle" : `${hedef.length} bayiyle`} paylaşıldı.`, zaman: Date.now() };
}

export async function dokumanSil(id: string): Promise<{ hata?: string }> {
  const yetki = await rolEksik(ROLLER);
  if (yetki) return { hata: yetki };
  await dokumanSilDepo(id);
  yenile();
  return {};
}

export async function duyuruYayinla(_o: DokumanFormDurumu, form: FormData): Promise<DokumanFormDurumu> {
  const yetki = await rolEksik(ROLLER);
  if (yetki) return { hatalar: { genel: yetki } };
  const baslik = kirp(form.get("baslik"), 120);
  const metin = kirp(form.get("metin"), 1000);
  const hatalar: Record<string, string> = {};
  if (baslik.length < 3) hatalar.baslik = "Başlık girin.";
  if (metin.length < 10) hatalar.metin = "Duyuru metnini yazın.";
  const hedef = await hedefOku(form);
  if (!hedef) hatalar.hedef = "En az bir bayi seçin.";
  if (Object.keys(hatalar).length || !hedef) return { hatalar };
  const d: Duyuru = { id: crypto.randomUUID(), baslik, metin, onem: form.get("onem") === "onemli" ? "onemli" : "normal", tarih: simdiYerel(), hedef, okuyanlar: [] };
  await duyuruEkle(d);
  yenile();
  return { tamam: "Duyuru yayınlandı.", zaman: Date.now() };
}

export async function duyuruSil(id: string): Promise<{ hata?: string }> {
  const yetki = await rolEksik(ROLLER);
  if (yetki) return { hata: yetki };
  await duyuruSilDepo(id);
  yenile();
  return {};
}
