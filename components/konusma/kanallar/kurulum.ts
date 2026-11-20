// Kanal kurulum durumu (Bot › Kanallar, P2.4): her kanal için gereken ortam değişkenleri TANIMLI MI, bağlı hesap
// kimliği ve docs/BOT_KURULUM.md'deki ilgili bölümün özeti. Yalnızca sunucuda çalışır (process.env okur).
// Secret değerleri hiçbir zaman döndürülmez: değişkenler için yalnızca var / yok; hesap kimliği gizli sayılan
// değişkenden geliyorsa (WHATSAPP_PHONE_ID, .env.example'da [GİZLİ]) son 4 hanesi dışında maskelenir.
//
// Değişken adları ve giriş yolları docs/BOT_KURULUM.md Bölüm 2–5 ve .env.example ile aynıdır; Meta tarafındaki
// ayrıntılar (izinler, App Review) o belgede kaynaklarıyla birlikte duruyor, burada yalnızca özetleri var.
// Bu dosya kanal bilgisidir; bot çekirdeği kanal adına göre dallanmaz (değişmez kural 13).
import type { Kanal } from "@/components/konusma/queries";
import { adaptorBul } from "./index";

/** Bir gereksinim: adlardan biri tanımlıysa karşılanır (eski / alternatif adlar) */
type Gereksinim = { adlar: readonly string[]; aciklama: string };

type KanalKurulumu = {
  kanal: Kanal;
  /** Kanalın kendi değişkenleri */
  gereksinimler: readonly Gereksinim[];
  /** Bağlı hesabın kimliğini veren değişken ve gizli olup olmadığı */
  hesap: { degisken: string; etiket: string; gizli: boolean };
  /** Adaptör yoksa hangi adımda geleceği */
  adaptorAdimi: string;
  /** docs/BOT_KURULUM.md'deki bölüm ve kısa özet (adımlar) */
  belge: { bolum: string; ozet: readonly string[] };
};

/** Üç kanalın ortak gereksinimleri: tek Meta uygulaması, ortak webhook (BOT_KURULUM Bölüm 2.1, 3) */
const ORTAK: readonly Gereksinim[] = [
  { adlar: ["META_APP_SECRET", "WHATSAPP_APP_SECRET"], aciklama: "Meta uygulamasının App Secret'ı (webhook imzası)" },
  { adlar: ["META_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"], aciklama: "Webhook doğrulama token'ı" },
];

const KURULUMLAR: Record<Kanal, KanalKurulumu> = {
  whatsapp: {
    kanal: "whatsapp",
    gereksinimler: [
      { adlar: ["WHATSAPP_TOKEN"], aciklama: "System User'ın süresiz erişim token'ı" },
      { adlar: ["WHATSAPP_PHONE_ID"], aciklama: "Gönderen numaranın Phone number ID'si" },
    ],
    hesap: { degisken: "WHATSAPP_PHONE_ID", etiket: "Phone number ID", gizli: true },
    adaptorAdimi: "P1.1",
    belge: {
      bolum: "Bölüm 2–4",
      ozet: [
        "Meta uygulamasına (Business türü) WhatsApp ürününü ekleyin; App Secret → META_APP_SECRET.",
        "Gerçek numarayı ekleyip doğrulayın; Phone number ID → WHATSAPP_PHONE_ID (numaranın kendisi değil).",
        "Webhook: Callback URL https://<alan-adı>/api/meta/webhook, Verify token = META_VERIFY_TOKEN, messages alanına abone olun.",
        "System User'dan süresiz token (whatsapp_business_messaging, whatsapp_business_management) → WHATSAPP_TOKEN.",
        "Token ve numara kimliği yoksa gönderim demo modundadır: kaydedilir, Meta'ya gitmez.",
      ],
    },
  },
  messenger: {
    kanal: "messenger",
    gereksinimler: [
      { adlar: ["META_SAYFA_ID"], aciklama: "Facebook sayfa kimliği" },
      { adlar: ["META_SAYFA_TOKEN"], aciklama: "Sayfa erişim token'ı (System User'dan)" },
    ],
    hesap: { degisken: "META_SAYFA_ID", etiket: "Facebook sayfa kimliği", gizli: false },
    adaptorAdimi: "P4.2",
    belge: {
      bolum: "Bölüm 5.1, 5.4, 5.5",
      ozet: [
        "Uygulamaya Messenger ürününü ekleyin; Facebook sayfası uygulamayla aynı Business hesabında olmalı.",
        "System User'a sayfayı atayıp süresiz token üretin (pages_messaging, pages_manage_metadata, pages_show_list); sayfa token'ı → META_SAYFA_TOKEN, sayfa kimliği → META_SAYFA_ID.",
        "Aynı webhook adresinde Page nesnesine abone olun ve sayfayı uygulamaya abone edin (subscribed_apps).",
        "App Review: pages_messaging ve pages_manage_metadata için Advanced Access, Human Agent.",
        "Meta gelen kutusuyla birlikte kullanılacaksa sayfanın Conversation Routing ayarına bakın.",
      ],
    },
  },
  instagram: {
    kanal: "instagram",
    gereksinimler: [
      { adlar: ["INSTAGRAM_HESAP_ID"], aciklama: "Instagram profesyonel hesap kimliği" },
      // Facebook Login (önerilen): sayfa token'ı; Instagram Login: Instagram kullanıcı token'ı (BOT_KURULUM 5.2)
      { adlar: ["META_SAYFA_TOKEN", "INSTAGRAM_TOKEN"], aciklama: "Sayfa token'ı (Facebook Login) ya da Instagram token'ı (Instagram Login)" },
    ],
    hesap: { degisken: "INSTAGRAM_HESAP_ID", etiket: "Instagram hesap kimliği", gizli: false },
    adaptorAdimi: "P4.1",
    belge: {
      bolum: "Bölüm 5.1–5.3, 5.5",
      ozet: [
        "Instagram hesabı Professional olmalı; önerilen Facebook Login yolunda Facebook sayfasına bağlı olmalı.",
        "Instagram uygulamasında Mesajlar › Bağlı araçlar › Mesajlara erişime izin ver açık olmalı.",
        "Facebook Login: META_SAYFA_ID + META_SAYFA_TOKEN + INSTAGRAM_HESAP_ID. Instagram Login: INSTAGRAM_HESAP_ID + INSTAGRAM_TOKEN (60 günde bir yenilenir).",
        "Aynı webhook adresinde Instagram nesnesine (messages vb.) abone olun.",
        "App Review: seçilen yolun Instagram mesajlaşma izinleri için Advanced Access ve ekran kaydı.",
      ],
    },
  },
};

const tanimli = (ad: string) => (process.env[ad]?.trim().length ?? 0) > 0;

export type DegiskenDurumu = {
  /** Gösterilecek ad(lar): "META_APP_SECRET (ya da WHATSAPP_APP_SECRET)" */
  ad: string;
  aciklama: string;
  tanimli: boolean;
};

export type KanalKurulumDurumu = {
  kanal: Kanal;
  /** Kanal adaptörü yazıldı mı (yoksa mesajlar işlenmez) */
  adaptorVar: boolean;
  adaptorAdimi: string;
  degiskenler: DegiskenDurumu[];
  /** Tüm gereksinimler tanımlı ve adaptör var */
  hazir: boolean;
  /** Bağlı hesap: etiket ve gösterilebilir kimlik (gizliyse maskeli); tanımsızsa kimlik null */
  hesap: { etiket: string; kimlik: string | null };
  belge: { bolum: string; ozet: readonly string[] };
};

/** Gizli kimliği maskeler: son 4 hane görünür ("••••1234") */
export function maskele(deger: string): string {
  const t = deger.trim();
  return t.length <= 4 ? "••••" : `••••${t.slice(-4)}`;
}

/** Kanalın kurulum durumu. Değişken DEĞERİ döndürmez; yalnızca tanımlı mı (hesap kimliği hariç, o da gizliyse maskeli). */
export function kanalKurulumDurumu(kanal: Kanal): KanalKurulumDurumu {
  const k = KURULUMLAR[kanal];
  const degiskenler = [...k.gereksinimler, ...ORTAK].map((g) => ({
    ad: g.adlar.length > 1 ? `${g.adlar[0]} (ya da ${g.adlar.slice(1).join(", ")})` : g.adlar[0],
    aciklama: g.aciklama,
    tanimli: g.adlar.some(tanimli),
  }));
  const adaptorVar = !!adaptorBul(kanal);
  const ham = process.env[k.hesap.degisken]?.trim() || null;
  return {
    kanal,
    adaptorVar,
    adaptorAdimi: k.adaptorAdimi,
    degiskenler,
    hazir: adaptorVar && degiskenler.every((d) => d.tanimli),
    hesap: { etiket: k.hesap.etiket, kimlik: ham ? (k.hesap.gizli ? maskele(ham) : ham.slice(0, 40)) : null },
    belge: k.belge,
  };
}
