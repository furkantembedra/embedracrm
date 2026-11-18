// Bayi portalı oturumu (Supabase Auth).
//  • "bayi" modu: oturumdaki hesap bayi_kullanicilari'nda bağlı ve erişimi açık → yalnızca kendi bayisinin verisi (RLS).
//  • "yonetici" modu: CRM ekip üyesi "Bayi gibi görüntüle" dedi → hangi bayiye baktığı imzalı, httpOnly bir çerezde
//    tutulur; veri erişimi ekip üyesinin kendi yetkisiyle (CRM policy) olur, portal ekranları bu bayiye göre süzer.
// Her sayfa ve her işlem bayiId'yi buradan alır (formdan gelen bayiId'ye güvenilmez).
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getAktifBayiler, type AktifBayi } from "@/components/bayiler/queries";
import { bayiHesabi, crmKullanicisi } from "@/lib/oturum";
import { createClient } from "@/lib/supabase/server";

const CEREZ = "embedra_portal_gorunum";
const SURE_SN = 8 * 60 * 60; // 8 saat

function secret() {
  const s = process.env.PORTAL_OTURUM_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("PORTAL_OTURUM_SECRET tanımlı değil.");
  return "gelistirme-icin-gizli-anahtar"; // yalnızca geliştirme
}
const imzala = (veri: string) => createHmac("sha256", secret()).update(veri).digest("base64url");

export type PortalOturumu = { bayi: AktifBayi; mod: "bayi" | "yonetici" };

/** Yalnızca "yonetici" modu için: CRM ekip üyesinin görüntülediği bayiyi çereze yazar. Bayi girişi Supabase Auth ile yapılır. */
export async function oturumAc(bayiId: string, mod: PortalOturumu["mod"]) {
  if (mod !== "yonetici") return;
  if (!(await crmKullanicisi())) return;
  const bitis = Math.floor(Date.now() / 1000) + SURE_SN;
  const veri = `${bayiId}.${bitis}`;
  (await cookies()).set(CEREZ, `${veri}.${imzala(veri)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SURE_SN,
  });
}

/** Portal çıkışı: yönetici görünümünü kapatır; bayi hesabıysa Supabase oturumunu da kapatır. */
export async function oturumKapat() {
  const c = await cookies();
  if (c.get(CEREZ)) {
    c.delete(CEREZ);
    return;
  }
  await (await createClient()).auth.signOut();
}

function gorunumBayisi(ham: string | undefined): string | null {
  if (!ham) return null;
  const i = ham.lastIndexOf(".");
  const veri = ham.slice(0, i);
  const a = Buffer.from(ham.slice(i + 1));
  const b = Buffer.from(imzala(veri));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [bayiId, bitis] = veri.split(".");
  return Number(bitis) * 1000 < Date.now() ? null : bayiId;
}

/** Bir render içinde tek kez çalışır (cache): kenar menü, yönetici bandı ve sayfa aynı sonucu paylaşır. */
export const portalOturumu = cache(async function portalOturumu(): Promise<PortalOturumu | null> {
  await connection(); // oturum istek anında okunur, prerender'da değil
  const gorunum = gorunumBayisi((await cookies()).get(CEREZ)?.value);
  const [hesap, crm] = await Promise.all([bayiHesabi(), gorunum ? crmKullanicisi() : Promise.resolve(null)]);
  const bayiId = hesap?.bayiId ?? (crm ? gorunum : null);
  if (!bayiId) return null;
  const bayi = (await getAktifBayiler()).find((x) => x.id === bayiId);
  if (!bayi) return null;
  return { bayi, mod: hesap ? "bayi" : "yonetici" };
});
