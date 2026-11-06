// İletişim izinleri: kanal ve kaynak listeleri. Sunucu kodu içermez; istemci bileşenleri doğrudan buradan okur.
/** İletişim izni kanalları (ticari ileti onayı kanal bazında tutulur) */
export const IZIN_KANALLARI = ["eposta", "whatsapp", "sms", "arama"] as const;
export type IzinKanali = (typeof IZIN_KANALLARI)[number];
export const IZIN_KANAL_ADI: Record<IzinKanali, string> = { eposta: "E-posta", whatsapp: "WhatsApp", sms: "SMS", arama: "Telefon araması" };
export const IZIN_KAYNAKLARI = [
  "Lisans aktivasyonu", "Web sitesi formu", "Sipariş", "WhatsApp onayı", "Fuar formu", "Destek talebi", "Bayi bildirimi", "Telefon görüşmesi", "Müşteri formu",
] as const;
/** Bir kanaldaki izin: ne zaman, nereden verildi; geri çekildiyse ne zaman. Kayıt silinmez, kanıt olarak kalır. */
export type IzinKaydi = { verildi: boolean; tarih: string; kaynak: string; cekilme: string | null }; // tarihler "2026-03-14"

