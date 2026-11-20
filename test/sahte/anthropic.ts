// Sahte Anthropic Messages API. Kullanım (P2.1'deki bot adaptörü için):
//   const claude = await sahteAnthropicBaslat();  process.env.ANTHROPIC_BASE_URL = claude.adres;
// Resmî SDK (@anthropic-ai/sdk) temel adresi ANTHROPIC_BASE_URL'den alır; istek POST /v1/messages'a gider.
// Yanıtlar sırayla kuyruktan verilir: metin(), aracCagrisi() ya da red() ile eklenir. Kuyruk boşsa 500 döner,
// böylece beklenmeyen bir model çağrısı testte sessizce geçmez.
import { sahteSunucuBaslat, type SahteSunucu } from "./sunucu";

type Blok =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "thinking"; thinking: string; signature: string };
type Kullanim = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
type Kuyruk = { durum: number; govde: unknown; gecikmeMs?: number };
/** Yanıt seçenekleri: kullanım (token) ve yanıtın başına düşünme bloğu (claude-haiku-5-5 düşünmesi varsayılan açık) */
export type YanitSecenegi = { kullanim?: Partial<Kullanim>; dusunme?: boolean };

export type SahteAnthropic = SahteSunucu & {
  /** Düz metin yanıtı (stop_reason: end_turn) */
  metin: (metin: string, s?: YanitSecenegi) => void;
  /** Araç çağrısı yanıtı (stop_reason: tool_use); önüne isteğe bağlı açıklama metni eklenebilir */
  aracCagrisi: (ad: string, girdi: unknown, onMetin?: string, s?: YanitSecenegi) => void;
  /** Çıktı sınırına takılan yanıt (stop_reason: max_tokens) */
  yarim: (metin: string) => void;
  /** Sonraki yanıtı geciktirir (zaman aşımı); yanıt metin olarak kuyruğa eklenir */
  gecikmeli: (ms: number, metin: string) => void;
  /** Güvenlik reddi (HTTP 200, stop_reason: refusal) */
  red: (kategori?: string | null) => void;
  /** HTTP hatası (ör. 429 hız sınırı, 529 aşırı yük) */
  httpHatasi: (durum: number, tur: string, mesaj: string) => void;
  /** Modele giden istek gövdeleri */
  gelenler: () => Record<string, unknown>[];
};

let kimlik = 0;
const yeniKimlik = (on: string) => `${on}_sahte${String(++kimlik).padStart(6, "0")}`;

const dusunme = (s: YanitSecenegi): Blok[] => (s.dusunme ? [{ type: "thinking", thinking: "", signature: yeniKimlik("imza") }] : []);

export async function sahteAnthropicBaslat(beklenenAnahtar = "test-anthropic-key"): Promise<SahteAnthropic> {
  const kuyruk: Kuyruk[] = [];
  const mesaj = (model: string, content: Blok[], stop_reason: string, stop_details: unknown = null, kullanim: Partial<Kullanim> = {}) => ({
    id: yeniKimlik("msg"),
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason,
    stop_sequence: null,
    stop_details,
    usage: { input_tokens: 42, output_tokens: 17, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...kullanim },
  });

  const sunucu = await sahteSunucuBaslat((istek) => {
    if (istek.yontem !== "POST" || istek.yol.split("?")[0] !== "/v1/messages") {
      return { durum: 404, govde: { type: "error", error: { type: "not_found_error", message: "Not found" } } };
    }
    // SDK 1.x (anthropic-version 2026-10-21) anahtarı "Authorization: Bearer" ile, eski sürümler x-api-key ile gönderir
    const yetki = istek.basliklar.authorization;
    const anahtar = istek.basliklar["x-api-key"] ?? (typeof yetki === "string" && yetki.startsWith("Bearer ") ? yetki.slice(7) : undefined);
    if (anahtar !== beklenenAnahtar) {
      return { durum: 401, govde: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } };
    }
    if (!istek.basliklar["anthropic-version"]) {
      return { durum: 400, govde: { type: "error", error: { type: "invalid_request_error", message: "anthropic-version header is required" } } };
    }
    const siradaki = kuyruk.shift();
    if (!siradaki) {
      return { durum: 500, govde: { type: "error", error: { type: "api_error", message: "Sahte Anthropic: kuyrukta yanıt yok" } } };
    }
    const model = (istek.govde as { model?: string }).model ?? "claude-opus-5-5";
    const g = siradaki.govde as { blok?: Blok[]; stop?: string; detay?: unknown; kullanim?: Partial<Kullanim> };
    return siradaki.durum === 200 && g.blok
      ? { durum: 200, govde: mesaj(model, g.blok, g.stop!, g.detay ?? null, g.kullanim), gecikmeMs: siradaki.gecikmeMs }
      : siradaki;
  });

  return {
    ...sunucu,
    metin: (metin, s = {}) =>
      void kuyruk.push({ durum: 200, govde: { blok: [...dusunme(s), { type: "text", text: metin }], stop: "end_turn", kullanim: s.kullanim } }),
    aracCagrisi: (ad, girdi, onMetin, s = {}) =>
      void kuyruk.push({
        durum: 200,
        govde: {
          blok: [...dusunme(s), ...(onMetin ? [{ type: "text" as const, text: onMetin }] : []), { type: "tool_use" as const, id: yeniKimlik("toolu"), name: ad, input: girdi }],
          stop: "tool_use",
          kullanim: s.kullanim,
        },
      }),
    yarim: (metin) => void kuyruk.push({ durum: 200, govde: { blok: [{ type: "text", text: metin }], stop: "max_tokens" } }),
    gecikmeli: (ms, metin) => void kuyruk.push({ durum: 200, govde: { blok: [{ type: "text", text: metin }], stop: "end_turn" }, gecikmeMs: ms }),
    red: (kategori = null) =>
      void kuyruk.push({ durum: 200, govde: { blok: [], stop: "refusal", detay: { type: "refusal", category: kategori, explanation: null } } }),
    httpHatasi: (durum, tur, mesaj) => void kuyruk.push({ durum, govde: { type: "error", error: { type: tur, message: mesaj } } }),
    gelenler: () => sunucu.istekler.filter((i) => i.yontem === "POST").map((i) => i.govde as Record<string, unknown>),
  };
}
