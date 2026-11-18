// Garanti & RMA (arıza / iade kabul): seri numarasıyla açılan servis kayıtları.
// Supabase: rma_kayitlari (domain id = r_no), rma_gecmisi, rma_ekleri (dosyalar Storage "rma-ekleri" bucket'ında),
// garanti_uzatmalari (cihaz_id ↔ cihazlar.c_serino), garanti süresi ayarlar['garanti_ay'].
import type { CihazModeli } from "@/lib/urunler";
import { RMA_ADIMLARI, ADIM_ADI, KARAR_ADI, ARIZA_TIPLERI, GELIS_KANALLARI, ONCELIKLER, HEDEF_GUN, UZATMA_AYLARI } from "./sabitler";
export { RMA_ADIMLARI, ADIM_ADI, KARAR_ADI, ARIZA_TIPLERI, GELIS_KANALLARI, ONCELIKLER, HEDEF_GUN, UZATMA_AYLARI };
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";

export type RmaAdimi = (typeof RMA_ADIMLARI)[number];

export type RmaKarari = "tamir" | "degisim" | "iade" | "red";

export type ArizaTipi = (typeof ARIZA_TIPLERI)[number];

/** RMA'ya eklenen fotoğraf / belge. Dosya Storage "rma-ekleri" bucket'ında ("<rma_kayitlari.id>/<uuid>-<ad>").
 *  veri: okurken 1 saatlik imzalı bağlantı (<img src> / indirme için); yeni eklenirken veri URL'si (data:…;base64) olabilir,
 *  kaydedilirken çözülüp yüklenir. _id / _yol: rma_ekleri.id ve re_yol (veritabanından gelen eklerde dolu). */
export type RmaEki = { id: string; ad: string; tip: string; boyut: number; veri: string; tarih: string; _id?: number; _yol?: string };

export type RmaKaydi = {
  id: string; // "RMA-0007"
  seriNo: string;
  model: CihazModeli;
  sahip: { tur: "musteri" | "bayi"; id: string | null; ad: string };
  arizaTipi: ArizaTipi;
  ariza: string;
  fotograflar: string[]; // eski kayıtlarda dosya adı ya da bağlantı
  ekler: RmaEki[]; // yüklenen fotoğraf / belgeler
  garantide: boolean; // otomatik hesap (satış tarihi + garanti süresi)
  garantiElle: boolean | null; // yönetici kararıyla kapsama alındı / çıkarıldı
  ucret: number | null; // garanti dışıysa servis ücreti (TL, KDV hariç)
  adim: RmaAdimi;
  karar: RmaKarari | null;
  kullanilanParcalar: Record<string, number>; // tamirde stoktan düşen bileşenler
  yeniSeri: string | null; // değişimde verilen cihaz
  destekTalebiId: string | null;
  iadeId: string | null; // iade kararında Sipariş › İadeler kaydı
  kaynak: "crm" | "bayi-portali";
  acilis: string; // "2026-11-04"
  kapanis: string | null; // tamamlandı / gönderildi tarihi
  gecmis: GecmisKaydi[]; // eskiden yeniye
  gelis: { kanal: GelisKanali; takipNo: string } | null; // cihaz servise nasıl geldi (teslim alınırken)
  kargo: { firma: string; takipNo: string } | null; // müşteriye geri gönderim
  ucretOdendi: boolean; // garanti dışı servis ücreti tahsil edildi mi
  ucretOnay: boolean; // garanti dışı servis ücretini müşteri onayladı mı (onaysız tamir / değişim kararı verilmez)
  oncelik: RmaOncelik;
};

/** sistem: adım / karar kaydı · not: iç teknik not · gorusme: müşteriyle yapılan görüşme */
// _id: rma_gecmisi.id (veritabanından gelen kayıtta dolu; kodun yeni eklediğinde boş → kaydedilirken insert edilir)
export type GecmisKaydi = { zaman: string; metin: string; tur?: "sistem" | "not" | "gorusme"; yazan?: string; _id?: number }; // zaman "2026-11-04T10:20"

export type GelisKanali = (typeof GELIS_KANALLARI)[number];

export type RmaOncelik = (typeof ONCELIKLER)[number];

/** Cihaza tanınan ek garanti (uzatılmış garanti paketi, jest vb.): standart süreye eklenir */
export type GarantiUzatma = { id: string; ay: number; tarih: string; not: string };

// ─────────────────────────────────────────────────────────────
// Satır ↔ domain dönüşümleri
// ─────────────────────────────────────────────────────────────

const BUCKET = "rma-ekleri";
const IMZA_SURESI = 60 * 60; // imzalı bağlantı: 1 saat

const RMA_SEC =
  "id, r_no, r_seri_no, r_model, r_sahip_tur, musteri_id, bayi_id, r_sahip_adi, r_ariza_tipi, r_ariza, r_fotograflar, r_garantide, " +
  "r_garanti_elle, r_ucret, r_adim, r_karar, r_kullanilan_parcalar, r_yeni_seri, destek_talebi_id, r_iade_no, r_kaynak, r_acilis, " +
  "r_kapanis, r_gelis_kanal, r_gelis_takip, r_kargo_firma, r_kargo_takip, r_ucret_odendi, r_ucret_onay, r_oncelik, " +
  "rma_gecmisi(id, rg_zaman, rg_metin, rg_tur, rg_yazan), rma_ekleri(id, re_ad, re_tip, re_boyut, re_yol, re_tarih)";

type GecmisSatiri = { id: number; rg_zaman: string; rg_metin: string; rg_tur: GecmisKaydi["tur"] | null; rg_yazan: string | null };
type EkSatiri = { id: number; re_ad: string; re_tip: string; re_boyut: number | string; re_yol: string; re_tarih: string };
type RmaSatiri = {
  id: number; r_no: string; r_seri_no: string; r_model: CihazModeli; r_sahip_tur: "musteri" | "bayi"; musteri_id: number | null;
  bayi_id: number | null; r_sahip_adi: string; r_ariza_tipi: ArizaTipi; r_ariza: string; r_fotograflar: string[] | null;
  r_garantide: boolean; r_garanti_elle: boolean | null; r_ucret: number | string | null; r_adim: RmaAdimi; r_karar: RmaKarari | null;
  r_kullanilan_parcalar: Record<string, number> | null; r_yeni_seri: string | null; destek_talebi_id: number | null; r_iade_no: string | null;
  r_kaynak: RmaKaydi["kaynak"]; r_acilis: string; r_kapanis: string | null; r_gelis_kanal: GelisKanali | null; r_gelis_takip: string | null;
  r_kargo_firma: string | null; r_kargo_takip: string | null; r_ucret_odendi: boolean; r_ucret_onay: boolean; r_oncelik: RmaOncelik;
  rma_gecmisi: GecmisSatiri[] | null; rma_ekleri: EkSatiri[] | null;
};

const sayiNo = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
const benzersizIhlali = (e: unknown) => e instanceof Error && /\(23505\)/.test(e.message);

function rmaCevir(r: RmaSatiri, imzalar: Map<string, string>): RmaKaydi {
  const sahipNo = r.r_sahip_tur === "bayi" ? r.bayi_id : r.musteri_id;
  return {
    id: r.r_no,
    seriNo: r.r_seri_no,
    model: r.r_model,
    sahip: { tur: r.r_sahip_tur, id: sahipNo != null ? String(sahipNo) : null, ad: r.r_sahip_adi },
    arizaTipi: r.r_ariza_tipi,
    ariza: r.r_ariza,
    fotograflar: r.r_fotograflar ?? [],
    ekler: [...(r.rma_ekleri ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((e) => ({ id: String(e.id), ad: e.re_ad, tip: e.re_tip, boyut: Number(e.re_boyut), veri: imzalar.get(e.re_yol) ?? "", tarih: yerelZaman(e.re_tarih), _id: e.id, _yol: e.re_yol })),
    garantide: r.r_garantide,
    garantiElle: r.r_garanti_elle,
    ucret: r.r_ucret == null ? null : Number(r.r_ucret),
    adim: r.r_adim,
    karar: r.r_karar,
    kullanilanParcalar: r.r_kullanilan_parcalar ?? {},
    yeniSeri: r.r_yeni_seri,
    destekTalebiId: r.destek_talebi_id != null ? String(r.destek_talebi_id) : null,
    iadeId: r.r_iade_no,
    kaynak: r.r_kaynak,
    acilis: r.r_acilis,
    kapanis: r.r_kapanis,
    gecmis: [...(r.rma_gecmisi ?? [])]
      .sort((a, b) => a.rg_zaman.localeCompare(b.rg_zaman) || a.id - b.id)
      .map((g) => ({ zaman: yerelZaman(g.rg_zaman), metin: g.rg_metin, ...(g.rg_tur ? { tur: g.rg_tur } : {}), ...(g.rg_yazan ? { yazan: g.rg_yazan } : {}), _id: g.id })),
    gelis: r.r_gelis_kanal ? { kanal: r.r_gelis_kanal, takipNo: r.r_gelis_takip ?? "" } : null,
    kargo: r.r_kargo_firma ? { firma: r.r_kargo_firma, takipNo: r.r_kargo_takip ?? "" } : null,
    ucretOdendi: r.r_ucret_odendi,
    ucretOnay: r.r_ucret_onay,
    oncelik: r.r_oncelik,
  };
}

/** Satırlardaki tüm eklere tek istekte imzalı bağlantı üretir (yol → URL) */
async function imzala(satirlar: RmaSatiri[]): Promise<Map<string, string>> {
  const yollar = satirlar.flatMap((r) => (r.rma_ekleri ?? []).map((e) => e.re_yol));
  const imzalar = new Map<string, string>();
  if (!yollar.length) return imzalar;
  const s = await db();
  const { data, error } = await s.storage.from(BUCKET).createSignedUrls(yollar, IMZA_SURESI);
  if (error) {
    console.error("RMA ekleri için imzalı bağlantı üretilemedi:", error.message);
    return imzalar;
  }
  for (const d of data ?? []) if (d.path && d.signedUrl) imzalar.set(d.path, d.signedUrl);
  return imzalar;
}

async function satirlariCevir(satirlar: RmaSatiri[]) {
  const imzalar = await imzala(satirlar);
  return satirlar.map((r) => rmaCevir(r, imzalar));
}

/** RMA'nın skaler alanları → rma_kayitlari sütunları (r_no hariç) */
function rmaSutunlari(r: RmaKaydi) {
  const sahipNo = sayiNo(r.sahip.id);
  return {
    r_seri_no: r.seriNo,
    r_model: r.model,
    r_sahip_tur: r.sahip.tur,
    musteri_id: r.sahip.tur === "musteri" ? sahipNo : null,
    bayi_id: r.sahip.tur === "bayi" ? sahipNo : null,
    r_sahip_adi: r.sahip.ad,
    r_ariza_tipi: r.arizaTipi,
    r_ariza: r.ariza,
    r_fotograflar: r.fotograflar,
    r_garantide: r.garantide,
    r_garanti_elle: r.garantiElle,
    r_ucret: r.ucret,
    r_adim: r.adim,
    r_karar: r.karar,
    r_kullanilan_parcalar: r.kullanilanParcalar,
    r_yeni_seri: r.yeniSeri,
    destek_talebi_id: sayiNo(r.destekTalebiId),
    r_iade_no: r.iadeId,
    r_kaynak: r.kaynak,
    r_acilis: r.acilis,
    r_kapanis: r.kapanis,
    r_gelis_kanal: r.gelis?.kanal ?? null,
    r_gelis_takip: r.gelis?.takipNo ?? null,
    r_kargo_firma: r.kargo?.firma ?? null,
    r_kargo_takip: r.kargo?.takipNo ?? null,
    r_ucret_odendi: r.ucretOdendi,
    r_ucret_onay: r.ucretOnay,
    r_oncelik: r.oncelik,
  };
}

const gecmisSatiri = (rmaId: number, g: GecmisKaydi) => ({ rma_id: rmaId, rg_zaman: g.zaman, rg_metin: g.metin, rg_tur: g.tur ?? null, rg_yazan: g.yazan ?? null });

/** Storage anahtarında güvenli ad (Türkçe karakter / boşluk → "_"); asıl ad re_ad'da saklanır */
const yolAdi = (ad: string) => ad.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "dosya";

/** Yeni ekleri yükler ve rma_ekleri'ne yazar. veri, veri URL'si (data:…;base64) olmalı. Eklerin id / _id / _yol / veri alanları güncellenir. */
async function ekleriYukle(rmaId: number, ekler: RmaEki[]) {
  if (!ekler.length) return;
  const s = await db();
  for (const e of ekler) {
    const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(e.veri);
    if (!m) throw new Error(`${e.ad}: dosya içeriği okunamadı.`);
    const icerik = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
    const yol = `${rmaId}/${crypto.randomUUID()}-${yolAdi(e.ad)}`;
    const { error } = await s.storage.from(BUCKET).upload(yol, icerik, { contentType: e.tip || m[1] || "application/octet-stream", upsert: false });
    if (error) throw new Error(`${e.ad} yüklenemedi: ${error.message}`);
    const satir = sonuc(
      await s.from("rma_ekleri").insert({ rma_id: rmaId, re_ad: e.ad, re_tip: e.tip, re_boyut: e.boyut, re_yol: yol, re_tarih: e.tarih }).select("id").single(),
      "RMA eki kaydedilirken",
    ) as { id: number };
    const { data } = await s.storage.from(BUCKET).createSignedUrl(yol, IMZA_SURESI);
    Object.assign(e, { id: String(satir.id), _id: satir.id, _yol: yol, veri: data?.signedUrl ?? "" });
  }
}

/** r_no → rma_kayitlari.id */
async function rmaNo(no: string): Promise<number | null> {
  const s = await db();
  const r = sonuc(await s.from("rma_kayitlari").select("id").eq("r_no", no).maybeSingle(), "RMA aranırken") as { id: number } | null;
  return r?.id ?? null;
}

/** Seri no → cihazlar.id */
async function cihazNo(seriNo: string): Promise<number | null> {
  const s = await db();
  const r = sonuc(await s.from("cihazlar").select("id").eq("c_serino", seriNo).maybeSingle(), "Cihaz aranırken") as { id: number } | null;
  return r?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Okuma
// ─────────────────────────────────────────────────────────────

/** En yeni RMA başta. Bayi oturumunda RLS yalnızca bayinin kayıtlarını döner. */
export async function getRmalar(): Promise<RmaKaydi[]> {
  const s = await db();
  const r = sonuc(await s.from("rma_kayitlari").select(RMA_SEC).order("r_acilis", { ascending: false }).order("id", { ascending: false }), "RMA kayıtları okunurken");
  return satirlariCevir(r as unknown as RmaSatiri[]);
}
export async function getRma(id: string): Promise<RmaKaydi | null> {
  const s = await db();
  const r = sonuc(await s.from("rma_kayitlari").select(RMA_SEC).eq("r_no", id).maybeSingle(), "RMA kaydı okunurken");
  return r ? (await satirlariCevir([r as unknown as RmaSatiri]))[0] : null;
}
/** Standart garanti süresi (ay): ayarlar['garanti_ay'], yoksa 24 */
export async function getGarantiAy(): Promise<number> {
  const s = await db();
  const r = sonuc(await s.from("ayarlar").select("deger").eq("anahtar", "garanti_ay").maybeSingle(), "Garanti süresi okunurken") as { deger: unknown } | null;
  const ay = Number(r?.deger);
  return Number.isFinite(ay) && ay > 0 ? ay : 24;
}

// Aşağıdakiler yalnızca action dosyalarından çağrılır.
export async function garantiAyKaydet(ay: number) {
  const s = await db();
  sonuc(await s.from("ayarlar").upsert({ anahtar: "garanti_ay", deger: ay, updated_at: new Date().toISOString() }), "Garanti süresi kaydedilirken");
}
/** Sıradaki belge numarası. Bayi oturumu yalnızca kendi kayıtlarını gördüğü için tüm tablodan veritabanında hesaplanır. */
export async function sonrakiRmaNo(): Promise<string> {
  const s = await db();
  return sonuc(await s.rpc("sonraki_belge_no", { p_tur: "rma" }), "Belge numarası alınırken") as string;
}
/** RMA'yı geçmişi ve ekleriyle kaydeder. Numara çakışırsa yeni numara alır ve r.id'ye yazar; eklerin veri URL'leri
 *  Storage'a yüklenir ve r.ekler imzalı bağlantılarla güncellenir. */
export async function rmaEkle(r: RmaKaydi) {
  const s = await db();
  let satir: { id: number } | null = null;
  for (let deneme = 0; !satir; deneme++) {
    try {
      satir = sonuc(await s.from("rma_kayitlari").insert({ ...rmaSutunlari(r), r_no: r.id }).select("id").single(), "RMA kaydedilirken") as { id: number };
    } catch (e) {
      if (!benzersizIhlali(e) || deneme >= 2) throw e;
      r.id = await sonrakiRmaNo();
    }
  }
  if (r.gecmis.length) sonuc(await s.from("rma_gecmisi").insert(r.gecmis.map((g) => gecmisSatiri(satir.id, g))), "RMA geçmişi kaydedilirken");
  await ekleriYukle(satir.id, r.ekler.filter((e) => !e._id));
}
/** RMA'yı okur, geri çağırmayla değiştirir, farkı yazar ve güncel kaydı döner.
 *  Skaler alanlar tek update; geçmişte _id'siz kayıtlar eklenir, çıkarılanlar silinir; eklerde yeniler yüklenir, çıkarılanlar
 *  (satır ve Storage dosyası) silinir. */
export async function rmayiGuncelle(id: string, f: (r: RmaKaydi) => void): Promise<RmaKaydi | null> {
  const no = await rmaNo(id);
  const eski = no !== null ? await getRma(id) : null;
  if (no === null || !eski) return null;
  const r = structuredClone(eski);
  f(r);
  const s = await db();

  const sutunlar: Record<string, unknown> = rmaSutunlari(r);
  if (r.id !== eski.id) sutunlar.r_no = r.id;
  sonuc(await s.from("rma_kayitlari").update(sutunlar).eq("id", no), "RMA güncellenirken");

  // Geçmiş
  const kalanG = new Set(r.gecmis.flatMap((g) => (g._id ? [g._id] : [])));
  const silinenG = eski.gecmis.filter((g) => g._id && !kalanG.has(g._id)).map((g) => g._id!);
  if (silinenG.length) sonuc(await s.from("rma_gecmisi").delete().in("id", silinenG), "RMA geçmişi silinirken");
  for (const g of r.gecmis) {
    const o = g._id ? eski.gecmis.find((x) => x._id === g._id) : undefined;
    if (o && (o.metin !== g.metin || o.zaman !== g.zaman || o.tur !== g.tur || o.yazan !== g.yazan)) {
      const { rma_id: _, ...degisen } = gecmisSatiri(no, g);
      sonuc(await s.from("rma_gecmisi").update(degisen).eq("id", g._id!), "RMA geçmişi güncellenirken");
    }
  }
  const yeniG = r.gecmis.filter((g) => !g._id);
  if (yeniG.length) sonuc(await s.from("rma_gecmisi").insert(yeniG.map((g) => gecmisSatiri(no, g))), "RMA geçmişi kaydedilirken");

  // Ekler
  const kalanE = new Set(r.ekler.flatMap((e) => (e._id ? [e._id] : [])));
  const silinenE = eski.ekler.filter((e) => e._id && !kalanE.has(e._id));
  if (silinenE.length) {
    sonuc(await s.from("rma_ekleri").delete().in("id", silinenE.map((e) => e._id!)), "RMA ekleri silinirken");
    const yollar = silinenE.flatMap((e) => (e._yol ? [e._yol] : []));
    if (yollar.length) {
      const { error } = await s.storage.from(BUCKET).remove(yollar);
      if (error) console.error("RMA eki dosyası Storage'dan silinemedi:", error.message);
    }
  }
  await ekleriYukle(no, r.ekler.filter((e) => !e._id));

  return getRma(r.id);
}

/** Cihazın RMA'ları (kendi seri nosuyla açılanlar ve değişimde yeni seri olarak verildiği kayıtlar) */
export async function getCihazRmalari(seriNo: string) {
  const s = await db();
  const [a, b] = await Promise.all([
    s.from("rma_kayitlari").select(RMA_SEC).eq("r_seri_no", seriNo),
    s.from("rma_kayitlari").select(RMA_SEC).eq("r_yeni_seri", seriNo),
  ]);
  const satirlar = new Map<number, RmaSatiri>();
  for (const x of [...(sonuc(a, "Cihazın RMA kayıtları okunurken") as unknown as RmaSatiri[]), ...(sonuc(b, "Cihazın RMA kayıtları okunurken") as unknown as RmaSatiri[])]) {
    satirlar.set(x.id, x);
  }
  const sirali = [...satirlar.values()].sort((x, y) => y.r_acilis.localeCompare(x.r_acilis) || y.id - x.id);
  return satirlariCevir(sirali);
}

export async function getGarantiUzatmalari(seriNo: string): Promise<GarantiUzatma[]> {
  const s = await db();
  const r = sonuc(
    await s.from("garanti_uzatmalari").select("id, gu_ay, gu_tarih, gu_not, cihazlar!inner(c_serino)").eq("cihazlar.c_serino", seriNo).order("id"),
    "Garanti uzatmaları okunurken",
  ) as unknown as { id: number; gu_ay: number; gu_tarih: string; gu_not: string }[];
  return r.map((u) => ({ id: String(u.id), ay: u.gu_ay, tarih: u.gu_tarih, not: u.gu_not }));
}
/** Uzatmayı kaydeder; veritabanının verdiği id u.id'ye yazılır */
export async function garantiUzatmaEkle(seriNo: string, u: GarantiUzatma) {
  const cihaz = await cihazNo(seriNo);
  if (cihaz === null) throw new Error(`Garanti uzatılamadı: ${seriNo} cihaz kaydı bulunamadı.`);
  const s = await db();
  const satir = sonuc(
    await s.from("garanti_uzatmalari").insert({ cihaz_id: cihaz, gu_ay: u.ay, gu_tarih: u.tarih, gu_not: u.not }).select("id").single(),
    "Garanti uzatması kaydedilirken",
  ) as { id: number };
  u.id = String(satir.id);
}
export async function garantiUzatmaSil(seriNo: string, id: string) {
  const no = sayiNo(id);
  const cihaz = await cihazNo(seriNo);
  if (no === null || cihaz === null) return;
  const s = await db();
  sonuc(await s.from("garanti_uzatmalari").delete().eq("id", no).eq("cihaz_id", cihaz), "Garanti uzatması silinirken");
}
