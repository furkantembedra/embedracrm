// Bayi bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import { ASAMALAR, HEDEF_ULKELER, ULKELER, type AktifBayi, type Basvuru, type BayiAsamasi } from "./queries";

export const ASAMA_TONU: Record<BayiAsamasi, ChipTon> = { basvuru: "gray", degerlendirme: "info", sozlesme: "warn", lansman: "lime" };

export const sonrakiAsama = (a: BayiAsamasi): BayiAsamasi | null => ASAMALAR[ASAMALAR.indexOf(a) + 1] ?? null;

export function puanRengi(p: number) {
  if (p >= 80) return "bg-[#1F8A4C]";
  if (p >= 65) return "bg-[#E58A2B]";
  return "bg-[#D93F3F]";
}

export function stokDurumu(stok: number): { ad: string; ton: ChipTon } {
  if (stok <= 1) return { ad: "Kritik", ton: "err" };
  if (stok <= 4) return { ad: "Sipariş zamanı", ton: "warn" };
  return { ad: "Yeterli", ton: "ok" };
}

export const moqYuzde = (b: AktifBayi) => (b.moqHedef ? Math.min(100, Math.round((b.moqGerceklesen / b.moqHedef) * 100)) : 0);

/** "2026-10-28" → "28 Eki" */
export const tarihYaz = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** "2026-11-06T14:00" → "6 Kas 14:00" */
export function gorusmeYaz(t: string) {
  const d = new Date(t);
  return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

type BolgeDurumu = { kod: string; ad: string; durum: string; ton: ChipTon };

/** Ülke başına en ileri durum: aktif bayi > lansman > sözleşme > değerlendirme > başvuru > bayi aranıyor */
export function bolgeKapsamasi(basvurular: Basvuru[], aktif: AktifBayi[]): BolgeDurumu[] {
  const sira = (kod: string) => {
    if (aktif.some((b) => b.ulkeKodu === kod)) return 5;
    const ust = basvurular.filter((b) => b.ulkeKodu === kod).map((b) => ASAMALAR.indexOf(b.asama) + 1);
    return ust.length ? Math.max(...ust) : 0;
  };
  const kodlar = [...new Set([...HEDEF_ULKELER, ...aktif.map((b) => b.ulkeKodu), ...basvurular.map((b) => b.ulkeKodu)])];
  const ETIKET: [string, ChipTon][] = [
    ["Bayi aranıyor", "gray"],
    ["Başvuru", "gray"],
    ["Değerlendirme", "info"],
    ["Sözleşme", "warn"],
    ["Lansman", "lime"],
    ["Aktif", "ok"],
  ];
  return kodlar
    .map((kod) => ({ kod, s: sira(kod) }))
    .sort((a, b) => b.s - a.s || (ULKELER[a.kod] ?? a.kod).localeCompare(ULKELER[b.kod] ?? b.kod, "tr"))
    .map(({ kod, s }) => ({ kod, ad: ULKELER[kod] ?? kod, durum: ETIKET[s][0], ton: ETIKET[s][1] }));
}
