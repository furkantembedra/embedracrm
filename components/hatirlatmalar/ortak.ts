// Hatırlatma ekranlarının paylaştığı yardımcılar
import type { Hatirlatma, KayitTuru } from "./queries";

export const KAYIT_ADI: Record<KayitTuru, string> = {
  firsat: "Fırsat", teklif: "Teklif", siparis: "Sipariş", musteri: "Müşteri", bayi: "Bayi", rma: "RMA", stok: "Stok", cihaz: "Cihaz",
};

/** "Bugün 09:00", "Yarın 14:00", "3 gün gecikti", "12 Kas 10:30" */
export function zamanEtiketi(zaman: string, simdi: string) {
  const gun = zaman.slice(0, 10);
  const bugun = simdi.slice(0, 10);
  const saat = zaman.slice(11, 16);
  const fark = Math.round((Date.parse(gun) - Date.parse(bugun)) / 86_400_000);
  if (fark < 0) return { metin: `${-fark} gün gecikti`, gecikti: true };
  if (fark === 0) return { metin: `Bugün ${saat}`, gecikti: zaman < simdi };
  if (fark === 1) return { metin: `Yarın ${saat}`, gecikti: false };
  const t = new Date(gun + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return { metin: `${t} ${saat}`, gecikti: false };
}

/** Zilde gösterilecek: zamanı gelmiş, bekleyen */
export const zamaniGeldi = (h: Hatirlatma, simdi: string) => h.durum === "bekliyor" && h.zaman <= simdi;
export const okumaAnahtari = (h: Pick<Hatirlatma, "id" | "zaman">) => `${h.id}@${h.zaman}`;
