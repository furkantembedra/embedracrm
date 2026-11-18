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

// gunFarki saf bir hesap: sunucu kodu da kullandığı için "use client" olmayan lib/gun-farki.ts'te (buradan da dışa açılır)
export { gunFarki } from "./gun-farki";
