// Teklifler: satış hattındaki fırsattan hazırlanan fiyat teklifleri.
// Şimdilik demo veri (sunucu belleğinde). Supabase bağlanınca supabase.from("quotes" | "quote_items")… ile değiştirin.
import type { CihazModeli } from "@/lib/urunler";

/** taslak → gonderildi → kabul | red. Yeni revizyon açılınca eskisi "revize" olur. Süresi dolma, gecerlilik tarihinden hesaplanır. */
export type TeklifDurumu = "taslak" | "gonderildi" | "kabul" | "red" | "revize";

export type TeklifKalemi =
  | { tur: "cihaz"; model: CihazModeli; adet: number; birimFiyat: number }
  | { tur: "lisans"; paket: string; adet: number; birimFiyat: number }
  | { tur: "ozel"; aciklama: string; adet: number; birimFiyat: number; kdvli: boolean };

export type Teklif = {
  id: string; // "TKL-2026-0001"
  no: string; // "TKL-2026-0001 v2" (ekranda)
  kok: string; // ilk sürümün id'si; revizyonlar aynı kökü paylaşır
  versiyon: number;
  firsatId: string;
  firma: string;
  konum: string;
  kalemler: TeklifKalemi[];
  iskonto: number; // % (ara toplamdan)
  kdv: number; // 0.2 (cihaz ve KDV'li özel kalemlere)
  gecerlilik: string; // "2026-11-25"
  odemeSartlari: string;
  teslimSartlari: string;
  not: string;
  durum: TeklifDurumu;
  olusturma: string; // "2026-11-06"
  gonderim: string | null;
  sonuc: string | null; // kabul / red tarihi
  siparisNo?: string | null; // kabul edilince açılan sipariş
};

export const DURUM_ADI: Record<TeklifDurumu, string> = {
  taslak: "Taslak", gonderildi: "Gönderildi", kabul: "Kabul edildi", red: "Reddedildi", revize: "Revize edildi",
};

const DEMO: Teklif[] = [
  {
    id: "TKL-2026-0001", no: "TKL-2026-0001", kok: "TKL-2026-0001", versiyon: 1, firsatId: "f7", firma: "Başkent Rot & Direksiyon", konum: "Ankara, TR",
    kalemler: [{ tur: "cihaz", model: "ONE", adet: 1, birimFiyat: 98_000 }, { tur: "lisans", paket: "Pro", adet: 2, birimFiyat: 70_000 }],
    iskonto: 5, kdv: 0.2, gecerlilik: "2026-11-12", odemeSartlari: "%50 peşin, %50 teslimde · Havale/EFT", teslimSartlari: "Siparişten itibaren 5 iş günü · Kargo dahil",
    not: "Mevcut Basic lisans Pro'ya yükseltilir.", durum: "gonderildi", olusturma: "2026-11-02", gonderim: "2026-11-02", sonuc: null,
  },
  {
    id: "TKL-2026-0002", no: "TKL-2026-0002", kok: "TKL-2026-0002", versiyon: 1, firsatId: "f6", firma: "Atelier Direction Lyon", konum: "Lyon, FR",
    kalemler: [{ tur: "lisans", paket: "Pro", adet: 1, birimFiyat: 70_000 }, { tur: "ozel", aciklama: "Basic lisans kalan süre mahsubu", adet: 1, birimFiyat: -14_000, kdvli: false }],
    iskonto: 0, kdv: 0.2, gecerlilik: "2026-11-15", odemeSartlari: "Kartla peşin", teslimSartlari: "Lisans anahtarı ödeme sonrası e-postayla",
    not: "", durum: "gonderildi", olusturma: "2026-10-28", gonderim: "2026-10-28", sonuc: null,
  },
];

const g = globalThis as { __embedraTeklifler?: Teklif[] };
const DEPO = (g.__embedraTeklifler ??= structuredClone(DEMO));

export async function getTeklifler(): Promise<Teklif[]> {
  return DEPO;
}

export async function getTeklif(id: string): Promise<Teklif | null> {
  return DEPO.find((t) => t.id === id) ?? null;
}

export async function sonrakiTeklifNo(yil: number): Promise<string> {
  const onek = `TKL-${yil}-`;
  const en = Math.max(0, ...DEPO.filter((t) => t.id.startsWith(onek)).map((t) => Number(t.id.slice(onek.length).split("-")[0]) || 0));
  return `${onek}${String(en + 1).padStart(4, "0")}`;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır.
export async function teklifEkle(t: Teklif) {
  DEPO.unshift(t);
}

export async function teklifiGuncelle(id: string, f: (t: Teklif) => void): Promise<Teklif | null> {
  const t = DEPO.find((x) => x.id === id);
  if (t) f(t);
  return t ?? null;
}
