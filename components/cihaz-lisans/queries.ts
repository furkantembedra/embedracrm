// Cihaz & Lisans: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("devices")... ile değiştirin.

export type LisansPlani = "Basic" | "Pro" | "Pro+";
export type CihazDurumu = "aktif" | "bitiyor" | "serviste" | "lisanssiz";
export type RmaAdimi = "Teşhiste" | "Parça bekliyor" | "Kargoda";

export type LisansKaydi = { plan: LisansPlani; baslangic: string; bitis: string };

export type Cihaz = {
  seriNo: string; // aynı zamanda adres: /cihaz-lisans/EO1-2402-0611
  musteriId: string | null;
  musteri: string;
  ulke: string;
  plan: LisansPlani;
  lisansBaslangic: string | null; // "2026-03-14" (aktivasyon)
  lisansBitis: string | null; // "2027-03-14"
  firmware: string; // "v2.4.1"
  durum: CihazDurumu;
  gecmis: LisansKaydi[]; // yeniden eskiye
};

export type RmaKaydi = { seriNo: string; sorun: string; adim: RmaAdimi };

export type CihazOzeti = {
  kayitli: number;
  ulke: number;
  aktif: number;
  bitiyor: number; // 30 gün içinde
  serviste: number;
  ortDonusGun: number;
  planlar: Record<LisansPlani, number>;
  firmware: { surum: string; adet: number; renk: string }[];
};

export const DURUM_ADI: Record<CihazDurumu, string> = {
  aktif: "Aktif",
  bitiyor: "Süresi doluyor",
  serviste: "Serviste",
  lisanssiz: "Lisanssız",
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
    seriNo: "EO1-2402-0611", musteriId: "volant", musteri: "Volant Lenkung Service", ulke: "Almanya", plan: "Pro+",
    lisansBaslangic: "2026-03-14", lisansBitis: "2027-03-14", firmware: "v2.4.1", durum: "aktif",
    gecmis: [
      { plan: "Pro+", baslangic: "2026-03-14", bitis: "2027-03-14" },
      { plan: "Pro", baslangic: "2025-03-14", bitis: "2026-03-14" },
    ],
  },
  {
    seriNo: "EO1-2402-0612", musteriId: "volant", musteri: "Volant Lenkung Service", ulke: "Almanya", plan: "Pro+",
    lisansBaslangic: "2026-03-14", lisansBitis: "2027-03-14", firmware: "v2.3.0", durum: "aktif",
    gecmis: [{ plan: "Pro+", baslangic: "2026-03-14", bitis: "2027-03-14" }],
  },
  {
    seriNo: "EO1-2309-0142", musteriId: "akdeniz", musteri: "Akdeniz Direksiyon Servisi", ulke: "Türkiye", plan: "Pro",
    lisansBaslangic: "2025-11-06", lisansBitis: "2026-11-06", firmware: "v2.2.4", durum: "bitiyor",
    gecmis: [
      { plan: "Pro", baslangic: "2025-11-06", bitis: "2026-11-06" },
      { plan: "Basic", baslangic: "2024-11-06", bitis: "2025-11-06" },
    ],
  },
  {
    seriNo: "EO1-2406-0455", musteriId: "kaya", musteri: "Kaya Oto Elektronik", ulke: "Türkiye", plan: "Pro",
    lisansBaslangic: "2026-06-02", lisansBitis: "2027-06-02", firmware: "v2.4.1", durum: "aktif",
    gecmis: [{ plan: "Pro", baslangic: "2026-06-02", bitis: "2027-06-02" }],
  },
  {
    seriNo: "EO1-2404-0390", musteriId: "polska", musteri: "Polska EPS Serwis", ulke: "Polonya", plan: "Pro+",
    lisansBaslangic: "2026-01-30", lisansBitis: "2027-01-30", firmware: "v2.4.0", durum: "aktif",
    gecmis: [{ plan: "Pro+", baslangic: "2026-01-30", bitis: "2027-01-30" }],
  },
  {
    seriNo: "EO1-2310-0218", musteriId: "bursa", musteri: "Bursa ECU Lab", ulke: "Türkiye", plan: "Pro+",
    lisansBaslangic: "2025-11-11", lisansBitis: "2026-11-11", firmware: "v2.4.1", durum: "bitiyor",
    gecmis: [{ plan: "Pro+", baslangic: "2025-11-11", bitis: "2026-11-11" }],
  },
  {
    seriNo: "EO1-2311-0301", musteriId: null, musteri: "Atelier Direction Lyon", ulke: "Fransa", plan: "Basic",
    lisansBaslangic: "2025-11-14", lisansBitis: "2026-11-14", firmware: "v2.3.2", durum: "bitiyor",
    gecmis: [{ plan: "Basic", baslangic: "2025-11-14", bitis: "2026-11-14" }],
  },
  {
    seriNo: "EO1-2305-0077", musteriId: null, musteri: "Anadolu Teknik Lisesi", ulke: "Türkiye", plan: "Basic",
    lisansBaslangic: "2026-05-22", lisansBitis: "2027-05-22", firmware: "v2.1.8", durum: "aktif",
    gecmis: [
      { plan: "Basic", baslangic: "2026-05-22", bitis: "2027-05-22" },
      { plan: "Basic", baslangic: "2025-05-22", bitis: "2026-05-22" },
    ],
  },
  {
    seriNo: "EO1-2401-0533", musteriId: "baskent", musteri: "Başkent Rot & Direksiyon", ulke: "Türkiye", plan: "Basic",
    lisansBaslangic: null, lisansBitis: null, firmware: "v2.4.1", durum: "serviste",
    gecmis: [{ plan: "Basic", baslangic: "2025-04-11", bitis: "2026-04-11" }],
  },
];

const RMA: RmaKaydi[] = [
  { seriNo: "EO1-2401-0533", sorun: "Ana bağlantı portu temassızlık", adim: "Teşhiste" },
  { seriNo: "EO1-2312-0412", sorun: "OLED ekran dokunmatik yanıt yok", adim: "Parça bekliyor" },
  { seriNo: "EO1-2308-0099", sorun: "Batarya şarj olmuyor", adim: "Kargoda" },
];

// Filo geneli sayılar. Supabase'de count sorgularıyla hesaplanacak (liste sayfalanırken de doğru kalır).
const OZET: CihazOzeti = {
  kayitli: 1038,
  ulke: 23,
  aktif: 945,
  bitiyor: 64,
  serviste: 7,
  ortDonusGun: 4.2,
  planlar: { Basic: 473, Pro: 586, "Pro+": 187 },
  firmware: [
    { surum: "v2.4.1 (güncel)", adet: 548, renk: "#B6DD2E" },
    { surum: "v2.4.0", adet: 116, renk: "#0E0F0C" },
    { surum: "v2.3.x", adet: 271, renk: "#E58A2B" },
    { surum: "v2.2.x ve öncesi", adet: 103, renk: "#D93F3F" },
  ],
};

export async function getCihazlar(): Promise<Cihaz[]> {
  return DEMO;
}

export async function getCihaz(seriNo: string): Promise<Cihaz | null> {
  return DEMO.find((c) => c.seriNo === seriNo) ?? null;
}

export async function getRmaKuyrugu(): Promise<RmaKaydi[]> {
  return RMA;
}

export async function getCihazOzeti(): Promise<CihazOzeti> {
  return OZET;
}
