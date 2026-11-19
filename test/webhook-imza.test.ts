// Ortak Meta webhook'u (components/konusma/meta-webhook.ts): /api/meta/webhook ve geriye uyumlu /api/whatsapp/webhook.
// Meta doğrulaması (GET), X-Hub-Signature-256 imza kontrolü (POST), secret / token geri düşüşü (META_* → WHATSAPP_*),
// object'e göre yönlendirme, Instagram / Messenger'da içerik loglanmaması ve WhatsApp ek bilgisi.
// Kayıt ve kuyruk (components/konusma/kuyruk.ts) burada sahtelenir: webhook adaptörün çevirdiği mesajları kuyruğa yazar
// ve hemen döner. Kuyruk / işleyici kuralları test/kuyruk.test.ts ve test/konusma-isle.test.ts'te, WhatsApp çevirisinin
// ayrıntıları test/kanal-whatsapp.test.ts'te.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GelenMesaj } from "@/components/konusma/kanallar/tur";
import {
  echoOlayi, hikayeBahsetmeOlayi, hikayeYanitiOlayi, imzala as imzalaS, instagramGovdesi, mesajOlayi, messengerGovdesi,
  okunduOlayi, postbackOlayi, reklamMesajiOlayi, tepkiOlayi, waMesaj, whatsappEchoGovdesi, whatsappGovdesi,
} from "./sahte/meta";

const islenen = vi.hoisted(() => [] as GelenMesaj[]);
const kuyruk = vi.hoisted(() => ({ hata: null as Error | null, gorulen: new Set<string>(), isleyici: 0 }));
vi.mock("@/components/konusma/kuyruk", () => ({
  kuyrugaYaz: vi.fn(async (mesajlar: GelenMesaj[]) => {
    if (kuyruk.hata) throw kuyruk.hata;
    const yeni = mesajlar.filter((m) => !kuyruk.gorulen.has(m.disMesajId));
    for (const m of yeni) kuyruk.gorulen.add(m.disMesajId);
    islenen.push(...yeni);
    return yeni.map((m, i) => ({ konusmaId: 1, mesajId: i + 1, echo: m.echo }));
  }),
  kuyruguIsle: vi.fn(async () => void kuyruk.isleyici++),
}));
vi.mock("@/lib/supabase/db", () => ({ sistemOlarak: <T>(is: () => Promise<T>) => is() }));
const durumlar = vi.hoisted(() => ({ yazilan: [] as unknown[], hata: null as Error | null }));
vi.mock("@/components/konusma/queries", async (asil) => ({
  ...(await asil<object>()),
  teslimDurumlariYaz: vi.fn(async (d: unknown[]) => {
    if (durumlar.hata) throw durumlar.hata;
    durumlar.yazilan.push(...d);
    return d.length;
  }),
}));

const meta = await import("@/app/api/meta/webhook/route");
const whatsapp = await import("@/app/api/whatsapp/webhook/route");

const SECRET = "test-app-secret";
const imzala = (govde: string, anahtar = SECRET) => imzalaS(govde, anahtar);
const metaGovdesi = (mesajId = "wamid.TEST1") =>
  JSON.stringify(whatsappGovdesi({ mesajlar: [waMesaj({ id: mesajId, timestamp: "1763460000", text: { body: "Fiyat alabilir miyim?" } })] }));

beforeEach(() => {
  islenen.length = 0;
  kuyruk.hata = null;
  kuyruk.gorulen.clear();
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
    it("geçerli imzalı bildirimi kabul eder, mesajı adaptörle çevirip kuyruğa yazar ve hemen döner", async () => {
      const govde = metaGovdesi();
      const r = await gonder(govde, imzala(govde));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, kaydedilen: 1, durum: 0 });
      expect(islenen).toEqual([{
        kanal: "whatsapp", kanalHesapId: "PNID-1", disKullaniciId: "+905321112233", disMesajId: "wamid.TEST1", tur: "metin",
        metin: "Fiyat alabilir miyim?", ek: {}, zaman: new Date(1763460000_000).toISOString(), echo: false, profilAdi: "Ahmet",
      }]);
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
      expect(await r.json()).toEqual({ ok: true, kaydedilen: 0 });
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
      expect(await r.json()).toEqual({ ok: true, kaydedilen: 0 });
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
        expect(await (await gonder(govde, imzala(govde))).json()).toEqual({ ok: true, kaydedilen: 0 });
      }
      expect(l.mock.calls.flat()).toEqual(["[meta-webhook] bilinmeyen object: user", "[meta-webhook] bilinmeyen object: ?", "[meta-webhook] bilinmeyen object: ?"]);
    });

    it("WhatsApp durum bildirimi (statuses) mesaj kaydetmez, yalnızca sayılır", async () => {
      const govde = JSON.stringify(whatsappGovdesi({ durumlar: [{ id: "wamid.X", status: "read", recipient_id: "905321112233" }] }));
      expect(await (await gonder(govde, imzala(govde))).json()).toEqual({ ok: true, kaydedilen: 0, durum: 1 });
      expect(islenen).toHaveLength(0);
      expect(durumlar.yazilan.at(-1)).toEqual({ disMesajId: "wamid.X", durum: "okundu", zaman: expect.any(String) });
    });

    it("teslim durumu yazılamazsa 500 döner (Meta tekrar gönderir)", async () => {
      durumlar.hata = new Error("bağlantı koptu");
      const e = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const govde = JSON.stringify(whatsappGovdesi({ durumlar: [{ id: "wamid.Y", status: "delivered", recipient_id: "905321112233" }] }));
        expect((await gonder(govde, imzala(govde))).status).toBe(500);
        expect(e.mock.calls.flat().join(" ")).not.toContain("wamid.Y");
      } finally {
        durumlar.hata = null;
        e.mockRestore();
      }
    });

    it("WhatsApp Business uygulamasından yazılan mesaj (smb_message_echoes) echo olarak kuyruğa yazılır", async () => {
      const govde = JSON.stringify(whatsappEchoGovdesi({ id: "wamid.ECHO-A", metin: "Merhaba, teklifiniz hazır" }));
      expect(await (await gonder(govde, imzala(govde))).json()).toEqual({ ok: true, kaydedilen: 1, durum: 0 });
      expect(islenen).toEqual([expect.objectContaining({ echo: true, disKullaniciId: "+905321112233", metin: "Merhaba, teklifiniz hazır" })]);
    });

    it("aynı bildirim tekrar gelirse 200 döner, hiçbir şey kaydedilmez", async () => {
      const govde = metaGovdesi("wamid.TEKRAR");
      await gonder(govde, imzala(govde));
      const r = await gonder(govde, imzala(govde));
      expect(await r.json()).toEqual({ ok: true, kaydedilen: 0, durum: 0 });
      expect(islenen).toHaveLength(1);
    });

    it("kayıt hata verirse 500 döner (Meta yeniden gönderir); içerik loglanmaz", async () => {
      kuyruk.hata = new Error("Gelen mesaj kaydedilirken başarısız: bağlantı koptu");
      const l = vi.spyOn(console, "error").mockImplementation(() => {});
      const govde = metaGovdesi();
      const r = await gonder(govde, imzala(govde));
      expect(r.status).toBe(500);
      const yazilan = l.mock.calls.flat().join("\n");
      expect(yazilan).toContain("bağlantı koptu");
      expect(yazilan).not.toContain("Fiyat alabilir");
    });

    it("işleyiciyi istek içinde çalıştırmaz (ağır iş kuyrukta; after() istek bağlamı dışında sessizce geçer)", async () => {
      const once = kuyruk.isleyici;
      const govde = metaGovdesi();
      expect((await gonder(govde, imzala(govde))).status).toBe(200);
      expect(kuyruk.isleyici).toBe(once);
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
