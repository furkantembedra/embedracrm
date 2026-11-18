// Bayi dokümanları, duyurular ve eğitim tamamlama kayıtları (Supabase).
// Tablolar: bayi_dokumanlari (+ bayi_dokuman_hedefleri), bayi_duyurulari (+ hedefleri, okumalari), bayi_egitim_tamamlamalari.
// Dosyalar Storage'da özel "bayi-dokumanlari" bucket'ında (bd_yol = "<id>/<dosya adı>"). Demo dokümanların (bd_demo) dosyası
// yoktur; indirmede ornekPdf ile üretilir. Doküman kimliği: bd_kod varsa o ("e-kurulum"), yoksa String(id).
// RLS: bayi yalnızca kendisine açık doküman / duyuruları ve kendi hedef / okuma / eğitim satırlarını görür.
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";
import type { BayiDokumani, DokumanKategorisi, DokumanTuru, Duyuru } from "./ortak";

const BUCKET = "bayi-dokumanlari";
const sayiMi = (id: string) => /^\d+$/.test(id);
const sayilar = (ids: string[]) => ids.filter(sayiMi).map(Number);

/* ---------- Dokümanlar ---------- */

const DOKUMAN_ALANLARI =
  "id, bd_kod, bd_baslik, bd_aciklama, bd_kategori, bd_tur, bd_dosya_adi, bd_mime, bd_boyut, bd_tarih, bd_hepsine, bd_sure, bd_demo, bd_yol, bayi_dokuman_hedefleri(bayi_id)";
type DokumanSatiri = {
  id: number; bd_kod: string | null; bd_baslik: string; bd_aciklama: string; bd_kategori: DokumanKategorisi; bd_tur: DokumanTuru;
  bd_dosya_adi: string; bd_mime: string | null; bd_boyut: number; bd_tarih: string; bd_hepsine: boolean; bd_sure: string | null;
  bd_demo: boolean; bd_yol: string | null; bayi_dokuman_hedefleri: { bayi_id: number }[];
};

function dokumanCevir(r: DokumanSatiri): BayiDokumani {
  const d: BayiDokumani = {
    id: r.bd_kod ?? String(r.id),
    baslik: r.bd_baslik,
    aciklama: r.bd_aciklama,
    kategori: r.bd_kategori,
    tur: r.bd_tur,
    dosyaAdi: r.bd_dosya_adi,
    boyut: Number(r.bd_boyut),
    tarih: r.bd_tarih,
    // Bayi oturumunda hedef listesinde yalnızca bayinin kendisi görünür (RLS); hedefteMi yine doğru çalışır
    hedef: r.bd_hepsine ? "hepsi" : r.bayi_dokuman_hedefleri.map((h) => String(h.bayi_id)),
  };
  if (r.bd_mime) d.mime = r.bd_mime;
  if (r.bd_sure) d.sure = r.bd_sure;
  if (r.bd_demo) d.demo = true;
  return d;
}

/** Domain kimliğine göre satır: "12" → id, "e-kurulum" → bd_kod */
async function dokumanSatiri(id: string): Promise<DokumanSatiri | null> {
  const s = await db();
  const q = s.from("bayi_dokumanlari").select(DOKUMAN_ALANLARI);
  return sonuc(await (sayiMi(id) ? q.eq("id", Number(id)) : q.eq("bd_kod", id)).maybeSingle(), "Bayi dokümanı okunuyordu") as DokumanSatiri | null;
}

export async function getDokumanlar() {
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_dokumanlari").select(DOKUMAN_ALANLARI).order("created_at", { ascending: false }).order("id"),
    "Bayi dokümanları okunuyordu",
  ) as DokumanSatiri[];
  return satirlar.map(dokumanCevir);
}

export async function getDokuman(id: string) {
  const r = await dokumanSatiri(id);
  return r ? dokumanCevir(r) : null;
}

/** Storage anahtarı: yalnızca güvenli ASCII karakterler (indirmedeki ad bd_dosya_adi'nden gelir) */
const anahtarAdi = (ad: string) => ad.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "dosya";

/** Yeni doküman: satır yazılır, dosya Storage'a yüklenir, hedef bayiler eklenir. Veritabanı id'si d.id'ye yazılır. */
export async function dokumanEkle(d: BayiDokumani, veri: Uint8Array) {
  const s = await db();
  const r = sonuc(
    await s.from("bayi_dokumanlari").insert({
      bd_baslik: d.baslik, bd_aciklama: d.aciklama, bd_kategori: d.kategori, bd_tur: d.tur, bd_dosya_adi: d.dosyaAdi,
      bd_mime: d.mime ?? null, bd_boyut: d.boyut, bd_tarih: d.tarih, bd_hepsine: d.hedef === "hepsi", bd_sure: d.sure ?? null, bd_demo: false,
    }).select("id").single(),
    "Bayi dokümanı kaydediliyordu",
  ) as { id: number };
  const yol = `${r.id}/${anahtarAdi(d.dosyaAdi)}`;
  const yukleme = await s.storage.from(BUCKET).upload(yol, veri, { contentType: d.mime ?? "application/octet-stream", upsert: false });
  if (yukleme.error) {
    await s.from("bayi_dokumanlari").delete().eq("id", r.id);
    throw new Error(`Doküman dosyası yüklenemedi: ${yukleme.error.message}`);
  }
  sonuc(await s.from("bayi_dokumanlari").update({ bd_yol: yol }).eq("id", r.id), "Doküman dosya yolu yazılıyordu");
  if (d.hedef !== "hepsi" && d.hedef.length) {
    sonuc(
      await s.from("bayi_dokuman_hedefleri").insert(sayilar(d.hedef).map((bayi_id) => ({ dokuman_id: r.id, bayi_id }))),
      "Dokümanın hedef bayileri yazılıyordu",
    );
  }
  d.id = String(r.id);
}

export async function dokumanSilDepo(id: string) {
  const r = await dokumanSatiri(id);
  if (!r) return;
  const s = await db();
  sonuc(await s.from("bayi_dokumanlari").delete().eq("id", r.id), "Bayi dokümanı siliniyordu");
  if (r.bd_yol) await s.storage.from(BUCKET).remove([r.bd_yol]); // dosya kalırsa yalnızca yer kaplar; satır silindiği için erişilemez
}

/** Yüklenmiş dosyanın içeriği; demo dokümanda (dosyası yok) null döner ve çağıran ornekPdf ile üretir */
export async function dokumanDosyasi(id: string): Promise<Uint8Array | null> {
  const r = await dokumanSatiri(id);
  if (!r?.bd_yol) return null;
  const s = await db();
  const { data, error } = await s.storage.from(BUCKET).download(r.bd_yol);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/* ---------- Duyurular ---------- */

const DUYURU_ALANLARI = "id, bdu_baslik, bdu_metin, bdu_onem, bdu_tarih, bdu_hepsine, bayi_duyuru_hedefleri(bayi_id), bayi_duyuru_okumalari(bayi_id)";
type DuyuruSatiri = {
  id: number; bdu_baslik: string; bdu_metin: string; bdu_onem: Duyuru["onem"]; bdu_tarih: string; bdu_hepsine: boolean;
  bayi_duyuru_hedefleri: { bayi_id: number }[]; bayi_duyuru_okumalari: { bayi_id: number }[];
};

const duyuruCevir = (r: DuyuruSatiri): Duyuru => ({
  id: String(r.id),
  baslik: r.bdu_baslik,
  metin: r.bdu_metin,
  onem: r.bdu_onem,
  tarih: yerelZaman(r.bdu_tarih),
  hedef: r.bdu_hepsine ? "hepsi" : r.bayi_duyuru_hedefleri.map((h) => String(h.bayi_id)),
  okuyanlar: r.bayi_duyuru_okumalari.map((o) => String(o.bayi_id)),
});

export async function getDuyurular() {
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_duyurulari").select(DUYURU_ALANLARI).order("bdu_tarih", { ascending: false }).order("id", { ascending: false }),
    "Bayi duyuruları okunuyordu",
  ) as DuyuruSatiri[];
  return satirlar.map(duyuruCevir);
}

export async function duyuruEkle(d: Duyuru) {
  const s = await db();
  const r = sonuc(
    await s.from("bayi_duyurulari").insert({
      bdu_baslik: d.baslik, bdu_metin: d.metin, bdu_onem: d.onem, bdu_tarih: d.tarih, bdu_hepsine: d.hedef === "hepsi",
    }).select("id").single(),
    "Duyuru kaydediliyordu",
  ) as { id: number };
  if (d.hedef !== "hepsi" && d.hedef.length) {
    sonuc(
      await s.from("bayi_duyuru_hedefleri").insert(sayilar(d.hedef).map((bayi_id) => ({ duyuru_id: r.id, bayi_id }))),
      "Duyurunun hedef bayileri yazılıyordu",
    );
  }
  d.id = String(r.id);
}

export async function duyuruSilDepo(id: string) {
  if (!sayiMi(id)) return;
  const s = await db();
  sonuc(await s.from("bayi_duyurulari").delete().eq("id", Number(id)), "Duyuru siliniyordu");
}

export async function duyuruOkundu(id: string, bayiId: string) {
  if (!sayiMi(id) || !sayiMi(bayiId)) return null;
  const s = await db();
  sonuc(
    await s.from("bayi_duyuru_okumalari").upsert({ duyuru_id: Number(id), bayi_id: Number(bayiId) }, { onConflict: "duyuru_id,bayi_id", ignoreDuplicates: true }),
    "Duyuru okundu işaretleniyordu",
  );
  const r = sonuc(await s.from("bayi_duyurulari").select(DUYURU_ALANLARI).eq("id", Number(id)).maybeSingle(), "Duyuru okunuyordu") as DuyuruSatiri | null;
  return r ? duyuruCevir(r) : null;
}

/* ---------- Eğitim tamamlama ---------- */

type EgitimSatiri = { bayi_id: number; bayi_dokumanlari: { id: number; bd_kod: string | null } | null };

/** Bayinin tamamladığı eğitim dokümanlarının kimlikleri ("e-kurulum" ya da "12") */
export async function getEgitimTamamlanan(bayiId: string) {
  if (!sayiMi(bayiId)) return [];
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_egitim_tamamlamalari").select("bayi_id, bayi_dokumanlari(id, bd_kod)").eq("bayi_id", Number(bayiId)),
    "Eğitim kayıtları okunuyordu",
  ) as unknown as EgitimSatiri[];
  return satirlar.flatMap((r) => (r.bayi_dokumanlari ? [r.bayi_dokumanlari.bd_kod ?? String(r.bayi_dokumanlari.id)] : []));
}

/** CRM: bayi → tamamlanan eğitim kimlikleri */
export async function getTumEgitimler() {
  const s = await db();
  const satirlar = sonuc(await s.from("bayi_egitim_tamamlamalari").select("bayi_id, bayi_dokumanlari(id, bd_kod)"), "Eğitim kayıtları okunuyordu") as unknown as EgitimSatiri[];
  const harita = new Map<string, string[]>();
  for (const r of satirlar) {
    if (!r.bayi_dokumanlari) continue;
    const liste = harita.get(String(r.bayi_id)) ?? [];
    liste.push(r.bayi_dokumanlari.bd_kod ?? String(r.bayi_dokumanlari.id));
    harita.set(String(r.bayi_id), liste);
  }
  return harita;
}

export async function egitimTamamla(bayiId: string, dokumanId: string, tamam: boolean) {
  const d = await dokumanSatiri(dokumanId);
  if (!d || !sayiMi(bayiId)) return;
  const s = await db();
  if (tamam) {
    sonuc(
      await s.from("bayi_egitim_tamamlamalari").upsert({ dokuman_id: d.id, bayi_id: Number(bayiId) }, { onConflict: "dokuman_id,bayi_id", ignoreDuplicates: true }),
      "Eğitim tamamlandı işaretleniyordu",
    );
  } else {
    sonuc(await s.from("bayi_egitim_tamamlamalari").delete().eq("dokuman_id", d.id).eq("bayi_id", Number(bayiId)), "Eğitim işareti kaldırılıyordu");
  }
}

/* ---------- Örnek PDF (demo dokümanlar ve sözleşme özeti için) ---------- */

// Standart PDF yazı tipleri Türkçe karakterleri içermez: ASCII'ye çevrilir
const ascii = (s: string) => s.replace(/[çÇğĞıİöÖşŞüÜăâîșțĂÂÎȘȚ€]/g, (c) => ({ ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U", ă: "a", â: "a", î: "i", ș: "s", ț: "t", Ă: "A", Â: "A", Î: "I", Ș: "S", Ț: "T", "€": "EUR" })[c] ?? c).replace(/[^\x20-\x7E]/g, "?");
const kacis = (s: string) => ascii(s).replace(/[\\()]/g, (c) => `\\${c}`);

/** Tek sayfalık basit PDF: başlık + satırlar */
export function ornekPdf(baslik: string, satirlar: string[]): Uint8Array {
  const icerik = [
    "BT /F1 20 Tf 56 780 Td (" + kacis(baslik) + ") Tj ET",
    "BT /F1 9 Tf 56 760 Td (Embedra Teknoloji - embedra.com) Tj ET",
    ...satirlar.slice(0, 48).map((s, i) => `BT /F1 11 Tf 56 ${728 - i * 15} Td (${kacis(s)}) Tj ET`),
  ].join("\n");
  const nesneler = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const konumlar: number[] = [];
  nesneler.forEach((n, i) => { konumlar.push(pdf.length); pdf += `${i + 1} 0 obj\n${n}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n${konumlar.map((k) => `${String(k).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
