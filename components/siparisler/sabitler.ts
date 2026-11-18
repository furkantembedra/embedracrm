// siparisler: istemci bileşenlerinin de kullandığı sabitler (sunucu kodu içermez; queries.ts bunları yeniden dışa açar).
import type { IadeTuru, OdemeYontemi } from "./queries";
import type { CihazModeli } from "@/lib/urunler";

export const ODEME_YONTEMLERI: OdemeYontemi[] = ["Kart", "Havale/EFT", "Proforma"];
export const IADE_NEDENLERI = ["Cayma hakkı", "Arızalı ürün", "Yanlış ürün gönderildi", "Eksik parça", "Diğer"] as const;
export const IADE_ADIMLARI: Record<IadeTuru, string[]> = {
  iade: ["Ürün bekleniyor", "Ürün alındı", "Para iadesi yapıldı"],
  degisim: ["Ürün bekleniyor", "Ürün alındı", "Yeni kargo yolda", "Tamamlandı"],
};
/** Her cihaz kutusunda bulunan kablolar (kargoya verilirken stoktan düşer) */
export const KUTU_ICERIGI = ["EO1-CBL-MAIN", "EO1-CBL-PIN", "EO1-CBL-BAT", "EO1-CBL-USB"];
export const CIHAZ_STOK_KODU: Record<CihazModeli, string> = { ONE: "EO1-HW", "ONE Lite": "EO1L-HW" };
