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
//        Gövdedeki `object` alanına göre kanal adaptörü seçilir (components/konusma/kanallar/, kanal adına göre dal yok):
//          adaptörü olan kanal (bugün whatsapp_business_account) → adaptör gövdeyi ortak mesaj listesine çevirir,
//            mesajlar kaydedilir + kuyruğa yazılır (components/konusma/kuyruk.ts) ve HEMEN 200 döner; fırsat / lead işini
//            işleyici yapar (/api/konusma/isleyici, pg_cron; ayrıca after() ile hemen bir kez dürtülür)
//          instagram / page (adaptörleri P4.1 / P4.2) → 200, yalnızca olay türleri loglanır
//        Tanınan her kanal için son bildirim zamanı yazılır (Bot › Kanallar, P2.4).
//        Loglara yalnızca kanal ve olay türü sayıları yazılır; mesaj içeriği, kullanıcı / sayfa kimliği yazılmaz.
// Meta 200 dönmeyen bildirimi tekrar gönderir (WhatsApp 7 güne kadar; Messenger / Instagram 5 sn içinde 200 bekler);
// aynı mesaj kimliği ikinci kez yazılmaz (konusma_mesajlari.dis_mesaj_id). Kayıt hatasında 500 döner ki Meta yeniden göndersin.
import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { webhookAdaptoru } from "@/components/konusma/kanallar";
import { kuyrugaYaz, kuyruguIsle } from "@/components/konusma/kuyruk";
import { kanalWebhookIsaretle, teslimDurumlariYaz, type Kanal } from "@/components/konusma/queries";
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

  const adaptor = webhookAdaptoru(veri.object);
  const kanal = adaptor?.kanal
    ?? (typeof veri.object === "string" && Object.hasOwn(ADAPTORU_OLMAYAN, veri.object) ? ADAPTORU_OLMAYAN[veri.object] : null);
  if (kanal) await sonWebhookYaz(kanal);
  if (adaptor) {
    const { mesajlar, durumlar } = adaptor.webhookCevir(veri);
    let kaydedilen = 0;
    if (mesajlar.length) {
      try {
        // Meta oturumsuz çağırır: veritabanı işi gizli anahtarlı istemciyle
        kaydedilen = (await sistemOlarak(() => kuyrugaYaz(mesajlar))).length;
      } catch (e) {
        console.error(`[meta-webhook] ${adaptor.kanal} mesajı kaydedilemedi: ${(e as Error).message?.slice(0, 200)}`);
        return NextResponse.json({ ok: false }, { status: 500 }); // Meta yeniden gönderir; kaydedilenler tekrar yazılmaz
      }
    }
    // Teslim / okundu durumları (adaptörde ortak türe çevrildi): giden mesajın yanında gösterilir (Bot › Gelen kutusu).
    // Yazılamazsa mesajlar zaten kaydedildiği için yine 500: Meta tekrar gönderir, mesajlar ikinci kez yazılmaz.
    let durum = 0;
    if (durumlar.length) {
      try {
        durum = await sistemOlarak(() => teslimDurumlariYaz(durumlar));
      } catch (e) {
        console.error(`[meta-webhook] ${adaptor.kanal} teslim durumu yazılamadı: ${(e as Error).message?.slice(0, 200)}`);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
    }
    if (kaydedilen) isleyiciyiDurt();
    return NextResponse.json({ ok: true, kaydedilen, durum });
  }
  if (kanal) {
    olaylariLogla(kanal, girdiler);
    return NextResponse.json({ ok: true, kaydedilen: 0 });
  }
  console.info(`[meta-webhook] bilinmeyen object: ${guvenliAd(veri?.object)}`);
  return NextResponse.json({ ok: true, kaydedilen: 0 });
}

/**
 * Yanıt gittikten sonra işleyiciyi bir kez çalıştırır. Yalnızca hızlandırıcıdır: sunucusuz ortamda yarıda kalabilir,
 * iş yine kaybolmaz (pg_cron her 10 sn'de işleyiciyi çağırır). İstek bağlamı yoksa (testler) sessizce geçer.
 */
function isleyiciyiDurt() {
  try {
    after(() => sistemOlarak(() => kuyruguIsle({ sureMs: 8_000 })).then(() => undefined, (e) => {
      console.error(`[meta-webhook] işleyici: ${(e as Error).message?.slice(0, 200)}`);
    }));
  } catch {
    /* istek bağlamı yok */
  }
}

/** Adaptörü henüz yazılmamış Meta kanalları: yalnızca olay türleri loglanır (P4.1 Instagram, P4.2 Messenger) */
const ADAPTORU_OLMAYAN: Record<string, Kanal> = { instagram: "instagram", page: "messenger" };

/** Bot › Kanallar'daki "son webhook" zamanı (imza geçtikten sonra). Yazılamazsa bildirimi düşürmez, yalnızca loglar. */
async function sonWebhookYaz(kanal: Kanal) {
  try {
    await sistemOlarak(() => kanalWebhookIsaretle(kanal));
  } catch (e) {
    console.error(`[meta-webhook] ${kanal} son webhook zamanı yazılamadı: ${(e as Error).message?.slice(0, 200)}`);
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

function olaylariLogla(kanal: string, girdiler: MetaGirdi[]) {
  const s = Object.entries(olayTurleri(girdiler)).map(([t, n]) => `${t}×${n}`).join(", ");
  console.info(`[meta-webhook] ${kanal} bildirimi henüz işlenmiyor: ${s || "olay yok"}`);
}
