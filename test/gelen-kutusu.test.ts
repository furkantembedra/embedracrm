// Bot › Gelen kutusu saf kuralları: cevap kutusunun hâli (pencere + kanalın kapalı pencere yolu; kanal adına göre dal yok),
// liste filtreleri ve arama, bot durumu rozeti.
import { describe, expect, it } from "vitest";
import { cevapModu, listeyiSuz } from "@/components/bot/cevap-modu";
import { botDurumu } from "@/components/bot/kanal-gorunumu";
import type { PencereDurumu } from "@/components/konusma/kanallar/tur";

const acik: PencereDurumu = { durum: "acik", bitis: "2026-11-20T10:00:00.000Z" };
const etiketli: PencereDurumu = { durum: "yalnizca_temsilci", bitis: "2026-11-26T10:00:00.000Z" };
const kapali: PencereDurumu = { durum: "kapali", bitis: null };

describe("cevapModu", () => {
  it("pencere açıkken serbest metin", () => {
    expect(cevapModu({ kanalBagli: true, pencere: acik, kapaliPencereYolu: "sablon" })).toEqual({ tur: "serbest" });
  });
  it("Instagram / Messenger: yalnızca temsilci etiketiyle (bitiş gösterilir)", () => {
    expect(cevapModu({ kanalBagli: true, pencere: etiketli, kapaliPencereYolu: "baska_kanal" })).toEqual({ tur: "etiketli", bitis: etiketli.bitis });
  });
  it("WhatsApp kapalı: şablon; Instagram / Messenger kapalı: e-posta ya da telefon", () => {
    expect(cevapModu({ kanalBagli: true, pencere: kapali, kapaliPencereYolu: "sablon" })).toEqual({ tur: "sablon" });
    expect(cevapModu({ kanalBagli: true, pencere: kapali, kapaliPencereYolu: "baska_kanal" })).toEqual({ tur: "baska_kanal" });
  });
  it("adaptörü olmayan kanal: bağlı değil (pencere ne olursa olsun)", () => {
    expect(cevapModu({ kanalBagli: false, pencere: acik, kapaliPencereYolu: "sablon" })).toEqual({ tur: "bagli_degil" });
  });
});

describe("botDurumu", () => {
  it("bot açık → bot; kapalı ve son mesaj müşteriden → cevap bekliyor; değilse temsilcide", () => {
    expect(botDurumu(true, "gelen")).toBe("bot");
    expect(botDurumu(false, "gelen")).toBe("bekliyor");
    expect(botDurumu(false, "giden")).toBe("temsilci");
    expect(botDurumu(false, null)).toBe("temsilci");
  });
});

describe("listeyiSuz", () => {
  const satir = (o: Partial<Parameters<typeof listeyiSuz>[0][number]> & { id: number }) => ({
    kanal: "whatsapp", ad: "Ahmet Usta", kimlik: "+90 532 111 22 33", disKullaniciId: "+905321112233", firma: "Usta Servis",
    botAktif: false, sorumluId: null as string | null, son: { yon: "gelen" as "gelen" | "giden" }, pencere: acik, ...o,
  });
  const liste = [
    satir({ id: 1, botAktif: true }),
    satir({ id: 2, son: { yon: "gelen" }, sorumluId: "u2" }),
    satir({ id: 3, son: { yon: "giden" }, pencere: kapali, ad: "Volant GmbH", firma: "Volant Lenkung", disKullaniciId: "+491701234567", kimlik: "+49 170 1234567" }),
    satir({ id: 4, kanal: "instagram", disKullaniciId: "IGSID-998877", kimlik: "Instagram kullanıcısı", ad: "zeynep.oto" }),
  ];
  const s = (o: Partial<Parameters<typeof listeyiSuz>[1]>) => listeyiSuz(liste, { kanal: null, filtre: null, arama: "", ben: "u2", ...o }).map((x) => x.id);

  it("filtreler", () => {
    expect(s({})).toEqual([1, 2, 3, 4]);
    expect(s({ filtre: "bot" })).toEqual([1]);
    expect(s({ filtre: "bekliyor" })).toEqual([2, 4]);
    expect(s({ filtre: "bana" })).toEqual([2]);
    expect(s({ filtre: "bana", ben: null })).toEqual([]);
    expect(s({ filtre: "kapali" })).toEqual([3]);
  });
  it("kanal sekmesi", () => {
    expect(s({ kanal: "instagram" })).toEqual([4]);
    expect(s({ kanal: "messenger" })).toEqual([]);
  });
  it("arama: isim, firma (Türkçe büyük/küçük harf), telefon rakamları", () => {
    expect(s({ arama: "volant" })).toEqual([3]);
    expect(s({ arama: "LENKUNG" })).toEqual([3]);
    expect(s({ arama: "ZEYNEP" })).toEqual([4]);
    expect(s({ arama: "0170 123" })).toEqual([3]);
    expect(s({ arama: "532 111" })).toEqual([1, 2]);
    expect(s({ arama: "98" })).toEqual([]); // 3 rakamdan kısa: gizli kimlikle (IGSID-998877) eşleşmez
    expect(s({ arama: "998" })).toEqual([4]);
  });
});
