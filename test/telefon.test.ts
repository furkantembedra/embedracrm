// Telefon normalizasyonu: WhatsApp wa_id'si ile CRM'de serbest yazılmış numaralar aynı biçime gelmeli.
// Aynı kuralların SQL karşılığı (private.telefon_normal) test/veritabani.test.ts'te bu tabloyla karşılaştırılır.
import { describe, expect, it } from "vitest";
import { telefonGoster, telefonNormalize } from "@/components/whatsapp/telefon";
import { TELEFON_ORNEKLERI } from "./veri/telefon-ornekleri";

describe("telefonNormalize", () => {
  it.each(TELEFON_ORNEKLERI)("%j → %j", (girdi, beklenen) => {
    expect(telefonNormalize(girdi)).toBe(beklenen);
  });

  it("WhatsApp wa_id'si ile CRM'de yazılmış biçim aynı sonucu verir", () => {
    expect(telefonNormalize("+905321234567")).toBe(telefonNormalize("0532 123 45 67"));
  });
});

describe("telefonGoster", () => {
  it("Türkiye numarasını gruplar, diğerlerine dokunmaz", () => {
    expect(telefonGoster("+905321234567")).toBe("+90 532 123 45 67");
    expect(telefonGoster("+497115550142")).toBe("+497115550142");
  });
});
