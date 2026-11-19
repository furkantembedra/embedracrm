// Sahte Meta / Anthropic sunucuları ve ağ koruması: testlerin gerçek API'ye çıkmadığını ve
// gönderim kodunun Meta'ya doğru isteği attığını doğrular.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  echoOlayi, hikayeYanitiOlayi, instagramGovdesi, messengerGovdesi, sahteMetaBaslat, VARSAYILAN_TOKENLAR, whatsappGovdesi, type SahteMeta,
} from "./sahte/meta";
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

describe("sahte Meta: Messenger ve Instagram Send API", () => {
  let meta: SahteMeta;
  beforeAll(async () => {
    meta = await sahteMetaBaslat();
  });
  afterAll(() => meta.kapat());

  const gonder = (yol: string, token: string, govde: unknown, sorguda = false) =>
    fetch(`${meta.adres}${yol}${sorguda ? `?access_token=${token}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(sorguda ? {} : { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify(govde),
    });
  const mesaj = { recipient: { id: "PSID-1" }, messaging_type: "RESPONSE", message: { text: "Merhaba" } };

  it("Messenger: sayfa token'ıyla { recipient_id, message_id } döner (token sorgu parametresinde de olabilir)", async () => {
    const r = await gonder("/v21.0/SAYFA-1/messages", VARSAYILAN_TOKENLAR.messenger, mesaj, true);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ recipient_id: "PSID-1", message_id: expect.stringMatching(/^m_SAHTE/) });
    expect(meta.gonderimler().at(-1)).toMatchObject({ kanal: "messenger", hesap: "SAYFA-1" });
  });

  it("Instagram: Instagram token'ıyla { recipient_id, message_id } döner", async () => {
    const r = await gonder("/v21.0/me/messages", VARSAYILAN_TOKENLAR.instagram, { ...mesaj, recipient: { id: "IGSID-1" } });
    expect(await r.json()).toEqual({ recipient_id: "IGSID-1", message_id: expect.stringMatching(/^aWdf/) });
    expect(meta.gonderimler().at(-1)).toMatchObject({ kanal: "instagram", hesap: "me" });
  });

  it("alıcısız istek 400, tanınmayan token 401, hata() sonraki yanıtı Meta hata gövdesine çevirir", async () => {
    expect((await gonder("/v21.0/SAYFA-1/messages", VARSAYILAN_TOKENLAR.messenger, { message: { text: "x" } })).status).toBe(400);
    expect((await gonder("/v21.0/SAYFA-1/messages", "yanlis", mesaj)).status).toBe(401);
    meta.hata(400, "(#10) This message is sent outside of allowed window.", 10);
    const r = await gonder("/v21.0/SAYFA-1/messages", VARSAYILAN_TOKENLAR.messenger, mesaj);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: { code: 10, message: expect.stringContaining("allowed window") } });
  });
});

describe("sahte Meta webhook gövdeleri", () => {
  it("üç kanalın object ve entry kimliği doğru", () => {
    expect(whatsappGovdesi({ phoneNumberId: "P" })).toMatchObject({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "P" } } }] }] });
    expect(instagramGovdesi({ hesap: "IG" })).toMatchObject({ object: "instagram", entry: [{ id: "IG", messaging: [{ recipient: { id: "IG" }, message: { text: "Merhaba" } }] }] });
    expect(messengerGovdesi({ sayfa: "S" })).toMatchObject({ object: "page", entry: [{ id: "S", messaging: [{ recipient: { id: "S" } }] }] });
  });

  it("echo'da gönderen işletme hesabıdır; hikâye yanıtı reply_to.story taşır", () => {
    expect(echoOlayi({ hesap: "IG", kullanici: "U", appId: "263902037430900" })).toMatchObject({ sender: { id: "IG" }, recipient: { id: "U" }, message: { is_echo: true, app_id: "263902037430900" } });
    expect(hikayeYanitiOlayi({ hikayeId: "H1" })).toMatchObject({ message: { reply_to: { story: { id: "H1" } } } });
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
