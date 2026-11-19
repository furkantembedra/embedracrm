// WhatsApp Cloud API mesaj türünü (messages[].type) kanaldan bağımsız ortak türe çevirir.
// Ortak liste: components/konusma/queries.ts › MESAJ_TURLERI. Birebir karşılığı olmayan türün aslı ek.kaynak_tur'da saklanır.
// P1.1'de WhatsApp kanal adaptörüne taşınacak.
import type { MesajEki, MesajTuru } from "@/components/konusma/queries";

const ESLEME: Record<string, MesajTuru> = {
  text: "metin",
  button: "metin", // şablon düğmesine basma: düğme metni gelir
  interactive: "metin", // düğme / liste cevabı: seçilen başlık gelir
  image: "gorsel",
  sticker: "gorsel",
  audio: "ses",
  video: "video",
  document: "dosya",
  reaction: "tepki",
};

/** Ortak listede kendi adıyla bulunan türler: aslını ek.kaynak_tur'a yazmaya gerek yok */
const BIREBIR = new Set(["text", "image", "audio", "video", "document"]);

export function whatsappTuru(tur: string): { tur: MesajTuru; ek: Pick<MesajEki, "kaynak_tur"> } {
  const t = (tur || "text").trim();
  return { tur: ESLEME[t] ?? "diger", ek: BIREBIR.has(t) ? {} : { kaynak_tur: t.slice(0, 40) } };
}
