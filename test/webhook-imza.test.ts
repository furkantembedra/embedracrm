// Ortak Meta webhook'u (components/konusma/meta-webhook.ts): /api/meta/webhook ve geriye uyumlu /api/whatsapp/webhook.
// Meta doğrulaması (GET), X-Hub-Signature-256 imza kontrolü (POST), secret / token geri düşüşü (META_* → WHATSAPP_*),
// object'e göre yönlendirme, Instagram / Messenger'da içerik loglanmaması ve WhatsApp ek bilgisi.
// Mesaj işleme (isle.ts) burada sahtelenir; kuralları test/isle.test.ts sınar.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  echoOlayi, hikayeBahsetmeOlayi, hikayeYanitiOlayi, imzala as imzalaS, instagramGovdesi, mesajOlayi, messengerGovdesi,
  okunduOlayi, postbackOlayi, reklamMesajiOlayi, tepkiOlayi, waMesaj, whatsappGovdesi,
} from "./sahte/meta";

const islenen = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@/components/whatsapp/isle", () => ({
  whatsappMesajiIsle: vi.fn(async (m: Record<string, unknown>) => {
    islenen.push(m);
    return { firsat: { id: "1" }, yeni: true };
  }),
}));
vi.mock("@/lib/supabase/db", () => ({ sistemOlarak: <T>(is: () => Promise<T>) => is() }));

const meta = await import("@/app/api/meta/webhook/route");
const whatsapp = await import("@/app/api/whatsapp/webhook/route");

const SECRET = "test-app-secret";
const imzala = (govde: string, anahtar = SECRET) => imzalaS(govde, anahtar);
const metaGovdesi = (mesajId = "wamid.TEST1") =>
  JSON.stringify(whatsappGovdesi({ mesajlar: [waMesaj({ id: mesajId, timestamp: "1763460000", text: { body: "Fiyat alabilir miyim?" } })] }));

beforeEach(() => {
  islenen.length = 0;
  vi.stubEnv("META_APP_SECRET", "");
  vi.stubEnv("META_VERIFY_TOKEN", "");
  vi.stubEnv("INSTAGRAM_APP_SECRET", "");
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each([
  ["/api/meta/webhook", meta],
  ["/api/whatsapp/webhook", whatsapp],
])("%s", (yol, { GET, POST }) => {
  const ADRES = `http://localhost:3000${yol}`;
  const gonder = (govde: string, imza?: string) =>
    POST(new NextRequest(ADRES, { method: "POST", body: govde, headers: imza ? { "x-hub-signature-256": imza } : {} }));

  describe("POST imza doğrulaması", () => {
    it("geçerli imzalı bildirimi kabul eder ve mesajı işler", async () => {
      const govde = metaGovdesi();
      const r = await gonder(govde, imzala(govde));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, islenen: 1 });
      expect(islenen).toEqual([expect.objectContaining({
        waId: "905321112233", ad: "Ahmet", metin: "Fiyat alabilir miyim?", tur: "text", mesajId: "wamid.TEST1", kanalHesapId: "PNID-1",
      })]);
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

    it("META_APP_SECRET tanımlıysa onu kullanır, WHATSAPP_APP_SECRET ile imzalananı reddeder", async () => {
      vi.stubEnv("META_APP_SECRET", "meta-secret");
      const govde = metaGovdesi();
      expect((await gonder(govde, imzala(govde, SECRET))).status).toBe(401);
      expect((await gonder(govde, imzala(govde, "meta-secret"))).status).toBe(200);
      expect(islenen).toHaveLength(1);
    });

    it("INSTAGRAM_APP_SECRET yalnızca Instagram gövdesinde kabul edilir; uygulama secret'ı da geçerli kalır", async () => {
      vi.stubEnv("INSTAGRAM_APP_SECRET", "ig-secret");
      vi.spyOn(console, "info").mockImplementation(() => {});
      const ig = JSON.stringify(instagramGovdesi());
      expect((await gonder(ig, imzala(ig, "ig-secret"))).status).toBe(200);
      expect((await gonder(ig, imzala(ig, SECRET))).status).toBe(200);
      expect((await gonder(ig, imzala(ig, "baska"))).status).toBe(401);
      // Instagram anahtarıyla WhatsApp ya da Messenger bildirimi uydurulamaz
      const wa = metaGovdesi();
      expect((await gonder(wa, imzala(wa, "ig-secret"))).status).toBe(401);
      const ms = JSON.stringify(messengerGovdesi());
      expect((await gonder(ms, imzala(ms, "ig-secret"))).status).toBe(401);
      expect(islenen).toHaveLength(0);
    });

    it("imzasız bozuk gövdeye 400 değil 401 döner (gövde imzadan önce kullanılmaz)", async () => {
      expect((await gonder("{bozuk", imzala("{bozuk", "baska"))).status).toBe(401);
    });

    it("META_APP_SECRET tanımsızsa WHATSAPP_APP_SECRET'e düşer", async () => {
      const govde = metaGovdesi();
      expect((await gonder(govde, imzala(govde, SECRET))).status).toBe(200);
    });

    it("hiçbir secret tanımlı değilse production'da imzasız isteği reddeder", async () => {
      vi.stubEnv("WHATSAPP_APP_SECRET", "");
      vi.stubEnv("NODE_ENV", "production");
      expect((await gonder(metaGovdesi())).status).toBe(401);
      expect(islenen).toHaveLength(0);
    });

    it("hiçbir secret tanımlı değilse geliştirmede imzasız isteği kabul eder", async () => {
      vi.stubEnv("WHATSAPP_APP_SECRET", "");
      vi.stubEnv("NODE_ENV", "development");
      expect((await gonder(metaGovdesi())).status).toBe(200);
      expect(islenen).toHaveLength(1);
    });

    it("JSON olmayan gövdeyi 400 ile reddeder", async () => {
      expect((await gonder("{bozuk", imzala("{bozuk"))).status).toBe(400);
    });
  });

  describe("object'e göre yönlendirme", () => {
    const log = () => vi.spyOn(console, "info").mockImplementation(() => {});

    it("Instagram bildirimini işlemeden 200 döner; yalnızca olay türlerini loglar, içerik ve kimlik loglanmaz", async () => {
      const l = log();
      const govde = JSON.stringify(instagramGovdesi({
        hesap: "IG-GIZLI-HESAP",
        olaylar: [
          mesajOlayi({ kullanici: "IGSID-GIZLI", hesap: "IG-GIZLI-HESAP", metin: "Telefonum 05321234567" }),
          hikayeYanitiOlayi({ kullanici: "IGSID-GIZLI" }), hikayeBahsetmeOlayi(), echoOlayi({ metin: "Gizli cevap" }), okunduOlayi(), tepkiOlayi(),
        ],
      }));
      const r = await gonder(govde, imzala(govde));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, islenen: 0 });
      expect(islenen).toHaveLength(0);
      const yazilan = l.mock.calls.flat().join("\n");
      expect(yazilan).toBe("[meta-webhook] instagram bildirimi henüz işlenmiyor: message×3, message_echo×1, read×1, reaction×1");
      for (const gizli of ["05321234567", "IGSID-GIZLI", "IG-GIZLI-HESAP", "Gizli cevap", "Bu cihazın"]) expect(yazilan).not.toContain(gizli);
    });

    it("Messenger (object: page) bildirimini işlemeden 200 döner; standby ve postback türleri sayılır", async () => {
      const l = log();
      const govde = JSON.stringify(messengerGovdesi({
        sayfa: "SAYFA-GIZLI", olaylar: [reklamMesajiOlayi({ hesap: "SAYFA-GIZLI" }), postbackOlayi()], standby: [mesajOlayi({ metin: "Gelen kutusundaki mesaj" })],
      }));
      const r = await gonder(govde, imzala(govde));
      expect(await r.json()).toEqual({ ok: true, islenen: 0 });
      const yazilan = l.mock.calls.flat().join("\n");
      expect(yazilan).toBe("[meta-webhook] messenger bildirimi henüz işlenmiyor: message×1, postback×1, standby:message×1");
      for (const gizli of ["SAYFA-GIZLI", "Gelen kutusundaki", "Reklamdaki", "REKLAM-1"]) expect(yazilan).not.toContain(gizli);
    });

    it("Instagram changes (yorum vb.) bildiriminde yalnızca alan adı loglanır", async () => {
      const l = log();
      const govde = JSON.stringify(instagramGovdesi({ olaylar: [], degisiklikler: [{ field: "comments", value: { text: "Fiyat?", from: { username: "gizli_kullanici" } } }] }));
      await gonder(govde, imzala(govde));
      const yazilan = l.mock.calls.flat().join("\n");
      expect(yazilan).toContain("degisiklik:comments×1");
      expect(yazilan).not.toContain("gizli_kullanici");
    });

    it("bilinmeyen object'te 200 döner ve yalnızca güvenli adı loglar", async () => {
      const l = log();
      for (const object of ["user", "<script>Gizli içerik</script>", 42]) {
        const govde = JSON.stringify({ object, entry: [] });
        expect(await (await gonder(govde, imzala(govde))).json()).toEqual({ ok: true, islenen: 0 });
      }
      expect(l.mock.calls.flat()).toEqual(["[meta-webhook] bilinmeyen object: user", "[meta-webhook] bilinmeyen object: ?", "[meta-webhook] bilinmeyen object: ?"]);
    });

    it("WhatsApp durum bildirimi (statuses) mesaj işlemez", async () => {
      const govde = JSON.stringify(whatsappGovdesi({ durumlar: [{ id: "wamid.X", status: "read", recipient_id: "905321112233" }] }));
      expect(await (await gonder(govde, imzala(govde))).json()).toEqual({ ok: true, islenen: 0 });
    });
  });

  describe("GET Meta doğrulaması", () => {
    const dogrula = (token: string) => GET(new NextRequest(`${ADRES}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`));

    it("doğru verify token'da challenge'ı döner (WHATSAPP_VERIFY_TOKEN'a düşer)", async () => {
      vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "dogrulama-tokeni");
      const r = await dogrula("dogrulama-tokeni");
      expect(r.status).toBe(200);
      expect(await r.text()).toBe("12345");
    });

    it("META_VERIFY_TOKEN tanımlıysa önceliklidir", async () => {
      vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "eski-token");
      vi.stubEnv("META_VERIFY_TOKEN", "yeni-token");
      expect((await dogrula("eski-token")).status).toBe(403);
      expect((await dogrula("yeni-token")).status).toBe(200);
    });

    it("yanlış token'ı ve tanımsız token'ı reddeder", async () => {
      vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "dogrulama-tokeni");
      expect((await dogrula("yanlis")).status).toBe(403);
      vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "");
      expect((await dogrula("")).status).toBe(403);
    });
  });
});

describe("WhatsApp ek bilgisi (kişisel veri yazılmaz)", () => {
  const gonder = async (mesaj: ReturnType<typeof waMesaj>, o: Parameters<typeof whatsappGovdesi>[0] = {}) => {
    const govde = JSON.stringify(whatsappGovdesi({ ...o, mesajlar: [mesaj] }));
    const r = await meta.POST(new NextRequest("http://localhost:3000/api/meta/webhook", { method: "POST", body: govde, headers: { "x-hub-signature-256": imzala(govde) } }));
    expect(r.status).toBe(200);
    return islenen.at(-1)!;
  };

  it("reklamdan gelen mesajın yönlendirme bilgisi yazılır, tıklama kimliği (ctwa_clid) yazılmaz", async () => {
    const m = await gonder(waMesaj({ referral: {
      source_url: "https://fb.me/abc", source_id: "REKLAM-9", source_type: "ad", headline: "ONE ile direksiyon testi", body: "Detaylar", media_type: "image", ctwa_clid: "GIZLI-TIKLAMA",
    } }));
    expect(m.ek).toEqual({ yonlendirme: { kaynak_turu: "ad", kaynak_id: "REKLAM-9", baslik: "ONE ile direksiyon testi", govde: "Detaylar", medya_turu: "image", kaynak_url: "https://fb.me/abc" } });
    expect(JSON.stringify(m.ek)).not.toContain("GIZLI-TIKLAMA");
  });

  it("yanıtlanan mesajın kimliği yazılır, yanıtlananın telefonu (context.from) yazılmaz", async () => {
    const m = await gonder(waMesaj({ context: { from: "905559998877", id: "wamid.ONCEKI" } }));
    expect(m.ek).toEqual({ yanitlanan_mesaj_id: "wamid.ONCEKI" });
  });

  it("dosyanın MIME türü yazılır, medya kimliği yazılmaz; tepkide tepki verilen mesaj yanıtlanan olarak yazılır", async () => {
    const d = await gonder(waMesaj({ type: "document", document: { id: "MEDYA-1", mime_type: "application/pdf", filename: "teklif.pdf" } }));
    expect(d).toMatchObject({ tur: "document", metin: "📄 teklif.pdf", ek: { ek_dosya_turu: "application/pdf" } });
    expect(JSON.stringify(d.ek)).not.toContain("MEDYA-1");
    const t = await gonder(waMesaj({ type: "reaction", reaction: { message_id: "wamid.BIZIM", emoji: "👍" } }));
    expect(t).toMatchObject({ tur: "reaction", metin: "Tepki: 👍", ek: { yanitlanan_mesaj_id: "wamid.BIZIM" } });
  });

  it("metadata yoksa hesap kimliği boş geçer (isle.ts varsayılana düşer)", async () => {
    const m = await gonder(waMesaj(), { phoneNumberId: null });
    expect(m.kanalHesapId).toBeUndefined();
  });
});
