// Bayi portalı hesapları ve talepleri. Şimdilik demo depo (sunucu belleğinde).
// Supabase'e geçişte: Supabase Auth kullanıcıları + dealer_users (bayi_id, rol) tablosu ve RLS ile bayi yalnızca kendi satırlarını görür.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getAktifBayiler, getBasvurular } from "@/components/bayiler/queries";

export type PortalHesabi = { bayiId: string; eposta: string; sifreOzeti: string; erisim: boolean; sonGiris: string | null };
export type YenilemeTalebi = { seriNo: string; bayiId: string; tarih: string };
/** Bayinin "Bir yanlışlık mı var?" talebi (Cihazlarım › cihaz detayı). CRM'de bayi detayındaki Portal panelinde çözülür. */
export type DuzeltmeTalebi = { id: string; bayiId: string; seriNo: string; metin: string; tarih: string; durum: "acik" | "cozuldu"; cozum?: string };

/** Demo şifresi: tüm demo bayi hesapları için. Gerçek kullanımda hesap açılırken tek kullanımlık davet bağlantısı gönderilir. */
export const DEMO_SIFRE = "Bayi2026!";

export function sifreOzeti(sifre: string) {
  const tuz = randomBytes(16).toString("hex");
  return `${tuz}:${scryptSync(sifre, tuz, 32).toString("hex")}`;
}
export function sifreDogru(sifre: string, ozet: string) {
  const [tuz, deger] = ozet.split(":");
  if (!tuz || !deger) return false;
  const a = Buffer.from(deger, "hex");
  const b = scryptSync(sifre, tuz, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Depo = { hesaplar: PortalHesabi[]; yenileme: YenilemeTalebi[]; duzeltme: DuzeltmeTalebi[] };
const g = globalThis as { __embedraPortal?: Depo };

async function depo(): Promise<Depo> {
  if (!g.__embedraPortal) {
    const [aktif, basvurular] = await Promise.all([getAktifBayiler(), getBasvurular()]);
    const ozet = sifreOzeti(DEMO_SIFRE);
    g.__embedraPortal = {
      hesaplar: aktif.map((b) => ({
        bayiId: b.id,
        eposta: basvurular.find((x) => x.id === b.id)?.eposta ?? `${b.id}@bayi.embedra.com`,
        sifreOzeti: ozet,
        erisim: b.id !== "kafkas", // demo: bir bayinin erişimi kapalı
        sonGiris: null,
      })),
      yenileme: [],
      duzeltme: [],
    };
  }
  g.__embedraPortal.duzeltme ??= [];
  return g.__embedraPortal;
}

export async function getPortalHesabi(bayiId: string) {
  return (await depo()).hesaplar.find((h) => h.bayiId === bayiId) ?? null;
}
export async function hesapBulEpostayla(eposta: string) {
  return (await depo()).hesaplar.find((h) => h.eposta.toLowerCase() === eposta.trim().toLowerCase()) ?? null;
}
export async function portalHesabiniGuncelle(bayiId: string, f: (h: PortalHesabi) => void) {
  const d = await depo();
  let h = d.hesaplar.find((x) => x.bayiId === bayiId);
  if (!h) {
    // Sonradan lansmanı yapılan bayi: hesap ilk erişim verildiğinde açılır
    const b = (await getBasvurular()).find((x) => x.id === bayiId);
    h = { bayiId, eposta: b?.eposta ?? `${bayiId}@bayi.embedra.com`, sifreOzeti: sifreOzeti(DEMO_SIFRE), erisim: false, sonGiris: null };
    d.hesaplar.push(h);
  }
  f(h);
  return h;
}
export async function getYenilemeTalepleri(bayiId: string) {
  return (await depo()).yenileme.filter((y) => y.bayiId === bayiId);
}
export async function yenilemeTalebiEkle(y: YenilemeTalebi) {
  (await depo()).yenileme.push(y);
}
/** Lisans cihaza işlenince ya da CRM kapatınca talep kalkar (portalda "Talep var" etiketi de kalkar) */
export async function yenilemeTalebiSil(seriNo: string) {
  const d = await depo();
  d.yenileme = d.yenileme.filter((y) => y.seriNo !== seriNo);
}
export async function getDuzeltmeTalepleri(bayiId: string) {
  return (await depo()).duzeltme.filter((x) => x.bayiId === bayiId);
}
export async function duzeltmeTalebiEkle(t: DuzeltmeTalebi) {
  (await depo()).duzeltme.unshift(t);
}
export async function duzeltmeTalebiCoz(id: string, cozum: string) {
  const t = (await depo()).duzeltme.find((x) => x.id === id);
  if (t) { t.durum = "cozuldu"; t.cozum = cozum; }
  return t ?? null;
}
