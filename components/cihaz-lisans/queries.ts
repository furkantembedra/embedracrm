// Cihaz & Lisans: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("devices")... ile değiştirin.

import type { CihazModeli } from "@/lib/urunler";

export type LisansPlani = "Basic" | "Pro" | "Pro+";
export type CihazDurumu = "aktif" | "bitiyor" | "lisanssiz" | "stokta"; // stokta: bayiye sevk edildi, henüz müşteriye satılmadı

export type LisansKaydi = { plan: LisansPlani; baslangic: string; bitis: string };

/** Cihazın bildirdiği (veya elle girilen) sürüm değişikliği */
export type SurumKaydi = { zaman: string; eski: string; yeni: string; kaynak: "cihaz" | "elle" }; // zaman: ISO

export type Cihaz = {
  seriNo: string; // aynı zamanda adres: /cihaz-lisans/EO1-2402-0611
  model: CihazModeli;
  musteriId: string | null;
  musteri: string;
  ulke: string;
  plan: LisansPlani;
  lisansBaslangic: string | null; // "2026-03-14" (aktivasyon)
  lisansBitis: string | null; // "2027-03-14"
  firmware: string; // "v2.4.1"
  durum: CihazDurumu;
  gecmis: LisansKaydi[]; // yeniden eskiye
  sonGorulme?: string | null; // ONESuite'in son bildirim zamanı (ISO). Hiç bağlanmadıysa yok
  surumGecmisi?: SurumKaydi[]; // yeniden eskiye
  bayiId?: string | null; // bayi üzerinden satıldıysa (bayi stoğundayken de dolu)
  stogaGiris?: string | null; // bayiye sevk tarihi "2026-11-05"
};

export type CihazOzeti = {
  kayitli: number;
  ulke: number;
  aktif: number;
  bitiyor: number; // 30 gün içinde
  planlar: Record<LisansPlani, number>;
  modeller: Record<CihazModeli, number>; // kayıtlı cihazların model dağılımı
  firmware: { surum: string; adet: number; renk: string }[];
};

export const DURUM_ADI: Record<CihazDurumu, string> = {
  aktif: "Aktif",
  bitiyor: "Süresi doluyor",
  lisanssiz: "Lisanssız",
  stokta: "Bayi stoğunda",
};

export const PLAN_ACIKLAMASI: Record<LisansPlani, string> = {
  Basic: "Temel direksiyon testleri",
  Pro: "Tam teşhis, flash ve canlı veri",
  "Pro+": "Pro'nun tümü + 2 cihaz desteği",
};

/** Bu sürümle başlamayan firmware "eski" sayılır */
export const GUNCEL_FIRMWARE = "v2.4";

const DEMO: Cihaz[] = [
  {
    seriNo: "EO1-2402-0611", model: "ONE", musteriId: "volant", musteri: "Volant Lenkung Service", ulke: "Almanya", plan: "Pro+",
    lisansBaslangic: "2026-03-14", lisansBitis: "2027-03-14", firmware: "v2.4.1", durum: "aktif",
    gecmis: [
      { plan: "Pro+", baslangic: "2026-03-14", bitis: "2027-03-14" },
      { plan: "Pro", baslangic: "2025-03-14", bitis: "2026-03-14" },
    ],
  },
  {
    seriNo: "EO1-2402-0612", model: "ONE", musteriId: "volant", musteri: "Volant Lenkung Service", ulke: "Almanya", plan: "Pro+",
    lisansBaslangic: "2026-03-14", lisansBitis: "2027-03-14", firmware: "v2.3.0", durum: "aktif",
    gecmis: [{ plan: "Pro+", baslangic: "2026-03-14", bitis: "2027-03-14" }],
  },
  {
    seriNo: "EO1-2309-0142", model: "ONE", musteriId: "akdeniz", musteri: "Akdeniz Direksiyon Servisi", ulke: "Türkiye", plan: "Pro",
    lisansBaslangic: "2025-11-06", lisansBitis: "2026-11-06", firmware: "v2.2.4", durum: "bitiyor",
    gecmis: [
      { plan: "Pro", baslangic: "2025-11-06", bitis: "2026-11-06" },
      { plan: "Basic", baslangic: "2024-11-06", bitis: "2025-11-06" },
    ],
  },
  {
    seriNo: "EO1-2406-0455", model: "ONE", musteriId: "kaya", musteri: "Kaya Oto Elektronik", ulke: "Türkiye", plan: "Pro",
    lisansBaslangic: "2026-06-02", lisansBitis: "2027-06-02", firmware: "v2.4.1", durum: "aktif",
    gecmis: [{ plan: "Pro", baslangic: "2026-06-02", bitis: "2027-06-02" }],
  },
  {
    seriNo: "EO1-2404-0390", model: "ONE", musteriId: "polska", musteri: "Polska EPS Serwis", ulke: "Polonya", plan: "Pro+",
    lisansBaslangic: "2026-01-30", lisansBitis: "2027-01-30", firmware: "v2.4.0", durum: "aktif",
    gecmis: [{ plan: "Pro+", baslangic: "2026-01-30", bitis: "2027-01-30" }],
  },
  {
    seriNo: "EO1-2310-0218", model: "ONE", musteriId: "bursa", musteri: "Bursa ECU Lab", ulke: "Türkiye", plan: "Pro+",
    lisansBaslangic: "2025-11-11", lisansBitis: "2026-11-11", firmware: "v2.4.1", durum: "bitiyor",
    gecmis: [{ plan: "Pro+", baslangic: "2025-11-11", bitis: "2026-11-11" }],
  },
  {
    seriNo: "EO1-2311-0301", model: "ONE Lite", musteriId: null, musteri: "Atelier Direction Lyon", ulke: "Fransa", plan: "Basic",
    lisansBaslangic: "2025-11-14", lisansBitis: "2026-11-14", firmware: "v2.3.2", durum: "bitiyor",
    gecmis: [{ plan: "Basic", baslangic: "2025-11-14", bitis: "2026-11-14" }],
  },
  {
    seriNo: "EO1-2404-0391", model: "ONE", musteriId: "polska", musteri: "Polska EPS Serwis", ulke: "Polonya", plan: "Pro+",
    lisansBaslangic: "2026-01-30", lisansBitis: "2027-01-30", firmware: "v2.4.0", durum: "aktif",
    gecmis: [{ plan: "Pro+", baslangic: "2026-01-30", bitis: "2027-01-30" }],
  },
  {
    seriNo: "EO1-2312-0412", model: "ONE", musteriId: "nordic", musteri: "Nordic Steering AB", ulke: "İsveç", plan: "Pro+",
    lisansBaslangic: null, lisansBitis: null, firmware: "v2.4.1", durum: "lisanssiz",
    gecmis: [{ plan: "Pro+", baslangic: "2025-12-04", bitis: "2026-12-04" }],
  },
  {
    seriNo: "EO1-2311-0322", model: "ONE", musteriId: "ege", musteri: "Ege Meslek Yüksekokulu", ulke: "Türkiye", plan: "Pro",
    lisansBaslangic: "2025-11-19", lisansBitis: "2026-11-19", firmware: "v2.3.2", durum: "bitiyor",
    gecmis: [{ plan: "Pro", baslangic: "2025-11-19", bitis: "2026-11-19" }],
  },
  {
    seriNo: "EO1-2312-0390", model: "ONE", musteriId: "nordic", musteri: "Nordic Steering AB", ulke: "İsveç", plan: "Pro+",
    lisansBaslangic: "2025-11-28", lisansBitis: "2026-11-28", firmware: "v2.4.1", durum: "bitiyor",
    gecmis: [{ plan: "Pro+", baslangic: "2025-11-28", bitis: "2026-11-28" }],
  },
  {
    seriNo: "EO1-2305-0077", model: "ONE Lite", musteriId: null, musteri: "Anadolu Teknik Lisesi", ulke: "Türkiye", plan: "Basic",
    lisansBaslangic: "2026-05-22", lisansBitis: "2027-05-22", firmware: "v2.1.8", durum: "aktif",
    gecmis: [
      { plan: "Basic", baslangic: "2026-05-22", bitis: "2027-05-22" },
      { plan: "Basic", baslangic: "2025-05-22", bitis: "2026-05-22" },
    ],
  },
  {
    seriNo: "EO1-2401-0533", model: "ONE Lite", musteriId: "baskent", musteri: "Başkent Rot & Direksiyon", ulke: "Türkiye", plan: "Basic",
    lisansBaslangic: null, lisansBitis: null, firmware: "v2.4.1", durum: "lisanssiz",
    gecmis: [{ plan: "Basic", baslangic: "2025-04-11", bitis: "2026-04-11" }],
  },
];

// Filo geneli sayılar. Supabase'de count sorgularıyla hesaplanacak (liste sayfalanırken de doğru kalır).
const OZET: CihazOzeti = {
  kayitli: 1038,
  ulke: 23,
  aktif: 945,
  bitiyor: 64,
  planlar: { Basic: 473, Pro: 586, "Pro+": 187 },
  modeller: { ONE: 712, "ONE Lite": 326 }, // toplam = kayitli
  firmware: [
    { surum: "v2.4.1 (güncel)", adet: 548, renk: "#B6DD2E" },
    { surum: "v2.4.0", adet: 116, renk: "#0E0F0C" },
    { surum: "v2.3.x", adet: 271, renk: "#E58A2B" },
    { surum: "v2.2.x ve öncesi", adet: 103, renk: "#D93F3F" },
  ],
};

// Demo depo: sunucu belleğinde, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
const g = globalThis as { __embedraCihazlar?: Cihaz[] };
const DEPO = (g.__embedraCihazlar ??= structuredClone(DEMO));
// Model alanı sonradan eklendi: o tarihten önce belleğe alınmış kayıtlara modeli işle (sunucu yeniden başlatılmadan)
for (const c of DEPO) {
  if (!c.model) c.model = DEMO.find((d) => d.seriNo === c.seriNo)?.model ?? "ONE";
}

export async function getCihazlar(): Promise<Cihaz[]> {
  return DEPO;
}

export async function getCihaz(seriNo: string): Promise<Cihaz | null> {
  return DEPO.find((c) => c.seriNo === seriNo) ?? null;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function cihazEkleDepo(c: Cihaz): Promise<boolean> {
  if (DEPO.some((x) => x.seriNo === c.seriNo)) return false;
  DEPO.unshift(c);
  return true;
}

export async function cihaziGuncelle(seriNo: string, yeni: (c: Cihaz) => Cihaz): Promise<Cihaz | null> {
  const i = DEPO.findIndex((c) => c.seriNo === seriNo);
  if (i < 0) return null;
  DEPO[i] = yeni(DEPO[i]);
  return DEPO[i];
}

/** Belirli bir zamandan sonra bildirim gönderen cihazlar (açık sayfanın canlı güncellenmesi için) */
export async function getSonBildirenler(sonra: string): Promise<Cihaz[]> {
  return DEPO.filter((c) => c.sonGorulme && c.sonGorulme > sonra);
}

export async function getCihazOzeti(): Promise<CihazOzeti> {
  return OZET;
}
