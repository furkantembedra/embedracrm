// enUygunPlan: istenen özellikleri kapsayan en ucuz plan, lisans adedi, üst planın farkı.
// Kurallar aşağıdaki SAHTE katalogla denenir (sahte özellikler gerçek ürünü anlatmaz).
// En altta gerçek katalog (docs/bot/ozellikler.md) hem belgeyle karşılaştırılır hem de birkaç gerçek senaryoyla denenir.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OZELLIK_KATALOGU, enUygunPlan, katalogHatalari, type Ozellik } from "@/lib/urun-bilgisi";
import { lisansYillikFiyat, type FiyatListesi } from "@/lib/urunler";

const oz = (id: string, enDusukPlan: Ozellik["enDusukPlan"], cihazlar?: Ozellik["cihazlar"]): Ozellik => ({
  id, ad: id, aciklama: "sahte", ifadeler: [], enDusukPlan, cihazlar, kaynak: "test",
});

const KATALOG: Ozellik[] = [
  oz("temel-a", "Basic"),
  oz("temel-b", "Basic"),
  oz("orta-a", "Pro"),
  oz("orta-b", "Pro"),
  oz("ust-a", "Pro+"),
  oz("premium-a", "Premium"),
  oz("yalniz-one", "Basic", ["ONE"]),
  oz("yalniz-lite", "Basic", ["ONE Lite"]),
  oz("ikisi-de", "Basic", ["ONE", "ONE Lite"]),
];

// Ayarlar'daki fiyat listesinin biçimi; tutarlar bilerek lib/urunler.ts'teki başlangıç değerlerinden farklı
const FIYAT: Pick<FiyatListesi, "lisans" | "eurKur"> = {
  eurKur: 50,
  lisans: {
    Basic: { fiyat: 40_000, cihaz: 1 },
    Pro: { fiyat: 70_000, cihaz: 1 },
    "Pro+": { fiyat: 100_000, cihaz: 3 },
    Premium: { fiyat: null, cihaz: 5 },
    Enterprise: { fiyat: null, cihaz: null },
  },
};
const k = { fiyat: FIYAT, katalog: KATALOG };

describe("enUygunPlan", () => {
  it("tek özellik: en düşük planı ve bir üst planın farkını verir", () => {
    const s = enUygunPlan(["temel-a"], 1, k);
    expect(s.oneri).toEqual({ plan: "Basic", lisansAdedi: 1, paraBirimi: "TRY", birimFiyat: 40_000, yillikTutar: 40_000 });
    expect(s.bilinmeyen).toEqual([]);
    expect(s.ustPlan?.plan).toBe("Pro");
    expect(s.ustPlan?.ekOzellikler.map((o) => o.id)).toEqual(["orta-a", "orta-b"]);
    expect(s.ustPlan?.ekTutar).toBe(30_000);
  });

  it("karışık özellikler: en yüksek gereksinimi karşılayan planı seçer", () => {
    expect(enUygunPlan(["temel-a", "orta-b"], 1, k).oneri?.plan).toBe("Pro");
    const s = enUygunPlan(["orta-a", "ust-a", "temel-b"], 1, k);
    expect(s.oneri).toMatchObject({ plan: "Pro+", lisansAdedi: 1, yillikTutar: 100_000 });
    expect(s.ustPlan).toMatchObject({ plan: "Premium", yillikTutar: null, ekTutar: null });
    expect(s.ustPlan?.ekOzellikler.map((o) => o.id)).toEqual(["premium-a"]);
  });

  it("özellik listesi boşsa en küçük planı önerir", () => {
    expect(enUygunPlan([], 1, k).oneri?.plan).toBe("Basic");
  });

  it("çok cihaz: lisans adedini hesaplar, daha ucuzsa çok cihazlı plana geçer", () => {
    // 1 cihaz: Pro 70.000 < Pro+ 100.000
    expect(enUygunPlan(["orta-a"], 1, k).oneri).toMatchObject({ plan: "Pro", lisansAdedi: 1, yillikTutar: 70_000 });
    // 2 cihaz: Pro 2 × 70.000 = 140.000 > Pro+ 1 × 100.000
    expect(enUygunPlan(["orta-a"], 2, k).oneri).toMatchObject({ plan: "Pro+", lisansAdedi: 1, yillikTutar: 100_000 });
    // 7 cihaz: Pro+ 3 lisans (3+3+1)
    expect(enUygunPlan(["orta-a"], 7, k).oneri).toMatchObject({ plan: "Pro+", lisansAdedi: 3, yillikTutar: 300_000 });
    // 4 cihaz Basic: Basic 160.000 < Pro+ 2 × 100.000 → Basic kalır
    const b = enUygunPlan(["temel-a"], 4, k);
    expect(b.oneri).toMatchObject({ plan: "Basic", lisansAdedi: 4, yillikTutar: 160_000 });
    // En ucuz yükseltme Pro × 4 (280.000) değil Pro+ × 2 (200.000): aynı Pro özellikleri + ust-a
    expect(b.ustPlan).toMatchObject({ plan: "Pro+", lisansAdedi: 2, yillikTutar: 200_000, ekTutar: 40_000 });
    expect(b.ustPlan?.ekOzellikler.map((o) => o.id)).toEqual(["orta-a", "orta-b", "ust-a"]);
  });

  it("geçersiz cihaz adedini 1'e yuvarlar", () => {
    expect(enUygunPlan(["temel-a"], 0, k).oneri?.lisansAdedi).toBe(1);
    expect(enUygunPlan(["temel-a"], Number.NaN, k).oneri?.lisansAdedi).toBe(1);
  });

  it("yalnızca özel fiyatlı plan kapsıyorsa onu fiyatsız önerir", () => {
    const s = enUygunPlan(["premium-a"], 12, k);
    expect(s.oneri).toEqual({ plan: "Premium", lisansAdedi: 3, paraBirimi: "TRY", birimFiyat: null, yillikTutar: null });
    // Enterprise sahte katalogda özellik eklemiyor: yükseltme önerilmez
    expect(s.ustPlan).toBeNull();
    const ent = enUygunPlan(["premium-a"], 12, { ...k, katalog: [...KATALOG, oz("ent-a", "Enterprise")] });
    expect(ent.ustPlan).toMatchObject({ plan: "Enterprise", lisansAdedi: 1, yillikTutar: null, ekTutar: null });
  });

  it("en üst plan önerildiğinde üst plan yoktur", () => {
    const s = enUygunPlan(["temel-a"], 1, { ...k, katalog: [oz("temel-a", "Enterprise")] });
    expect(s.oneri?.plan).toBe("Enterprise");
    expect(s.ustPlan).toBeNull();
  });

  it("bilinmeyen özellik: ayrıca bildirir, bilinenlerle hesaplar", () => {
    const s = enUygunPlan(["orta-a", "uydurma-ozellik", "orta-a"], 1, k);
    expect(s.bilinmeyen).toEqual(["uydurma-ozellik"]);
    expect(s.ozellikler.map((o) => o.id)).toEqual(["orta-a"]);
    expect(s.oneri?.plan).toBe("Pro");
  });

  it("cihaz koşulu: yalnızca ONE'da çalışan özelliği ve model uyumsuzluğunu bildirir", () => {
    const s = enUygunPlan(["yalniz-one", "temel-a"], 1, k);
    expect(s.uygunCihazlar).toEqual(["ONE"]);
    expect(s.cihazKosullari.map((c) => [c.ozellik.id, c.cihazlar])).toEqual([["yalniz-one", ["ONE"]]]);
    expect(s.modelUyumsuz).toBe(false);
    expect(enUygunPlan(["yalniz-one"], 1, { ...k, cihazModeli: "ONE Lite" }).modelUyumsuz).toBe(true);
    expect(enUygunPlan(["yalniz-one"], 1, { ...k, cihazModeli: "ONE" }).modelUyumsuz).toBe(false);
  });

  it("cihaz koşulu: iki modeli de kapsayan liste koşul sayılmaz, çelişen koşullar boş küme verir", () => {
    const iki = enUygunPlan(["ikisi-de"], 1, k);
    expect(iki.cihazKosullari).toEqual([]);
    expect(iki.uygunCihazlar).toEqual(["ONE", "ONE Lite"]);
    const celiski = enUygunPlan(["yalniz-one", "yalniz-lite"], 1, { ...k, cihazModeli: "ONE" });
    expect(celiski.uygunCihazlar).toEqual([]);
    expect(celiski.modelUyumsuz).toBe(true);
  });

  it("fiyatı parametredeki listeden okur", () => {
    const zamli = { ...FIYAT, lisans: { ...FIYAT.lisans, Basic: { fiyat: 55_555, cihaz: 1 } } };
    expect(enUygunPlan(["temel-a"], 1, { fiyat: zamli, katalog: KATALOG }).oneri?.yillikTutar).toBe(55_555);
  });
});

describe("EUR fiyatı", () => {
  it("elle girilmiş EUR fiyatı yoksa TL fiyatı kurla çevirir", () => {
    expect(lisansYillikFiyat(FIYAT, "Basic", "EUR")).toBe(800);
    expect(lisansYillikFiyat(FIYAT, "Basic")).toBe(40_000);
    expect(lisansYillikFiyat(FIYAT, "Premium", "EUR")).toBeNull();
  });

  it("elle girilmiş EUR fiyatı kurun önüne geçer", () => {
    const f = { ...FIYAT, lisans: { ...FIYAT.lisans, Basic: { fiyat: 40_000, cihaz: 1, eurFiyat: 750 }, Premium: { fiyat: null, cihaz: 5, eurFiyat: 2_400 } } };
    expect(lisansYillikFiyat(f, "Basic", "EUR")).toBe(750);
    expect(lisansYillikFiyat(f, "Basic", "TRY")).toBe(40_000);
    expect(lisansYillikFiyat(f, "Premium", "EUR")).toBe(2_400);
  });

  it("enUygunPlan EUR'da da hesaplar; karşılaştırma EUR tutarlarıyla yapılır", () => {
    const s = enUygunPlan(["temel-a"], 4, { ...k, paraBirimi: "EUR" });
    expect(s.oneri).toEqual({ plan: "Basic", lisansAdedi: 4, paraBirimi: "EUR", birimFiyat: 800, yillikTutar: 3_200 });
    // Pro × 4 = 5.600 €, Pro+ × 2 = 4.000 € → en ucuz yükseltme Pro+
    expect(s.ustPlan).toMatchObject({ plan: "Pro+", paraBirimi: "EUR", birimFiyat: 2_000, lisansAdedi: 2, ekTutar: 800 });
    // Pro+ EUR fiyatı elle düşürülünce 4 cihazda Pro+ (2 lisans) Basic'ten ucuz olur
    const f = { ...FIYAT, lisans: { ...FIYAT.lisans, "Pro+": { fiyat: 100_000, cihaz: 3, eurFiyat: 1_500 } } };
    expect(enUygunPlan(["temel-a"], 4, { fiyat: f, katalog: KATALOG, paraBirimi: "EUR" }).oneri).toMatchObject({ plan: "Pro+", lisansAdedi: 2, yillikTutar: 3_000 });
  });
});

describe("katalog", () => {
  it("sahte katalog tutarlı, bozuk kayıtlar yakalanır", () => {
    expect(katalogHatalari(KATALOG)).toEqual([]);
    expect(katalogHatalari([oz("Buyuk Harf", "Basic"), oz("a", "Basic"), oz("a", "Gold" as never), { ...oz("b", "Basic"), kaynak: "" }])).toHaveLength(4);
  });
});

/** docs/bot/ozellikler.md'deki "### Başlık" bloklarını okur (Katalog dışı bölümünden önceki kısım). Cihazı "?" olanlar atlanır. */
function belgedekiOzellikler() {
  const md = readFileSync("docs/bot/ozellikler.md", "utf8");
  const bolum = md.slice(0, md.indexOf("## Katalog dışı"));
  return bolum.split("\n### ").slice(1).flatMap((blok) => {
    const alan = (ad: string) => blok.match(new RegExp(`\\*\\*${ad}:\\*\\* (.*)`))?.[1].trim() ?? "";
    const cihaz = alan("Cihaz");
    if (cihaz.startsWith("?")) return [];
    return [{
      id: alan("Kimlik"),
      ad: blok.split("\n")[0].trim(),
      aciklama: alan("Açıklama"),
      ifadeler: [...blok.matchAll(/^ {2}- "(.*?)"/gm)].map((m) => m[1]),
      enDusukPlan: alan("En düşük plan"),
      cihazlar: cihaz.startsWith("Yalnızca ONE Lite") ? ["ONE Lite"] : cihaz.startsWith("Yalnızca ONE") ? ["ONE"] : undefined,
    }];
  });
}

describe("gerçek katalog (docs/bot/ozellikler.md)", () => {
  const gercek = { fiyat: FIYAT };

  it("tutarlı ve belgeyle birebir aynı", () => {
    expect(katalogHatalari(OZELLIK_KATALOGU)).toEqual([]);
    const belge = belgedekiOzellikler();
    expect(belge.length).toBeGreaterThan(10);
    expect(OZELLIK_KATALOGU.map(({ id, ad, aciklama, ifadeler, enDusukPlan, cihazlar }) => ({ id, ad, aciklama, ifadeler, enDusukPlan, cihazlar }))).toEqual(belge);
  });

  it("Basic yalnızca onaylı üç özelliği kapsar (dondurma özellik değil, lisans koşulu)", () => {
    expect(OZELLIK_KATALOGU.filter((o) => o.enDusukPlan === "Basic" && !o.cihazlar).map((o) => o.id)).toEqual(["temel-direksiyon-testi", "can-protokolu", "k-line-protokolu"]);
    const s = enUygunPlan(["temel-direksiyon-testi", "can-protokolu", "k-line-protokolu"], 1, gercek);
    expect(s.oneri?.plan).toBe("Basic");
    expect(s.ustPlan?.ekOzellikler.map((o) => o.id)).toEqual(expect.arrayContaining(["can-fd-protokolu", "ariza-teshisi", "canli-veri", "flash"]));
  });

  it("CAN-FD ya da hata kodu isteyen müşteriye Pro, 3 cihazda Pro+", () => {
    expect(enUygunPlan(["can-fd-protokolu"], 1, gercek).oneri?.plan).toBe("Pro");
    expect(enUygunPlan(["ariza-teshisi", "can-protokolu"], 1, gercek).oneri?.plan).toBe("Pro");
    expect(enUygunPlan(["flash"], 3, gercek).oneri).toMatchObject({ plan: "Pro+", lisansAdedi: 1 });
    // Pro+ Pro'ya yalnızca cihaz ekler, özellik eklemez: 1 cihazda yükseltme önerisi Premium'dur
    expect(enUygunPlan(["flash"], 1, gercek).ustPlan).toMatchObject({ plan: "Premium", yillikTutar: null });
  });

  it("özel fonksiyonlar ve bilgisayarsız kullanım yalnızca ONE'da", () => {
    const s = enUygunPlan(["ozel-fonksiyonlar"], 1, { ...gercek, cihazModeli: "ONE Lite" });
    expect(s.oneri?.plan).toBe("Pro");
    expect(s.modelUyumsuz).toBe(true);
    expect(enUygunPlan(["bilgisayarsiz-kullanim"], 1, gercek)).toMatchObject({ oneri: { plan: "Basic" }, uygunCihazlar: ["ONE"] });
  });

  it("katalogda olmayan ONEAssist bilinmeyen sayılır", () => {
    expect(enUygunPlan(["oneassist"], 1, gercek).bilinmeyen).toEqual(["oneassist"]);
  });
});
