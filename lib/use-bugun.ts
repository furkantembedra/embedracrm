"use client";

// Bugünün başlangıcını (ms) yalnızca tarayıcıda okur.
// Sunucuda / önceden hazırlanan sayfada null döner; böylece Next.js'in
// "new Date() in a Client Component" hatası oluşmaz.
import { useSyncExternalStore } from "react";

const abone = () => () => {};
const gunBasi = () => new Date().setHours(0, 0, 0, 0);

export function useBugun(): number | null {
  return useSyncExternalStore(abone, gunBasi, () => null);
}

/** Bugüne göre gün farkı: 0 bugün, 1 yarın, -2 iki gün önce. bugun null ise null. */
export function gunFarki(tarih: string, bugun: number | null) {
  if (bugun === null) return null;
  return Math.round((new Date(tarih + "T00:00:00").getTime() - bugun) / 86_400_000);
}
