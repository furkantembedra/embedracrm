// Bayi portalı oturumu: imzalı, httpOnly çerez. Bayi yalnızca çerezdeki bayiId'nin verisini görür;
// her sayfa ve her işlem bayiId'yi buradan alır (formdan gelen bayiId'ye güvenilmez).
// "yonetici" modu: CRM'deki "Bayi gibi görüntüle" ile açılır, portalda üst bantta belirtilir.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getAktifBayiler, type AktifBayi } from "@/components/bayiler/queries";
import { getPortalHesabi } from "./queries";

const CEREZ = "embedra_portal";
const SURE_SN = 8 * 60 * 60; // 8 saat

function secret() {
  const s = process.env.PORTAL_OTURUM_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("PORTAL_OTURUM_SECRET tanımlı değil.");
  return "gelistirme-icin-gizli-anahtar"; // yalnızca geliştirme
}
const imzala = (veri: string) => createHmac("sha256", secret()).update(veri).digest("base64url");

export type PortalOturumu = { bayi: AktifBayi; mod: "bayi" | "yonetici" };

export async function oturumAc(bayiId: string, mod: PortalOturumu["mod"]) {
  const bitis = Math.floor(Date.now() / 1000) + SURE_SN;
  const veri = `${bayiId}.${mod}.${bitis}`;
  (await cookies()).set(CEREZ, `${veri}.${imzala(veri)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SURE_SN,
  });
}

export async function oturumKapat() {
  (await cookies()).delete(CEREZ);
}

export async function portalOturumu(): Promise<PortalOturumu | null> {
  await connection(); // süre kontrolü (Date.now) istek anında yapılır, prerender'da değil
  const ham = (await cookies()).get(CEREZ)?.value;
  if (!ham) return null;
  const i = ham.lastIndexOf(".");
  const veri = ham.slice(0, i);
  const a = Buffer.from(ham.slice(i + 1));
  const b = Buffer.from(imzala(veri));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [bayiId, mod, bitis] = veri.split(".");
  if (Number(bitis) * 1000 < Date.now() || (mod !== "bayi" && mod !== "yonetici")) return null;
  const bayi = (await getAktifBayiler()).find((x) => x.id === bayiId);
  if (!bayi) return null;
  if (mod === "bayi" && !(await getPortalHesabi(bayiId))?.erisim) return null; // erişim kaldırıldıysa oturum düşer
  return { bayi, mod };
}
