"use client";

// Şu anki zaman (ms), her 30 saniyede bir güncellenir; sunucuda null.
// "3 dk önce" gibi göreli zamanlar için. cacheComponents açıkken bileşende doğrudan Date.now() kullanmayın.
import { useSyncExternalStore } from "react";

let simdi = 0;
const dinleyiciler = new Set<() => void>();
let zamanlayici: ReturnType<typeof setInterval> | null = null;

function abone(cb: () => void) {
  dinleyiciler.add(cb);
  if (!zamanlayici) {
    zamanlayici = setInterval(() => {
      simdi = Date.now();
      dinleyiciler.forEach((d) => d());
    }, 30_000);
  }
  return () => {
    dinleyiciler.delete(cb);
    if (dinleyiciler.size === 0 && zamanlayici) {
      clearInterval(zamanlayici);
      zamanlayici = null;
    }
  };
}

function anlik() {
  if (!simdi) simdi = Date.now();
  return simdi;
}

/** Zamanı hemen ilerletir (ör. yeni bildirim gelince "Az önce" doğru görünsün) */
export function simdiyiYenile() {
  simdi = Date.now();
  dinleyiciler.forEach((d) => d());
}

export function useSimdi(): number | null {
  return useSyncExternalStore(abone, anlik, () => null);
}
