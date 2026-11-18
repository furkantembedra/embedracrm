// Bayi & Distribütör: veri okuma / yazma (Supabase).
// Tablolar: bayi_basvurulari (başvuru), bayiler (aktif bayi; lansmanda id = başvuru id), bayi_hareketleri + bayi_hareket_kalemleri.
// RLS: CRM ekibi her şeyi görür; bayi oturumunda yalnızca kendi bayi / başvuru / hareket satırları döner.
import { connection } from "next/server";
import { ASAMALAR, ASAMA_BILGI, KONTROL_LISTESI, ULKELER, HEDEF_ULKELER, DESTEK_KALEMLERI, HAREKET_ADI } from "./sabitler";
export { ASAMALAR, ASAMA_BILGI, KONTROL_LISTESI, ULKELER, HEDEF_ULKELER, DESTEK_KALEMLERI, HAREKET_ADI };
import { db, sonuc, kullaniciKimligi, kullaniciNo, yerelZaman } from "@/lib/supabase/db";
import type { CihazModeli } from "@/lib/urunler";
import type { LisansPlani } from "@/components/cihaz-lisans/queries";

export type BayiAsamasi = (typeof ASAMALAR)[number];

/** Bölge kapsamasında her zaman gösterilen hedef ülkeler (bayisi olmasa da) */


export type DestekKalemi = (typeof DESTEK_KALEMLERI)[number];

/** Sözleşme kontrol listesinin her maddesinde kararlaştırılanlar. Boş alan: henüz girilmedi. */
export type SozlesmeDetayi = {
  bolge: { kapsam: string; munhasir: boolean | null };
  moq: { one: number | null; lite: number | null; yillik: number | null; indirim: number | null }; // indirim: %
  marka: { kitTarihi: string; logoOnay: boolean; not: string }; // kitTarihi: "2026-10-28"
  destek: { bayi: DestekKalemi[] };
};

export const bosSozlesme = (bolge = ""): SozlesmeDetayi => ({
  bolge: { kapsam: bolge, munhasir: null },
  moq: { one: null, lite: null, yillik: null, indirim: null },
  marka: { kitTarihi: "", logoOnay: false, not: "" },
  destek: { bayi: [] },
});

export type Basvuru = {
  id: string;
  sirket: string;
  yetkili: string;
  ulkeKodu: string; // "PL"
  bolge: string; // talep edilen bölge: "Polonya (tamamı)"
  asama: BayiAsamasi;
  puan: number | null; // uygunluk 0–100, değerlendirmede verilir
  ilkSiparis: number; // cihaz adedi
  tarih: string; // "2026-10-28"
  eposta: string;
  telefon: string;
  vergiNo: string;
  kontroller: boolean[]; // KONTROL_LISTESI sırasıyla
  sozlesme: SozlesmeDetayi; // kontrol listesi maddelerinin ayrıntısı
  gorusme: { tarih: string; not: string } | null; // "2026-11-06T14:00"
};

export type AktifBayi = {
  id: string;
  ad: string;
  bolge: string;
  ulkeKodu: string;
  satilan: number; // bu çeyrek, cihaz
  stok: number;
  moqHedef: number; // çeyreklik minimum sipariş, cihaz
  moqGerceklesen: number;
  // Bayi portalı ayarları (CRM › Bayi detayı › Portal paneli)
  temsilciId?: string | null; // Embedra ekibinden sorumlu (Operasyon › Ekip); portal talepleri bu kişiye düşer
  adres?: string; // kayıtlı teslimat adresi (portal siparişlerinde varsayılan)
  sozlesmeBaslangic?: string | null; // "2026-09-14"
  sozlesmeSureAy?: number | null; // 24
};

/* ---------- Bayi hareketleri: bayiye sevkiyat, bayinin bildirdiği satış, bayinin sattığı lisans ---------- */

// iade: bayi stoğundaki cihaz Embedra'ya geri döndü (stoktan düşer) · degisim: RMA'da cihaz değiştirildi, yeni seri eskisinin yerini alır
// (eski seri geçmiş hareketlerde yenisiyle değiştirilir; bu kayıt yalnızca izdir, sayaçlara girmez)
export type HareketTuru = "sevkiyat" | "satis" | "lisans" | "iade" | "degisim";

export type BayiHareketi = {
  id: string;
  bayiId: string;
  tur: HareketTuru;
  tarih: string; // "2026-10-14"
  kalemler: { model: CihazModeli; seriNo: string | null }[]; // seri no girilmeden sevk edilen stokta null
  musteri?: { id: string | null; ad: string }; // satış / lisans: son kullanıcı
  plan?: LisansPlani; // lisans
  sureAy?: number; // lisans
  eskiSeri?: string; // degisim: yerine yenisi verilen seri
  not?: string;
};

/* ---------- Satır ↔ nesne dönüşümleri ---------- */

const BASVURU_ALANLARI =
  "id, s_ad, y_ad_soyad, s_ulke, s_bolge, s_asama, s_puan, s_ilk_siparis, s_tarih, y_eposta, y_tel, s_vergino, k_bolge, k_moq, k_marka, k_destek, s_sozlesme, g_tarih, g_not";

type BasvuruSatiri = {
  id: number; s_ad: string; y_ad_soyad: string | null; s_ulke: string | null; s_bolge: string | null; s_asama: BayiAsamasi;
  s_puan: number | null; s_ilk_siparis: number | null; s_tarih: string; y_eposta: string | null; y_tel: string | null; s_vergino: string | null;
  k_bolge: boolean; k_moq: boolean; k_marka: boolean; k_destek: boolean; s_sozlesme: Partial<SozlesmeDetayi> | null; g_tarih: string | null; g_not: string | null;
};

function basvuruCevir(r: BasvuruSatiri): Basvuru {
  const bolge = r.s_bolge ?? "";
  return {
    id: String(r.id),
    sirket: r.s_ad,
    yetkili: r.y_ad_soyad ?? "",
    ulkeKodu: r.s_ulke ?? "",
    bolge,
    asama: r.s_asama,
    puan: r.s_puan,
    ilkSiparis: r.s_ilk_siparis ?? 0,
    tarih: r.s_tarih,
    eposta: r.y_eposta ?? "",
    telefon: r.y_tel ?? "",
    vergiNo: r.s_vergino ?? "",
    kontroller: [r.k_bolge, r.k_moq, r.k_marka, r.k_destek],
    // jsonb'de eksik madde kalmışsa boş değerle tamamlanır
    sozlesme: { ...bosSozlesme(bolge), ...(r.s_sozlesme ?? {}) },
    gorusme: r.g_tarih ? { tarih: yerelZaman(r.g_tarih), not: r.g_not ?? "" } : null,
  };
}

/** "2026-11-06T11:00" (sunucunun yerel saati) → timestamptz için ISO; yerelZaman bunun tersidir */
const yereldenIso = (t: string) => new Date(t).toISOString();

function basvuruSatiri(b: Basvuru) {
  return {
    s_ad: b.sirket,
    y_ad_soyad: b.yetkili,
    s_ulke: b.ulkeKodu,
    s_bolge: b.bolge,
    s_asama: b.asama,
    s_puan: b.puan,
    s_ilk_siparis: b.ilkSiparis,
    s_tarih: b.tarih,
    y_eposta: b.eposta,
    y_tel: b.telefon,
    s_vergino: b.vergiNo,
    k_bolge: !!b.kontroller[0],
    k_moq: !!b.kontroller[1],
    k_marka: !!b.kontroller[2],
    k_destek: !!b.kontroller[3],
    s_sozlesme: b.sozlesme,
    g_tarih: b.gorusme ? yereldenIso(b.gorusme.tarih) : null,
    g_not: b.gorusme?.not ?? null,
  };
}

const BAYI_ALANLARI = "id, by_ad, by_bolge, by_ulke_kodu, by_moq_hedef, temsilci_id, by_adres, by_sozlesme_bat, by_sozlesme_sure_ay";
type BayiSatiri = {
  id: number; by_ad: string; by_bolge: string | null; by_ulke_kodu: string; by_moq_hedef: number; temsilci_id: number | null;
  by_adres: string | null; by_sozlesme_bat: string | null; by_sozlesme_sure_ay: number | null;
};

/** Sayaçlar hariç bayi kartı (sayaçlar hareketlerden ayrıca hesaplanır) */
function bayiCevir(r: BayiSatiri): AktifBayi {
  return {
    id: String(r.id),
    ad: r.by_ad,
    bolge: r.by_bolge ?? "",
    ulkeKodu: r.by_ulke_kodu,
    satilan: 0,
    stok: 0,
    moqHedef: r.by_moq_hedef,
    moqGerceklesen: 0,
    temsilciId: r.temsilci_id == null ? null : kullaniciKimligi(r.temsilci_id),
    adres: r.by_adres ?? "",
    sozlesmeBaslangic: r.by_sozlesme_bat,
    sozlesmeSureAy: r.by_sozlesme_sure_ay,
  };
}

function bayiSatiri(b: AktifBayi) {
  return {
    by_ad: b.ad,
    by_bolge: b.bolge || null,
    by_ulke_kodu: b.ulkeKodu,
    by_moq_hedef: Math.max(0, Math.round(b.moqHedef || 0)),
    temsilci_id: b.temsilciId ? kullaniciNo(b.temsilciId) : null,
    by_adres: b.adres?.trim() || null,
    by_sozlesme_bat: b.sozlesmeBaslangic ?? null,
    by_sozlesme_sure_ay: b.sozlesmeSureAy ?? null,
  };
}

const HAREKET_ALANLARI =
  "id, bayi_id, bh_tur, bh_tarih, musteri_id, bh_musteri_adi, bh_plan, bh_sure_ay, bh_eski_seri, bh_not, bayi_hareket_kalemleri(bhk_model, bhk_seri_no, bhk_sira)";
type HareketSatiri = {
  id: number; bayi_id: number; bh_tur: HareketTuru; bh_tarih: string; musteri_id: number | null; bh_musteri_adi: string | null;
  bh_plan: LisansPlani | null; bh_sure_ay: number | null; bh_eski_seri: string | null; bh_not: string | null;
  bayi_hareket_kalemleri: { bhk_model: CihazModeli; bhk_seri_no: string | null; bhk_sira: number }[];
};

function hareketCevir(r: HareketSatiri): BayiHareketi {
  const h: BayiHareketi = {
    id: String(r.id),
    bayiId: String(r.bayi_id),
    tur: r.bh_tur,
    tarih: r.bh_tarih,
    kalemler: [...r.bayi_hareket_kalemleri].sort((a, b) => a.bhk_sira - b.bhk_sira).map((k) => ({ model: k.bhk_model, seriNo: k.bhk_seri_no })),
  };
  if (r.musteri_id != null || r.bh_musteri_adi) h.musteri = { id: r.musteri_id == null ? null : String(r.musteri_id), ad: r.bh_musteri_adi ?? "" };
  if (r.bh_plan) h.plan = r.bh_plan;
  if (r.bh_sure_ay != null) h.sureAy = r.bh_sure_ay;
  if (r.bh_eski_seri) h.eskiSeri = r.bh_eski_seri;
  if (r.bh_not) h.not = r.bh_not;
  return h;
}

/** "12" → 12; sayı olmayan kimlik (eski slug / uuid) veritabanında yoktur */
const kimlikNo = (id: string) => (/^\d+$/.test(id) ? Number(id) : null);

/* ---------- Başvurular ---------- */

export async function getBasvurular(): Promise<Basvuru[]> {
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_basvurulari").select(BASVURU_ALANLARI).order("s_tarih", { ascending: false }).order("id", { ascending: false }),
    "Bayi başvuruları okunuyordu",
  ) as BasvuruSatiri[];
  return satirlar.map(basvuruCevir);
}

async function basvuruOku(id: string): Promise<Basvuru | null> {
  const no = kimlikNo(id);
  if (no === null) return null;
  const s = await db();
  const r = sonuc(await s.from("bayi_basvurulari").select(BASVURU_ALANLARI).eq("id", no).maybeSingle(), "Bayi başvurusu okunuyordu") as BasvuruSatiri | null;
  return r ? basvuruCevir(r) : null;
}

/* ---------- Hareketler ---------- */

export async function getBayiHareketleri(): Promise<BayiHareketi[]> {
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_hareketleri").select(HAREKET_ALANLARI).order("bh_tarih", { ascending: false }).order("id", { ascending: false }),
    "Bayi hareketleri okunuyordu",
  ) as HareketSatiri[];
  return satirlar.map(hareketCevir);
}

/** Hareketi ve kalemlerini yazar; veritabanının verdiği id geçirilen nesnenin üstüne yazılır. */
export async function hareketEkle(h: BayiHareketi) {
  const bayiNo = kimlikNo(h.bayiId);
  if (bayiNo === null) throw new Error(`Bayi hareketi yazılamadı: geçersiz bayi kimliği (${h.bayiId})`);
  const s = await db();
  const musteriNo = h.musteri?.id ? kimlikNo(h.musteri.id) : null;
  const r = sonuc(
    await s.from("bayi_hareketleri").insert({
      bayi_id: bayiNo,
      bh_tur: h.tur,
      bh_tarih: h.tarih,
      musteri_id: musteriNo,
      bh_musteri_adi: h.musteri?.ad ?? null,
      bh_plan: h.plan ?? null,
      bh_sure_ay: h.sureAy ?? null,
      bh_eski_seri: h.eskiSeri ?? null,
      bh_not: h.not ?? null,
    }).select("id").single(),
    "Bayi hareketi yazılıyordu",
  ) as { id: number };
  h.id = String(r.id);
  if (h.kalemler.length) {
    sonuc(
      await s.from("bayi_hareket_kalemleri").insert(
        h.kalemler.map((k, i) => ({ hareket_id: r.id, bhk_model: k.model, bhk_seri_no: k.seriNo, bhk_sira: i })),
      ),
      "Bayi hareketinin kalemleri yazılıyordu",
    );
  }
}

/** RMA değişimi: bayinin hareketlerinde eski seri yenisiyle değiştirilir (stok, satış tarihi ve garanti yeni cihaza geçer)
 *  ve izi "degisim" hareketi olarak yazılır. Eski seri bayide hiç geçmiyorsa false döner. */
export async function bayiSeriDegistir(bayiId: string, eski: string, yeni: string, model: CihazModeli, tarih: string, not: string) {
  const bayiNo = kimlikNo(bayiId);
  if (bayiNo === null) return false;
  const s = await db();
  const kalemler = sonuc(
    await s.from("bayi_hareket_kalemleri").select("id, bayi_hareketleri!inner(bayi_id)").eq("bhk_seri_no", eski).eq("bayi_hareketleri.bayi_id", bayiNo),
    "Bayi hareketlerinde seri no aranıyordu",
  ) as { id: number }[];
  if (!kalemler.length) return false;
  sonuc(
    await s.from("bayi_hareket_kalemleri").update({ bhk_seri_no: yeni }).in("id", kalemler.map((k) => k.id)),
    "Bayi hareketlerinde seri no değiştiriliyordu",
  );
  await hareketEkle({ id: "", bayiId, tur: "degisim", tarih, kalemler: [{ model, seriNo: yeni }], eskiSeri: eski, not });
  return true;
}

/* ---------- Aktif bayiler ---------- */

/** Bayinin sayaçları hareketlerden hesaplanır (CRM formları, bayi portalı ve sipariş sevkiyatı aynı kaynağı kullanır):
 *  stok = toplam sevk − toplam satış − iade · satilan = bu çeyrek satış · moqGerceklesen = bu çeyrek bayiye sevk */
function sayaclar(bayiId: string, bugun: string, hareketler: BayiHareketi[]) {
  const ceyrek = (t: string) => `${t.slice(0, 4)}-${Math.floor((Number(t.slice(5, 7)) - 1) / 3)}`;
  const buCeyrek = ceyrek(bugun);
  let sevk = 0, satis = 0, ceyrekSevk = 0, ceyrekSatis = 0;
  for (const h of hareketler) {
    if (h.bayiId !== bayiId) continue;
    const n = h.kalemler.length;
    if (h.tur === "sevkiyat") { sevk += n; if (ceyrek(h.tarih) === buCeyrek) ceyrekSevk += n; }
    if (h.tur === "satis") { satis += n; if (ceyrek(h.tarih) === buCeyrek) ceyrekSatis += n; }
    if (h.tur === "iade") { sevk -= n; if (ceyrek(h.tarih) === buCeyrek) ceyrekSevk -= n; } // iade edilen sevkiyat MOQ'dan da düşer
  }
  return { stok: Math.max(0, sevk - satis), satilan: ceyrekSatis, moqGerceklesen: Math.max(0, ceyrekSevk) };
}

export async function getAktifBayiler(): Promise<AktifBayi[]> {
  await connection(); // sayaçlar bugünün çeyreğine göre: istek anında hesaplanır (cacheComponents)
  const bugun = new Date().toISOString().slice(0, 10);
  const s = await db();
  const [satirlar, hareketler] = await Promise.all([
    s.from("bayiler").select(BAYI_ALANLARI).order("created_at", { ascending: false }).order("id", { ascending: true })
      .then((r) => sonuc(r, "Aktif bayiler okunuyordu") as BayiSatiri[]),
    getBayiHareketleri(),
  ]);
  return satirlar.map((r) => {
    const b = bayiCevir(r);
    return { ...b, ...sayaclar(b.id, bugun, hareketler) };
  });
}

/** Bayi kartını günceller (stok / satış / MOQ sayaçları hareketlerden hesaplandığı için buradan değiştirilmez) */
export async function aktifBayiyiGuncelle(id: string, degisiklik: (b: AktifBayi) => void): Promise<AktifBayi | null> {
  const no = kimlikNo(id);
  if (no === null) return null;
  const s = await db();
  const r = sonuc(await s.from("bayiler").select(BAYI_ALANLARI).eq("id", no).maybeSingle(), "Bayi okunuyordu") as BayiSatiri | null;
  if (!r) return null;
  const b = bayiCevir(r);
  const once = JSON.stringify(bayiSatiri(b));
  degisiklik(b);
  const yeni = bayiSatiri(b);
  if (JSON.stringify(yeni) !== once) sonuc(await s.from("bayiler").update(yeni).eq("id", no), "Bayi güncelleniyordu");
  return b;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır.

/** Yeni başvuru: id veritabanından gelir ve geçirilen nesnenin üstüne yazılır */
export async function basvuruEkle(b: Basvuru) {
  const s = await db();
  const r = sonuc(await s.from("bayi_basvurulari").insert(basvuruSatiri(b)).select("id").single(), "Bayi başvurusu kaydediliyordu") as { id: number };
  b.id = String(r.id);
}

/** Başvuruyu okur, değişikliği uygular, bir şey değiştiyse yazar ve güncel hâlini döner (boş geri çağırma = okuma) */
export async function basvuruyuGuncelle(id: string, degisiklik: (b: Basvuru) => void): Promise<Basvuru | null> {
  const b = await basvuruOku(id);
  if (!b) return null;
  const once = JSON.stringify(basvuruSatiri(b));
  degisiklik(b);
  const yeni = basvuruSatiri(b);
  if (JSON.stringify(yeni) !== once) {
    const s = await db();
    sonuc(await s.from("bayi_basvurulari").update(yeni).eq("id", Number(b.id)), "Bayi başvurusu güncelleniyordu");
  }
  return b;
}

/** Başvuruyu siler; lansmanı yapılmış bayinin kartı kalır (bayiler.basvuru_id null olur) */
export async function basvuruyuSil(id: string): Promise<boolean> {
  const no = kimlikNo(id);
  if (no === null) return false;
  const s = await db();
  const silinen = sonuc(await s.from("bayi_basvurulari").delete().eq("id", no).select("id"), "Bayi başvurusu siliniyordu") as { id: number }[];
  return silinen.length > 0;
}

/** Lansman: başvurudan gelen bayi başvurunun id'siyle eklenir (zaten varsa dokunulmaz).
 *  Başvurusu olmayan bayide id veritabanından gelir ve nesnenin üstüne yazılır. */
export async function aktifBayiEkle(b: AktifBayi) {
  const s = await db();
  const no = kimlikNo(b.id);
  const basvuru = no === null ? null : await basvuruOku(b.id);
  if (basvuru) {
    sonuc(
      await s.from("bayiler").upsert({ id: no, basvuru_id: no, ...bayiSatiri(b) }, { onConflict: "id", ignoreDuplicates: true }),
      "Aktif bayi ekleniyordu",
    );
    return;
  }
  const r = sonuc(await s.from("bayiler").insert(bayiSatiri(b)).select("id").single(), "Aktif bayi ekleniyordu") as { id: number };
  b.id = String(r.id);
}
