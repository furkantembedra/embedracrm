// Müşteriler bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import type { CihazDurumu, Plan } from "./queries";

export const PLAN_TONU: Record<Plan, ChipTon> = { Basic: "gray", Pro: "ink", "Pro+": "info", Lead: "warn" };

export const CIHAZ_TONU: Record<CihazDurumu, ChipTon> = {
  "Lisans aktif": "ok",
  "Süresi doluyor": "err",
  Serviste: "info",
};

export function durumTonu(durum: string): ChipTon {
  if (/risk/i.test(durum)) return "err";
  if (/yakın/i.test(durum)) return "warn";
  if (/aday|demo/i.test(durum)) return "info";
  if (/vip|yükseltme/i.test(durum)) return "lime";
  return "ok";
}

/** "2026-11-06" → kalan gün (negatifse geçmiş). bugun: useBugun() değeri */
export function kalanGun(tarih: string | null, bugun: number | null) {
  if (!tarih || bugun === null) return null;
  return Math.round((new Date(tarih + "T00:00:00").getTime() - bugun) / 86_400_000);
}

export function tarihYaz(tarih: string | null) {
  if (!tarih) return "—";
  return new Date(tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export const AVATAR_RENKLERI = [
  "bg-info-bg text-info",
  "bg-lime-bg text-[#3A4D00]",
  "bg-warn-bg text-warn",
  "bg-err-bg text-err",
  "bg-bg text-[#474A42]",
];

export function avatarRengi(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_RENKLERI[h % AVATAR_RENKLERI.length];
}
