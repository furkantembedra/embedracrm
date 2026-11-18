// Sahte Meta / Anthropic sunucuları ve ağ koruması: testlerin gerçek API'ye çıkmadığını ve
// gönderim kodunun Meta'ya doğru isteği attığını doğrular.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sahteMetaBaslat, type SahteMeta } from "./sahte/meta";
import { sahteAnthropicBaslat, type SahteAnthropic } from "./sahte/anthropic";
import { whatsappGonder } from "@/lib/ileti-gonder";

describe("ağ koruması", () => {
  it("dış adrese fetch'i durdurur", async () => {
    await expect(fetch("https://api.anthropic.com/v1/messages")).rejects.toThrow(/gerçek ağa çıkılamaz/);
    await expect(fetch("https://graph.facebook.com/v21.0/x/messages")).rejects.toThrow(/gerçek ağa çıkılamaz/);
  });
});

describe("whatsappGonder → sahte Meta Graph API", () => {
  let meta: SahteMeta;
  beforeAll(async () => {
    meta = await sahteMetaBaslat("test-whatsapp-token");
  });
  afterAll(() => meta.kapat());
  afterEach(() => vi.unstubAllEnvs());

  const anahtarlarla = () => {
    vi.stubEnv("META_GRAPH_URL", meta.adres);
    vi.stubEnv("WHATSAPP_TOKEN", "test-whatsapp-token");
    vi.stubEnv("WHATSAPP_PHONE_ID", "123456789");
  };

  it("anahtar yoksa demo: istek atmadan başarılı döner", async () => {
    const once = meta.istekler.length;
    expect(await whatsappGonder({ telefon: "905321234567", sablon: "lisans_hatirlatma", parametreler: ["Ali"] })).toEqual({ ok: true });
    expect(meta.istekler.length).toBe(once);
  });

  it("onaylı şablonu doğru gövdeyle gönderir", async () => {
    anahtarlarla();
    const sonuc = await whatsappGonder({ telefon: "905321234567", sablon: "lisans_hatirlatma", parametreler: ["Ali", ""] });
    expect(sonuc).toEqual({ ok: true });
    const son = meta.istekler.at(-1)!;
    expect(son.yol).toBe("/v21.0/123456789/messages");
    expect(son.basliklar.authorization).toBe("Bearer test-whatsapp-token");
    expect(son.govde).toMatchObject({
      messaging_product: "whatsapp",
      to: "905321234567",
      type: "template",
      template: { name: "lisans_hatirlatma", language: { code: "tr" }, components: [{ type: "body", parameters: [{ type: "text", text: "Ali" }, { type: "text", text: "-" }] }] },
    });
  });

  it("Meta hatasını mesajıyla döndürür", async () => {
    anahtarlarla();
    meta.hata(400, "Template name does not exist in the translation");
    expect(await whatsappGonder({ telefon: "905321234567", sablon: "yok", parametreler: [] })).toEqual({
      ok: false,
      hata: "Template name does not exist in the translation",
    });
  });

  it("geçersiz telefonu Meta'ya göndermez", async () => {
    anahtarlarla();
    const once = meta.istekler.length;
    expect(await whatsappGonder({ telefon: "+90 532", sablon: "x", parametreler: [] })).toMatchObject({ ok: false });
    expect(meta.istekler.length).toBe(once);
  });
});

describe("sahte Anthropic Messages API", () => {
  let claude: SahteAnthropic;
  beforeAll(async () => {
    claude = await sahteAnthropicBaslat("test-anthropic-key");
  });
  afterAll(() => claude.kapat());

  const istek = (basliklar: Record<string, string> = { "x-api-key": "test-anthropic-key", "anthropic-version": "2023-06-01" }) =>
    fetch(`${claude.adres}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...basliklar },
      body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 1024, messages: [{ role: "user", content: "Merhaba" }] }),
    });

  it("metin ve araç çağrısı yanıtlarını Messages API biçiminde sırayla verir", async () => {
    claude.metin("Merhaba, ben Embedra'nın yapay zekâ asistanıyım.");
    claude.aracCagrisi("plan_oner", { ozellikler: ["canli_veri"] }, "Kontrol ediyorum.");
    const ilk = await (await istek()).json();
    expect(ilk).toMatchObject({ type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_details: null });
    expect(ilk.content).toEqual([{ type: "text", text: "Merhaba, ben Embedra'nın yapay zekâ asistanıyım." }]);
    expect(ilk.usage).toMatchObject({ input_tokens: expect.any(Number), output_tokens: expect.any(Number) });
    const ikinci = await (await istek()).json();
    expect(ikinci.stop_reason).toBe("tool_use");
    expect(ikinci.content[1]).toMatchObject({ type: "tool_use", name: "plan_oner", input: { ozellikler: ["canli_veri"] } });
    expect(ikinci.content[1].id).toMatch(/^toolu_/);
    expect(claude.gelenler()).toHaveLength(2);
  });

  it("reddi HTTP 200 + stop_reason refusal olarak verir", async () => {
    claude.red("cyber");
    const r = await (await istek()).json();
    expect(r).toMatchObject({ stop_reason: "refusal", content: [], stop_details: { type: "refusal", category: "cyber" } });
  });

  it("anahtarı ya da sürüm başlığı olmayan isteği reddeder; kuyruk boşsa 500 döner", async () => {
    expect((await istek({ "anthropic-version": "2023-06-01" })).status).toBe(401);
    expect((await istek({ "x-api-key": "test-anthropic-key" })).status).toBe(400);
    expect((await istek()).status).toBe(500);
  });

  it("HTTP hatasını Anthropic hata gövdesiyle verir", async () => {
    claude.httpHatasi(429, "rate_limit_error", "Number of request tokens has exceeded your rate limit");
    const r = await istek();
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ type: "error", error: { type: "rate_limit_error", message: "Number of request tokens has exceeded your rate limit" } });
  });
});
