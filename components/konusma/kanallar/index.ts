// Kanal adaptörleri listesi. Çekirdek adaptörü yalnızca buradan, kanal adı ya da webhook `object` değeriyle bulur;
// kanal adına göre dallanan kod yazılmaz (değişmez kural 13). Instagram (P4.1) ve Messenger (P4.2) buraya eklenir.
import { KONUSMA_KANALLARI, type Kanal } from "@/components/konusma/queries";
import type { KanalAdaptoru } from "./tur";
import { whatsappAdaptoru } from "./whatsapp";

export const ADAPTORLER: readonly KanalAdaptoru[] = [whatsappAdaptoru];

/** Kanalın adaptörü; henüz yazılmamışsa null */
export function adaptorBul(kanal: string): KanalAdaptoru | null {
  return ADAPTORLER.find((a) => a.kanal === kanal) ?? null;
}

/** Kanalın adaptörü; yoksa hata (kuyruktaki iş adaptörü olmayan bir kanala aitse) */
export function adaptor(kanal: string): KanalAdaptoru {
  const a = adaptorBul(kanal);
  if (!a) throw new Error(`Kanal adaptörü yok: ${String(kanal).slice(0, 20)}`);
  return a;
}

/** Webhook gövdesindeki `object` değerinin adaptörü */
export function webhookAdaptoru(object: unknown): KanalAdaptoru | null {
  return ADAPTORLER.find((a) => a.webhookObject === object) ?? null;
}

/** Simülasyon formu için: tüm kanallar ve adaptörü hazır olanlar */
export function kanalListesi(): { kanal: Kanal; hazir: boolean; ad: string; kimlikAlani: KanalAdaptoru["kimlikAlani"] | null }[] {
  const AD: Record<Kanal, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };
  return KONUSMA_KANALLARI.map((k) => {
    const a = adaptorBul(k);
    return { kanal: k, hazir: !!a, ad: a?.ad ?? AD[k], kimlikAlani: a?.kimlikAlani ?? null };
  });
}

export type { KanalAdaptoru } from "./tur";
