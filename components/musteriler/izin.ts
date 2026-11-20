// İletişim izinleri: kanal ve kaynak listeleri. Sunucu kodu içermez; istemci bileşenleri doğrudan buradan okur.
/**
 * İletişim izni kanalları (ticari ileti onayı kanal bazında tutulur).
 * Instagram ve Messenger BİLEREK yok: bu kanallardan toplu pazarlama mesajı gönderilmiyor (Meta yalnızca müşterinin
 * başlattığı konuşmaya 24 saat içinde cevap verilmesine izin verir; bot şablon / mesaj etiketi kullanmaz). Bu kanallarda
 * konuşurken alınan izin, toplanan e-posta / telefon üzerinden aşağıdaki kanallardan birine kaydedilir; kaynağı
 * IZIN_KAYNAKLARI'ndaki "Instagram bot" / "Messenger bot" olur (değişmez kural 11).
 */
export const IZIN_KANALLARI = ["eposta", "whatsapp", "sms", "arama"] as const;
export type IzinKanali = (typeof IZIN_KANALLARI)[number];
export const IZIN_KANAL_ADI: Record<IzinKanali, string> = { eposta: "E-posta", whatsapp: "WhatsApp", sms: "SMS", arama: "Telefon araması" };
export const IZIN_KAYNAKLARI = [
  "Lisans aktivasyonu", "Web sitesi formu", "Sipariş", "WhatsApp onayı", "Fuar formu", "Destek talebi", "Bayi bildirimi", "Telefon görüşmesi", "Müşteri formu",
  // AI satış botunun konuşmada açıkça sorup aldığı izin; kaynak konuşmanın kanalıdır (P2.2 izin_kaydet)
  "WhatsApp bot", "Instagram bot", "Messenger bot",
] as const;
export type IzinKaynagi = (typeof IZIN_KAYNAKLARI)[number];
/** Bir kanaldaki izin: ne zaman, nereden verildi; geri çekildiyse ne zaman. Kayıt silinmez, kanıt olarak kalır. */
export type IzinKaydi = { verildi: boolean; tarih: string; kaynak: string; cekilme: string | null }; // tarihler "2026-03-14"

