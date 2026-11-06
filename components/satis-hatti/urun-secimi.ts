// Fırsat içeriği: cihaz (model + adet) ve lisans (paket + adet) seçimden kurulur.
// Lisans cihaz başına değildir: Pro+ 3, Premium 5 cihazı kapsar.
import { LISANS_PAKETLERI, URUN_BILGI, VARSAYILAN_FIYAT, type CihazModeli, type FiyatListesi } from "@/lib/urunler";

export const LISANS_SECENEKLERI = Object.keys(LISANS_PAKETLERI) as (keyof typeof LISANS_PAKETLERI)[];
export type LisansSecenegi = keyof typeof LISANS_PAKETLERI;

export type UrunSecimi = { model: CihazModeli | null; adet: number; lisans: LisansSecenegi | null; lisansAdet: number };

/** Cihazları kapsamak için gereken lisans sayısı: 4 cihaz + Pro+ (3 cihaz) → 2 */
export function gerekenLisans(cihazAdet: number, lisans: LisansSecenegi | null, cihazVar: boolean, f: FiyatListesi = VARSAYILAN_FIYAT) {
  const kapsam = lisans ? f.lisans[lisans].cihaz : null;
  if (!cihazVar || !kapsam) return 1;
  return Math.max(1, Math.ceil(cihazAdet / kapsam));
}

/** Liste fiyatı (KDV hariç). ozel: pakette sabit fiyat yok (Premium / Enterprise); lisans ücreti ozelFiyat olarak girilir. */
export function urunTutari(u: UrunSecimi, ozelFiyat = 0, f: FiyatListesi = VARSAYILAN_FIYAT) {
  const cihaz = u.model ? u.adet * f.cihaz[u.model] : 0;
  const fiyat = u.lisans ? f.lisans[u.lisans].fiyat : 0;
  const lisans = (fiyat ?? ozelFiyat) * (u.lisans ? u.lisansAdet : 0);
  return { cihaz, lisans, tutar: cihaz + lisans, ozel: fiyat === null };
}

/** Kart metni: "2× ONE + Pro+ lisans", "4× ONE + 2× Pro+ lisans", "Premium lisans" */
export function icerikYaz(u: UrunSecimi) {
  const cihaz = u.model ? `${u.adet}× ${URUN_BILGI[u.model].ad}` : "";
  const lisans = u.lisans ? `${u.lisansAdet > 1 ? `${u.lisansAdet}× ` : ""}${u.lisans} lisans` : "";
  return [cihaz, lisans].filter(Boolean).join(" + ");
}

/** Mevcut kart metninden seçimi tahmin eder (düzenleme penceresinin ilk değerleri için) */
export function icerikCoz(icerik: string): UrunSecimi {
  const m = icerik.match(/(\d+)\s*×\s*ONE(\s*LITE)?/i);
  const l = icerik.match(/(?:(\d+)\s*×\s*)?(Basic|Pro\+|Pro|Premium|Enterprise)(?!\w)/i);
  const lisans = l ? (LISANS_SECENEKLERI.find((p) => p.toLowerCase() === l[2].toLowerCase()) ?? null) : null;
  return { model: m ? (m[2] ? "ONE Lite" : "ONE") : null, adet: m ? Number(m[1]) : 1, lisans, lisansAdet: l?.[1] ? Number(l[1]) : 1 };
}
