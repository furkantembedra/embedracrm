// WhatsApp webhook'u (app/api/whatsapp/webhook): Meta doğrulaması (GET) ve X-Hub-Signature-256 imza kontrolü (POST).
// Mesaj işleme (isle.ts) burada sahtelenir; kuralları test/isle.test.ts sınar.
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const islenen = vi.hoisted(() => [] as unknown[]);
vi.mock("@/components/whatsapp/isle", () => ({
  whatsappMesajiIsle: vi.fn(async (m: unknown) => {
    islenen.push(m);
    return { firsat: { id: "1" }, yeni: true };
  }),
}));
vi.mock("@/lib/supabase/db", () => ({ sistemOlarak: <T>(is: () => Promise<T>) => is() }));

const { GET, POST } = await import("@/app/api/whatsapp/webhook/route");

const SECRET = "test-app-secret";
const ADRES = "http://localhost:3000/api/whatsapp/webhook";
const imzala = (govde: string, anahtar = SECRET) => `sha256=${createHmac("sha256", anahtar).update(govde).digest("hex")}`;

const metaGovdesi = (mesajId = "wamid.TEST1") =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: {
      contacts: [{ wa_id: "905321112233", profile: { name: "Ahmet" } }],
      messages: [{ from: "905321112233", id: mesajId, timestamp: "1763460000", type: "text", text: { body: "Fiyat alabilir miyim?" } }],
    } }] }],
  });

const gonder = (govde: string, imza?: string) =>
  POST(new NextRequest(ADRES, { method: "POST", body: govde, headers: imza ? { "x-hub-signature-256": imza } : {} }));

beforeEach(() => {
  islenen.length = 0;
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST imza doğrulaması", () => {
  it("geçerli imzalı bildirimi kabul eder ve mesajı işler", async () => {
    const govde = metaGovdesi();
    const r = await gonder(govde, imzala(govde));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, islenen: 1 });
    expect(islenen).toEqual([expect.objectContaining({ waId: "905321112233", ad: "Ahmet", metin: "Fiyat alabilir miyim?", tur: "text", mesajId: "wamid.TEST1" })]);
  });

  it("yanlış anahtarla imzalanmış bildirimi reddeder", async () => {
    const govde = metaGovdesi();
    const r = await gonder(govde, imzala(govde, "baska-secret"));
    expect(r.status).toBe(401);
    expect(islenen).toHaveLength(0);
  });

  it("imzalandıktan sonra değiştirilmiş gövdeyi reddeder", async () => {
    const imza = imzala(metaGovdesi("wamid.ASIL"));
    const r = await gonder(metaGovdesi("wamid.DEGISTIRILMIS"), imza);
    expect(r.status).toBe(401);
    expect(islenen).toHaveLength(0);
  });

  it("biçimi bozuk imzayı reddeder", async () => {
    const govde = metaGovdesi();
    for (const imza of ["sha1=abc", "abc", "sha256=", `sha256=${"0".repeat(64)}`]) {
      expect((await gonder(govde, imza)).status).toBe(401);
    }
    expect(islenen).toHaveLength(0);
  });

  it("imza başlığı eksikse reddeder", async () => {
    const r = await gonder(metaGovdesi());
    expect(r.status).toBe(401);
    expect(islenen).toHaveLength(0);
  });

  it("secret tanımlı değilse production'da imzasız isteği reddeder", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await gonder(metaGovdesi())).status).toBe(401);
    expect(islenen).toHaveLength(0);
  });

  it("secret tanımlı değilse geliştirmede imzasız isteği kabul eder", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect((await gonder(metaGovdesi())).status).toBe(200);
    expect(islenen).toHaveLength(1);
  });

  it("WhatsApp dışı bildirimi işlemeden 200 döner", async () => {
    const govde = JSON.stringify({ object: "page", entry: [] });
    expect(await (await gonder(govde, imzala(govde))).json()).toEqual({ ok: true, islenen: 0 });
    expect(islenen).toHaveLength(0);
  });
});

describe("GET Meta doğrulaması", () => {
  const dogrula = (token: string) =>
    GET(new NextRequest(`${ADRES}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`));

  it("doğru verify token'da challenge'ı döner", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "dogrulama-tokeni");
    const r = await dogrula("dogrulama-tokeni");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("12345");
  });

  it("yanlış token'ı ve tanımsız token'ı reddeder", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "dogrulama-tokeni");
    expect((await dogrula("yanlis")).status).toBe(403);
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "");
    expect((await dogrula("")).status).toBe(403);
  });
});
