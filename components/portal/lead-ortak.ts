// Bayinin kendi lead'leri: tipler ve sabitler (istemci ve sunucu ortak). Embedra bu kayıtları görmez.
import type { TeklifDurumu, TeklifKalemi } from "@/components/teklifler/queries";

/** Bayinin ülkesindeki varsayılan KDV / VAT oranı (teklif formunda değiştirilebilir) */
export const YEREL_KDV: Record<string, number> = { TR: 0.2, RO: 0.21, BG: 0.2, DE: 0.19, AZ: 0.18, GR: 0.24, PL: 0.23, CZ: 0.21, ES: 0.21, RS: 0.2 };

/** Lead'in güncel teklifi (son sürüm) */
export const guncelTeklif = (l: { teklifler: BayiTeklif[] }) => l.teklifler[l.teklifler.length - 1] ?? null;

export const LEAD_ASAMALARI = ["yeni", "gorusuldu", "demo", "teklif", "kazanildi", "kaybedildi"] as const;
export type LeadAsamasi = (typeof LEAD_ASAMALARI)[number];
export const ASAMA_AD: Record<LeadAsamasi, string> = {
  yeni: "Yeni", gorusuldu: "Görüşüldü", demo: "Demo", teklif: "Teklif", kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
};
export const ACIK_ASAMALAR: LeadAsamasi[] = ["yeni", "gorusuldu", "demo", "teklif"];

export const LEAD_KAYNAKLARI = ["Fuar", "Referans", "Sosyal medya", "Saha ziyareti", "Mevcut müşteri", "Web sitesi", "Diğer"] as const;
export const KAYIP_NEDENLERI = ["Fiyat", "Rakip ürün", "Bütçe yok", "Zamanlama", "Yanıt vermedi", "Diğer"] as const;

export type LeadNotu = { zaman: string; metin: string; sistem?: boolean; _id?: number }; // zaman "2026-11-16T12:30" · _id: veritabanı satırı (yeni notta yok)
/** Bayinin müşterisine verdiği teklif. Kalem tipi ve hesaplar CRM teklifleriyle aynı (components/teklifler). */
export type BayiTeklif = {
  id: string; // "DP-2026-015" (ilk sürüm), "DP-2026-015-v2"
  no: string; // ekranda: "DP-2026-015 v2"
  versiyon: number;
  kalemler: TeklifKalemi[]; // birimFiyat: bayinin satış fiyatı (KDV hariç, bayinin para biriminde)
  iskonto: number; // %
  kdv: number; // 0.21 — bayinin ülkesindeki KDV / VAT oranı
  gecerlilik: string;
  odemeSartlari: string;
  teslimSartlari: string;
  not: string;
  durum: TeklifDurumu;
  olusturma: string;
  gonderim: string | null;
  sonuc: string | null;
};

export type BayiLead = {
  id: string;
  bayiId: string;
  firma: string;
  yetkili: string;
  telefon: string;
  eposta: string;
  sehir: string;
  kaynak: string;
  ilgi: { model: "ONE" | "ONE Lite"; adet: number; plan: "" | "Basic" | "Pro" | "Pro+" };
  tutar: number | null; // tahmini, bayinin para biriminde
  asama: LeadAsamasi;
  kayipNedeni: string | null;
  sonrakiAdim: string;
  sonrakiTarih: string | null; // "2026-11-20"
  olusturma: string; // "2026-11-02"
  kapanis: string | null; // kazanıldı / kaybedildi tarihi
  notlar: LeadNotu[]; // eskiden yeniye
  teklifler: BayiTeklif[]; // sürümler, eskiden yeniye (son eleman güncel)
  satilanSeriler: string[]; // kazanılınca satıldı bildirilen cihazlar
};
