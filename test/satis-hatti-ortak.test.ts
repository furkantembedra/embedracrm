// components/satis-hatti/ortak.ts › ekleVeyaGuncelle: yeni fırsat, sunucudan gelen yenilenmiş listeyle yarışsa da bir kez görünür.
import { describe, expect, it } from "vitest";
import { ekleVeyaGuncelle } from "@/components/satis-hatti/ortak";
import type { Firsat } from "@/components/satis-hatti/queries";

const f = (id: string, firma = `Firma ${id}`): Firsat => ({
  id, firma, konum: "", kaynak: "WhatsApp", icerik: "", tutar: 0, asama: "yeni", sonrakiAdim: "", sonrakiTarih: "", kampanyaId: null,
});

describe("ekleVeyaGuncelle", () => {
  it("listede olmayan fırsatı sona ekler", () => {
    expect(ekleVeyaGuncelle([f("1")], f("2")).map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("sunucu listesi önce geldiyse fırsatı ikinci kez eklemez, yerinde günceller", () => {
    const l = ekleVeyaGuncelle([f("1"), f("13", "Eski ad"), f("2")], f("13", "Yeni ad"));
    expect(l.map((x) => x.id)).toEqual(["1", "13", "2"]);
    expect(l[1].firma).toBe("Yeni ad");
  });
});
