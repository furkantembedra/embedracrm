// Satış hattı bileşenlerinin paylaştığı yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import { gunFarki } from "@/lib/use-bugun";
import type { Kaynak } from "./queries";

export const KAYNAK_TONU: Record<Kaynak, ChipTon> = {
  "Web sitesi": "gray",
  WhatsApp: "ok",
  Instagram: "info",
  Bayi: "lime",
  Fuar: "warn",
  "Mevcut müşteri": "gray",
};

/** "Bugün", "Yarın", "3 gün gecikti" veya "5 Kas". bugun bilinmiyorsa düz tarih. */
export function tarihEtiketi(tarih: string, bugun: number | null, kapali = false) {
  const fark = gunFarki(tarih, bugun);
  if (fark !== null) {
    if (!kapali && fark < 0) return { metin: `${-fark} gün gecikti`, gecikti: true };
    if (fark === 0) return { metin: "Bugün", gecikti: false };
    if (fark === 1) return { metin: "Yarın", gecikti: false };
  }
  const metin = new Date(tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return { metin, gecikti: false };
}

/** Kartın bırakılacağı yer: hedef kartın önü ya da arkası. Yoksa sütunun sonu. */
export type BirakmaKonumu = { hedefId: string; once: boolean };

/** Listede id'li elemanı çıkarıp hedefin önüne/arkasına koyar; hedef yoksa sona ekler.
 *  Sütun sırası, tüm listenin sırasından gelir (filter sırayı korur). */
export function yerlestir<T extends { id: string }>(liste: T[], eleman: T, konum?: BirakmaKonumu): T[] {
  const kalan = liste.filter((x) => x.id !== eleman.id);
  if (!konum || konum.hedefId === eleman.id) return konum?.hedefId === eleman.id ? liste : [...kalan, eleman];
  const i = kalan.findIndex((x) => x.id === konum.hedefId);
  if (i < 0) return [...kalan, eleman];
  const yer = konum.once ? i : i + 1;
  return [...kalan.slice(0, yer), eleman, ...kalan.slice(yer)];
}
