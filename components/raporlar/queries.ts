// Raporlar: dönem özetleri. Şimdilik demo veri döner;
// Supabase bağlanınca bu sayılar orders / licenses / tickets / deals tablolarından toplanacak.

export const DONEMLER = ["30g", "ceyrek", "yil"] as const;
export type Donem = (typeof DONEMLER)[number];

export const DONEM_BILGI: Record<Donem, { kisa: string; uzun: string }> = {
  "30g": { kisa: "30 gün", uzun: "Son 30 gün" },
  ceyrek: { kisa: "Çeyrek", uzun: "Ağu – Eki 2026" },
  yil: { kisa: "Yıl", uzun: "2026 yılbaşından bugüne" },
};

export type Kpi = { etiket: string; deger: string; degisim: string; iyi: boolean };
export type UlkeGeliri = { kod: string; ad: string; tutar: number }; // TL
export type KonuPayi = { ad: string; yuzde: number; renk: string };
export type KaynakDonusumu = { ad: string; lead: number; musteri: number };
export type AylikYenileme = { ay: string; oran: number }; // %

export type DonemRaporu = {
  kpi: Kpi[];
  ulkeler: UlkeGeliri[];
  konular: KonuPayi[];
  kaynaklar: KaynakDonusumu[];
};

export type RaporOzeti = {
  donemler: Record<Donem, DonemRaporu>;
  yenileme: AylikYenileme[]; // son 12 ay
  yenilemeHedefi: number;
};

// Kategorik renkler sabit sırada (dataviz doğrulayıcısından geçti; beyaz zeminde etiket + tablo ile kullanılır)
const KONULAR: KonuPayi[] = [
  { ad: "Bağlantı", yuzde: 31, renk: "#2a78d6" },
  { ad: "Flash / yazılım", yuzde: 24, renk: "#eb6834" },
  { ad: "Lisans", yuzde: 18, renk: "#1baf7a" },
  { ad: "Araç kapsamı", yuzde: 15, renk: "#eda100" },
  { ad: "Donanım / RMA", yuzde: 12, renk: "#e87ba4" },
];

const KAYNAKLAR: KaynakDonusumu[] = [
  { ad: "Fuar & etkinlik", lead: 18, musteri: 4 },
  { ad: "Mevcut müşteri önerisi", lead: 27, musteri: 5 },
  { ad: "WhatsApp", lead: 51, musteri: 6 },
  { ad: "Instagram", lead: 36, musteri: 4 },
  { ad: "Web sitesi", lead: 82, musteri: 7 },
];

const kpi = (etiket: string, deger: string, degisim: string, iyi: boolean): Kpi => ({ etiket, deger, degisim, iyi });

const OZET: RaporOzeti = {
  donemler: {
    "30g": {
      kpi: [
        kpi("Toplam gelir", "₺1,28M", "+%12,4", true),
        kpi("Satılan cihaz", "38", "+6 adet", true),
        kpi("Yenileme oranı", "%89", "+1 puan", true),
        kpi("Ort. sipariş değeri", "₺118K", "-%3,1", false),
        kpi("Lead → müşteri", "%8,4", "+0,9 puan", true),
      ],
      ulkeler: [
        { kod: "TR", ad: "Türkiye", tutar: 612_000 }, { kod: "DE", ad: "Almanya", tutar: 318_000 },
        { kod: "RO", ad: "Romanya", tutar: 144_000 }, { kod: "PL", ad: "Polonya", tutar: 96_000 },
        { kod: "ES", ad: "İspanya", tutar: 71_000 }, { kod: "SE", ad: "İsveç", tutar: 43_000 },
      ],
      konular: KONULAR,
      kaynaklar: KAYNAKLAR,
    },
    ceyrek: {
      kpi: [
        kpi("Toplam gelir", "₺3,86M", "+%18,2", true),
        kpi("Satılan cihaz", "112", "+21 adet", true),
        kpi("Yenileme oranı", "%87", "+3 puan", true),
        kpi("Ort. sipariş değeri", "₺121K", "+%2,4", true),
        kpi("Lead → müşteri", "%7,9", "-0,4 puan", false),
      ],
      ulkeler: [
        { kod: "TR", ad: "Türkiye", tutar: 1_740_000 }, { kod: "DE", ad: "Almanya", tutar: 980_000 },
        { kod: "RO", ad: "Romanya", tutar: 510_000 }, { kod: "PL", ad: "Polonya", tutar: 280_000 },
        { kod: "ES", ad: "İspanya", tutar: 190_000 }, { kod: "SE", ad: "İsveç", tutar: 160_000 },
      ],
      konular: KONULAR,
      kaynaklar: KAYNAKLAR,
    },
    yil: {
      kpi: [
        kpi("Toplam gelir", "₺12,9M", "+%41", true),
        kpi("Satılan cihaz", "384", "+118 adet", true),
        kpi("Yenileme oranı", "%85", "+6 puan", true),
        kpi("Ort. sipariş değeri", "₺116K", "+%5,8", true),
        kpi("Lead → müşteri", "%7,6", "+1,2 puan", true),
      ],
      ulkeler: [
        { kod: "TR", ad: "Türkiye", tutar: 6_100_000 }, { kod: "DE", ad: "Almanya", tutar: 3_200_000 },
        { kod: "RO", ad: "Romanya", tutar: 1_400_000 }, { kod: "PL", ad: "Polonya", tutar: 900_000 },
        { kod: "ES", ad: "İspanya", tutar: 700_000 }, { kod: "SE", ad: "İsveç", tutar: 600_000 },
      ],
      konular: KONULAR,
      kaynaklar: KAYNAKLAR,
    },
  },
  yenileme: [
    { ay: "Kas", oran: 77.4 }, { ay: "Ara", oran: 79.4 }, { ay: "Oca", oran: 78.4 }, { ay: "Şub", oran: 81.3 },
    { ay: "Mar", oran: 83.3 }, { ay: "Nis", oran: 82.4 }, { ay: "May", oran: 84.2 }, { ay: "Haz", oran: 85.2 },
    { ay: "Tem", oran: 83.3 }, { ay: "Ağu", oran: 86.2 }, { ay: "Eyl", oran: 87.1 }, { ay: "Eki", oran: 89 },
  ],
  yenilemeHedefi: 85,
};

export async function getRaporOzeti(): Promise<RaporOzeti> {
  return OZET;
}
