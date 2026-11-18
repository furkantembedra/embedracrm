// Bayi lisans havuzu: bayinin Embedra'dan satın aldığı, henüz cihaza atanmamış ONESuite lisansları.
// Havuza yalnızca CRM'de "lisans teslim edildi" denen (ödenmiş) bayi siparişlerinden lisans girer;
// bayi satışta ya da yenilemede havuzdan cihaza atar. Atama, cihaza lisans işler ve bayi hareketine "lisans" yazar.
// Tablo: bayi_lisans_havuzu (bayi_id, blh_paket, blh_sure_ay, blh_adet, blh_kaynak = sipariş no, blh_tarih). Adedi 0'a inen satır silinmez,
// okumada elenir. RLS: bayi kendi satırlarını okur; portal ataması adet düşürür (yazma policy'si 20261118120000_bayi_portal_yazma.sql).
import { getCihaz, cihaziGuncelle } from "@/components/cihaz-lisans/queries";
import { ayEkle, lisansUygula } from "@/components/cihaz-lisans/ortak";
import type { LisansPlani } from "@/components/cihaz-lisans/queries";
import { db, sonuc } from "@/lib/supabase/db";
import { hareketEkle } from "./queries";
import { yenilemeTalebiSil } from "@/components/portal/queries";

export type HavuzKalemi = { paket: LisansPlani; sureAy: number; adet: number; kaynak: string; tarih: string }; // kaynak: sipariş no
export const HAVUZ_PAKETLERI: LisansPlani[] = ["Basic", "Pro", "Pro+"];

type HavuzSatiri = { id: number; blh_paket: LisansPlani; blh_sure_ay: number; blh_adet: number; blh_kaynak: string; blh_tarih: string };
const ALANLAR = "id, blh_paket, blh_sure_ay, blh_adet, blh_kaynak, blh_tarih";
const bayiNo = (id: string) => (/^\d+$/.test(id) ? Number(id) : null);

/** Kalan adedi olan satırlar, en eski kaynak önce */
async function havuzSatirlari(bayiId: string, paket?: LisansPlani): Promise<HavuzSatiri[]> {
  const no = bayiNo(bayiId);
  if (no === null) return [];
  const s = await db();
  let q = s.from("bayi_lisans_havuzu").select(ALANLAR).eq("bayi_id", no).gt("blh_adet", 0);
  if (paket) q = q.eq("blh_paket", paket);
  return sonuc(await q.order("blh_tarih").order("id"), "Lisans havuzu okunuyordu") as HavuzSatiri[];
}

export async function getHavuz(bayiId: string): Promise<HavuzKalemi[]> {
  return (await havuzSatirlari(bayiId)).map((r) => ({ paket: r.blh_paket, sureAy: r.blh_sure_ay, adet: r.blh_adet, kaynak: r.blh_kaynak, tarih: r.blh_tarih }));
}

/** Paket başına kalan adet: { Basic: 0, Pro: 2, "Pro+": 0 } (yalnızca 12 aylıklar satışta kullanılır, süreler ayrı tutulur) */
export async function havuzOzeti(bayiId: string) {
  const ozet: Record<LisansPlani, number> = { Basic: 0, Pro: 0, "Pro+": 0 };
  for (const k of await getHavuz(bayiId)) ozet[k.paket] += k.adet;
  return ozet;
}

/** CRM: ödenmiş bayi siparişinin lisansları havuza girer */
export async function havuzaEkle(bayiId: string, k: HavuzKalemi) {
  const no = bayiNo(bayiId);
  if (no === null) throw new Error(`Lisans havuzuna eklenemedi: geçersiz bayi kimliği (${bayiId})`);
  const s = await db();
  sonuc(
    await s.from("bayi_lisans_havuzu").insert({ bayi_id: no, blh_paket: k.paket, blh_sure_ay: k.sureAy, blh_adet: k.adet, blh_kaynak: k.kaynak, blh_tarih: k.tarih }),
    "Lisans havuzuna ekleniyordu",
  );
}

/** Havuzdan paket düşer (en eski kaynaktan). Yetmezse hiçbir şey düşmez ve null döner. Düşülen kalemlerin süresini döner.
 *  Her satır "adet hâlâ okuduğumuz değer mi" koşuluyla güncellenir; arada başka bir işlem düşmüşse hata verilir. */
export async function havuzdanDus(bayiId: string, paket: LisansPlani, adet: number): Promise<number[] | null> {
  const liste = await havuzSatirlari(bayiId, paket);
  if (liste.reduce((t, k) => t + k.blh_adet, 0) < adet) return null;
  const s = await db();
  const sureler: number[] = [];
  let kalan = adet;
  for (const k of liste) {
    if (kalan <= 0) break;
    const dus = Math.min(kalan, k.blh_adet);
    const guncel = sonuc(
      await s.from("bayi_lisans_havuzu").update({ blh_adet: k.blh_adet - dus }).eq("id", k.id).eq("blh_adet", k.blh_adet).select("id"),
      "Lisans havuzundan düşülüyordu",
    ) as { id: number }[];
    if (!guncel.length) throw new Error("Lisans havuzu aynı anda başka bir işlemle değişti; sayfayı yenileyip tekrar deneyin.");
    for (let i = 0; i < dus; i++) sureler.push(k.blh_sure_ay);
    kalan -= dus;
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
