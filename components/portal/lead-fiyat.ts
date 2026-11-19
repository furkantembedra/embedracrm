// Bayi teklifleri için önerilen satış fiyatları (Embedra liste fiyatı, bayinin para biriminde) ve yerel KDV.
import { getFiyatListesi } from "@/components/operasyon/queries";
import { bayiFiyatlari } from "./katalog";
import { YEREL_KDV } from "./lead-ortak";

export async function bayiTeklifAyarlari(ulkeKodu: string) {
  const { kosul, fiyat } = bayiFiyatlari(ulkeKodu, await getFiyatListesi());
  const cevir = (tl: number) => Math.round(tl / kosul.kur);
  return {
    paraBirimi: kosul.paraBirimi,
    varsayilanKdv: YEREL_KDV[ulkeKodu] ?? fiyat.kdv,
    oneriFiyat: {
      ONE: cevir(fiyat.cihaz.ONE), "ONE Lite": cevir(fiyat.cihaz["ONE Lite"]),
      Basic: cevir(fiyat.lisans.Basic.fiyat ?? 0), Pro: cevir(fiyat.lisans.Pro.fiyat ?? 0), "Pro+": cevir(fiyat.lisans["Pro+"].fiyat ?? 0),
    } as Record<string, number>,
  };
}
