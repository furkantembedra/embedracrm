// Kanal simgesi ve bot durumu rozeti: Gelen kutusu ve satış hattı kartı aynı görünümü kullanır.
// (Yalnızca görünüm: kanalın rengi ve kısa adı. Kanal davranışı adaptördedir, components/konusma/kanallar.)
import { MessageCircle } from "lucide-react";
import Chip from "@/components/ui/chip";

const KANAL: Record<string, { ad: string; renk: string }> = {
  whatsapp: { ad: "WhatsApp", renk: "#1F8F4E" },
  messenger: { ad: "Messenger", renk: "#2F4BFF" },
  instagram: { ad: "Instagram", renk: "#C13584" },
};

export const kanalAdi = (kanal: string) => KANAL[kanal]?.ad ?? kanal;

export function KanalSimgesi({ kanal, boyut = 16 }: { kanal: string; boyut?: number }) {
  const k = KANAL[kanal] ?? { ad: kanal, renk: "#6B6E66" };
  return (
    <span
      title={k.ad}
      role="img"
      aria-label={k.ad}
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ background: k.renk, width: boyut + 8, height: boyut + 8 }}
    >
      <MessageCircle size={boyut - 2} aria-hidden="true" />
    </span>
  );
}

export type BotDurumu = "bot" | "bekliyor" | "temsilci";

/**
 * bot: bot açık (konuşmayı bot yürütüyor) · bekliyor: bot kapalı ve son mesaj müşteriden (ekipten cevap bekleniyor)
 * · temsilci: bot kapalı, son sözü ekip söylemiş. (P1.3 devral / devretti durumlarını ekler.)
 */
export function botDurumu(botAktif: boolean, sonYon: "gelen" | "giden" | null | undefined): BotDurumu {
  if (botAktif) return "bot";
  return sonYon === "gelen" ? "bekliyor" : "temsilci";
}

const ROZET: Record<BotDurumu, { metin: string; ton: "lime" | "warn" | "gray" }> = {
  bot: { metin: "Bot konuşuyor", ton: "lime" },
  bekliyor: { metin: "Cevap bekliyor", ton: "warn" },
  temsilci: { metin: "Temsilcide", ton: "gray" },
};

export function BotRozeti({ durum }: { durum: BotDurumu }) {
  const r = ROZET[durum];
  return <Chip ton={r.ton}>{r.metin}</Chip>;
}

/** "14:05" (bugün), "Dün", "12 Kas" */
export function kisaZaman(iso: string, simdi = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const gun = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (gun(d) === gun(simdi)) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dun = new Date(simdi);
  dun.setDate(dun.getDate() - 1);
  if (gun(d) === gun(dun)) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
