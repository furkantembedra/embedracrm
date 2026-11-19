// Ortak Meta webhook adresi: WhatsApp, Instagram ve Messenger bildirimleri buraya gelir.
// Meta panelinde Callback URL: https://<crm-adresi>/api/meta/webhook — ayrıntı components/konusma/meta-webhook.ts ve docs/BOT_KURULUM.md
import type { NextRequest } from "next/server";
import { metaWebhookAl, metaWebhookDogrula } from "@/components/konusma/meta-webhook";

export async function GET(istek: NextRequest) {
  return metaWebhookDogrula(istek);
}

export async function POST(istek: NextRequest) {
  return metaWebhookAl(istek);
}
