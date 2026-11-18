// pazarlama: istemci bileşenlerinin de kullandığı sabitler (sunucu kodu içermez; queries.ts bunları yeniden dışa açar).
import type { HazirListe } from "./queries";

export const ICERIK_KANALLARI = ["Instagram", "Bülten / e-posta", "Blog", "WhatsApp", "LinkedIn"] as const;
export const KAMPANYA_KANALLARI = ["E-posta", "Instagram", "WhatsApp", "Fuar"] as const;
export const HAZIR_LISTELER: { id: HazirListe; ad: string; ipucu: string }[] = [
  { id: "bitiyor", ad: "Lisansı 30 gün içinde bitenler", ipucu: "bitiş tarihine göre" },
  { id: "basic", ad: "Basic plan kullanıcıları", ipucu: "plan alanına göre" },
  { id: "izinli", ad: "Duyuru izni olanlar", ipucu: "en az bir kanalda izinli yetkililer" },
  { id: "bayiler", ad: "Aktif bayiler", ipucu: "lansmanı yapılan bayiler" },
  { id: "kayip", ad: "Kaybedilen lead'ler", ipucu: "satış hattında kaybedildi" },
];
export const KAMPANYA_DURUMLARI = ["Taslak", "Aktif", "Tamamlandı"] as const;
