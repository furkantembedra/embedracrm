// Konuşma kuyruğu ve konuşma kilidi (components/konusma/kuyruk.ts): aynı konuşmanın işleri asla paralel işlenmez,
// aynı anda gelen iki webhook tek tur (P2.1'de tek bot cevabı) üretir, çöken işleyicinin kilidi süre dolunca devralınır.
// Bellek içi depo SQL fonksiyonlarının kurallarını taşır; SQL'in kendisi PGlite'ta test/kuyruk-sema.test.ts'te.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { depo, depoyuSifirla } from "./sahte/depo";
import type { GelenMesaj } from "@/components/konusma/kanallar/tur";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/db", async () => (await import("./sahte/depo")).dbModulu);
vi.mock("@/components/konusma/queries", async () => (await import("./sahte/depo")).konusmaModulu);
vi.mock("@/components/satis-hatti/queries", async () => (await import("./sahte/depo")).satisHattiModulu);
vi.mock("@/components/musteriler/queries", async () => (await import("./sahte/depo")).musteriModulu);

const { kuyrugaYaz, kuyruguIsle } = await import("@/components/konusma/kuyruk");
const { whatsappWebhookCevir } = await import("@/components/konusma/kanallar/whatsapp");
const { whatsappGovdesi, waMesaj } = await import("./sahte/meta");

let sira = 0;
const mesaj = (disKullaniciId: string, metin: string): GelenMesaj => ({
  kanal: "whatsapp", kanalHesapId: "PNID-1", disKullaniciId, disMesajId: `wamid.K${++sira}`, tur: "metin", metin, ek: {},
  zaman: new Date().toISOString(), echo: false, profilAdi: "Ahmet",
});

/** Webhook'un yaptığı: gövdeyi adaptörle çevir, kuyruğa yaz (işleyici ayrı) */
const webhook = (telefon: string, metin: string) =>
  kuyrugaYaz(whatsappWebhookCevir(whatsappGovdesi({ mesajlar: [waMesaj({ from: telefon, text: { body: metin } })] })).mesajlar);

beforeEach(() => depoyuSifirla());

describe("aynı anda gelen iki webhook", () => {
  it("yeni numaradan aynı anda gelen iki farklı mesaj tek lead ve tek tur üretir; işleme hiç paralel olmaz", async () => {
    // İki webhook ve her birinin dürttüğü iki işleyici aynı anda
    await Promise.all([webhook("905339998877", "Merhaba"), webhook("905339998877", "Fiyat alabilir miyim?")]);
    const turlar: { konusma: number; mesajlar: number[] }[] = [];
    const turSonrasi = async (konusmaId: number, s: { mesajId: number }[]) => void turlar.push({ konusma: konusmaId, mesajlar: s.map((x) => x.mesajId) });
    const [a, b] = await Promise.all([kuyruguIsle({ turSonrasi }), kuyruguIsle({ turSonrasi })]);

    expect(depo.konusmalar).toHaveLength(1);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.mesajlar.map((m) => m.satisHattiId)).toEqual([Number(depo.firsatlar[0].id), Number(depo.firsatlar[0].id)]);
    expect(a.islenen + b.islenen).toBe(2);
    expect(turlar).toEqual([{ konusma: depo.konusmalar[0].id, mesajlar: depo.mesajlar.map((m) => m.id) }]); // tek tur = tek cevap
    expect(depo.enCokAktifYazma).toBe(1);
    expect(depo.konusmalar[0].kilitSahibi).toBeNull();
  });

  it("kilit olmasaydı aynı iki mesaj iki lead açardı (testin kilidi gerçekten sınadığının kanıtı)", async () => {
    depo.kilitDevreDisi = true;
    await Promise.all([webhook("905339998877", "Merhaba"), webhook("905339998877", "Fiyat alabilir miyim?")]);
    const turSonrasi = vi.fn(async () => {});
    await Promise.all([kuyruguIsle({ turSonrasi }), kuyruguIsle({ turSonrasi })]);
    expect(depo.firsatlar).toHaveLength(2);
    expect(turSonrasi).toHaveBeenCalledTimes(2);
    expect(depo.enCokAktifYazma).toBe(2);
  });

  it("aynı mesaj iki webhook'la gelir ve iki işleyici çalışırsa tek mesaj, tek lead, tek tur", async () => {
    const govde = whatsappGovdesi({ mesajlar: [waMesaj({ id: "wamid.AYNI", from: "905339998877" })] });
    await Promise.all([kuyrugaYaz(whatsappWebhookCevir(govde).mesajlar), kuyrugaYaz(whatsappWebhookCevir(structuredClone(govde)).mesajlar)]);
    const turSonrasi = vi.fn(async () => {});
    await Promise.all([kuyruguIsle({ turSonrasi }), kuyruguIsle({ turSonrasi })]);
    expect(depo.mesajlar).toHaveLength(1);
    expect(depo.isler).toHaveLength(1);
    expect(depo.firsatlar).toHaveLength(1);
    expect(turSonrasi).toHaveBeenCalledTimes(1);
  });
});

describe("konuşma kilidi", () => {
  it("farklı konuşmalar iki işleyiciye paylaştırılır, her iş bir kez işlenir", async () => {
    await kuyrugaYaz([mesaj("+905330000001", "A"), mesaj("+905330000002", "B"), mesaj("+905330000003", "C")]);
    const [a, b] = await Promise.all([kuyruguIsle(), kuyruguIsle()]);
    expect(a.islenen + b.islenen).toBe(3);
    expect(a.konusma).toBeGreaterThan(0);
    expect(b.konusma).toBeGreaterThan(0); // ikisi de iş aldı (paralellik konuşmalar arasında var)
    expect(depo.firsatlar).toHaveLength(3);
    expect(depo.isler.every((i) => i.durum === "tamam")).toBe(true);
  });

  it("başka işleyicinin canlı kilidi varken konuşmaya dokunulmaz", async () => {
    await kuyrugaYaz([mesaj("+905339998877", "Merhaba")]);
    Object.assign(depo.konusmalar[0], { kilitSahibi: "baska-isleyici", kilitBitis: Date.now() + 60_000 });
    expect(await kuyruguIsle()).toMatchObject({ konusma: 0, islenen: 0 });
    expect(depo.firsatlar).toHaveLength(0);
  });

  it("çöken işleyicinin kilidi süresi dolunca başka işleyici devralır", async () => {
    await kuyrugaYaz([mesaj("+905339998877", "Merhaba")]);
    Object.assign(depo.konusmalar[0], { kilitSahibi: "coken-isleyici", kilitBitis: Date.now() - 1 });
    expect((await kuyruguIsle()).islenen).toBe(1);
    expect(depo.konusmalar[0].kilitSahibi).toBeNull();
  });

  it("tur sonrası sırasında gelen mesajı aynı işleyici kilidi bırakmadan işler (ikinci tur)", async () => {
    await kuyrugaYaz([mesaj("+905339998877", "Bir")]);
    const turlar: number[][] = [];
    let ilk = true;
    const r = await kuyruguIsle({
      turSonrasi: async (_k, s) => {
        turlar.push(s.map((x) => x.mesajId));
        if (ilk) {
          ilk = false;
          await kuyrugaYaz([mesaj("+905339998877", "İki")]); // bot cevap yazarken müşteri yeni mesaj attı
        }
      },
    });
    expect(r.islenen).toBe(2);
    expect(turlar).toHaveLength(2);
    expect(depo.firsatlar).toHaveLength(1);
  });

  it("konusmaId verilirse yalnızca o konuşma işlenir (simülasyon)", async () => {
    const [a] = await kuyrugaYaz([mesaj("+905330000001", "A")]);
    await kuyrugaYaz([mesaj("+905330000002", "B")]);
    const r = await kuyruguIsle({ konusmaId: a.konusmaId });
    expect(r.sonuclar.map((s) => s.mesajId)).toEqual([a.mesajId]);
    expect(depo.isler.map((i) => i.durum)).toEqual(["tamam", "bekliyor"]);
  });

  it("zaman bütçesi bitince yeni konuşma alınmaz", async () => {
    await kuyrugaYaz([mesaj("+905330000001", "A"), mesaj("+905330000002", "B")]);
    expect((await kuyruguIsle({ sureMs: 0 })).islenen).toBe(0);
  });
});
