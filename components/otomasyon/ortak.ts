// Otomasyon ekranlarının ve motorun paylaştığı tanımlar (sunucu bağımlılığı yok, istemciden de import edilebilir)
import type { TetikleyiciId } from "./queries";

export type TetikleyiciTanimi = {
  ad: string;
  /** "{n} gün" biçiminde gün eşiğinin cümledeki karşılığı; yoksa eşik kullanılmaz */
  esik: { etiket: string; varsayilan: number } | null;
  aciklama: (gun: number) => string;
  musteriBagli: boolean; // e-posta eylemi için müşteriye bağlanabilir mi
};

export const TETIKLEYICILER: Record<TetikleyiciId, TetikleyiciTanimi> = {
  "lisans-bitiyor": {
    ad: "Lisans bitmek üzere", esik: { etiket: "Bitişe kaç gün kala?", varsayilan: 30 }, musteriBagli: true,
    aciklama: (g) => `Müşteriye bağlı bir cihazın lisansı ${g} gün içinde bittiğinde`,
  },
  "teklif-yanitsiz": {
    ad: "Teklif yanıtsız", esik: { etiket: "Gönderimden kaç gün sonra?", varsayilan: 5 }, musteriBagli: true,
    aciklama: (g) => `Gönderilen teklif ${g} gündür kabul/red edilmediğinde`,
  },
  "rma-gecikti": {
    ad: "RMA uzadı", esik: { etiket: "Kaç gündür açık?", varsayilan: 5 }, musteriBagli: true,
    aciklama: (g) => `RMA kaydı ${g} günden uzun süredir tamamlanmadığında`,
  },
  "siparis-kargolanmadi": {
    ad: "Sipariş kargolanmadı", esik: { etiket: "Kaç gündür hazırlanıyor?", varsayilan: 2 }, musteriBagli: true,
    aciklama: (g) => `Sipariş ${g} gündür "hazırlanıyor" durumunda kaldığında`,
  },
  "firsat-hareketsiz": {
    ad: "Fırsat hareketsiz", esik: { etiket: "Kaç gündür hareketsiz?", varsayilan: 7 }, musteriBagli: true,
    aciklama: (g) => `Açık satış fırsatında ${g} gündür değişiklik olmadığında`,
  },
  "stok-kritik": {
    ad: "Stok kritik seviyede", esik: null, musteriBagli: false,
    aciklama: () => "Bir bileşenin stoğu kritik seviyeye indiğinde",
  },
};

export const TETIKLEYICI_SIRASI = Object.keys(TETIKLEYICILER) as TetikleyiciId[];

export const KURAL_ADI_MAX = 80;
export const gunYaz = (iso: string) => iso.split("-").reverse().join(".");
