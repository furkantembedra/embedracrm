// Otomasyon ekranlarının ve motorun paylaştığı tanımlar (sunucu bağımlılığı yok, istemciden de import edilebilir)
import type { KuralFiltresi, TetikleyiciId } from "./queries";

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
  "destek-yanitsiz": {
    ad: "Destek talebi ele alınmadı", esik: { etiket: "Kaç gündür “Yeni” durumda?", varsayilan: 1 }, musteriBagli: true,
    aciklama: (g) => `Destek talebi ${g} gündür “Yeni” durumunda, kimse işleme almadığında`,
  },
  "cihaz-sessiz": {
    ad: "Cihaz uzun süredir bağlanmadı", esik: { etiket: "Kaç gündür bildirim yok?", varsayilan: 14 }, musteriBagli: true,
    aciklama: (g) => `Müşterideki bir cihaz ${g} gündür ONESuite'ten bildirim göndermediğinde`,
  },
  "stok-kritik": {
    ad: "Stok kritik seviyede", esik: null, musteriBagli: false,
    aciklama: () => "Bir bileşenin stoğu kritik seviyeye indiğinde",
  },
};

export const TETIKLEYICI_SIRASI = Object.keys(TETIKLEYICILER) as TetikleyiciId[];

export const KURAL_ADI_MAX = 80;
export const gunYaz = (iso: string) => iso.split("-").reverse().join(".");

/** Her tetikleyicide kullanılabilen filtre alanları (kayıtta karşılığı olmayan alan gösterilmez) */
export const FILTRE_ALANLARI: Record<TetikleyiciId, (keyof KuralFiltresi)[]> = {
  "lisans-bitiyor": ["ulke", "plan", "model"],
  "cihaz-sessiz": ["ulke", "plan", "model"],
  "destek-yanitsiz": ["plan"],
  "siparis-kargolanmadi": ["ulke"],
  "rma-gecikti": ["model"],
  "teklif-yanitsiz": [],
  "firsat-hareketsiz": [],
  "stok-kritik": [],
};
export const FILTRE_ADI: Record<keyof KuralFiltresi, string> = { ulke: "Ülke", plan: "Lisans planı", model: "Cihaz modeli" };

/** Bir kuralın otomatik çalışmada tek turda gönderebileceği en fazla e-posta. Aşılırsa kural durur, yönetici onaylayınca devam eder. */
export const EPOSTA_TUR_LIMITI = 10;

export const filtreOzeti = (t: TetikleyiciId, f: KuralFiltresi) =>
  FILTRE_ALANLARI[t].filter((a) => f[a]).map((a) => `${FILTRE_ADI[a].toLocaleLowerCase("tr-TR")}: ${f[a]}`).join(", ");
