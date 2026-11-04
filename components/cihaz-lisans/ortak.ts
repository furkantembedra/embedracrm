// Cihaz & Lisans bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import { GUNCEL_FIRMWARE, type Cihaz, type CihazDurumu, type LisansKaydi, type LisansPlani, type RmaAdimi } from "./queries";

export const PLAN_TONU: Record<LisansPlani, ChipTon> = { Basic: "gray", Pro: "ink", "Pro+": "info" };
export const DURUM_TONU: Record<CihazDurumu, ChipTon> = { aktif: "ok", bitiyor: "err", serviste: "info", lisanssiz: "gray" };
export const RMA_TONU: Record<RmaAdimi, ChipTon> = { Teşhiste: "info", "Parça bekliyor": "warn", Kargoda: "ok" };

export const eskiFirmware = (fw: string) => !fw.startsWith(GUNCEL_FIRMWARE);

/** "2027-03-14" → "14.03.2027" */
export function tarihYaz(tarih: string | null) {
  if (!tarih) return "—";
  const [y, a, g] = tarih.split("-");
  return `${g}.${a}.${y}`;
}

/** Lisans süresinin ne kadarı geçti (0–100) ve kaç gün kaldı. bugun: useBugun() değeri */
export function lisansIlerleme(baslangic: string | null, bitis: string | null, bugun: number | null) {
  if (!baslangic || !bitis || bugun === null) return null;
  const gun = (t: string) => new Date(t + "T00:00:00").getTime();
  const toplam = Math.round((gun(bitis) - gun(baslangic)) / 86_400_000);
  const kalan = Math.round((gun(bitis) - bugun) / 86_400_000);
  const yuzde = toplam > 0 ? Math.min(100, Math.max(0, Math.round(((toplam - kalan) / toplam) * 100))) : 100;
  return { kalan, yuzde };
}

export function kalanYaz(kalan: number) {
  if (kalan < 0) return `${-kalan} gün geçti`;
  if (kalan === 0) return "Bugün bitiyor";
  return `${kalan} gün`;
}

/** Çubuk rengi: son %5 kırmızı, son %25 turuncu */
export function ilerlemeRengi(yuzde: number) {
  if (yuzde >= 95) return "bg-[#D93F3F]";
  if (yuzde >= 75) return "bg-[#E58A2B]";
  return "bg-ink";
}

/** "2026-11-04" + 12 ay → "2027-11-04" */
export function ayEkle(tarih: string, ay: number) {
  const [y, a, g] = tarih.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1 + ay, g));
  return d.toISOString().slice(0, 10);
}

/** Tarihe göre güncel durum; bugun bilinmiyorsa kayıttaki durum. */
export function guncelDurum(c: Cihaz, bugun: number | null): CihazDurumu {
  if (c.durum === "serviste") return "serviste";
  if (!c.lisansBitis) return "lisanssiz";
  const i = lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun);
  if (!i) return c.durum;
  return i.kalan <= 30 ? "bitiyor" : "aktif";
}

/** Kaydedilen yeni lisansı cihaza işler (geçmişin başına ekler). */
export function lisansUygula(c: Cihaz, l: LisansKaydi & { seriNo: string }): Cihaz {
  if (c.seriNo !== l.seriNo) return c;
  return {
    ...c,
    plan: l.plan,
    lisansBaslangic: l.baslangic,
    lisansBitis: l.bitis,
    durum: c.durum === "serviste" ? "serviste" : "aktif",
    gecmis: [{ plan: l.plan, baslangic: l.baslangic, bitis: l.bitis }, ...c.gecmis],
  };
}
