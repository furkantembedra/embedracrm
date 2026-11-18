// rma: istemci bileşenlerinin de kullandığı sabitler (sunucu kodu içermez; queries.ts bunları yeniden dışa açar).
import type { RmaAdimi, RmaKarari } from "./queries";

/** talep → teslim_alindi → inceleme → karar → tamamlandi → gonderildi (red / iade kararında gönderim adımı atlanabilir) */
export const RMA_ADIMLARI = ["talep", "teslim_alindi", "inceleme", "karar", "tamamlandi", "gonderildi"] as const;
export const ADIM_ADI: Record<RmaAdimi, string> = {
  talep: "Talep alındı", teslim_alindi: "Cihaz teslim alındı", inceleme: "İnceleme", karar: "Karar verildi", tamamlandi: "İşlem tamamlandı", gonderildi: "Müşteriye gönderildi",
};
export const KARAR_ADI: Record<RmaKarari, string> = { tamir: "Tamir", degisim: "Değişim (yeni cihaz)", iade: "İade (para iadesi)", red: "Red (kapsam dışı)" };
export const ARIZA_TIPLERI = ["Ekran / dokunmatik", "Bağlantı (OBD / K-Line)", "Güç / batarya", "Yazılım / firmware", "Kablo / aksesuar", "Fiziksel hasar", "Diğer"] as const;
export const GELIS_KANALLARI = ["Kargo", "Elden teslim", "Bayi üzerinden", "Saha servisi"] as const;
export const ONCELIKLER = ["Normal", "Acil"] as const;
/** Hedef çözüm süresi (gün): açılıştan müşteriye gönderime */
export const HEDEF_GUN = 7;
export const UZATMA_AYLARI = [6, 12, 24, 36] as const;
