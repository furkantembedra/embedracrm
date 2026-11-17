// Raporlar: tipler ve dönem adları (istemci ve sunucu ortak). Veri sunucuda rapor-verisi.ts › getRaporOzeti() ile
// CRM kayıtlarından hesaplanır.

export const DONEMLER = ["30g", "ceyrek", "yil"] as const;
export type Donem = (typeof DONEMLER)[number];

export const DONEM_BILGI: Record<Donem, { kisa: string; uzun: string }> = {
  "30g": { kisa: "30 gün", uzun: "Son 30 gün" },
  ceyrek: { kisa: "Çeyrek", uzun: "Bu çeyrek" },
  yil: { kisa: "Yıl", uzun: "Yılbaşından bugüne" },
};

/** degisim boşsa karşılaştırma yok; not verilirse "önceki döneme göre" yerine o yazılır */
export type Kpi = { etiket: string; deger: string; degisim: string; iyi: boolean; not?: string };
export type UlkeGeliri = { kod: string; ad: string; tutar: number }; // TL
export type KonuPayi = { ad: string; yuzde: number; renk: string };
export type KaynakDonusumu = { ad: string; lead: number; musteri: number };
export type AylikYenileme = { ay: string; oran: number; biten: number; yenilenen: number }; // oran %

export type DonemRaporu = {
  etiket: string; // "Eki – Ara 2026 · bugüne kadar"
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
