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
export function tarihEtiketi(tarih: string, bugun: number | null, kazanildi = false) {
  const fark = gunFarki(tarih, bugun);
  if (fark !== null) {
    if (!kazanildi && fark < 0) return { metin: `${-fark} gün gecikti`, gecikti: true };
    if (fark === 0) return { metin: "Bugün", gecikti: false };
    if (fark === 1) return { metin: "Yarın", gecikti: false };
  }
  const metin = new Date(tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return { metin, gecikti: false };
}
