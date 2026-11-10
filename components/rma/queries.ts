// Garanti & RMA (arıza / iade kabul): seri numarasıyla açılan servis kayıtları.
// Şimdilik demo veri (sunucu belleğinde). Supabase bağlanınca supabase.from("rma_cases" | "settings")… ile değiştirin.
import type { CihazModeli } from "@/lib/urunler";

/** talep → teslim_alindi → inceleme → karar → tamamlandi → gonderildi (red / iade kararında gönderim adımı atlanabilir) */
export const RMA_ADIMLARI = ["talep", "teslim_alindi", "inceleme", "karar", "tamamlandi", "gonderildi"] as const;
export type RmaAdimi = (typeof RMA_ADIMLARI)[number];
export const ADIM_ADI: Record<RmaAdimi, string> = {
  talep: "Talep alındı", teslim_alindi: "Cihaz teslim alındı", inceleme: "İnceleme", karar: "Karar verildi", tamamlandi: "İşlem tamamlandı", gonderildi: "Müşteriye gönderildi",
};

export type RmaKarari = "tamir" | "degisim" | "iade" | "red";
export const KARAR_ADI: Record<RmaKarari, string> = { tamir: "Tamir", degisim: "Değişim (yeni cihaz)", iade: "İade (para iadesi)", red: "Red (kapsam dışı)" };

export const ARIZA_TIPLERI = ["Ekran / dokunmatik", "Bağlantı (OBD / K-Line)", "Güç / batarya", "Yazılım / firmware", "Kablo / aksesuar", "Fiziksel hasar", "Diğer"] as const;
export type ArizaTipi = (typeof ARIZA_TIPLERI)[number];

export type RmaKaydi = {
  id: string; // "RMA-0007"
  seriNo: string;
  model: CihazModeli;
  sahip: { tur: "musteri" | "bayi"; id: string | null; ad: string };
  arizaTipi: ArizaTipi;
  ariza: string;
  fotograflar: string[]; // şimdilik dosya adı ya da bağlantı
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
  oncelik: RmaOncelik;
};

/** sistem: adım / karar kaydı · not: iç teknik not · gorusme: müşteriyle yapılan görüşme */
export type GecmisKaydi = { zaman: string; metin: string; tur?: "sistem" | "not" | "gorusme"; yazan?: string }; // zaman "2026-11-04T10:20"
export const GELIS_KANALLARI = ["Kargo", "Elden teslim", "Bayi üzerinden", "Saha servisi"] as const;
export type GelisKanali = (typeof GELIS_KANALLARI)[number];
export const ONCELIKLER = ["Normal", "Acil"] as const;
export type RmaOncelik = (typeof ONCELIKLER)[number];
/** Hedef çözüm süresi (gün): açılıştan müşteriye gönderime */
export const HEDEF_GUN = 7;

const DEMO: Omit<RmaKaydi, "gelis" | "kargo" | "ucretOdendi" | "oncelik">[] = [
  {
    id: "RMA-0006", seriNo: "EO1-2402-0612", model: "ONE", sahip: { tur: "musteri", id: "volant", ad: "Volant Lenkung Service" },
    arizaTipi: "Ekran / dokunmatik", ariza: "Ekranın sağ alt köşesi dokunmaya yanıt vermiyor.", fotograflar: ["ekran-sag-alt.jpg"],
    garantide: true, garantiElle: null, ucret: null, adim: "inceleme", karar: null, kullanilanParcalar: {}, yeniSeri: null,
    destekTalebiId: "4815", iadeId: null, kaynak: "crm", acilis: "2026-10-30", kapanis: null,
    gecmis: [{ zaman: "2026-10-30T10:05", metin: "RMA açıldı (destek talebi #4815)." }, { zaman: "2026-11-03T09:40", metin: "Cihaz teslim alındı." }, { zaman: "2026-11-03T14:10", metin: "İncelemeye alındı." }],
  },
  {
    id: "RMA-0005", seriNo: "EO1-2309-0142", model: "ONE", sahip: { tur: "musteri", id: "akdeniz", ad: "Akdeniz Direksiyon Servisi" },
    arizaTipi: "Güç / batarya", ariza: "Cihaz şarjda açılmıyor.", fotograflar: [], garantide: false, garantiElle: null, ucret: 6_500,
    adim: "talep", karar: null, kullanilanParcalar: {}, yeniSeri: null, destekTalebiId: null, iadeId: null, kaynak: "crm", acilis: "2026-11-07", kapanis: null,
    gecmis: [{ zaman: "2026-11-07T11:20", metin: "RMA açıldı. Garanti dışı · servis ücreti ₺6.500 bildirildi." }],
  },
  {
    id: "RMA-0004", seriNo: "EO1-2610-0661", model: "ONE", sahip: { tur: "musteri", id: "iberia", ad: "Iberia Dirección SL" },
    arizaTipi: "Bağlantı (OBD / K-Line)", ariza: "K-Line hattında kopma.", fotograflar: [], garantide: true, garantiElle: null, ucret: null,
    adim: "gonderildi", karar: "tamir", kullanilanParcalar: { "PCB-MAIN": 1 }, yeniSeri: null, destekTalebiId: null, iadeId: null, kaynak: "crm",
    acilis: "2026-10-12", kapanis: "2026-10-19",
    gecmis: [{ zaman: "2026-10-12T09:00", metin: "RMA açıldı." }, { zaman: "2026-10-15T16:00", metin: "Karar: Tamir · Ana kart değiştirildi." }, { zaman: "2026-10-19T10:30", metin: "Müşteriye gönderildi." }],
  },
];

const EK: Record<string, Partial<RmaKaydi>> = {
  "RMA-0006": { gelis: { kanal: "Kargo", takipNo: "UPS 1Z88F4E2" }, oncelik: "Acil" },
  "RMA-0004": { gelis: { kanal: "Kargo", takipNo: "UPS 1Z77A1" }, kargo: { firma: "UPS Express", takipNo: "1Z88F4E20444719921" } },
};

type Depo = { kayitlar: RmaKaydi[]; garantiAy: number };
const g = globalThis as { __embedraRma?: Depo };
const DEPO = (g.__embedraRma ??= { kayitlar: structuredClone(DEMO) as RmaKaydi[], garantiAy: 24 });
// Sonradan eklenen alanlar (bellekte eski kayıtlar varsa da tamamlanır)
for (const r of DEPO.kayitlar) {
  const e = EK[r.id] ?? {};
  r.gelis ??= e.gelis ?? null;
  r.kargo ??= e.kargo ?? null;
  r.ucretOdendi ??= false;
  r.oncelik ??= e.oncelik ?? "Normal";
}

export async function getRmalar(): Promise<RmaKaydi[]> {
  return DEPO.kayitlar;
}
export async function getRma(id: string) {
  return DEPO.kayitlar.find((r) => r.id === id) ?? null;
}
export async function getGarantiAy() {
  return DEPO.garantiAy;
}

// Aşağıdakiler yalnızca action dosyalarından çağrılır.
export async function garantiAyKaydet(ay: number) {
  DEPO.garantiAy = ay;
}
export async function sonrakiRmaNo() {
  const en = Math.max(0, ...DEPO.kayitlar.map((r) => Number(r.id.slice(4)) || 0));
  return `RMA-${String(en + 1).padStart(4, "0")}`;
}
export async function rmaEkle(r: RmaKaydi) {
  DEPO.kayitlar.unshift(r);
}
export async function rmayiGuncelle(id: string, f: (r: RmaKaydi) => void) {
  const r = DEPO.kayitlar.find((x) => x.id === id);
  if (r) f(r);
  return r ?? null;
}

export async function getCihazRmalari(seriNo: string) {
  return DEPO.kayitlar.filter((r) => r.seriNo === seriNo || r.yeniSeri === seriNo);
}
