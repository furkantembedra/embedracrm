// Kanal adaptörü sözleşme testleri (components/konusma/kanallar/tur.ts › KanalAdaptoru). ADAPTORLER listesindeki her
// adaptör aynı testlerden geçer: bugün WhatsApp; Instagram (P4.1) ve Messenger (P4.2) eklenince onlar da.
// Adaptöre özgü veriler test/veri/kanal-ornekleri.ts'te; WhatsApp'a özgü ayrıntılar test/kanal-whatsapp.test.ts'te.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ADAPTORLER, adaptor, adaptorBul, webhookAdaptoru } from "@/components/konusma/kanallar";
import { KONUSMA_KANALLARI, MESAJ_TURLERI } from "@/components/konusma/queries";
import { LEAD_KAYNAKLARI } from "@/lib/constants";
import { karakterSay, utf8BaytSay } from "@/components/konusma/kanallar/bol";
import type { TeslimDurumu } from "@/components/konusma/kanallar/tur";
import { ADAPTOR_ORNEKLERI } from "./veri/kanal-ornekleri";
import { sahteMetaBaslat, type SahteMeta } from "./sahte/meta";

let meta: SahteMeta;
beforeAll(async () => {
  meta = await sahteMetaBaslat();
});
afterAll(() => meta?.kapat());
afterEach(() => {
  vi.unstubAllEnvs();
  meta.istekler.length = 0;
});

describe("adaptör listesi", () => {
  it("her adaptör ayrı bir kanala ve ayrı bir webhook object'ine bağlı; her birinin sözleşme verisi var", () => {
    expect(ADAPTORLER.length).toBeGreaterThan(0);
    expect(new Set(ADAPTORLER.map((a) => a.kanal)).size).toBe(ADAPTORLER.length);
    expect(new Set(ADAPTORLER.map((a) => a.webhookObject)).size).toBe(ADAPTORLER.length);
    for (const a of ADAPTORLER) {
      expect(KONUSMA_KANALLARI).toContain(a.kanal);
      expect(ADAPTOR_ORNEKLERI[a.kanal], `${a.kanal} için test/veri/kanal-ornekleri.ts verisi eksik`).toBeDefined();
      expect(adaptor(a.kanal)).toBe(a);
      expect(webhookAdaptoru(a.webhookObject)).toBe(a);
    }
  });

  it("adaptörü olmayan kanal ve bilinmeyen object için null / hata", () => {
    expect(adaptorBul("telgraf")).toBeNull();
    expect(() => adaptor("telgraf")).toThrow(/Kanal adaptörü yok/);
    expect(webhookAdaptoru("user")).toBeNull();
    expect(webhookAdaptoru(undefined)).toBeNull();
  });
});

const BASKA_OBJECTLER = ["whatsapp_business_account", "instagram", "page", "user"];

describe.each(ADAPTORLER.map((a) => [a.kanal, a] as const))("%s adaptörü sözleşmesi", (_kanal, a) => {
  const o = ADAPTOR_ORNEKLERI[a.kanal]!;
  const birim = a.sinirlar.birim === "utf8_bayt" ? utf8BaytSay : karakterSay;

  describe("tanım", () => {
    it("ad, lead kaynağı, sonraki adım ve kimlik alanı dolu; lead kaynağı ortak listede", () => {
      expect(a.ad).toBeTruthy();
      expect(LEAD_KAYNAKLARI).toContain(a.leadKaynagi);
      expect(a.sonrakiAdim).toBeTruthy();
      expect(a.kimlikAlani.etiket).toBeTruthy();
      expect(a.kimlikCoz(a.kimlikAlani.ornek)).toBeTruthy(); // formdaki örnek geçerli
      expect(a.varsayilanHesap()).toBeTruthy();
    });

    it("biçim sınırları tanımlı", () => {
      expect(a.sinirlar.azamiUzunluk).toBeGreaterThan(0);
      expect(a.sinirlar.not).toBeTruthy();
      expect(Array.isArray(a.sinirlar.bicimlendirme)).toBe(true);
    });
  });

  describe("webhookCevir", () => {
    const g = { kullanici: o.kullanici.ham, hesap: o.hesap, metin: "Merhaba, fiyat alabilir miyim?", mid: `MID-${a.kanal}-1`, ad: "Ahmet" };

    it("müşteri mesajını ortak biçime çevirir", () => {
      const r = a.webhookCevir(o.musteriGovdesi(g));
      expect(r.mesajlar).toHaveLength(1);
      const m = r.mesajlar[0];
      expect(m).toMatchObject({ kanal: a.kanal, kanalHesapId: o.hesap, disKullaniciId: o.kullanici.kimlik, disMesajId: g.mid, metin: g.metin, echo: false });
      expect(MESAJ_TURLERI).toContain(m.tur);
      expect(new Date(m.zaman).toISOString()).toBe(m.zaman);
      expect(m.ek).toBeTypeOf("object");
      expect(r.durumlar).toEqual([]);
    });

    it("işletme hesabından CRM dışında gönderilmiş mesajı echo olarak, müşterinin kimliğiyle çevirir", () => {
      const r = a.webhookCevir(o.echoGovdesi({ ...g, mid: `MID-${a.kanal}-ECHO`, metin: "Size nasıl yardımcı olabiliriz?" }));
      expect(r.mesajlar).toEqual([expect.objectContaining({
        echo: true, disKullaniciId: o.kullanici.kimlik, kanalHesapId: o.hesap, disMesajId: `MID-${a.kanal}-ECHO`, metin: "Size nasıl yardımcı olabiliriz?",
      })]);
      expect(r.mesajlar[0].profilAdi).toBeUndefined();
    });

    it.each(["gonderildi", "iletildi", "okundu", "basarisiz"] as TeslimDurumu[])("teslim durumu: %s", (durum) => {
      const r = a.webhookCevir(o.durumGovdesi({ mid: "MID-GIDEN", durum, hesap: o.hesap }));
      expect(r.mesajlar).toEqual([]);
      expect(r.durumlar).toEqual([expect.objectContaining({ disMesajId: "MID-GIDEN", durum })]);
      expect(new Date(r.durumlar[0].zaman).toISOString()).toBe(r.durumlar[0].zaman);
    });

    it("bozuk ya da başka kanala ait gövdede fırlatmaz, boş döner", () => {
      const bozuklar: unknown[] = [null, undefined, 42, "metin", [], {}, { entry: "x" }, { object: a.webhookObject }, { object: a.webhookObject, entry: [null, 1, { changes: "x", messaging: "x" }] },
        ...BASKA_OBJECTLER.filter((x) => x !== a.webhookObject).map((object) => ({ ...(o.musteriGovdesi(g) as object), object }))];
      for (const b of bozuklar) {
        const r = a.webhookCevir(b);
        expect(r.mesajlar).toEqual([]);
        expect(r.durumlar).toEqual([]);
      }
    });

    it("mesaj kimliği olmayan olayı atlar", () => {
      const govde = JSON.parse(JSON.stringify(o.musteriGovdesi(g)).replaceAll(`"${g.mid}"`, '""'));
      const r = a.webhookCevir(govde);
      expect(r.mesajlar).toEqual([]);
      expect(r.atlanan).toBeGreaterThan(0);
    });
  });

  describe("kimlik", () => {
    it("elle girilen kimliği çözer, geçersizi reddeder", () => {
      expect(a.kimlikCoz(o.kimlikGirdisi.gecerli)).toBe(o.kimlikGirdisi.beklenen);
      for (const x of o.kimlikGirdisi.gecersiz) expect(a.kimlikCoz(x)).toBeNull();
    });

    it("görünen kimlik boş değil; telefon ya normalize telefon ya null", () => {
      expect(a.gorunenKimlik(o.kullanici.kimlik)).toBeTruthy();
      const t = a.telefon(o.kullanici.kimlik);
      if (t !== null) expect(t).toMatch(/^\+\d{10,15}$/);
    });
  });

  describe("pencere", () => {
    const simdi = new Date("2026-11-19T12:00:00Z");
    const once = (dk: number) => new Date(simdi.getTime() - dk * 60_000).toISOString();

    it("müşteri hiç yazmadıysa açık değil", () => {
      expect(a.pencere(null, simdi).durum).not.toBe("acik");
    });

    it("son müşteri mesajından hemen sonra açık, bitişi 24 saat sonra", () => {
      const p = a.pencere(once(1), simdi);
      expect(p.durum).toBe("acik");
      expect(Date.parse(p.bitis!)).toBe(Date.parse(once(1)) + 24 * 3600_000);
    });

    it("24 saat geçince açık değil (bot yazamaz); temsilci etiketli pencerenin bitişi bellidir", () => {
      for (const dk of [24 * 60 + 1, 3 * 24 * 60, 30 * 24 * 60]) {
        const p = a.pencere(once(dk), simdi);
        expect(p.durum).not.toBe("acik");
        if (p.durum === "yalnizca_temsilci") expect(Date.parse(p.bitis!)).toBeGreaterThan(simdi.getTime());
      }
    });

    it("bozuk zamanda açık değil", () => {
      expect(a.pencere("dün", simdi).durum).not.toBe("acik");
    });
  });

  describe("bölme", () => {
    const azami = a.sinirlar.azamiUzunluk;

    it("kısa metin tek parça, boş metin hiç parça", () => {
      expect(a.bol("  Merhaba!  ")).toEqual(["Merhaba!"]);
      expect(a.bol("   ")).toEqual([]);
    });

    it("uzun metin sınırı aşmayan parçalara bölünür, kelimeler kaybolmaz ve sırası korunur", () => {
      const cumle = "ONE cihazı direksiyon testlerinde ölçüm yapar ve rapor üretir. ";
      const metin = `${cumle.repeat(Math.ceil((azami * 2.5) / cumle.length))}\n\nSon paragraf: teşekkürler.`;
      const parcalar = a.bol(metin);
      expect(parcalar.length).toBeGreaterThanOrEqual(3);
      for (const p of parcalar) {
        expect(birim(p)).toBeLessThanOrEqual(azami);
        expect(p).toBe(p.trim());
        expect(p).not.toBe("");
      }
      expect(parcalar.join(" ").split(/\s+/)).toEqual(metin.trim().split(/\s+/));
    });

    it("boşluksuz çok uzun metin de sınırda kesilir (emoji gibi çok baytlı karakterler bölünmez)", () => {
      const parcalar = a.bol("🔧".repeat(azami + 10));
      for (const p of parcalar) {
        expect(birim(p)).toBeLessThanOrEqual(azami);
        expect([...p].every((c) => c === "🔧")).toBe(true);
      }
      expect(parcalar.join("")).toBe("🔧".repeat(azami + 10));
    });
  });

  describe("gonder", () => {
    const alici = { kanalHesapId: o.hesap, disKullaniciId: o.kullanici.kimlik };

    it("anahtar yoksa demo: hiçbir istek atmaz, ok döner", async () => {
      vi.stubEnv("META_GRAPH_URL", meta.adres);
      o.ortamBosalt();
      expect(await a.gonder(alici, { tur: "metin", metin: "Merhaba" })).toEqual({ ok: true, disMesajId: null, demo: true });
      expect(meta.istekler).toHaveLength(0);
    });

    it("anahtar varsa gönderir ve kanalın mesaj kimliğini döner", async () => {
      o.ortamKur(meta.adres);
      const r = await a.gonder(alici, { tur: "metin", metin: "Merhaba" });
      expect(r).toMatchObject({ ok: true, demo: false, disMesajId: expect.any(String) });
      expect(meta.gonderimler().at(-1)).toMatchObject({ kanal: a.kanal, hesap: o.hesap });
      expect(JSON.stringify(meta.gonderilenler().at(-1))).toContain("Merhaba");
    });

    it("sınırı aşan ya da boş metni göndermez (bölmek çağıranın işi)", async () => {
      o.ortamKur(meta.adres);
      expect((await a.gonder(alici, { tur: "metin", metin: "a".repeat(a.sinirlar.azamiUzunluk + 1) })).ok).toBe(false);
      expect((await a.gonder(alici, { tur: "metin", metin: "  " })).ok).toBe(false);
      expect(meta.istekler).toHaveLength(0);
    });

    it("kanal hata dönerse fırlatmaz, anlaşılır hata döner; ulaşılamazsa da", async () => {
      o.ortamKur(meta.adres);
      meta.hata(400, "(#131047) Re-engagement message", 131047);
      const r = await a.gonder(alici, { tur: "metin", metin: "Merhaba" });
      // Kod ayrı alanda; temsilciye Meta'nın İngilizce metni değil, adaptörün Türkçe açıklaması gösterilir
      expect(r).toEqual({ ok: false, hata: a.hataAciklamasi("131047"), kod: "131047" });
      expect(a.hataAciklamasi("131047")).not.toMatch(/Re-engagement/);
      expect(a.hataAciklamasi("999999")).toContain("999999"); // bilinmeyen kod da gösterilir
      expect(a.hataAciklamasi(null)).toEqual(expect.any(String));
      o.ortamKur("http://127.0.0.1:9"); // kapalı port
      expect(await a.gonder(alici, { tur: "metin", metin: "Merhaba" })).toEqual({ ok: false, hata: expect.any(String) });
    });
  });
});
