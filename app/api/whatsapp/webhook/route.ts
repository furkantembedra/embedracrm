// WhatsApp Business Platform (Cloud API) → CRM webhook
//
// Meta panelinde (WhatsApp › Configuration › Webhook):
//   Callback URL : https://<crm-adresi>/api/whatsapp/webhook
//   Verify token : .env'deki WHATSAPP_VERIFY_TOKEN
//   Abonelik     : "messages" alanı
//
// GET  → Meta doğrulaması: hub.mode=subscribe & hub.verify_token eşleşirse hub.challenge geri döner.
// POST → Mesaj bildirimi. X-Hub-Signature-256 başlığı WHATSAPP_APP_SECRET ile doğrulanır
//        (geliştirmede secret tanımlı değilse imzasız istek kabul edilir). Her mesaj satış hattına işlenir.
// Meta 200 dönmeyen bildirimi tekrar gönderir; aynı mesaj id'si ikinci kez işlenmez.
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { whatsappMesajiIsle } from "@/components/whatsapp/isle";

export async function GET(istek: NextRequest) {
  const p = istek.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Doğrulanamadı", { status: 403 });
}

function imzaGecerli(govde: string, imza: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!imza?.startsWith("sha256=")) return false;
  const beklenen = Buffer.from(createHmac("sha256", secret).update(govde).digest("hex"));
  const gelen = Buffer.from(imza.slice(7));
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
}

type MetaMesaj = {
  from: string; id: string; timestamp: string; type: string;
  text?: { body: string };
  image?: { caption?: string }; document?: { caption?: string; filename?: string }; video?: { caption?: string };
  location?: { name?: string; address?: string; latitude: number; longitude: number };
  button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};
type MetaDeger = { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: MetaMesaj[] };

function mesajMetni(m: MetaMesaj) {
  switch (m.type) {
    case "text": return m.text?.body ?? "";
    case "image": return m.image?.caption ? `📷 ${m.image.caption}` : "";
    case "video": return m.video?.caption ? `🎬 ${m.video.caption}` : "";
    case "document": return `📄 ${m.document?.filename ?? "Belge"}${m.document?.caption ? ` · ${m.document.caption}` : ""}`;
    case "location": return `📍 ${m.location?.name ?? m.location?.address ?? `${m.location?.latitude}, ${m.location?.longitude}`}`;
    case "button": return m.button?.text ?? "";
    case "interactive": return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    default: return "";
  }
}

export async function POST(istek: NextRequest) {
  const govde = await istek.text();
  if (!imzaGecerli(govde, istek.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false, hata: "İmza doğrulanamadı." }, { status: 401 });
  }
  let veri: { object?: string; entry?: { changes?: { field?: string; value?: MetaDeger }[] }[] };
  try {
    veri = JSON.parse(govde);
  } catch {
    return NextResponse.json({ ok: false, hata: "Gövde JSON olmalı." }, { status: 400 });
  }
  if (veri.object !== "whatsapp_business_account") return NextResponse.json({ ok: true, islenen: 0 });

  let islenen = 0;
  for (const entry of veri.entry ?? []) {
    for (const degisiklik of entry.changes ?? []) {
      const deger = degisiklik.value;
      // Okundu / iletildi gibi durum bildirimleri (statuses) mesaj içermez, atlanır
      for (const m of deger?.messages ?? []) {
        const kisi = deger?.contacts?.find((c) => c.wa_id === m.from);
        const sonuc = await whatsappMesajiIsle({
          waId: m.from,
          ad: kisi?.profile?.name ?? "",
          metin: mesajMetni(m),
          tur: m.type,
          mesajId: m.id,
          zaman: new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString(),
        });
        if (sonuc) islenen++;
      }
    }
  }
  return NextResponse.json({ ok: true, islenen });
}
