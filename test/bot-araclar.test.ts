// P2.2 botun araçları (components/bot/araclar.ts) bellek içi AracDeposu ile: strict şemalar, sunucuda yeniden
// doğrulama, kapsam (araç yalnızca turun konuşmasının fırsatına dokunur), geçici firma adının güncellenmesi, mevcut
// müşteri yetkilisiyle eşleşme (yeni müşteri açılmaz), münhasır bayi uyarısı (satışçı karar verir), demo hatırlatması
// (aşama değişmez), plan_oner (fiyat listesinden; bilinmeyen özellikte uydurmaz), izin_kaydet (kaynak kanaldan;
// Instagram'da WhatsApp izni ancak telefon varsa) ve modele dönen sonuçlarda kişisel veri olmaması.
// Veritabanı tarafı (lead_karti_birlestir, munhasir_bayi, yetkili_eslestir) test/lead-karti-sema.test.ts'te.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AracDeposu, AracKonusmasi, FirsatYamasi } from "@/components/bot/arac-deposu";
import type { IzinKanali } from "@/components/musteriler/izin";
import type { KanalAdaptoru } from "@/components/konusma/kanallar/tur";
import { VARSAYILAN_FIYAT } from "@/lib/urunler";

const v = vi.hoisted(() => ({ devirler: [] as unknown[][] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/konusma/devir", () => ({
  botDevretti: async (...a: unknown[]) => (v.devirler.push(a), { devredildi: true, firsatId: null, alicilar: [] }),
  devirAlicilari: () => [],
}));
// Instagram adaptörü henüz yok (P4.1): kanal farkı adaptörde kaldığı için testte telefon vermeyen bir adaptör yeter
vi.mock("@/components/konusma/kanallar", async (asil) => {
  const a = await asil<typeof import("@/components/konusma/kanallar")>();
  const ig = { ...a.adaptor("whatsapp"), kanal: "instagram", ad: "Instagram", leadKaynagi: "Instagram", izinKaynagi: "Instagram bot", telefon: () => null } as KanalAdaptoru;
  const ADAPTORLER = [...a.ADAPTORLER, ig];
  return { ...a, ADAPTORLER, adaptorBul: (k: string) => ADAPTORLER.find((x) => x.kanal === k) ?? null };
});

const { BOT_ARACLARI, aracTanimlari, araciCalistir } = await import("@/components/bot/araclar");
const { leadMetni } = await import("@/components/bot/istem");
const { geciciFirmaMi, ihtiyacGirdisi, eksikAlanlar } = await import("@/components/bot/lead-karti");

/* ---------- Bellek içi depo ---------- */

type Yetkili = { yetkiliId: number; musteriId: number; tel: string; eposta: string };
class BellekDepo implements AracDeposu {
  konusmalar = new Map<number, AracKonusmasi>();
  yetkililer: Yetkili[] = [];
  bayiler: { ulke: string; bayiId: number; ad: string; kapsam: string | null }[] = [];
  notlar: [number, string][] = [];
  hatirlatmalar: { firsatId: number; baslik: string; aciklama: string }[] = [];
  izinler: [number, IzinKanali, string, string][] = [];
  firsatYamalari: [number, FirsatYamasi][] = [];
  baglamalar: [number, number, number][] = [];

  private firsat(id: number) {
    for (const k of this.konusmalar.values()) if (k.firsat?.id === id) return k.firsat;
    throw new Error("fırsat yok");
  }
  async konusma(id: number) { return structuredClone(this.konusmalar.get(id) ?? null); }
  async kartBirlestir(firsatId: number, yama: Record<string, unknown>) {
    const f = this.firsat(firsatId);
    const k = { ...f.kart, ...yama } as Record<string, unknown>;
    for (const a of Object.keys(k)) if (k[a] === null) delete k[a];
    f.kart = k;
    return structuredClone(f.kart);
  }
  async firsatGuncelle(firsatId: number, y: FirsatYamasi) {
    this.firsatYamalari.push([firsatId, y]);
    const f = this.firsat(firsatId);
    if (y.firma) f.firma = y.firma;
    if (y.konum) f.konum = y.konum;
    if (y.telefon) f.telefon = y.telefon;
  }
  async yetkiliEslestir(tel: string | null, eposta: string | null) {
    return this.yetkililer
      .filter((y) => (tel && y.tel === tel) || (eposta && y.eposta.toLowerCase() === eposta.toLowerCase()))
      .map(({ yetkiliId, musteriId }) => ({ yetkiliId, musteriId }));
  }
  async musteriyeBagla(konusmaId: number, firsatId: number, musteriId: number) {
    this.baglamalar.push([konusmaId, firsatId, musteriId]);
    const k = this.konusmalar.get(konusmaId)!;
    k.musteriId ??= musteriId;
    this.firsat(firsatId).musteriId ??= musteriId;
  }
  async munhasirBayiler(ulke: string) { return this.bayiler.filter((b) => b.ulke === ulke).map(({ bayiId, ad, kapsam }) => ({ bayiId, ad, kapsam })); }
  async firsatNotu(firsatId: number, metin: string) { this.notlar.push([firsatId, metin]); }
  async hatirlatma(h: { firsatId: number; baslik: string; aciklama: string }) { this.hatirlatmalar.push({ firsatId: h.firsatId, baslik: h.baslik, aciklama: h.aciklama }); }
  async izinYaz(y: number, kanal: IzinKanali, kaynak: string, tarih: string) { this.izinler.push([y, kanal, kaynak, tarih]); }
  async fiyatListesi() { return structuredClone(VARSAYILAN_FIYAT); }
}

let depo: BellekDepo;
const SIMDI = new Date("2026-11-20T10:00:00Z");
const calistir = (ad: string, girdi: unknown, konusmaId = 1) => araciCalistir(ad, girdi, { konusmaId, depo, simdi: () => SIMDI });
const kart = (id = 1) => depo.konusmalar.get(id)!.firsat!.kart;

function konusmaEkle(id: number, kanal: "whatsapp" | "instagram", f: Partial<NonNullable<AracKonusmasi["firsat"]>> | null = {}, ek: Partial<AracKonusmasi> = {}) {
  depo.konusmalar.set(id, {
    konusmaId: id, kanal, disKullaniciId: kanal === "whatsapp" ? "+905321112233" : "17841400000000001", profilAdi: null, musteriId: null,
    firsat: f === null ? null : { id: id * 10, firma: "+90 532 111 22 33", konum: "Türkiye", telefon: null, musteriId: null, sorumluId: 2, kart: {}, ...f },
    ...ek,
  });
}

beforeEach(() => {
  depo = new BellekDepo();
  v.devirler = [];
  konusmaEkle(1, "whatsapp");
  konusmaEkle(2, "instagram", { firma: "usta.oto", konum: "—" }, { profilAdi: "usta.oto" });
});

/* ---------- Şemalar ---------- */

describe("araç şemaları", () => {
  it("altı araç, sabit sırada, hepsi strict; nesnelerde additionalProperties false, required ⊆ properties", () => {
    expect(aracTanimlari().map((t) => t.name)).toEqual(["ihtiyac_kaydet", "lead_skoru_ver", "demo_talep_et", "insana_devret", "plan_oner", "izin_kaydet"]);
    for (const t of aracTanimlari()) {
      expect(t.strict, t.name).toBe(true);
      const s = t.input_schema as { type: string; properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(s.type).toBe("object");
      expect(s.additionalProperties).toBe(false);
      for (const r of s.required) expect(Object.keys(s.properties)).toContain(r);
      expect(t.description!.length).toBeGreaterThan(80);
    }
  });

  it("strict'in desteklemediği kısıtlar ve iskonto / fiyat alanı yok (değişmez kural 1); kimlik alanı yok (kural 12)", () => {
    const json = JSON.stringify(aracTanimlari().map((t) => t.input_schema));
    for (const k of ["minimum", "maximum", "minLength", "maxLength", "multipleOf", "pattern"]) expect(json).not.toContain(`"${k}"`);
    const alanlar = aracTanimlari().flatMap((t) => Object.keys((t.input_schema as { properties: object }).properties));
    for (const a of alanlar) expect(a).not.toMatch(/iskonto|indirim|fiyat|tutar|kdv|firsat|musteri_id|konusma|yetkili_id/i);
  });

  it("insana_devret sebepleri: yol haritasındaki kodlar, dil kararı gereği desteklenmeyen_dil hariç (P2.3)", () => {
    const t = BOT_ARACLARI.find((a) => a.tanim.name === "insana_devret")!.tanim;
    expect((t.input_schema.properties as { sebep: { enum: string[] } }).sebep.enum).toEqual(
      ["fiyat_pazarligi", "sikayet", "ozel_fiyat", "emin_degil", "musteri_istedi", "bayi_bolgesi", "veri_silme", "diger"],
    );
  });
});

/* ---------- ihtiyac_kaydet ---------- */

describe("ihtiyac_kaydet", () => {
  it("girdiyi sunucuda yeniden doğrular: geçersiz alan atlanır, gerisi kaydedilir; hiç geçerli alan yoksa hata", () => {
    const r = ihtiyacGirdisi({ firma: "  Usta <b>Oto</b> ", cihaz_adedi: 0, eposta: "yanlis", ulke_kodu: "tr", fazla: 1, telefon: "0532 999 88 77" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.deger).toEqual({ firma: "Usta bOto/b", ulke_kodu: "TR", telefon: "+905329998877" });
    expect(r.atlanan.join(" ")).toMatch(/fazla.*cihaz_adedi.*eposta|fazla/);
    expect(ihtiyacGirdisi({ cihaz_adedi: 2.5 })).toMatchObject({ ok: false });
    expect(ihtiyacGirdisi([])).toMatchObject({ ok: false });
    expect(ihtiyacGirdisi({ ekran_tercihi: "mor" })).toMatchObject({ ok: false });
  });

  it("geçici firma adını (+90 …) gerçek adla günceller, konumu şehir + ülkeden yazar, eksikleri söyler", async () => {
    const r = await calistir("ihtiyac_kaydet", { firma: "Usta Oto Servis", sehir: "Konya", ulke_kodu: "TR", cihaz_adedi: 2 });
    expect(r.hata).toBeUndefined();
    const f = depo.konusmalar.get(1)!.firsat!;
    expect(f.firma).toBe("Usta Oto Servis");
    expect(f.konum).toBe("Konya, Türkiye");
    expect(f.kart).toMatchObject({ firma: "Usta Oto Servis", sehir: "Konya", ulke_kodu: "TR", cihaz_adedi: 2, guncelleme: SIMDI.toISOString() });
    expect(r.icerik).toContain("Kaydedildi: Firma, Şehir, Ülke, Cihaz adedi.");
    // WhatsApp telefonu kanaldan verir: telefon eksik sayılmaz
    expect(r.icerik).toMatch(/Eksik: Yetkili, Kullanım alanı, Ekran tercihi, Aciliyet, E-posta\./);
  });

  it("gerçek firma adı varsa üzerine yazmaz; profil adı (Instagram) geçici sayılır", async () => {
    depo.konusmalar.get(1)!.firsat!.firma = "Kayıtlı Firma A.Ş.";
    await calistir("ihtiyac_kaydet", { firma: "Başka Ad" });
    expect(depo.konusmalar.get(1)!.firsat!.firma).toBe("Kayıtlı Firma A.Ş.");
    expect(geciciFirmaMi("usta.oto", "usta.oto")).toBe(true);
    expect(geciciFirmaMi("+90 532 111 22 33")).toBe(true);
    expect(geciciFirmaMi("Usta Oto")).toBe(false);
    await calistir("ihtiyac_kaydet", { firma: "Usta Oto" }, 2);
    expect(depo.konusmalar.get(2)!.firsat!.firma).toBe("Usta Oto");
  });

  it("Instagram'da toplanan telefon fırsata yazılır, telefon ve e-posta modele dönen sonuçta tekrar edilmez", async () => {
    const r = await calistir("ihtiyac_kaydet", { telefon: "+49 151 2345 6789", eposta: "Ali@Usta.de" }, 2);
    expect(depo.konusmalar.get(2)!.firsat!.telefon).toBe("+4915123456789");
    expect(kart(2)).toMatchObject({ telefon: "+4915123456789", eposta: "ali@usta.de" });
    expect(r.icerik).not.toMatch(/4915|ali@/i);
  });

  it("telefon mevcut müşteri yetkilisiyle eşleşirse fırsat ve konuşma o müşteriye bağlanır (yeni müşteri yok)", async () => {
    depo.yetkililer.push({ yetkiliId: 7, musteriId: 70, tel: "+4915123456789", eposta: "" });
    const r = await calistir("ihtiyac_kaydet", { telefon: "+49 151 23456789" }, 2);
    expect(depo.baglamalar).toEqual([[2, 20, 70]]);
    expect(depo.konusmalar.get(2)!.firsat!.musteriId).toBe(70);
    expect(depo.notlar.at(-1)![1]).toMatch(/müşteriye bağlandı/);
    // modele eşleşme söylenmez (kimin müşteri olduğu bilgisi sızmaz)
    expect(r.icerik).not.toMatch(/müşteri/i);
  });

  it("e-posta büyük/küçük harf duyarsız eşleşir; iki farklı müşteriyle eşleşirse bağlamaz, not düşer; bağlıysa dokunmaz", async () => {
    depo.yetkililer.push({ yetkiliId: 8, musteriId: 80, tel: "", eposta: "ortak@firma.com" }, { yetkiliId: 9, musteriId: 90, tel: "", eposta: "ORTAK@firma.com" });
    await calistir("ihtiyac_kaydet", { eposta: "ortak@firma.com" }, 2);
    expect(depo.baglamalar).toEqual([]);
    expect(depo.notlar.at(-1)![1]).toMatch(/2 farklı müşteri/);
    depo.yetkililer = [{ yetkiliId: 8, musteriId: 80, tel: "", eposta: "a@b.com" }];
    depo.konusmalar.get(1)!.firsat!.musteriId = 5;
    await calistir("ihtiyac_kaydet", { eposta: "a@b.com" }, 1);
    expect(depo.baglamalar).toEqual([]);
  });

  it("münhasır bayi olan ülke: kartta uyarı + fırsat notu; bot devretmez, yönlendirmemesi söylenir (satışçı karar verir)", async () => {
    depo.bayiler.push({ ulke: "DE", bayiId: 3, ad: "Auto Test GmbH", kapsam: "Almanya" });
    const r = await calistir("ihtiyac_kaydet", { ulke_kodu: "DE", sehir: "Köln" }, 2);
    expect(kart(2).bayi).toMatchObject({ bayi_id: 3, ad: "Auto Test GmbH", kapsam: "Almanya", ulke_kodu: "DE" });
    expect(depo.notlar.map((n) => n[1])).toContain("Bölgede münhasır bayi var: Auto Test GmbH (Almanya). Bayiye mi yönlendirilecek, Embedra mı satacak: satışçı karar verir.");
    expect(r.icerik).toMatch(/bayiye yönlendirme/);
    expect(r.icerik).not.toContain("Auto Test GmbH");
    expect(v.devirler).toEqual([]);
    // Aynı ülke tekrar: ikinci not yok
    await calistir("ihtiyac_kaydet", { ulke_kodu: "DE" }, 2);
    expect(depo.notlar.filter((n) => n[1].startsWith("Bölgede")).length).toBe(1);
    // Müşteri ülkesini düzeltirse uyarı kalkar
    await calistir("ihtiyac_kaydet", { ulke_kodu: "AT" }, 2);
    expect(kart(2).bayi).toBeUndefined();
  });

  it("bayi olmayan ülkede uyarı yok", async () => {
    const r = await calistir("ihtiyac_kaydet", { ulke_kodu: "TR" });
    expect(kart().bayi).toBeUndefined();
    expect(r.icerik).not.toMatch(/bayi/i);
  });

  it("kapsam: konuşmanın fırsatı yoksa hiçbir şey yazmaz; araç modelden kimlik almaz", async () => {
    konusmaEkle(3, "whatsapp", null);
    const r = await calistir("ihtiyac_kaydet", { firma: "X" }, 3);
    expect(r.hata).toBe(true);
    expect(depo.firsatYamalari).toEqual([]);
    const r2 = await calistir("ihtiyac_kaydet", { firma: "Y Ltd", firsat_id: 20 }, 1);
    expect(r2.icerik).toMatch(/firsat_id: bilinmeyen alan/);
    expect(depo.konusmalar.get(2)!.firsat!.kart).toEqual({});
  });
});

/* ---------- lead_skoru_ver, demo_talep_et ---------- */

describe("lead_skoru_ver ve demo_talep_et", () => {
  it("skor doğrulanır ve kartta birikir", async () => {
    expect((await calistir("lead_skoru_ver", { skor: "kaynar", gerekce: "x" })).hata).toBe(true);
    expect((await calistir("lead_skoru_ver", { skor: "sicak", gerekce: "  " })).hata).toBe(true);
    await calistir("lead_skoru_ver", { skor: "sicak", gerekce: "2 cihaz, bu ay almak istiyor" });
    expect(kart().skor).toEqual({ deger: "sicak", gerekce: "2 cihaz, bu ay almak istiyor", zaman: SIMDI.toISOString() });
  });

  it("demo talebi sorumluya hatırlatma açar, aşamayı değiştirmez; aynı talep 24 saat içinde tekrar hatırlatma açmaz", async () => {
    const r = await calistir("demo_talep_et", { zaman_notu: "perşembe öğleden sonra" });
    expect(depo.hatirlatmalar).toEqual([{ firsatId: 10, baslik: "Demo talebi: +90 532 111 22 33", aciklama: expect.stringContaining("perşembe öğleden sonra") }]);
    expect(depo.notlar.at(-1)![1]).toMatch(/Aşama otomatik değişmedi/);
    expect(kart().demo).toEqual({ not: "perşembe öğleden sonra", zaman: SIMDI.toISOString() });
    expect(depo.firsatYamalari).toEqual([]); // fırsatın aşaması ya da başka alanı yazılmadı
    expect(r.icerik).not.toMatch(/telefon ya da e-posta yok/);
    await calistir("demo_talep_et", { zaman_notu: "perşembe öğleden sonra" });
    expect(depo.hatirlatmalar).toHaveLength(1);
  });

  it("iletişim bilgisi olmayan kanalda telefon / e-postayı gerekçesiyle istemesi söylenir", async () => {
    const r = await calistir("demo_talep_et", { zaman_notu: "" }, 2);
    expect(kart(2).demo!.not).toBe("belirtilmedi");
    expect(r.icerik).toMatch(/telefon ya da e-posta yok: gerekçesini söyleyerek/);
  });
});

/* ---------- plan_oner ---------- */

describe("plan_oner", () => {
  it("planı enUygunPlan ve fiyat listesinden verir, gerekçe ve üst planı döner, karta yazar", async () => {
    const r = await calistir("plan_oner", { ozellik_idleri: ["temel-direksiyon-testi"], cihaz_adedi: 1 });
    expect(r.hata).toBeUndefined();
    expect(r.icerik).toMatch(/^Önerilen plan: Basic × 1 lisans, 1 cihaz için; yıllık .*₺/);
    expect(r.icerik).toMatch(/Gerekçe: .* en az Basic planı gerektiriyor/);
    expect(r.icerik).toMatch(/Bir üst seçenek: /);
    expect(kart().plan).toMatchObject({ plan: "Basic", lisans_adedi: 1, cihaz_adedi: 1, para_birimi: "TRY", ozellikler: ["temel-direksiyon-testi"] });
  });

  it("yurt dışı lead'de EUR; bilinmeyen özellikte uydurmaz, devretmesi söylenir", async () => {
    depo.konusmalar.get(1)!.firsat!.kart = { ulke_kodu: "DE" };
    const r = await calistir("plan_oner", { ozellik_idleri: ["temel-direksiyon-testi", "uçan-araba"], cihaz_adedi: 2 });
    expect(r.icerik).toMatch(/Katalogda olmayan: "uçan-araba".*insana_devret \(emin_degil\)/);
    expect(r.icerik).toMatch(/€/);
    expect(kart().plan!.para_birimi).toBe("EUR");
    const yalniz = await calistir("plan_oner", { ozellik_idleri: ["uçan-araba"], cihaz_adedi: 1 });
    expect(yalniz.icerik).toMatch(/plan önerilemedi/);
    expect(kart().plan!.ozellikler).toEqual(["temel-direksiyon-testi"]);
  });

  it("girdi doğrulaması: boş liste, geçersiz adet", async () => {
    expect((await calistir("plan_oner", { ozellik_idleri: [], cihaz_adedi: 1 })).hata).toBe(true);
    expect((await calistir("plan_oner", { ozellik_idleri: ["temel-direksiyon-testi"], cihaz_adedi: 0 })).hata).toBe(true);
    expect((await calistir("plan_oner", { ozellik_idleri: "temel-direksiyon-testi", cihaz_adedi: 1 })).hata).toBe(true);
  });
});

/* ---------- izin_kaydet ---------- */

describe("izin_kaydet", () => {
  it("WhatsApp: müşteriye bağlı fırsatta eşleşen yetkiliye 'WhatsApp bot' kaynağıyla yazılır", async () => {
    depo.yetkililer.push({ yetkiliId: 7, musteriId: 70, tel: "+905321112233", eposta: "" });
    depo.konusmalar.get(1)!.firsat!.musteriId = 70;
    const r = await calistir("izin_kaydet", { kanal: "whatsapp" });
    expect(r.hata).toBeUndefined();
    expect(depo.izinler).toEqual([[7, "whatsapp", "WhatsApp bot", "2026-11-20"]]);
    expect(kart().izinler).toBeUndefined();
  });

  it("Instagram'da WhatsApp izni telefon toplanmadıysa kaydedilmez; e-posta izni e-posta yoksa kaydedilmez", async () => {
    expect((await calistir("izin_kaydet", { kanal: "whatsapp" }, 2)).hata).toBe(true);
    expect((await calistir("izin_kaydet", { kanal: "eposta" }, 2)).hata).toBe(true);
    expect(depo.izinler).toEqual([]);
    expect(kart(2).izinler).toBeUndefined();
  });

  it("Instagram'da telefon toplandıktan sonra izin 'Instagram bot' kaynağıyla kartta bekler, müşteri eşleşince yetkiliye taşınır", async () => {
    await calistir("ihtiyac_kaydet", { telefon: "+49 151 23456789" }, 2);
    await calistir("izin_kaydet", { kanal: "whatsapp" }, 2);
    expect(kart(2).izinler).toEqual([{ kanal: "whatsapp", kaynak: "Instagram bot", tarih: "2026-11-20" }]);
    expect(depo.izinler).toEqual([]);
    depo.yetkililer.push({ yetkiliId: 9, musteriId: 90, tel: "", eposta: "ali@usta.de" }, { yetkiliId: 10, musteriId: 90, tel: "+4915123456789", eposta: "" });
    await calistir("ihtiyac_kaydet", { eposta: "ali@usta.de" }, 2);
    expect(depo.baglamalar).toEqual([[2, 20, 90]]);
    // WhatsApp izni telefonu eşleşen yetkiliye (10) yazılır
    expect(depo.izinler).toEqual([[10, "whatsapp", "Instagram bot", "2026-11-20"]]);
    expect(kart(2).izinler).toBeUndefined();
  });

  it("geçersiz kanal reddedilir", async () => {
    expect((await calistir("izin_kaydet", { kanal: "instagram" })).hata).toBe(true);
  });
});

/* ---------- çalıştırıcı, insana_devret, istem ---------- */

describe("çalıştırıcı ve istem", () => {
  it("bilinmeyen araç ve fırlayan depo is_error olarak döner", async () => {
    expect(await calistir("sil_her_seyi", {})).toMatchObject({ hata: true });
    depo.konusma = async () => { throw new Error("db çöktü"); };
    expect(await calistir("lead_skoru_ver", { skor: "ilik", gerekce: "x" })).toEqual({ icerik: "Araç çalıştırılamadı.", hata: true });
  });

  it("insana_devret bayi_bolgesi sebebini kabul eder", async () => {
    const r = await calistir("insana_devret", { sebep: "bayi_bolgesi", aciklama: "Müşteri bayiyle görüşmek istedi" });
    expect(r.devir).toBe(true);
    expect(v.devirler).toEqual([[1, "bayi_bolgesi", "Müşteri bayiyle görüşmek istedi"]]);
  });

  it("istemdeki lead kartı: telefon / e-posta değeri değil 'alındı'; eksikler listelenir", () => {
    const m = leadMetni({
      firma: null, konum: "Türkiye", asama: "Yeni lead", ilgi: null, kanalTelefonu: false,
      kart: { firma: "Usta Oto", yetkili: "Ali", telefon: "+4915123456789", eposta: "ali@usta.de", cihaz_adedi: 3, skor: { deger: "ilik", gerekce: "g", zaman: "" } },
    });
    expect(m).toContain("Firma: Usta Oto");
    expect(m).toContain("Telefon: alındı");
    expect(m).toContain("E-posta: alındı");
    expect(m).not.toMatch(/4915|ali@/);
    expect(m).toContain("Lead skoru: Ilık");
    expect(m).toMatch(/Eksik \(.*\): Ülke, Kullanım alanı, Ekran tercihi, Aciliyet/);
    expect(eksikAlanlar({}, true)).not.toContain("telefon");
  });
});
