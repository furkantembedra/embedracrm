// Claude adaptörü: resmî @anthropic-ai/sdk ile Messages API çağrısı. Model ve effort ./yapilandirma.ts'ten.
// ANTHROPIC_API_KEY tanımlı değilse bot kapalıdır (claudeHazir false); SDK'nın başka kimlik kaynaklarına (ant auth
// profili vb.) düşmemesi için anahtar her zaman açıkça verilir. ANTHROPIC_BASE_URL (testte sahte sunucu) SDK'ya iletilir.
// Loglarda yalnızca token sayıları ve hata türü yazılır; istem, mesaj metni ve anahtar yazılmaz (değişmez kural 7).
import Anthropic, { APIConnectionError, APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk";
import { BOT_AZAMI_CIKTI, BOT_EFFORT, BOT_MODELI, BOT_YENIDEN_DENEME, BOT_ZAMAN_ASIMI_MS, type TokenKullanimi } from "./yapilandirma";

const anahtar = () => process.env.ANTHROPIC_API_KEY?.trim() || "";

/** Bot çağrılabilir mi (anahtar tanımlı mı) */
export function claudeHazir(): boolean {
  return anahtar().length > 0;
}

let onbellek: { anahtar: string; adres: string; istemci: Anthropic } | null = null;

function istemci(): Anthropic {
  const a = anahtar();
  if (!a) throw new Error("ANTHROPIC_API_KEY tanımlı değil");
  const adres = process.env.ANTHROPIC_BASE_URL?.trim() || "";
  if (!onbellek || onbellek.anahtar !== a || onbellek.adres !== adres) {
    onbellek = {
      anahtar: a,
      adres,
      istemci: new Anthropic({ apiKey: a, baseURL: adres || undefined, timeout: BOT_ZAMAN_ASIMI_MS, maxRetries: BOT_YENIDEN_DENEME }),
    };
  }
  return onbellek.istemci;
}

export type ClaudeIstegi = {
  /** Sabit sistem istemi (önbelleğe alınır) */
  sistem: string;
  araclar: Anthropic.Tool[];
  mesajlar: Anthropic.MessageParam[];
};

/**
 * Tek Messages API çağrısı. Önbellek: araçlar → sistem sırası sabit; kırılma noktası sistem bloğunun sonunda, böylece
 * araç tanımları + sistem istemi her turda önbellekten okunur, değişken kullanıcı mesajı sonda kalır.
 * Düşünme: claude-haiku-5-5'te varsayılan açık (adaptive); derinliği effort belirler. Araç döngüsünde dönen içerik
 * (thinking blokları dahil) değiştirilmeden geri verilmelidir: çağıran response.content'i olduğu gibi ekler.
 */
export async function claudeCagir(i: ClaudeIstegi): Promise<Anthropic.Message> {
  return istemci().messages.create({
    model: BOT_MODELI,
    max_tokens: BOT_AZAMI_CIKTI,
    output_config: { effort: BOT_EFFORT },
    system: [{ type: "text", text: i.sistem, cache_control: { type: "ephemeral" } }],
    tools: i.araclar,
    tool_choice: { type: "auto" },
    messages: i.mesajlar,
  });
}

/** Yanıtın kullanımı (null alanlar 0) */
export function kullanim(m: Anthropic.Message): TokenKullanimi {
  const u = m.usage;
  return {
    girdi: u.input_tokens ?? 0,
    cikti: u.output_tokens ?? 0,
    cacheYazma: u.cache_creation_input_tokens ?? 0,
    cacheOkuma: u.cache_read_input_tokens ?? 0,
  };
}

/** Hatanın kısa kodu (bot_kullanim.hata_kodu; hata mesajı yazılmaz) */
export function hataKodu(e: unknown): string {
  if (e instanceof APIConnectionTimeoutError) return "zaman_asimi";
  if (e instanceof APIConnectionError) return "baglanti";
  if (e instanceof APIError && typeof e.status === "number") return `http_${e.status}`;
  return "beklenmeyen";
}
