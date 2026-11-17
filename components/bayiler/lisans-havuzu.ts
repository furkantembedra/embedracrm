// Bayi lisans havuzu: bayinin Embedra'dan satın aldığı, henüz cihaza atanmamış ONESuite lisansları.
// Havuza yalnızca CRM'de "lisans teslim edildi" denen (ödenmiş) bayi siparişlerinden lisans girer;
// bayi satışta ya da yenilemede havuzdan cihaza atar. Atama, cihaza lisans işler ve bayi hareketine "lisans" yazar.
// TODO: Supabase'de bayi_lisans_havuzu tablosu (bayi_id, paket, sure_ay, adet, kaynak_siparis).
import { getCihaz, cihaziGuncelle } from "@/components/cihaz-lisans/queries";
import { ayEkle, lisansUygula } from "@/components/cihaz-lisans/ortak";
import type { LisansPlani } from "@/components/cihaz-lisans/queries";
import { hareketEkle } from "./queries";
import { yenilemeTalebiSil } from "@/components/portal/queries";

export type HavuzKalemi = { paket: LisansPlani; sureAy: number; adet: number; kaynak: string; tarih: string }; // kaynak: sipariş no
export const HAVUZ_PAKETLERI: LisansPlani[] = ["Basic", "Pro", "Pro+"];

const g = globalThis as { __embedraLisansHavuzu?: Map<string, HavuzKalemi[]> };
// Demo: Romanya bayisinin daha önce aldığı 2 adet Pro lisansı havuzda
const DEPO = (g.__embedraLisansHavuzu ??= new Map([["directie", [{ paket: "Pro" as LisansPlani, sureAy: 12, adet: 2, kaynak: "S-26-1172", tarih: "2026-11-02" }]]]));

export async function getHavuz(bayiId: string): Promise<HavuzKalemi[]> {
  return (DEPO.get(bayiId) ?? []).filter((k) => k.adet > 0);
}

/** Paket başına kalan adet: { Basic: 0, Pro: 2, "Pro+": 0 } (yalnızca 12 aylıklar satışta kullanılır, süreler ayrı tutulur) */
export async function havuzOzeti(bayiId: string) {
  const ozet: Record<LisansPlani, number> = { Basic: 0, Pro: 0, "Pro+": 0 };
  for (const k of await getHavuz(bayiId)) ozet[k.paket] += k.adet;
  return ozet;
}

export async function havuzaEkle(bayiId: string, k: HavuzKalemi) {
  const liste = DEPO.get(bayiId) ?? [];
  liste.push(k);
  DEPO.set(bayiId, liste);
}

/** Havuzdan paket düşer (en eski kaynaktan). Yetmezse hiçbir şey düşmez ve false döner. Düşülen kalemlerin süresini döner. */
export async function havuzdanDus(bayiId: string, paket: LisansPlani, adet: number): Promise<number[] | null> {
  const liste = (DEPO.get(bayiId) ?? []).filter((k) => k.paket === paket && k.adet > 0);
  if (liste.reduce((t, k) => t + k.adet, 0) < adet) return null;
  const sureler: number[] = [];
  let kalan = adet;
  for (const k of liste) {
    while (kalan > 0 && k.adet > 0) { k.adet--; kalan--; sureler.push(k.sureAy); }
  }
  return sureler;
}

/** Bayinin müşterisindeki cihaza lisans işler: mevcut lisans bitmemişse bitişinden, bitmişse başlangıç tarihinden devam eder.
 *  Bayi hareketlerine "lisans" yazılır (yenileme oranı ve bayi performansı buradan hesaplanır). */
export async function bayiCihazinaLisansIsle(bayiId: string, seriNo: string, plan: LisansPlani, sureAy: number, baslangicTarihi: string, not: string) {
  const c = await getCihaz(seriNo);
  if (!c || c.bayiId !== bayiId || !c.musteriId) return null;
  const baslangic = c.lisansBitis && c.lisansBitis > baslangicTarihi ? c.lisansBitis : baslangicTarihi;
  const bitis = ayEkle(baslangic, sureAy);
  const guncel = await cihaziGuncelle(seriNo, (x) => lisansUygula(x, { seriNo, plan, baslangic, bitis }));
  await hareketEkle({
    id: crypto.randomUUID(), bayiId, tur: "lisans", tarih: baslangicTarihi,
    kalemler: [{ model: c.model, seriNo }], musteri: { id: c.musteriId, ad: c.musteri }, plan, sureAy, not,
  });
  await yenilemeTalebiSil(seriNo);
  return guncel;
}
