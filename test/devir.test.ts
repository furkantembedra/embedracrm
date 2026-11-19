// P1.3 devral / bota geri ver / bot devretti: çekirdek (components/konusma/devir.ts), temsilci yazınca botun susması
// (gonder.ts CRM'den, isle.ts echo ile), bildirim alıcıları, rozet / filtre ve sistem satırı metinleri.
// Durum geçişlerinin SQL kuralları PGlite'ta test/devir-sema.test.ts'te.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { depo, depoyuSifirla } from "./sahte/depo";
import { sahteMetaBaslat, VARSAYILAN_TOKENLAR, type SahteMeta } from "./sahte/meta";
import type { Hatirlatma } from "@/components/hatirlatmalar/queries";
import type { Kullanici } from "@/components/operasyon/queries";

const yan = vi.hoisted(() => ({
  devretti: true,
  bilgi: { satisHattiId: 17 as number | null, firma: "Usta Oto" as string | null, sorumluId: 2 as number | null },
  ekip: [] as Pick<Kullanici, "id" | "rol" | "aktif" | "ad">[],
  cagrilar: [] as unknown[][],
  notlar: [] as unknown[][],
  hatirlatmalar: [] as Hatirlatma[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/db", async () => (await import("./sahte/depo")).dbModulu);
vi.mock("@/components/konusma/queries", async () => ({
  ...(await import("./sahte/depo")).konusmaModulu,
  konusmaDevral: async (...a: unknown[]) => (yan.cagrilar.push(["devral", ...a]), true),
  konusmaBotaVer: async (...a: unknown[]) => (yan.cagrilar.push(["botaVer", ...a]), true),
  konusmaBotDevretti: async (...a: unknown[]) => (yan.cagrilar.push(["devretti", ...a]), yan.devretti),
  devirBilgisi: async () => yan.bilgi,
}));
vi.mock("@/components/satis-hatti/queries", async () => ({
  ...(await import("./sahte/depo")).satisHattiModulu,
  firsatNotuEkle: async (...a: unknown[]) => void yan.notlar.push(a),
}));
vi.mock("@/components/musteriler/queries", async () => (await import("./sahte/depo")).musteriModulu);
vi.mock("@/components/hatirlatmalar/queries", () => ({ hatirlatmaEkleDepo: async (h: Hatirlatma) => void yan.hatirlatmalar.push(h) }));
vi.mock("@/components/operasyon/queries", () => ({ getEkip: async () => yan.ekip }));

const { botDevretti, botaGeriVer, devral, devirAlicilari } = await import("@/components/konusma/devir");
const { mesajGonder, sablonGonder } = await import("@/components/konusma/gonder");
const { kuyrugaYaz, kuyruguIsle } = await import("@/components/konusma/kuyruk");
const { botDurumu, cevapBekliyor } = await import("@/components/bot/kanal-gorunumu");
const { listeyiSuz } = await import("@/components/bot/cevap-modu");
const { devirDugmeleri, sistemSatiriMetni } = await import("@/components/bot/devir-gorunumu");
const { botDevrettiBekliyor } = await import("@/components/satis-hatti/ortak");
const { DEVIR_SEBEPLERI } = await import("@/components/konusma/devir-sebepleri");

const EKIP = [
  { id: "u1", ad: "Deniz", rol: "Yönetici" as const, aktif: true },
  { id: "u2", ad: "Ayşe", rol: "Satış" as const, aktif: true },
  { id: "u3", ad: "Can", rol: "Satış" as const, aktif: true },
  { id: "u4", ad: "Ece", rol: "Satış" as const, aktif: false },
  { id: "u5", ad: "Mert", rol: "Destek" as const, aktif: true },
];

beforeEach(() => {
  yan.devretti = true;
  yan.bilgi = { satisHattiId: 17, firma: "Usta Oto", sorumluId: 2 };
  yan.ekip = EKIP;
  yan.cagrilar.length = 0;
  yan.notlar.length = 0;
  yan.hatirlatmalar.length = 0;
});

describe("botDevretti", () => {
  it("fırsata not yazar, sorumluya hemen zamanı gelen yüksek önemli hatırlatma (zil bildirimi) açar", async () => {
    const r = await botDevretti(5, "fiyat_pazarligi", "  5 cihaz için\n iskonto istiyor ");
    expect(r).toEqual({ devredildi: true, firsatId: 17, alicilar: ["u2"] });
    expect(yan.cagrilar).toEqual([["devretti", 5, "fiyat_pazarligi", "5 cihaz için iskonto istiyor"]]);
    expect(yan.notlar).toEqual([[17, "Bot devretti: Fiyat pazarlığı · 5 cihaz için iskonto istiyor", "bot_devretti"]]);
    expect(yan.hatirlatmalar).toHaveLength(1);
    const h = yan.hatirlatmalar[0];
    expect(h).toMatchObject({
      baslik: "Bot devretti: Usta Oto · Fiyat pazarlığı", sorumluId: "u2", onem: "yuksek", durum: "bekliyor", otomatik: false,
      kayit: { tur: "firsat", id: "17", ad: "Usta Oto", href: "/bot?k=5" },
    });
    // Zil "zamanı gelmiş" hatırlatmaları gösterir: zaman şimdi (yerel, dakika hassasiyetinde)
    expect(h.zaman).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
    expect(Math.abs(Date.parse(h.zaman) - Date.now())).toBeLessThan(120_000);
  });

  it("sorumlu yoksa (ya da pasifse) aktif Satış rolündekilere gider; Satış da yoksa Yönetici'ye", async () => {
    yan.bilgi.sorumluId = null;
    expect(await botDevretti(5, "musteri_istedi")).toMatchObject({ alicilar: ["u2", "u3"] });
    expect(yan.hatirlatmalar.map((h) => h.sorumluId)).toEqual(["u2", "u3"]);
    expect(devirAlicilari("u4", EKIP)).toEqual(["u2", "u3"]); // pasif sorumlu
    expect(devirAlicilari(null, EKIP.filter((k) => k.rol !== "Satış"))).toEqual(["u1"]);
  });

  it("bot zaten konuşmuyorsa (tekrar / yarış) not ve bildirim yazılmaz", async () => {
    yan.devretti = false;
    expect(await botDevretti(5, "sikayet")).toEqual({ devredildi: false });
    expect(yan.notlar).toEqual([]);
    expect(yan.hatirlatmalar).toEqual([]);
  });

  it("fırsatı olmayan konuşmada not yazılmaz, bildirim yine gider; bilinmeyen sebep 'diger' olur", async () => {
    yan.bilgi = { satisHattiId: null, firma: null, sorumluId: null };
    await botDevretti(5, "uydurma" as never);
    expect(yan.cagrilar[0]).toEqual(["devretti", 5, "diger", null]);
    expect(yan.notlar).toEqual([]);
    expect(yan.hatirlatmalar.map((h) => h.baslik)).toEqual(["Bot devretti: Konuşma · Diğer", "Bot devretti: Konuşma · Diğer"]);
  });

  it("açıklama 300 karakterle sınırlanır (müşteri mesajı kopyalanmaz, kısa gerekçe)", async () => {
    await botDevretti(5, "diger", "x".repeat(1000));
    expect((yan.cagrilar[0][3] as string).length).toBe(300);
  });
});

describe("devral ve bota geri ver", () => {
  it("Devral düğmesi kaynak 'dugme' ve kullanıcıyla SQL'e gider", async () => {
    expect(await devral(5, 6)).toBe(true);
    expect(yan.cagrilar).toEqual([["devral", 5, "dugme", 6]]);
  });

  it("bota not kırpılır, boş not null olur, 1000 karakterle sınırlanır", async () => {
    await botaGeriVer(5, "  Demo gününü sor  ", 6);
    await botaGeriVer(5, "   ", 6);
    await botaGeriVer(5, "y".repeat(1500), 6);
    expect(yan.cagrilar[0]).toEqual(["botaVer", 5, "Demo gününü sor", 6]);
    expect(yan.cagrilar[1]).toEqual(["botaVer", 5, null, 6]);
    expect((yan.cagrilar[2][2] as string).length).toBe(1000);
  });
});

describe("temsilci yazınca bot susar (değişmez kural 4)", () => {
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
  afterEach(() => vi.unstubAllEnvs());

  async function konusma(echo = false) {
    const [k] = await kuyrugaYaz([{
      kanal: "whatsapp", kanalHesapId: "PNID-1", disKullaniciId: "+905321112233", disMesajId: `wamid.D${Math.random()}`, tur: "metin",
      metin: echo ? "Ben Ayşe, yardımcı olayım" : "Merhaba", ek: {}, zaman: new Date(Date.now() - 60_000).toISOString(), echo,
    }]);
    return k.konusmaId;
  }

  it("Gelen kutusu'ndan yazan devralır, bot susar, bekleyen devir kapanır; sistem satırı 'cevap'", async () => {
    const id = await konusma();
    await kuyruguIsle();
    const k = depo.konusmalar.find((x) => x.id === id)!;
    k.botAktif = false;
    k.devirSebebi = "musteri_istedi";
    expect((await mesajGonder(id, "Merhaba, ben Ayşe", "temsilci", 2)).ok).toBe(true);
    expect(k).toMatchObject({ botAktif: false, devirSebebi: null, devralanId: 2 });
    expect(k.olaylar).toEqual([{ tur: "devralindi", kaynak: "cevap", kullaniciId: 2 }]);
  });

  it("şablonla yazınca da devralır; bot mesajı devir yazmaz", async () => {
    const id = await konusma();
    await kuyruguIsle();
    const k = depo.konusmalar.find((x) => x.id === id)!;
    expect((await mesajGonder(id, "Bot cevabı", "bot")).ok).toBe(true);
    expect(k.botAktif).toBe(true);
    expect(k.olaylar ?? []).toEqual([]);
    expect((await sablonGonder(id, { ad: "takip", dil: "tr", parametreler: [] }, 3)).ok).toBe(true);
    expect(k).toMatchObject({ botAktif: false, devralanId: 3 });
  });

  it("CRM dışından yazılan mesaj (echo) botu susturur, kim yazdığı bilinmez", async () => {
    const id = await konusma();
    await kuyruguIsle();
    await konusma(true);
    await kuyruguIsle();
    const k = depo.konusmalar.find((x) => x.id === id)!;
    expect(k).toMatchObject({ botAktif: false, devralanId: null });
    expect(k.olaylar).toEqual([{ tur: "devralindi", kaynak: "kanal_disi", kullaniciId: null }]);
  });
});

describe("rozet, filtreler ve sistem satırları", () => {
  it("bot durumu: bot / devretti / bekliyor / temsilci; 'Cevap bekliyor' devredilenleri de kapsar", () => {
    expect(botDurumu(true, "gelen", null)).toBe("bot");
    expect(botDurumu(false, "giden", "sikayet")).toBe("devretti");
    expect(botDurumu(false, "gelen", null)).toBe("bekliyor");
    expect(botDurumu(false, "giden", null)).toBe("temsilci");
    expect(["bot", "devretti", "bekliyor", "temsilci"].map((d) => cevapBekliyor(d as never))).toEqual([false, true, true, false]);
  });

  it("Gelen kutusu 'Cevap bekliyor' filtresi: bot devretti (son mesaj bottan olsa da) + bot kapalıyken müşteri yazdı", () => {
    const acik = { durum: "acik" as const, bitis: null };
    const satir = (o: { id: number; botAktif?: boolean; devirSebebi?: string; son?: { yon: "gelen" | "giden" } }) => ({ kanal: "whatsapp", ad: "A", kimlik: "+90", disKullaniciId: "+90", firma: null, botAktif: false,
      devirSebebi: null as string | null, sorumluId: null, son: { yon: "gelen" as "gelen" | "giden" }, pencere: acik, ...o });
    const l = [
      satir({ id: 1, botAktif: true }),
      satir({ id: 2, devirSebebi: "sikayet", son: { yon: "giden" } }),
      satir({ id: 3 }),
      satir({ id: 4, son: { yon: "giden" } }),
    ];
    expect(listeyiSuz(l, { kanal: null, filtre: "bekliyor", arama: "", ben: null }).map((x) => x.id)).toEqual([2, 3]);
  });

  it("satış hattı 'Bot devretti, cevap bekliyor' filtresi", () => {
    const k = (o: object) => ({ konusma: { id: 1, kanal: "whatsapp", botAktif: false, devirSebebi: null, sonMesaj: null, ...o } });
    expect(botDevrettiBekliyor(k({ devirSebebi: "ozel_fiyat" }))).toBe(true);
    expect(botDevrettiBekliyor(k({}))).toBe(false);
    expect(botDevrettiBekliyor({ konusma: null })).toBe(false);
  });

  it("düğmeler: bot konuşurken Devral; kapalıyken Bota geri ver; başkasındaysa ikisi de", () => {
    expect(devirDugmeleri({ botAktif: true, devirSebebi: null, devralanId: null }, "u2")).toEqual({ devral: true, botaVer: false });
    expect(devirDugmeleri({ botAktif: false, devirSebebi: null, devralanId: "u2" }, "u2")).toEqual({ devral: false, botaVer: true });
    expect(devirDugmeleri({ botAktif: false, devirSebebi: null, devralanId: "u3" }, "u2")).toEqual({ devral: true, botaVer: true });
    expect(devirDugmeleri({ botAktif: false, devirSebebi: "sikayet", devralanId: null }, "u2")).toEqual({ devral: true, botaVer: true });
  });

  it("sistem satırları kimin ne yaptığını söyler", () => {
    const o = { kaynak: null, kullaniciAd: "Ayşe", sebep: null, aciklama: null };
    expect(sistemSatiriMetni({ ...o, tur: "devralindi", kaynak: "dugme" }).metin).toBe("Ayşe konuşmayı devraldı; bot sustu");
    expect(sistemSatiriMetni({ ...o, tur: "devralindi", kaynak: "cevap" }).metin).toBe("Ayşe yazdı ve konuşmayı devraldı; bot sustu");
    expect(sistemSatiriMetni({ ...o, tur: "devralindi", kaynak: "kanal_disi", kullaniciAd: null }).metin).toMatch(/^CRM dışından/);
    expect(sistemSatiriMetni({ ...o, tur: "bota_verildi", aciklama: "Demo gününü sor" })).toEqual({ metin: "Ayşe konuşmayı bota geri verdi", ek: "Bota not: Demo gününü sor" });
    expect(sistemSatiriMetni({ ...o, tur: "bot_devretti", kullaniciAd: null, sebep: "veri_silme", aciklama: "KVKK" })).toEqual({ metin: "Bot devretti: Veri silme talebi", ek: "KVKK" });
  });

  it("sebep listesi SQL kısıtıyla aynı", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261119160000_devral_devret.sql", "utf8");
    const liste = sql.match(/konusmalar_devir_sebebi_check check \(devir_sebebi in \(([^)]*)\)/)![1].match(/'([a-z_]+)'/g)!.map((x) => x.slice(1, -1));
    expect(liste).toEqual(Object.keys(DEVIR_SEBEPLERI));
  });
});
