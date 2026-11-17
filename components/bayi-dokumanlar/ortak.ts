// Bayi dokümanları ve duyuruları: tipler ve sabitler (CRM, portal ve istemci ortak).
// CRM'de "Bayi & Distribütör › Doküman & duyurular" ekranından yönetilir, bayi portalının Dokümanlar sayfasında görünür.

export const DOKUMAN_KATEGORILERI = ["Ürün broşürleri", "Teknik dokümanlar", "Eğitim", "Sözleşme ekleri", "Pazarlama"] as const;
export type DokumanKategorisi = (typeof DOKUMAN_KATEGORILERI)[number];

export type DokumanTuru = "pdf" | "gorsel" | "video";
export const DOSYA_TIPLERI: Record<string, DokumanTuru> = {
  "application/pdf": "pdf", "image/jpeg": "gorsel", "image/png": "gorsel", "image/webp": "gorsel", "video/mp4": "video", "video/webm": "video",
};
/** Sunucu işlemi gövde sınırı 4,5 MB (next.config); daha büyükleri Supabase Storage'a doğrudan yüklenmeli */
export const DOKUMAN_SINIRI = 4 * 1024 * 1024;

export type BayiDokumani = {
  id: string;
  baslik: string;
  aciklama: string;
  kategori: DokumanKategorisi;
  tur: DokumanTuru;
  dosyaAdi: string;
  mime?: string; // yüklenen dosyanın türü ("application/pdf")
  boyut: number; // bayt
  tarih: string; // "2026-11-10"
  hedef: "hepsi" | string[]; // tüm bayiler ya da bayi id'leri
  sure?: string; // eğitim: "12 dk"
  demo?: boolean; // dosyası örnek olarak üretilir (gerçek yükleme yok)
};

export type Duyuru = {
  id: string;
  baslik: string;
  metin: string;
  onem: "normal" | "onemli";
  tarih: string; // "2026-11-12T10:00"
  hedef: "hepsi" | string[];
  okuyanlar: string[]; // bayi id'leri
};

export const hedefteMi = (hedef: "hepsi" | string[], bayiId: string) => hedef === "hepsi" || hedef.includes(bayiId);

export function boyutYaz(b: number) {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
