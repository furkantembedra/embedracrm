// components/konusma/gonder.ts: pencere kontrolü adaptörden, uzun metin adaptörde bölünür, her parça kanalın verdiği
// kimlikle kaydedilir (echo'su ikinci kez yazılmaz), temsilci yazınca bot susar, demo modu ve gönderim hatası.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { depo, depoyuSifirla } from "./sahte/depo";
import { sahteMetaBaslat, VARSAYILAN_TOKENLAR, whatsappEchoGovdesi, type SahteMeta } from "./sahte/meta";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/db", async () => (await import("./sahte/depo")).dbModulu);
vi.mock("@/components/konusma/queries", async () => (await import("./sahte/depo")).konusmaModulu);
vi.mock("@/components/satis-hatti/queries", async () => (await import("./sahte/depo")).satisHattiModulu);
vi.mock("@/components/musteriler/queries", async () => (await import("./sahte/depo")).musteriModulu);

const { mesajGonder, sablonGonder } = await import("@/components/konusma/gonder");
const { kuyrugaYaz, kuyruguIsle } = await import("@/components/konusma/kuyruk");
const { whatsappAdaptoru } = await import("@/components/konusma/kanallar/whatsapp");

let meta: SahteMeta;
beforeAll(async () => {
  meta = await sahteMetaBaslat();
});
afterAll(() => meta?.kapat());
beforeEach(() => {
  depoyuSifirla();
  vi.stubEnv("META_GRAPH_URL", meta.adres);
  vi.stubEnv("WHATSAPP_TOKEN", VARSAYILAN_TOKENLAR.whatsapp);
  vi.stubEnv("WHATSAPP_PHONE_ID", "PNID-1");
});
afterEach(() => {
  vi.unstubAllEnvs();
  meta.istekler.length = 0;
});

/** Müşteri yazmış (pencere açık) bir konuşma; dakika: son müşteri mesajı kaç dakika önce */
async function konusma(dakika = 1) {
  const [k] = await kuyrugaYaz([{
    kanal: "whatsapp", kanalHesapId: "PNID-1", disKullaniciId: "+905321112233", disMesajId: `wamid.M${Math.random()}`, tur: "metin",
    metin: "Merhaba", ek: {}, zaman: new Date(Date.now() - dakika * 60_000).toISOString(), echo: false,
  }]);
  await kuyruguIsle();
  return k.konusmaId;
}

describe("mesajGonder", () => {
  it("pencere açıkken gönderir, kanalın kimliğiyle kaydeder; temsilci yazınca bot susar", async () => {
    const id = await konusma();
    const r = await mesajGonder(id, "Merhaba, fiyat listemizi iletiyorum.", "temsilci");
    expect(r).toMatchObject({ ok: true, demo: false, mesajIdleri: [expect.any(Number)] });
    const m = depo.mesajlar.at(-1)!;
    expect(m).toMatchObject({ yon: "giden", gonderen: "temsilci", disMesajId: expect.stringMatching(/^wamid\.SAHTE/), satisHattiId: depo.konusmalar[0].satisHattiId });
    expect(depo.konusmalar[0].botAktif).toBe(false);
  });

  it("bot gönderince bot açık kalır; gönderdiğinin echo'su gelirse ikinci kez yazılmaz", async () => {
    const id = await konusma();
    await mesajGonder(id, "Merhaba, ben Embedra'nın asistanıyım.", "bot");
    const gonderilen = depo.mesajlar.at(-1)!;
    const echo = whatsappAdaptoru.webhookCevir(whatsappEchoGovdesi({ id: gonderilen.disMesajId!, metin: gonderilen.metin })).mesajlar;
    expect(await kuyrugaYaz(echo)).toEqual([]);
    expect(depo.mesajlar.filter((x) => x.disMesajId === gonderilen.disMesajId)).toHaveLength(1);
    expect(depo.konusmalar[0].botAktif).toBe(true);
  });

  it("24 saat geçtiyse serbest metin göndermez (WhatsApp'ta yalnızca şablon); Meta'ya istek atılmaz", async () => {
    const id = await konusma(24 * 60 + 5);
    for (const g of ["bot", "temsilci"] as const) {
      const r = await mesajGonder(id, "Merhaba", g);
      expect(r).toEqual({ ok: false, hata: expect.stringContaining("penceresi kapalı"), gonderilen: 0 });
    }
    expect(meta.istekler).toHaveLength(0);
  });

  it("uzun metin kanal sınırına göre bölünüp sırayla gönderilir", async () => {
    const id = await konusma();
    const paragraf = "Bu uzun bir açıklama cümlesidir. ".repeat(80);
    const r = await mesajGonder(id, `${paragraf}\n\n${paragraf}\n\n${paragraf}\n\n${paragraf}`, "bot");
    expect(r.ok).toBe(true);
    const govdeler = meta.gonderilenler() as { text: { body: string } }[];
    expect(govdeler.length).toBeGreaterThanOrEqual(2);
    for (const g of govdeler) expect([...g.text.body].length).toBeLessThanOrEqual(4096);
    expect(depo.mesajlar.filter((m) => m.gonderen === "bot")).toHaveLength(govdeler.length);
  });

  it("anahtar yoksa demo: göndermez, CRM kimliğiyle kaydeder", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    const id = await konusma();
    const r = await mesajGonder(id, "Merhaba", "temsilci");
    expect(r).toMatchObject({ ok: true, demo: true });
    expect(meta.istekler).toHaveLength(0);
    expect(depo.mesajlar.at(-1)!.disMesajId).toMatch(/^crm-/);
  });

  it("Meta hata dönerse kaydetmez, hatayı döner", async () => {
    const id = await konusma();
    const once = depo.mesajlar.length;
    meta.hata(400, "(#131026) Message undeliverable", 131026);
    const r = await mesajGonder(id, "Merhaba", "temsilci");
    expect(r).toEqual({ ok: false, hata: expect.stringContaining("teslim edilemedi"), kod: "131026", gonderilen: 0 });
    expect(depo.mesajlar).toHaveLength(once);
    expect(depo.konusmalar[0].botAktif).toBe(true);
  });

  it("boş metin ve bilinmeyen konuşma", async () => {
    const id = await konusma();
    expect(await mesajGonder(id, "   ", "bot")).toMatchObject({ ok: false, hata: "Boş mesaj gönderilemez." });
    expect(await mesajGonder(99999, "Merhaba", "bot")).toMatchObject({ ok: false, hata: "Konuşma bulunamadı." });
  });

  it("temsilci mesajı gönderen kullanıcıyla yazılır; bot mesajında kullanıcı yok", async () => {
    const id = await konusma();
    await mesajGonder(id, "Merhaba", "temsilci", 2);
    expect(depo.mesajlar.at(-1)).toMatchObject({ gonderen: "temsilci", gonderenKullaniciId: 2, ek: {} });
  });

  it("anahtar yoksa demo: kaydeder, göndermez, ek.demo işaretli", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    const id = await konusma();
    const r = await mesajGonder(id, "Merhaba", "temsilci", 2);
    expect(r).toMatchObject({ ok: true, demo: true });
    expect(meta.istekler).toHaveLength(0);
    expect(depo.mesajlar.at(-1)).toMatchObject({ ek: { demo: true }, disMesajId: expect.stringMatching(/^crm-/) });
  });

  it("pencere kapalıyken temsilciye şablon yolunu söyler", async () => {
    const id = await konusma(24 * 60 + 5);
    const r = await mesajGonder(id, "Merhaba", "temsilci", 2);
    expect(r).toMatchObject({ ok: false, hata: expect.stringContaining("onaylı şablon") });
  });
});

describe("sablonGonder", () => {
  it("pencere kapalıyken onaylı şablon gönderir (Cloud API template gövdesi), temsilci olarak kaydeder, bot susar", async () => {
    const id = await konusma(3 * 24 * 60);
    const r = await sablonGonder(id, { ad: "takip_mesaji", dil: "tr", parametreler: ["Ahmet", "ONE"] }, 2);
    expect(r).toMatchObject({ ok: true, demo: false });
    expect(meta.gonderilenler().at(-1)).toMatchObject({
      messaging_product: "whatsapp", to: "905321112233", type: "template",
      template: { name: "takip_mesaji", language: { code: "tr" }, components: [{ type: "body", parameters: [{ type: "text", text: "Ahmet" }, { type: "text", text: "ONE" }] }] },
    });
    expect(depo.mesajlar.at(-1)).toMatchObject({ gonderen: "temsilci", gonderenKullaniciId: 2, metin: "Şablon: takip_mesaji · Ahmet · ONE", ek: { sablon: { ad: "takip_mesaji", dil: "tr" } } });
    expect(depo.konusmalar[0].botAktif).toBe(false);
  });

  it("geçersiz şablon adı ya da dil Meta'ya gitmez; Meta hatası Türkçe açıklamayla döner", async () => {
    const id = await konusma(3 * 24 * 60);
    expect(await sablonGonder(id, { ad: "Takip Mesajı", dil: "tr", parametreler: [] }, 2)).toMatchObject({ ok: false });
    expect(await sablonGonder(id, { ad: "takip", dil: "türkçe", parametreler: [] }, 2)).toMatchObject({ ok: false });
    expect(meta.istekler).toHaveLength(0);
    meta.hata(404, "(#132001) Template name does not exist in the translation", 132001);
    expect(await sablonGonder(id, { ad: "yok", dil: "tr", parametreler: [] }, 2)).toMatchObject({ ok: false, kod: "132001", hata: expect.stringContaining("onaylı şablon yok") });
  });
});

