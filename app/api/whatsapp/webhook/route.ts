// Eski WhatsApp webhook adresi: geriye uyumluluk için kalır, ortak Meta webhook'uyla aynı işleyiciyi çağırır.
// Yeni kurulumlarda Meta panelinde /api/meta/webhook kullanın (components/konusma/meta-webhook.ts, docs/BOT_KURULUM.md).
import type { NextRequest } from "next/server";
import { metaWebhookAl, metaWebhookDogrula } from "@/components/konusma/meta-webhook";

export async function GET(istek: NextRequest) {
  return metaWebhookDogrula(istek);
}

export async function POST(istek: NextRequest) {
  return metaWebhookAl(istek);
}
