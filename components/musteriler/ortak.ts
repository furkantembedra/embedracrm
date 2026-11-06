// Müşteriler bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import type { CihazDurumu, IzinKanali, Plan, Yetkili } from "./queries";
import { IZIN_KANALLARI } from "./izin";

export const PLAN_TONU: Record<Plan, ChipTon> = { Basic: "gray", Pro: "ink", "Pro+": "info", Lead: "warn" };

export const CIHAZ_TONU: Record<CihazDurumu, ChipTon> = {
  "Lisans aktif": "ok",
  "Süresi doluyor": "err",
  Serviste: "info",
  Lisanssız: "gray",
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

/** Ara / WhatsApp / E-posta düğmelerinin kullandığı kişi: listedeki ilk yetkili */
export function birincilYetkili(m: { yetkililer: Yetkili[] }): Yetkili | null {
  return m.yetkililer?.[0] ?? null;
}

/** "+90 532 410 22 18" → "+905324102218" (tel: ve wa.me bağlantıları için) */
export const telefonSade = (t: string) => t.replace(/[^\d+]/g, "");

/** Yetkilinin verilmiş (geri çekilmemiş) izni olan kanallar */
export const izinliKanallar = (y: Pick<Yetkili, "izinler">) => IZIN_KANALLARI.filter((k) => y.izinler?.[k]?.verildi);

/** Yetkilinin bu kanalda (kanal yoksa herhangi bir kanalda) izni var mı */
export const izinVar = (y: Pick<Yetkili, "izinler">, kanal?: IzinKanali) =>
  kanal ? !!y.izinler?.[kanal]?.verildi : izinliKanallar(y).length > 0;

/** "2026-03-14" → "14.03.2026" */
export const gunYaz = (iso: string) => iso.split("-").reverse().join(".");
