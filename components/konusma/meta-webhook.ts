// Ortak Meta webhook'u: WhatsApp Cloud API, Instagram Messaging ve Messenger Platform bildirimleri tek adrese gelir.
//   Yeni adres          : /api/meta/webhook   (app/api/meta/webhook/route.ts)
//   Geriye uyumlu adres : /api/whatsapp/webhook (aynı işleyici)
// Kurulum (Meta panelinde Callback URL, Verify token, abone olunacak alanlar): docs/BOT_KURULUM.md
//
// GET  → Meta doğrulaması: hub.mode=subscribe & hub.verify_token = META_VERIFY_TOKEN (yoksa WHATSAPP_VERIFY_TOKEN)
//        ise hub.challenge düz metin olarak döner.
// POST → X-Hub-Signature-256 (ham gövdenin HMAC-SHA256'sı) META_APP_SECRET ile (yoksa WHATSAPP_APP_SECRET) doğrulanır.
//        INSTAGRAM_APP_SECRET tanımlıysa yalnızca object: instagram gövdelerinde onunla atılmış imza da kabul edilir
//        (Instagram Login, aşağıda imzaAnahtarlari).
//        Secret tanımsızsa geliştirmede imzasız istek kabul edilir, production'da her istek reddedilir.
//        Gövdedeki `object` alanına göre kanal seçilir:
//          whatsapp_business_account → WhatsApp: mesajlar satış hattına işlenir (components/whatsapp/isle.ts)
//          instagram                 → Instagram: henüz işlenmez (P4.1), yalnızca olay türleri loglanır
//          page                      → Messenger: henüz işlenmez (P4.2), yalnızca olay türleri loglanır
//        Loglara yalnızca kanal ve olay türü sayıları yazılır; mesaj içeriği, kullanıcı / sayfa kimliği yazılmaz.
// Meta 200 dönmeyen bildirimi tekrar gönderir; aynı mesaj kimliği ikinci kez işlenmez (konusma_mesajlari.dis_mesaj_id).
// P1.1'de kanal adaptörleri (components/konusma/kanallar/) bu dosyadaki kanal dallarının yerini alır.
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { whatsappMesajiIsle } from "@/components/whatsapp/isle";
import type { MesajEki } from "@/components/konusma/queries";
import { sistemOlarak } from "@/lib/supabase/db";

/** Meta uygulamasının App Secret'ı; eski kurulumlarla uyum için WHATSAPP_APP_SECRET'e düşer */
export const metaUygulamaSirri = () => process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || "";
/** Webhook doğrulama token'ı; eski kurulumlarla uyum için WHATSAPP_VERIFY_TOKEN'a düşer */
export const metaDogrulamaTokeni = () => process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "";

export function metaWebhookDogrula(istek: NextRequest) {
  const p = istek.nextUrl.searchParams;
  const token = metaDogrulamaTokeni();
  const gelen = p.get("hub.verify_token") ?? "";
  if (token && p.get("hub.mode") === "subscribe" && esit(gelen, token)) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Doğrulanamadı", { status: 403 });
}

function esit(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * İmzayı doğrulayan anahtarlar. INSTAGRAM_APP_SECRET isteğe bağlıdır: "Instagram API with Instagram Login" ürününde
 * panelde ayrı bir "Instagram app secret" görünür ve resmi doküman webhook imzasının hangisiyle atıldığını açıkça
 * yazmıyor (docs/BOT_KURULUM.md). Tanımlıysa yalnızca Instagram gövdelerinde kabul edilir: o anahtar sızsa bile
 * onunla WhatsApp / Messenger bildirimi (ör. sahte lead) uydurulamaz.
 */
const imzaAnahtarlari = (object: unknown) =>
  [metaUygulamaSirri(), object === "instagram" ? process.env.INSTAGRAM_APP_SECRET || "" : ""].filter(Boolean);

/** `object`, gövde doğrulanmadan önce yalnızca hangi anahtarların deneneceğini seçmek için okunur */
export function imzaGecerli(govde: string, imza: string | null, object?: unknown) {
  const anahtarlar = imzaAnahtarlari(object);
  if (!anahtarlar.length) return process.env.NODE_ENV !== "production";
  if (!imza?.startsWith("sha256=")) return false;
  const gelen = imza.slice(7);
  return anahtarlar.some((a) => esit(createHmac("sha256", a).update(govde).digest("hex"), gelen));
}

type MetaGovdesi = { object?: unknown; entry?: unknown };

export async function metaWebhookAl(istek: NextRequest) {
  const govde = await istek.text();
  let veri: MetaGovdesi | null = null;
  try {
    veri = JSON.parse(govde);
  } catch {
    /* imza kontrolünden sonra 400 */
  }
  // İmza her zaman ham gövde üzerinden; ayrıştırılan gövde imza geçmeden hiçbir işte kullanılmaz
  if (!imzaGecerli(govde, istek.headers.get("x-hub-signature-256"), veri?.object)) {
    return NextResponse.json({ ok: false, hata: "İmza doğrulanamadı." }, { status: 401 });
  }
  if (!veri) return NextResponse.json({ ok: false, hata: "Gövde JSON olmalı." }, { status: 400 });
  const girdiler = Array.isArray(veri?.entry) ? (veri.entry as MetaGirdi[]) : [];

  switch (veri?.object) {
    case "whatsapp_business_account":
      return NextResponse.json({ ok: true, islenen: await whatsappBildirimiIsle(girdiler) });
    case "instagram":
      olaylariLogla("instagram", girdiler); // P4.1
      return NextResponse.json({ ok: true, islenen: 0 });
    case "page":
      olaylariLogla("messenger", girdiler); // P4.2
      return NextResponse.json({ ok: true, islenen: 0 });
    default:
      console.info(`[meta-webhook] bilinmeyen object: ${guvenliAd(veri?.object)}`);
      return NextResponse.json({ ok: true, islenen: 0 });
  }
}

/* ---------------- Instagram / Messenger: yalnızca olay türü ---------------- */

type MetaGirdi = { changes?: { field?: string; value?: unknown }[]; messaging?: Record<string, unknown>[]; standby?: Record<string, unknown>[] };

/** Bilinen mesajlaşma olay anahtarları (entry.messaging[] içindeki olayın türünü belirleyen alan) */
const OLAY_ANAHTARLARI = [
  "message", "postback", "read", "delivery", "reaction", "referral", "optin", "account_linking",
  "pass_thread_control", "take_thread_control", "request_thread_control", "app_roles", "policy_enforcement", "message_edit",
];

/** Olay türü adı: Meta'nın alan adları gibi kısa küçük harfli bir ad değilse "?" (log'a rastgele içerik girmesin) */
const guvenliAd = (x: unknown) => (typeof x === "string" && /^[a-z_]{1,40}$/.test(x) ? x : "?");

export function olayTurleri(girdiler: MetaGirdi[]): Record<string, number> {
  const sayac: Record<string, number> = {};
  const ekle = (ad: string) => void (sayac[ad] = (sayac[ad] ?? 0) + 1);
  for (const g of girdiler) {
    const olaylar = [...(g.messaging ?? []).map((o) => ({ o, standby: false })), ...(g.standby ?? []).map((o) => ({ o, standby: true }))];
    for (const { o, standby } of olaylar) {
      let tur = OLAY_ANAHTARLARI.find((k) => o && typeof o === "object" && k in o) ?? "?";
      if (tur === "message" && (o.message as { is_echo?: boolean } | undefined)?.is_echo) tur = "message_echo";
      ekle(standby ? `standby:${tur}` : tur);
    }
    for (const c of g.changes ?? []) ekle(`degisiklik:${guvenliAd(c?.field)}`);
  }
  return sayac;
}

function olaylariLogla(kanal: "instagram" | "messenger", girdiler: MetaGirdi[]) {
  const s = Object.entries(olayTurleri(girdiler)).map(([t, n]) => `${t}×${n}`).join(", ");
  console.info(`[meta-webhook] ${kanal} bildirimi henüz işlenmiyor: ${s || "olay yok"}`);
}

/* ---------------- WhatsApp ---------------- */

type WaMedya = { mime_type?: string; caption?: string; filename?: string };
export type WaMesaj = {
  from: string; id: string; timestamp: string; type: string;
  text?: { body: string };
  image?: WaMedya; document?: WaMedya; video?: WaMedya; audio?: WaMedya; sticker?: WaMedya;
  location?: { name?: string; address?: string; latitude: number; longitude: number };
  button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  reaction?: { message_id?: string; emoji?: string };
  context?: { id?: string; from?: string };
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; media_type?: string; ctwa_clid?: string };
};
type WaDeger = {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: WaMesaj[];
};

function mesajMetni(m: WaMesaj) {
  switch (m.type) {
    case "text": return m.text?.body ?? "";
    case "image": return m.image?.caption ? `📷 ${m.image.caption}` : "";
    case "video": return m.video?.caption ? `🎬 ${m.video.caption}` : "";
    case "document": return `📄 ${m.document?.filename ?? "Belge"}${m.document?.caption ? ` · ${m.document.caption}` : ""}`;
    case "location": return `📍 ${m.location?.name ?? m.location?.address ?? `${m.location?.latitude}, ${m.location?.longitude}`}`;
    case "button": return m.button?.text ?? "";
    case "interactive": return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "reaction": return m.reaction?.emoji ? `Tepki: ${m.reaction.emoji}` : "Tepki kaldırıldı";
    default: return "";
  }
}

const kirp = (x: unknown, n = 300) => (typeof x === "string" && x ? x.slice(0, n) : undefined);

/**
 * Mesajın ek bilgisi. Kişisel veri yazılmaz: context.from (telefon), konum, ctwa_clid (tıklama kimliği) ve medya
 * bağlantıları bilerek atlanır.
 */
export function whatsappEki(m: WaMesaj): MesajEki {
  const ek: MesajEki = {};
  const medya = m.image ?? m.document ?? m.video ?? m.audio ?? m.sticker;
  if (medya?.mime_type) ek.ek_dosya_turu = kirp(medya.mime_type, 100);
  const yanitlanan = m.type === "reaction" ? m.reaction?.message_id : m.context?.id;
  if (yanitlanan) ek.yanitlanan_mesaj_id = kirp(yanitlanan, 200);
  if (m.referral) {
    const r = m.referral;
    ek.yonlendirme = Object.fromEntries(Object.entries({
      kaynak_turu: kirp(r.source_type, 40), kaynak_id: kirp(r.source_id, 100), baslik: kirp(r.headline),
      govde: kirp(r.body, 1000), medya_turu: kirp(r.media_type, 40), kaynak_url: kirp(r.source_url, 500),
    }).filter(([, v]) => v !== undefined));
  }
  return ek;
}

async function whatsappBildirimiIsle(girdiler: MetaGirdi[]) {
  let islenen = 0;
  for (const entry of girdiler) {
    for (const degisiklik of entry.changes ?? []) {
      const deger = degisiklik.value as WaDeger | undefined;
      // Okundu / iletildi gibi durum bildirimleri (statuses) mesaj içermez, atlanır (P1.2'de işlenecek)
      for (const m of deger?.messages ?? []) {
        const kisi = deger?.contacts?.find((c) => c.wa_id === m.from);
        // Meta oturumsuz çağırır: veritabanı işi gizli anahtarlı istemciyle
        const sonuc = await sistemOlarak(() => whatsappMesajiIsle({
          // Kullanıcı adı kullanan WhatsApp kullanıcılarında `from` (telefon) gelmeyebilir (yalnızca from_user_id);
          // bu durumda isle.ts telefonu çözemez ve mesajı atlar. Telefonsuz kimlik P1.1 adaptöründe ele alınacak.
          waId: m.from ?? "",
          ad: kisi?.profile?.name ?? "",
          metin: mesajMetni(m),
          tur: m.type,
          mesajId: m.id,
          zaman: new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString(),
          kanalHesapId: deger?.metadata?.phone_number_id,
          ek: whatsappEki(m),
        }));
        if (sonuc) islenen++;
      }
    }
  }
  return islenen;
}
