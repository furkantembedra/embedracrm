// Sahte Meta Graph API (WhatsApp Cloud API, Messenger Send API, Instagram Send API) ve örnek webhook gövdeleri.
//
// Sunucu:
//   const meta = await sahteMetaBaslat();            // ya da sahteMetaBaslat({ whatsapp, messenger, instagram }) token'larıyla
//   process.env.META_GRAPH_URL = meta.adres;
// POST /v{sürüm}/{kimlik}/messages yolu üç kanalda da aynıdır; kanal, isteğin token'ından anlaşılır
// (Authorization: Bearer … ya da ?access_token=…, Meta ikisini de kabul eder):
//   WhatsApp  (phone_number_id)        → { messaging_product: "whatsapp", contacts: [{ input, wa_id }], messages: [{ id: "wamid.…" }] }
//   Messenger (sayfa kimliği ya da me) → { recipient_id, message_id: "m_…" }
//   Instagram (IG hesap kimliği ya da me) → { recipient_id, message_id: "aWdf…" }
// Token hiçbir kanalınkiyle eşleşmezse Meta gibi 401 (OAuthException, code 190) döner; hata() bir sonraki yanıtı hataya çevirir.
//
// Webhook gövdeleri: whatsappGovdesi, instagramGovdesi, messengerGovdesi + olay üreticileri (igMesaj, msMesaj …) ve imzala.
// Gövde biçimleri Meta'nın Webhooks referansındaki örneklerle aynı alan adlarını kullanır (docs/BOT_KURULUM.md kaynaklar).
import { createHmac } from "node:crypto";
import { sahteSunucuBaslat, type SahteSunucu } from "./sunucu";

export type MetaKanali = "whatsapp" | "messenger" | "instagram";
export type SahteMetaTokenlari = Partial<Record<MetaKanali, string>>;
export type SahteGonderim = { kanal: MetaKanali; hesap: string; govde: Record<string, unknown> };

export type SahteMeta = SahteSunucu & {
  /** Bir sonraki istek bu durum kodu ve Meta hata gövdesiyle yanıtlanır */
  hata: (durum: number, mesaj: string, kod?: number) => void;
  /** Gönderilen mesajların gövdeleri (tüm kanallar, geliş sırasıyla) */
  gonderilenler: () => Record<string, unknown>[];
  /** Başarılı gönderimler: hangi kanal, hangi hesap / sayfa kimliğinden */
  gonderimler: () => SahteGonderim[];
};

export const VARSAYILAN_TOKENLAR: Required<SahteMetaTokenlari> = {
  whatsapp: "test-whatsapp-token",
  messenger: "test-sayfa-token",
  instagram: "test-instagram-token",
};

export async function sahteMetaBaslat(tokenlar: string | SahteMetaTokenlari = {}): Promise<SahteMeta> {
  const t: SahteMetaTokenlari = typeof tokenlar === "string" ? { ...VARSAYILAN_TOKENLAR, whatsapp: tokenlar } : { ...VARSAYILAN_TOKENLAR, ...tokenlar };
  let siradakiHata: { durum: number; mesaj: string; kod: number } | null = null;
  let sayac = 0;
  const basarili: SahteGonderim[] = [];
  const sunucu = await sahteSunucuBaslat((istek) => {
    const url = new URL(istek.yol, "http://x");
    const yol = /^\/v\d+\.\d+\/([^/]+)\/messages$/.exec(url.pathname);
    if (istek.yontem !== "POST" || !yol) {
      return { durum: 404, govde: { error: { message: "Unknown path", type: "OAuthException", code: 803 } } };
    }
    const baslik = istek.basliklar.authorization;
    const token = baslik?.startsWith("Bearer ") ? baslik.slice(7) : url.searchParams.get("access_token");
    const kanal = (Object.keys(t) as MetaKanali[]).find((k) => t[k] && t[k] === token);
    if (!kanal) {
      return { durum: 401, govde: { error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190 } } };
    }
    if (siradakiHata) {
      const h = siradakiHata;
      siradakiHata = null;
      return { durum: h.durum, govde: { error: { message: h.mesaj, type: "OAuthException", code: h.kod, fbtrace_id: "SAHTE" } } };
    }
    const g = (istek.govde ?? {}) as { to?: string; recipient?: { id?: string } };
    sayac++;
    basarili.push({ kanal, hesap: yol[1], govde: istek.govde as Record<string, unknown> });
    if (kanal === "whatsapp") {
      return { durum: 200, govde: { messaging_product: "whatsapp", contacts: [{ input: g.to, wa_id: g.to }], messages: [{ id: `wamid.SAHTE${sayac}` }] } };
    }
    if (!g.recipient?.id) {
      return { durum: 400, govde: { error: { message: "(#100) The parameter recipient is required", type: "OAuthException", code: 100 } } };
    }
    return { durum: 200, govde: { recipient_id: g.recipient.id, message_id: kanal === "instagram" ? `aWdfSAHTE${sayac}` : `m_SAHTE${sayac}` } };
  });
  return {
    ...sunucu,
    hata: (durum, mesaj, kod = 100) => void (siradakiHata = { durum, mesaj, kod }),
    gonderilenler: () => sunucu.istekler.filter((i) => i.yontem === "POST").map((i) => i.govde as Record<string, unknown>),
    gonderimler: () => [...basarili],
  };
}

/* ======================= Webhook gövdeleri ======================= */

/** X-Hub-Signature-256 başlığının değeri: "sha256=" + ham gövdenin HMAC-SHA256'sı (uygulama secret'ı ile) */
export const imzala = (govde: string, secret: string) => `sha256=${createHmac("sha256", secret).update(govde).digest("hex")}`;

const saniye = (ms = Date.now()) => String(Math.floor(ms / 1000));

/* ---------- WhatsApp: object = whatsapp_business_account, entry[].changes[].value ---------- */

export type WaGelen = {
  from?: string; id?: string; timestamp?: string; type?: string;
  text?: { body: string }; [alan: string]: unknown;
};

/** WhatsApp metin mesajı (diğer türler için alanları üzerine yazın: { type: "image", image: { … } }) */
export const waMesaj = (x: WaGelen = {}): WaGelen => ({
  from: "905321112233", id: `wamid.TEST${Math.random().toString(36).slice(2, 10)}`, timestamp: saniye(), type: "text",
  ...(x.type && x.type !== "text" ? {} : { text: { body: "Merhaba, fiyat alabilir miyim?" } }),
  ...x,
});

export function whatsappGovdesi(o: {
  mesajlar?: WaGelen[]; durumlar?: Record<string, unknown>[]; phoneNumberId?: string | null; waId?: string; ad?: string;
} = {}) {
  const mesajlar = o.mesajlar ?? (o.durumlar ? [] : [waMesaj()]);
  const deger: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...(o.phoneNumberId === null ? {} : { metadata: { display_phone_number: "905550000000", phone_number_id: o.phoneNumberId ?? "PNID-1" } }),
  };
  if (mesajlar.length) {
    deger.contacts = [{ profile: { name: o.ad ?? "Ahmet" }, wa_id: o.waId ?? mesajlar[0].from ?? "905321112233" }];
    deger.messages = mesajlar;
  }
  if (o.durumlar) deger.statuses = o.durumlar;
  return { object: "whatsapp_business_account", entry: [{ id: "WABA-1", changes: [{ field: "messages", value: deger }] }] };
}

/**
 * WhatsApp Business uygulamasından (coexistence) gönderilen mesajın kopyası: field smb_message_echoes,
 * value.message_echoes[] { from: işletme numarası, to: müşteri, to_user_id?, id, timestamp, type, … }
 */
export function whatsappEchoGovdesi(o: { to?: string; toUserId?: string; id?: string; metin?: string; type?: string; ek?: Record<string, unknown>; phoneNumberId?: string } = {}) {
  const echo: Record<string, unknown> = {
    from: "905550000000", ...(o.to === "" ? {} : { to: o.to ?? "905321112233" }), ...(o.toUserId ? { to_user_id: o.toUserId } : {}),
    id: o.id ?? `wamid.ECHO${Math.random().toString(36).slice(2, 10)}`, timestamp: saniye(), type: o.type ?? "text",
    ...((o.type ?? "text") === "text" ? { text: { body: o.metin ?? "Merhaba, nasıl yardımcı olabiliriz?" } } : {}), ...o.ek,
  };
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA-1", changes: [{ field: "smb_message_echoes", value: {
      messaging_product: "whatsapp", metadata: { display_phone_number: "905550000000", phone_number_id: o.phoneNumberId ?? "PNID-1" }, message_echoes: [echo],
    } }] }],
  };
}

/* ---------- Instagram ve Messenger: entry[].messaging[] olayları ---------- */

type Olay = Record<string, unknown>;
const olay = (gonderen: string, alici: string, govde: Olay): Olay => ({
  sender: { id: gonderen }, recipient: { id: alici }, timestamp: Date.now(), ...govde,
});

/** Müşteriden gelen metin mesajı. Instagram'da gönderen IGSID, alıcı IG hesap kimliği; Messenger'da PSID ve sayfa kimliği. */
export const mesajOlayi = (o: { kullanici?: string; hesap?: string; metin?: string; mid?: string; ek?: Olay } = {}) =>
  olay(o.kullanici ?? "KULLANICI-1", o.hesap ?? "HESAP-1", { message: { mid: o.mid ?? `m_TEST${Math.random().toString(36).slice(2, 10)}`, text: o.metin ?? "Merhaba", ...o.ek } });

/** İşletme hesabından gönderilmiş mesajın kopyası (echo): gönderen hesap, alıcı müşteri; app_id gönderen uygulama */
export const echoOlayi = (o: { kullanici?: string; hesap?: string; metin?: string; mid?: string; appId?: string } = {}) =>
  olay(o.hesap ?? "HESAP-1", o.kullanici ?? "KULLANICI-1", {
    message: { mid: o.mid ?? "m_ECHO1", text: o.metin ?? "Merhaba, nasıl yardımcı olabiliriz?", is_echo: true, ...(o.appId ? { app_id: o.appId } : {}) },
  });

/** Instagram hikâye yanıtı: reply_to.story */
export const hikayeYanitiOlayi = (o: { kullanici?: string; hesap?: string; metin?: string; hikayeId?: string } = {}) =>
  mesajOlayi({ ...o, metin: o.metin ?? "Bu cihazın fiyatı nedir?", ek: { reply_to: { story: { id: o.hikayeId ?? "HIKAYE-1", url: "https://lookaside.example/story" } } } });

/** Instagram hikâye bahsetmesi: attachments[].type = story_mention */
export const hikayeBahsetmeOlayi = (o: { kullanici?: string; hesap?: string } = {}) =>
  olay(o.kullanici ?? "KULLANICI-1", o.hesap ?? "HESAP-1", {
    message: { mid: `m_BAHSETME${Math.random().toString(36).slice(2, 8)}`, attachments: [{ type: "story_mention", payload: { url: "https://lookaside.example/m" } }] },
  });

/** Reklamdan / m.me bağlantısından gelen ilk mesaj: message.referral */
export const reklamMesajiOlayi = (o: { kullanici?: string; hesap?: string; reklamId?: string } = {}) =>
  mesajOlayi({ ...o, metin: "Reklamdaki cihaz hakkında bilgi alabilir miyim?", ek: { referral: { ref: "kampanya", ad_id: o.reklamId ?? "REKLAM-1", source: "ADS", type: "OPEN_THREAD" } } });

/** Okundu bildirimi */
export const okunduOlayi = (o: { kullanici?: string; hesap?: string; mid?: string } = {}) =>
  olay(o.kullanici ?? "KULLANICI-1", o.hesap ?? "HESAP-1", { read: { mid: o.mid ?? "m_ECHO1" } });

/** Emoji tepkisi */
export const tepkiOlayi = (o: { kullanici?: string; hesap?: string; mid?: string } = {}) =>
  olay(o.kullanici ?? "KULLANICI-1", o.hesap ?? "HESAP-1", { reaction: { mid: o.mid ?? "m_ECHO1", action: "react", reaction: "love", emoji: "❤️" } });

/** Düğme / menü (postback) */
export const postbackOlayi = (o: { kullanici?: string; hesap?: string; baslik?: string; payload?: string } = {}) =>
  olay(o.kullanici ?? "KULLANICI-1", o.hesap ?? "HESAP-1", { postback: { mid: "m_POSTBACK1", title: o.baslik ?? "Fiyat listesi", payload: o.payload ?? "FIYAT" } });

/** Instagram webhook gövdesi: object = instagram, entry[].id = Instagram hesap kimliği */
export function instagramGovdesi(o: { hesap?: string; olaylar?: Olay[]; degisiklikler?: { field: string; value: unknown }[] } = {}) {
  const hesap = o.hesap ?? "IG-HESAP-1";
  const olaylar = o.olaylar ?? [mesajOlayi({ hesap })];
  return {
    object: "instagram",
    entry: [{ id: hesap, time: Date.now(), ...(olaylar.length ? { messaging: olaylar } : {}), ...(o.degisiklikler ? { changes: o.degisiklikler } : {}) }],
  };
}

/** Messenger webhook gövdesi: object = page, entry[].id = Facebook sayfa kimliği */
export function messengerGovdesi(o: { sayfa?: string; olaylar?: Olay[]; standby?: Olay[] } = {}) {
  const sayfa = o.sayfa ?? "SAYFA-1";
  const olaylar = o.olaylar ?? [mesajOlayi({ hesap: sayfa })];
  return {
    object: "page",
    entry: [{ id: sayfa, time: Date.now(), ...(olaylar.length ? { messaging: olaylar } : {}), ...(o.standby ? { standby: o.standby } : {}) }],
  };
}
