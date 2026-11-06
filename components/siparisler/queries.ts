// Sipariş & Sevkiyat: veri okuma. Şimdilik demo veri döner (sunucu belleğinde, sayfalar arasında paylaşılır).
// Supabase bağlanınca fonksiyonların içini supabase.from("orders" | "stock" | "returns")... ile değiştirin.
import type { CihazModeli } from "@/lib/urunler";

/** odeme → hazirlaniyor → kargoda → teslim → tamamlandi. Yalnızca lisans içeren siparişte kargo adımları atlanır. */
export type SiparisDurumu = "odeme" | "hazirlaniyor" | "kargoda" | "teslim" | "tamamlandi";
export type OdemeYontemi = "Kart" | "Havale/EFT" | "Proforma";
export type ParaBirimi = "TRY" | "EUR";

export const ODEME_YONTEMLERI: OdemeYontemi[] = ["Kart", "Havale/EFT", "Proforma"];

export type Kalem =
  | { tur: "cihaz"; model: CihazModeli; adet: number }
  | { tur: "lisans"; paket: string; adet: number; sureAy: number }
  | { tur: "aksesuar"; stokKodu: string; adet: number };

export type SiparisNotu = { metin: string; zaman: string; sistem?: boolean }; // zaman: "2026-11-06T11:24"

export type Siparis = {
  id: string; // "S-26-1184" (adres: /siparisler/S-26-1184)
  tarih: string; // "2026-11-06T11:24"
  musteriId: string | null;
  musteri: string;
  ulke: string;
  adres: string;
  bayiId?: string | null; // bayi stoğu siparişi
  kalemler: Kalem[];
  tutar: number; // KDV hariç
  paraBirimi: ParaBirimi;
  odeme: OdemeYontemi;
  durum: SiparisDurumu;
  seriNolar: string[]; // atanan cihaz seri numaraları
  kargo: { firma: string; takipNo: string } | null;
  teslimTarihi: string | null; // "2026-11-04"
  faturaNo: string | null;
  lisansBaslangic: string | null; // lisans teslim edilince
  notlar: SiparisNotu[]; // eskiden yeniye
};

export type StokKalemi = { kod: string; ad: string; adet: number; kritik: number; hedef: number; fiyat: number | null };

export type IadeTuru = "iade" | "degisim";
export type Iade = {
  id: string; // "R-0042"
  siparisId: string;
  musteri: string;
  tur: IadeTuru;
  neden: string;
  urunler?: string[]; // iade edilen cihaz seri no'ları ve diğer kalemler ("EO1-2610-0661", "1× Ana teşhis kablosu")
  tarih: string; // "2026-11-03"
  adim: number; // IADE_ADIMLARI[tur] içindeki sıra
};

export const IADE_ADIMLARI: Record<IadeTuru, string[]> = {
  iade: ["Ürün bekleniyor", "Ürün alındı", "Para iadesi yapıldı"],
  degisim: ["Ürün bekleniyor", "Ürün alındı", "Yeni kargo yolda", "Tamamlandı"],
};
export const IADE_NEDENLERI = ["Cayma hakkı", "Arızalı ürün", "Yanlış ürün gönderildi", "Eksik parça", "Diğer"] as const;

/** Her cihaz kutusunda bulunan kablolar (kargoya verilirken stoktan düşer) */
export const KUTU_ICERIGI = ["EO1-CBL-MAIN", "EO1-CBL-PIN", "EO1-CBL-BAT", "EO1-CBL-USB"];
export const CIHAZ_STOK_KODU: Record<CihazModeli, string> = { ONE: "EO1-HW", "ONE Lite": "EO1L-HW" };

const STOK: StokKalemi[] = [
  { kod: "EO1-HW", ad: "EmbedraONE cihaz", adet: 46, kritik: 10, hedef: 100, fiyat: null },
  { kod: "EO1L-HW", ad: "EmbedraONE LITE cihaz", adet: 21, kritik: 8, hedef: 60, fiyat: null },
  { kod: "EO1-CBL-MAIN", ad: "Ana teşhis kablosu", adet: 120, kritik: 30, hedef: 150, fiyat: 4_200 },
  { kod: "EO1-CBL-PIN", ad: "Universal pin kablosu", adet: 18, kritik: 30, hedef: 130, fiyat: 3_500 },
  { kod: "EO1-CBL-BAT", ad: "Batarya kablosu", adet: 88, kritik: 30, hedef: 130, fiyat: 1_200 },
  { kod: "EO1-CBL-USB", ad: "USB-C kablo", adet: 140, kritik: 30, hedef: 150, fiyat: 600 },
];

const not = (metin: string, zaman: string): SiparisNotu => ({ metin, zaman, sistem: true });

const DEMO: Siparis[] = [
  {
    id: "S-26-1184", tarih: "2026-11-06T11:24", musteriId: "volant", musteri: "Volant Lenkung Service GmbH", ulke: "Almanya",
    adres: "Industriestr. 14, 70565 Stuttgart, DE",
    kalemler: [{ tur: "cihaz", model: "ONE", adet: 2 }, { tur: "lisans", paket: "Pro+", adet: 1, sureAy: 12 }],
    tutar: 9_800, paraBirimi: "EUR", odeme: "Kart", durum: "hazirlaniyor", seriNolar: [], kargo: null, teslimTarihi: null,
    faturaNo: "EMB2026000431", lisansBaslangic: null,
    notlar: [not("Web sitesinden kartla ödendi.", "2026-11-06T11:24"), not("İhracat faturası kesildi: EMB2026000431", "2026-11-06T11:40")],
  },
  {
    id: "S-26-1181", tarih: "2026-11-06T09:10", musteriId: null, musteri: "Mert Usta Oto", ulke: "Türkiye", adres: "Gebze OSB, Kocaeli",
    kalemler: [{ tur: "cihaz", model: "ONE", adet: 1 }, { tur: "lisans", paket: "Pro", adet: 1, sureAy: 12 }],
    tutar: 168_000, paraBirimi: "TRY", odeme: "Havale/EFT", durum: "odeme", seriNolar: [], kargo: null, teslimTarihi: null,
    faturaNo: null, lisansBaslangic: null,
    notlar: [not("Sipariş açıldı, havale bekleniyor.", "2026-11-06T09:10")],
  },
  {
    id: "S-26-1177", tarih: "2026-11-01T14:02", musteriId: "bursa", musteri: "Bursa ECU Lab", ulke: "Türkiye", adres: "Nilüfer, Bursa",
    kalemler: [{ tur: "lisans", paket: "Pro+", adet: 1, sureAy: 12 }],
    tutar: 100_800, paraBirimi: "TRY", odeme: "Kart", durum: "tamamlandi", seriNolar: ["EO1-2310-0218"], kargo: null, teslimTarihi: "2026-11-01",
    faturaNo: "EMB2026000412", lisansBaslangic: "2025-11-11",
    notlar: [not("Yenileme siparişi, kartla ödendi.", "2026-11-01T14:02"), not("Lisans anahtarı müşteriye iletildi.", "2026-11-01T14:30")],
  },
  {
    id: "S-26-1172", tarih: "2026-10-31T10:15", musteriId: null, bayiId: "directie", musteri: "Direcție Pro SRL", ulke: "Romanya",
    adres: "Bd. Unirii 22, București, RO",
    kalemler: [{ tur: "cihaz", model: "ONE", adet: 10 }],
    tutar: 31_500, paraBirimi: "EUR", odeme: "Proforma", durum: "kargoda",
    seriNolar: Array.from({ length: 10 }, (_, i) => `EO1-2610-${String(680 + i).padStart(4, "0")}`),
    kargo: { firma: "DHL Freight", takipNo: "4471 0928 3315" }, teslimTarihi: null, faturaNo: "EMB2026000398", lisansBaslangic: null,
    notlar: [not("Bayi stoğu siparişi, proforma ile ödendi.", "2026-10-31T10:15"), not("DHL Freight ile kargoya verildi.", "2026-11-02T16:05")],
  },
  {
    id: "S-26-1169", tarih: "2026-10-30T15:40", musteriId: "kaya", musteri: "Kaya Oto Elektronik", ulke: "Türkiye", adres: "Bornova, İzmir",
    kalemler: [{ tur: "aksesuar", stokKodu: "EO1-CBL-MAIN", adet: 1 }],
    tutar: 4_200, paraBirimi: "TRY", odeme: "Kart", durum: "teslim", seriNolar: [],
    kargo: { firma: "Yurtiçi Kargo", takipNo: "2210 4471 09" }, teslimTarihi: "2026-11-02", faturaNo: "EMB2026000401", lisansBaslangic: null,
    notlar: [not("Yedek kablo siparişi.", "2026-10-30T15:40"), not("Teslim edildi.", "2026-11-02T11:00")],
  },
  {
    id: "S-26-1166", tarih: "2026-10-29T13:05", musteriId: "akdeniz", musteri: "Akdeniz Direksiyon Servisi", ulke: "Türkiye", adres: "Muratpaşa, Antalya",
    kalemler: [{ tur: "cihaz", model: "ONE Lite", adet: 1 }, { tur: "lisans", paket: "Basic", adet: 1, sureAy: 12 }],
    tutar: 112_000, paraBirimi: "TRY", odeme: "Kart", durum: "kargoda", seriNolar: ["EO1-2610-0670"],
    kargo: { firma: "Yurtiçi Kargo", takipNo: "2210 4480 17" }, teslimTarihi: null, faturaNo: null, lisansBaslangic: null,
    notlar: [not("İkinci cihaz siparişi.", "2026-10-29T13:05"), not("Yurtiçi Kargo ile kargoya verildi.", "2026-11-05T15:20")],
  },
  {
    id: "S-26-1163", tarih: "2026-10-28T10:00", musteriId: "iberia", musteri: "Iberia Dirección SL", ulke: "İspanya", adres: "C/ de Colón 18, Valencia, ES",
    kalemler: [{ tur: "cihaz", model: "ONE", adet: 1 }, { tur: "lisans", paket: "Basic", adet: 1, sureAy: 12 }],
    tutar: 4_100, paraBirimi: "EUR", odeme: "Kart", durum: "teslim", seriNolar: ["EO1-2610-0661"],
    kargo: { firma: "UPS Express", takipNo: "1Z88F4E20444712210" }, teslimTarihi: "2026-11-03", faturaNo: "EMB2026000389", lisansBaslangic: null,
    notlar: [not("Kartla ödendi.", "2026-10-28T10:00"), not("Teslim edildi, lisans anahtarı bekliyor.", "2026-11-03T09:40")],
  },
  {
    id: "S-26-1158", tarih: "2026-10-27T11:30", musteriId: null, musteri: "Anadolu Teknik Lisesi", ulke: "Türkiye", adres: "Melikgazi, Kayseri",
    kalemler: [{ tur: "cihaz", model: "ONE", adet: 3 }, { tur: "lisans", paket: "Pro", adet: 3, sureAy: 12 }],
    tutar: 504_000, paraBirimi: "TRY", odeme: "Havale/EFT", durum: "hazirlaniyor", seriNolar: [], kargo: null, teslimTarihi: null,
    faturaNo: null, lisansBaslangic: null,
    notlar: [not("Kamu alımı, havale ile ödendi. e-Fatura kamu kurumuna kesilecek.", "2026-10-28T09:00")],
  },
];

const DEMO_IADE: Iade[] = [
  { id: "R-0042", siparisId: "S-26-1149", musteri: "Atelier Direction Lyon", tur: "degisim", neden: "Yanlış ürün gönderildi · kablo seti eksik", urunler: ["1× Universal pin kablosu"], tarih: "2026-11-03", adim: 2 },
  { id: "R-0041", siparisId: "S-26-1152", musteri: "Sarajevo Auto Elektro", tur: "iade", neden: "Cayma hakkı · kutu açılmamış", urunler: ["EO1-2610-0655"], tarih: "2026-11-02", adim: 0 },
];

const g = globalThis as { __embedraSiparisler?: { siparisler: Siparis[]; stok: StokKalemi[]; iadeler: Iade[] } };
const DEPO = (g.__embedraSiparisler ??= { siparisler: structuredClone(DEMO), stok: structuredClone(STOK), iadeler: structuredClone(DEMO_IADE) });

export async function getSiparisler(): Promise<Siparis[]> {
  return DEPO.siparisler;
}

export async function getSiparis(id: string): Promise<Siparis | null> {
  return DEPO.siparisler.find((s) => s.id === id) ?? null;
}

export async function getStok(): Promise<StokKalemi[]> {
  return DEPO.stok;
}

export async function getIadeler(): Promise<Iade[]> {
  return DEPO.iadeler;
}

/** Sıradaki sipariş numarası: "S-26-1185" */
export async function sonrakiSiparisNo(): Promise<string> {
  const en = Math.max(0, ...DEPO.siparisler.map((s) => Number(s.id.split("-")[2]) || 0));
  return `S-26-${en + 1}`;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function siparisEkle(s: Siparis) {
  DEPO.siparisler.unshift(s);
}

export async function siparisiGuncelle(id: string, f: (s: Siparis) => void): Promise<Siparis | null> {
  const s = DEPO.siparisler.find((x) => x.id === id);
  if (s) f(s);
  return s ?? null;
}

export async function stokGuncelle(kod: string, fark: number) {
  const k = DEPO.stok.find((x) => x.kod === kod);
  if (k) k.adet = Math.max(0, k.adet + fark);
  return k ?? null;
}

export async function stokKalemiEkle(k: StokKalemi) {
  DEPO.stok.push(k);
}

export async function iadeEkle(i: Iade) {
  DEPO.iadeler.unshift(i);
}

export async function iadeyiGuncelle(id: string, f: (i: Iade) => void): Promise<Iade | null> {
  const i = DEPO.iadeler.find((x) => x.id === id);
  if (i) f(i);
  return i ?? null;
}

export async function sonrakiIadeNo(): Promise<string> {
  const en = Math.max(0, ...DEPO.iadeler.map((i) => Number(i.id.slice(2)) || 0));
  return `R-${String(en + 1).padStart(4, "0")}`;
}

/** Satış hattında kazanılan fırsattan "ödeme bekliyor" sipariş açar (satis-hatti/actions.ts çağırır) */
export async function firsattanSiparisAc(f: { firma: string; musteriId: string; ulke: string; konum: string; icerik: string; tutar: number }, kalemler: Kalem[]) {
  if (!kalemler.length) return null;
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const zaman = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  const siparis: Siparis = {
    id: await sonrakiSiparisNo(), tarih: zaman, musteriId: f.musteriId, musteri: f.firma, ulke: f.ulke, adres: f.konum,
    kalemler, tutar: f.tutar, paraBirimi: "TRY", odeme: "Havale/EFT", durum: "odeme", seriNolar: [], kargo: null,
    teslimTarihi: null, faturaNo: null, lisansBaslangic: null,
    notlar: [{ metin: `Satış hattında kazanılan fırsattan açıldı: ${f.icerik}`, zaman, sistem: true }],
  };
  await siparisEkle(siparis);
  return siparis;
}
