// Bayi portalında lisans EUR fiyatı: Ayarlar'da elle girilen EUR fiyatı, portalın "TL / kur" hesaplarından aynen çıkmalı;
// girilmemişse davranış eskisiyle (TL / kur) birebir aynı kalmalı. Bot (lisansYillikFiyat) ile portal aynı fiyatı söylemeli.
import { describe, expect, it } from "vitest";
import { bayiFiyati, bayiFiyatlari, etkinFiyatListesi, katalogOlustur, paraYaz, sepetToplami } from "@/components/portal/katalog";
import { lisansYillikFiyat, VARSAYILAN_FIYAT, type FiyatListesi } from "@/lib/urunler";

const fiyatListesi = (eur: Partial<Record<"Basic" | "Pro" | "Pro+", number>> = {}): FiyatListesi => {
  const f = structuredClone(VARSAYILAN_FIYAT);
  f.eurKur = 55.54;
  for (const [p, v] of Object.entries(eur)) f.lisans[p as "Basic"].eurFiyat = v;
  return f;
};
const eurTutar = (tl: number, kur: number) => Math.round(tl / kur);

describe("etkinFiyatListesi / bayiFiyatlari", () => {
  it("TRY bayide liste değişmez", () => {
    const f = fiyatListesi({ Basic: 750 });
    const { kosul, fiyat } = bayiFiyatlari("TR", f);
    expect(kosul.paraBirimi).toBe("TRY");
    expect(fiyat).toBe(f);
    expect(etkinFiyatListesi(f, "TRY")).toBe(f);
    expect(fiyat.lisans.Basic.fiyat).toBe(42_000);
  });

  it("EUR bayide EUR fiyatı yoksa eski davranış: TL / kur", () => {
    const f = fiyatListesi();
    const { kosul, fiyat } = bayiFiyatlari("DE", f);
    expect(fiyat.lisans).toEqual(f.lisans);
    expect(eurTutar(fiyat.lisans.Basic.fiyat!, kosul.kur)).toBe(Math.round(42_000 / 55.54));
  });

  it("EUR bayide elle girilen EUR fiyatı portalda aynen çıkar ve botla aynıdır", () => {
    const f = fiyatListesi({ Basic: 750, Pro: 1_200, "Pro+": 1_800 });
    const { kosul, fiyat } = bayiFiyatlari("DE", f);
    for (const [p, eur] of [["Basic", 750], ["Pro", 1_200], ["Pro+", 1_800]] as const) {
      expect(eurTutar(fiyat.lisans[p].fiyat!, kosul.kur)).toBe(eur);
      expect(lisansYillikFiyat(f, p, "EUR")).toBe(eur);
    }
    // Cihaz fiyatları ve cihaz kapsamı etkilenmez; orijinal liste değişmez
    expect(fiyat.cihaz).toEqual(f.cihaz);
    expect(fiyat.lisans["Pro+"].cihaz).toBe(3);
    expect(f.lisans.Basic.fiyat).toBe(42_000);
  });

  it("yalnızca EUR fiyatı girilen paket değişir", () => {
    const { fiyat } = bayiFiyatlari("PL", fiyatListesi({ Pro: 1_200 }));
    expect(fiyat.lisans.Basic.fiyat).toBe(42_000);
    expect(fiyat.lisans.Pro.fiyat).toBe(Math.round(1_200 * 55.54));
  });

  it("paraYaz ve iskontolu sepet EUR fiyatından hesaplanır", () => {
    const { kosul, fiyat } = bayiFiyatlari("DE", fiyatListesi({ Basic: 750, Pro: 1_200 }));
    const katalog = katalogOlustur(fiyat, []);
    const basic = katalog.find((u) => u.anahtar === "lisans:Basic")!;
    expect(paraYaz(basic.liste, kosul.paraBirimi, kosul.kur)).toBe(paraYaz(750 * kosul.kur, "EUR", kosul.kur));
    expect(paraYaz(basic.liste, kosul.paraBirimi, kosul.kur)).toContain("750");
    for (const indirim of [0, 10, 15, 25]) {
      const net = sepetToplami(katalog, { "lisans:Basic": 2, "lisans:Pro": 1 }, indirim, kosul.kdv).net;
      // Doğrudan EUR üzerinden hesaplanan iskontolu tutarla en fazla 1 € fark (yuvarlama)
      const dogrudan = 2 * 750 * (1 - indirim / 100) + 1_200 * (1 - indirim / 100);
      expect(Math.abs(eurTutar(net, kosul.kur) - dogrudan)).toBeLessThanOrEqual(1);
    }
    expect(bayiFiyati(basic.liste, 0)).toBe(basic.liste);
  });

  it("Premium'a EUR fiyatı girilse de portal kataloğunda görünmez (özel fiyatlı paketler portalda yok)", () => {
    const f = fiyatListesi();
    f.lisans.Premium.eurFiyat = 2_400;
    const { fiyat } = bayiFiyatlari("DE", f);
    expect(katalogOlustur(fiyat, []).some((u) => u.anahtar === "lisans:Premium")).toBe(false);
  });
});
