// Sipariş bileşenlerinin ve server action'ların paylaştığı yardımcılar (istemci ve sunucuda çalışır)
import type { ChipTon } from "@/components/ui/chip";
import { URUN_BILGI } from "@/lib/urunler";
import type { Kalem, ParaBirimi, Siparis, SiparisDurumu, StokKalemi } from "./queries";

export const DURUM_ADI: Record<SiparisDurumu, string> = {
  odeme: "Ödeme bekliyor",
  hazirlaniyor: "Hazırlanıyor",
  kargoda: "Kargoda",
  teslim: "Teslim edildi",
  tamamlandi: "Tamamlandı",
};
export const DURUM_TONU: Record<SiparisDurumu, ChipTon> = { odeme: "warn", hazirlaniyor: "info", kargoda: "ink", teslim: "lime", tamamlandi: "ok" };

export type Sekme = "tumu" | SiparisDurumu;
export const SEKMELER: { id: Sekme; ad: string }[] = [
  { id: "tumu", ad: "Tümü" },
  { id: "odeme", ad: "Ödeme bekliyor" },
  { id: "hazirlaniyor", ad: "Hazırlanıyor" },
  { id: "kargoda", ad: "Kargoda" },
  { id: "teslim", ad: "Teslim edildi" },
  { id: "tamamlandi", ad: "Tamamlandı" },
];
export const sekmede = (s: Siparis, sekme: Sekme) => sekme === "tumu" || s.durum === sekme;
/** Ödemesi alınmış ama faturası kesilmemiş sipariş (özet kartı ve liste filtresi aynı kuralı kullanır) */
export const faturaBekliyor = (s: Siparis) => s.durum !== "odeme" && !s.faturaNo;

/** Kargo gerektirmeyen (yalnızca lisans) sipariş */
export const dijital = (s: Siparis) => s.kalemler.every((k) => k.tur === "lisans");
export const cihazAdedi = (s: Siparis) => s.kalemler.reduce((t, k) => t + (k.tur === "cihaz" ? k.adet : 0), 0);
export const lisansVar = (s: Siparis) => s.kalemler.some((k) => k.tur === "lisans");
/** Seri no ataması bitmiş, kargoya verilebilir */
export const seriTamam = (s: Siparis) => s.seriNolar.length >= cihazAdedi(s);
export const yurtDisi = (s: Siparis) => s.ulke !== "Türkiye";

export function para(n: number, birim: ParaBirimi) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: birim, maximumFractionDigits: 0 }).format(n);
}

export function kalemAdi(k: Kalem, stok: StokKalemi[] = []) {
  if (k.tur === "cihaz") return `${k.adet}× ${URUN_BILGI[k.model].ad}`;
  if (k.tur === "lisans") return `${k.adet > 1 ? `${k.adet}× ` : ""}${k.paket} lisans`;
  return `${k.adet}× ${stok.find((x) => x.kod === k.stokKodu)?.ad ?? k.stokKodu}`;
}

/** İade / değişim formunda seçilebilen ürünler: her cihaz seri no'suyla tek tek, aksesuar ve lisanslar kalem olarak */
export function iadeSecenekleri(s: Siparis, stok: StokKalemi[] = []): { id: string; ad: string; alt: string }[] {
  const modeller = s.kalemler.flatMap((k) => (k.tur === "cihaz" ? Array<string>(k.adet).fill(URUN_BILGI[k.model].ad) : []));
  const cihazlar = s.seriNolar.map((no, i) => ({ id: no, ad: no, alt: modeller[i] ?? "Cihaz" }));
  const diger = s.kalemler.flatMap((k, i) =>
    k.tur === "cihaz" ? [] : [{ id: `k${i}`, ad: kalemAdi(k, stok), alt: k.tur === "lisans" ? "Lisans" : "Aksesuar" }],
  );
  return [...cihazlar, ...diger];
}

/** Tablodaki kısa içerik: "2× ONE + Pro+ lisans" */
export const icerikOzeti = (s: Siparis, stok: StokKalemi[] = []) => s.kalemler.map((k) => kalemAdi(k, stok)).join(" + ");

/** Adım izleyicideki 5 adımdan kaçı tamamlandı */
export function tamamlananAdim(s: Siparis) {
  if (s.durum === "odeme") return 0;
  if (s.durum === "hazirlaniyor") return 1;
  if (s.durum === "kargoda") return 3;
  if (s.durum === "teslim") return 4;
  return 5;
}

export type Eylem = "odeme" | "seri" | "kargo" | "teslim" | "lisans" | "tamamla";
/** Siparişin sıradaki ana işlemi ve düğme metni */
export function siradakiEylem(s: Siparis): { eylem: Eylem; ad: string } | null {
  switch (s.durum) {
    case "odeme":
      return { eylem: "odeme", ad: "Ödeme alındı" };
    case "hazirlaniyor":
      if (dijital(s)) return { eylem: "lisans", ad: "Lisansı teslim et" };
      return seriTamam(s) ? { eylem: "kargo", ad: "Kargoya ver" } : { eylem: "seri", ad: "Seri no ata" };
    case "kargoda":
      return { eylem: "teslim", ad: "Teslim edildi" };
    case "teslim":
      return lisansVar(s) && !s.lisansBaslangic ? { eylem: "lisans", ad: "Lisansı teslim et" } : { eylem: "tamamla", ad: "Siparişi tamamla" };
    default:
      return null;
  }
}

/** "2026-11-06T11:24" → "Bugün 11:24" / "6 Kas" */
export function tarihEtiketi(zaman: string, bugun: number | null) {
  const t = new Date(zaman);
  const gun = new Date(zaman.slice(0, 10) + "T00:00:00").getTime();
  if (bugun !== null && gun === bugun) return `Bugün ${zaman.slice(11, 16)}`;
  if (bugun !== null && gun === bugun - 86_400_000) return `Dün ${zaman.slice(11, 16)}`;
  return t.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export const tarihYaz = (tarih: string) => new Date(tarih.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export const SERI_NO = /^EO1-\d{4}-\d{4}$/;
/** Satır, virgül veya boşlukla ayrılmış seri numaraları */
export const seriListesi = (metin: string) => [...new Set(metin.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
