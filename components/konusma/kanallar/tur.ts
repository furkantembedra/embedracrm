// Kanal adaptörü arayüzü (değişmez kural 13): bot çekirdeği, kuyruk ve işleyici kanal adına göre dallanmaz.
// Kanalın farkı (webhook gövdesi, kimlik, mesaj penceresi, gönderim, durum bildirimleri, biçim / uzunluk sınırları)
// yalnızca bu arayüzü uygulayan adaptörde kalır. Bugün: WhatsApp (./whatsapp.ts). Instagram (P4.1) ve Messenger (P4.2)
// aynı arayüzü uygulayıp ./index.ts'teki listeye eklenir ve test/kanal-adaptoru.test.ts sözleşme testlerinden geçer.
import type { Kanal, MesajEki, MesajTuru } from "@/components/konusma/queries";
import type { LeadKaynagi } from "@/lib/constants";

/** Webhook'tan gelen bir mesajın kanaldan bağımsız hâli */
export type GelenMesaj = {
  kanal: Kanal;
  /** İşletme hesabı: WhatsApp phone_number_id | Instagram hesap kimliği | Facebook sayfa kimliği */
  kanalHesapId: string;
  /** Müşterinin kanaldaki kimliği: WhatsApp normalize telefon (yoksa BSUID) | IGSID | PSID */
  disKullaniciId: string;
  /** Meta mesaj kimliği (wamid… / mid); tüm kanallarda tekil, tekrarı ve kendi mesajımızın echo'sunu bu tanır */
  disMesajId: string;
  tur: MesajTuru;
  /** Gösterilecek metin; metinsiz medya için adaptör kısa bir açıklama koyar ("📷 Fotoğraf") */
  metin: string;
  /** Ek bilgi (kişisel veri yok; components/konusma/queries.ts › MesajEki) */
  ek: MesajEki;
  /** ISO zaman */
  zaman: string;
  /**
   * true: işletme hesabından CRM dışında gönderilmiş mesaj (WhatsApp Business uygulaması, Meta Business Suite,
   * Instagram uygulaması). Çekirdek bunu gönderen: temsilci olarak yazar ve "temsilci yazdı" kuralını tetikler.
   * CRM'in / botun kendi gönderdiği mesajın echo'su: adaptör tanıyabiliyorsa (Messenger app_id) hiç döndürmez;
   * tanıyamasa da çekirdek dis_mesaj_id tekilliğiyle ikinci kez yazmaz.
   */
  echo: boolean;
  /** Profil adı (yalnızca müşteri mesajında; yeni lead firma adı için) */
  profilAdi?: string;
};

/** Gönderdiğimiz mesajın teslim durumu (ortak) */
export type TeslimDurumu = "gonderildi" | "iletildi" | "okundu" | "basarisiz";
export type DurumBildirimi = { disMesajId: string; durum: TeslimDurumu; zaman: string; hataKodu?: string };

export type WebhookSonucu = {
  mesajlar: GelenMesaj[];
  durumlar: DurumBildirimi[];
  /** Tanınmayan / işlenemeyen olay sayısı (içerik loglanmaz) */
  atlanan: number;
};

/**
 * Mesaj penceresi (değişmez kural 5):
 *  acik              → serbest metin gönderilebilir (bot da yazabilir)
 *  yalnizca_temsilci → yalnızca temsilci, kanalın insan etiketiyle yazabilir (Instagram / Messenger HUMAN_AGENT, 7 gün);
 *                      bot yazamaz
 *  kapali            → serbest mesaj gönderilemez (WhatsApp'ta yalnızca onaylı şablon; bot hiçbir zaman şablon kullanmaz)
 */
export type PencereDurumu = { durum: "acik" | "yalnizca_temsilci" | "kapali"; /** Şu anki durumun bittiği an (ISO) */ bitis: string | null };

export type Bicimlendirme = "kalin" | "italik" | "ustu_cizili" | "kod" | "liste" | "alinti" | "baglanti_onizleme";

export type BicimSinirlari = {
  /** Tek mesajın azami uzunluğu */
  azamiUzunluk: number;
  /** Uzunluğun birimi (Instagram bayt sayar) */
  birim: "karakter" | "utf8_bayt";
  bicimlendirme: Bicimlendirme[];
  /** Modele "Kanal: X" yanında verilecek kısa biçim notu */
  not: string;
};

export type GidenIcerik = { tur: "metin"; metin: string };
// İleride: | { tur: "dosya"; ... } | { tur: "baglanti"; ... }

export type GonderimSonucu =
  | { ok: true; disMesajId: string | null; demo: boolean }
  | { ok: false; hata: string };

export type Alici = { kanalHesapId: string; disKullaniciId: string };

export interface KanalAdaptoru {
  kanal: Kanal;
  /** Meta webhook gövdesindeki `object` değeri (whatsapp_business_account | instagram | page) */
  webhookObject: string;
  /** Ekranda ve metinlerde kanal adı ("WhatsApp") */
  ad: string;
  /** Yeni lead'in kaynağı (lib/constants.ts › LEAD_KAYNAKLARI'ndan biri) */
  leadKaynagi: LeadKaynagi;
  /** Mesaj gelince fırsata yazılan sonraki adım ("WhatsApp'tan dönüş yap") */
  sonrakiAdim: string;
  /** Simülasyon / elle giriş formunda kimlik alanının etiketi ve örneği */
  kimlikAlani: { etiket: string; ornek: string };
  /** Elle girilen kimliği konuşma kimliğine çevirir (WhatsApp: normalize telefon); geçersizse null */
  kimlikCoz(girdi: string): string | null;
  /** Elle / simülasyonda hesap verilmezse kullanılacak işletme hesabı */
  varsayilanHesap(): string;
  /** Dış kullanıcı kimliğinden telefon (CRM'deki fırsat / yetkiliyle eşleşmek için); kanal telefon vermiyorsa null */
  telefon(disKullaniciId: string): string | null;
  /** Yeni lead'in profil adı yoksa firma adı olarak kullanılacak okunur kimlik */
  gorunenKimlik(disKullaniciId: string): string;

  /** Webhook gövdesini (imzası doğrulanmış) ortak mesaj ve durum listesine çevirir. Hiçbir zaman fırlatmaz. */
  webhookCevir(govde: unknown): WebhookSonucu;
  /** Mesajı gönderir. Anahtar yoksa demo: göndermez, ok döner. Pencere kontrolü çağırandadır (components/konusma/gonder.ts). */
  gonder(alici: Alici, icerik: GidenIcerik): Promise<GonderimSonucu>;
  /** Müşterinin son mesaj zamanına göre pencere */
  pencere(sonMusteriMesaji: string | null, simdi?: Date): PencereDurumu;
  sinirlar: BicimSinirlari;
  /** Uzun metni kanalın sınırına göre parçalar (paragraf → satır → cümle → kelime sınırından; boş parça yok) */
  bol(metin: string): string[];
}
