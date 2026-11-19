// WhatsApp adaptörüne özgü ayrıntılar (components/konusma/kanallar/whatsapp.ts); ortak sözleşme test/kanal-adaptoru.test.ts'te.
// Telefonsuz kimlik (BSUID), sistem / silme olayları, tür eşlemesi, ek bilgide kişisel veri olmaması, gönderim gövdesi.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mesajMetni, whatsappAdaptoru as a, whatsappKimligi, whatsappTuru } from "@/components/konusma/kanallar/whatsapp";
import { metniBol, utf8BaytSay } from "@/components/konusma/kanallar/bol";
import { sahteMetaBaslat, VARSAYILAN_TOKENLAR, waMesaj, whatsappEchoGovdesi, whatsappGovdesi, type SahteMeta } from "./sahte/meta";

let meta: SahteMeta;
beforeAll(async () => {
  meta = await sahteMetaBaslat();
});
afterAll(() => meta?.kapat());
afterEach(() => {
  vi.unstubAllEnvs();
  meta.istekler.length = 0;
});

const cevir = (m: ReturnType<typeof waMesaj>, o: Parameters<typeof whatsappGovdesi>[0] = {}) => a.webhookCevir(whatsappGovdesi({ ...o, mesajlar: [m] }));

describe("kimlik", () => {
  it("telefon varsa normalize telefon, yoksa BSUID; ikisi de yoksa ya da bozuksa null", () => {
    expect(whatsappKimligi("905321112233", "TR.123")).toBe("+905321112233");
    expect(whatsappKimligi(undefined, "TR.13491208655302741918")).toBe("TR.13491208655302741918");
    expect(whatsappKimligi(undefined, "US.ENT.11815799212886844830")).toBe("US.ENT.11815799212886844830");
    expect(whatsappKimligi("123", undefined)).toBeNull();
    expect(whatsappKimligi(undefined, "bozuk kimlik")).toBeNull();
    expect(whatsappKimligi(undefined, undefined)).toBeNull();
  });

  it("kullanıcı adı kullanan (telefonu gelmeyen) kişinin mesajı BSUID ile işlenir; profil adı contacts[].user_id'den", () => {
    const govde = whatsappGovdesi({ mesajlar: [waMesaj({ from: undefined, from_user_id: "TR.13491208655302741918", id: "wamid.B1" })] });
    (govde.entry[0].changes[0].value as { contacts: unknown }).contacts = [{ profile: { name: "Ayşe", username: "ayse.usta" }, user_id: "TR.13491208655302741918" }];
    const r = a.webhookCevir(govde);
    expect(r.mesajlar).toEqual([expect.objectContaining({ disKullaniciId: "TR.13491208655302741918", profilAdi: "Ayşe" })]);
    expect(a.telefon("TR.13491208655302741918")).toBeNull();
    expect(a.gorunenKimlik("TR.13491208655302741918")).toBe("WhatsApp kullanıcısı");
  });

  it("numara / kimlik değişikliği (type: system) konuşma mesajı sayılmaz", () => {
    const r = cevir(waMesaj({ type: "system", system: { type: "user_changed_number", body: "…" } }));
    expect(r).toMatchObject({ mesajlar: [], atlanan: 1 });
  });

  it("phone_number_id yoksa WHATSAPP_PHONE_ID, o da yoksa 'varsayilan'", () => {
    vi.stubEnv("WHATSAPP_PHONE_ID", "");
    expect(cevir(waMesaj(), { phoneNumberId: null }).mesajlar[0].kanalHesapId).toBe("varsayilan");
    vi.stubEnv("WHATSAPP_PHONE_ID", "ENV-PNID");
    expect(cevir(waMesaj(), { phoneNumberId: null }).mesajlar[0].kanalHesapId).toBe("ENV-PNID");
    expect(cevir(waMesaj(), { phoneNumberId: "PNID-9" }).mesajlar[0].kanalHesapId).toBe("PNID-9");
  });
});

describe("tür ve metin", () => {
  it.each([
    ["text", "metin", {}], ["image", "gorsel", {}], ["audio", "ses", {}], ["video", "video", {}], ["document", "dosya", {}],
    ["sticker", "gorsel", { kaynak_tur: "sticker" }], ["button", "metin", { kaynak_tur: "button" }], ["interactive", "metin", { kaynak_tur: "interactive" }],
    ["reaction", "tepki", { kaynak_tur: "reaction" }], ["location", "diger", { kaynak_tur: "location" }], ["contacts", "diger", { kaynak_tur: "contacts" }],
    ["unsupported", "diger", { kaynak_tur: "unsupported" }],
  ])("%s → %s", (wa, ortak, ek) => {
    expect(whatsappTuru(wa)).toEqual({ tur: ortak, ek });
  });

  it("metinsiz medya ve bilinmeyen tür kısa açıklamayla gelir", () => {
    expect(mesajMetni({ type: "image" })).toBe("📷 Fotoğraf");
    expect(mesajMetni({ type: "sticker" })).toBe("Çıkartma");
    expect(mesajMetni({ type: "unsupported" })).toBe("[unsupported]");
    expect(mesajMetni({ type: "location", location: { name: "Konya Sanayi" } })).toBe("📍 Konya Sanayi");
  });
});

describe("ek bilgi (kişisel veri yazılmaz)", () => {
  it("reklam yönlendirmesi yazılır, tıklama kimliği (ctwa_clid) yazılmaz", () => {
    const [m] = cevir(waMesaj({ referral: {
      source_url: "https://fb.me/abc", source_id: "REKLAM-9", source_type: "ad", headline: "ONE ile direksiyon testi", body: "Detaylar", media_type: "image", ctwa_clid: "GIZLI-TIKLAMA",
    } })).mesajlar;
    expect(m.ek).toEqual({ yonlendirme: { kaynak_turu: "ad", kaynak_id: "REKLAM-9", baslik: "ONE ile direksiyon testi", govde: "Detaylar", medya_turu: "image", kaynak_url: "https://fb.me/abc" } });
    expect(JSON.stringify(m)).not.toContain("GIZLI-TIKLAMA");
  });

  it("yanıtlanan mesajın kimliği yazılır, yanıtlananın telefonu (context.from) yazılmaz", () => {
    const [m] = cevir(waMesaj({ context: { from: "905559998877", id: "wamid.ONCEKI" } })).mesajlar;
    expect(m.ek).toEqual({ yanitlanan_mesaj_id: "wamid.ONCEKI" });
    expect(JSON.stringify(m)).not.toContain("905559998877");
  });

  it("dosyanın MIME türü yazılır, medya kimliği yazılmaz; tepkide tepki verilen mesaj yanıtlanan olarak yazılır", () => {
    const [d] = cevir(waMesaj({ type: "document", document: { id: "MEDYA-1", mime_type: "application/pdf", filename: "teklif.pdf" } })).mesajlar;
    expect(d).toMatchObject({ tur: "dosya", metin: "📄 teklif.pdf", ek: { ek_dosya_turu: "application/pdf" } });
    expect(JSON.stringify(d)).not.toContain("MEDYA-1");
    const [t] = cevir(waMesaj({ type: "reaction", reaction: { message_id: "wamid.BIZIM", emoji: "👍" } })).mesajlar;
    expect(t).toMatchObject({ tur: "tepki", metin: "Tepki: 👍", ek: { yanitlanan_mesaj_id: "wamid.BIZIM", kaynak_tur: "reaction" } });
  });

  it("konum mesajında koordinat ek bilgiye yazılmaz", () => {
    const [m] = cevir(waMesaj({ type: "location", location: { latitude: 37.87, longitude: 32.48 } })).mesajlar;
    expect(m.ek).toEqual({ kaynak_tur: "location" });
  });
});

describe("echo (WhatsApp Business uygulaması, smb_message_echoes)", () => {
  it("müşteriye BSUID ile yazılmışsa to_user_id kullanılır", () => {
    const r = a.webhookCevir(whatsappEchoGovdesi({ to: "", toUserId: "TR.999", id: "wamid.E1" }));
    expect(r.mesajlar).toEqual([expect.objectContaining({ echo: true, disKullaniciId: "TR.999" })]);
  });

  it("silme / düzenleme bildirimleri işlenmez", () => {
    for (const type of ["revoke", "edit"]) {
      const r = a.webhookCevir(whatsappEchoGovdesi({ type, ek: { [type]: { original_message_id: "wamid.X" } } }));
      expect(r).toMatchObject({ mesajlar: [], atlanan: 1 });
    }
  });
});

describe("teslim durumu", () => {
  it("played okundu sayılır, bilinmeyen durum atlanır, hata kodu taşınır", () => {
    const r = a.webhookCevir(whatsappGovdesi({ durumlar: [
      { id: "wamid.1", status: "played", timestamp: "1763460000" },
      { id: "wamid.2", status: "deleted", timestamp: "1763460000" },
      { id: "wamid.3", status: "failed", timestamp: "1763460000", errors: [{ code: 131047 }] },
    ] }));
    expect(r.durumlar).toEqual([
      { disMesajId: "wamid.1", durum: "okundu", zaman: new Date(1763460000_000).toISOString() },
      { disMesajId: "wamid.3", durum: "basarisiz", zaman: new Date(1763460000_000).toISOString(), hataKodu: "131047" },
    ]);
    expect(r.atlanan).toBe(1);
  });
});

describe("gönderim gövdesi", () => {
  const ortam = () => {
    vi.stubEnv("META_GRAPH_URL", meta.adres);
    vi.stubEnv("WHATSAPP_TOKEN", VARSAYILAN_TOKENLAR.whatsapp);
    vi.stubEnv("WHATSAPP_PHONE_ID", "PNID-ENV");
  };

  it("telefona `to` ile, önizlemesiz metin gönderir; konuşmanın numarasından", async () => {
    ortam();
    await a.gonder({ kanalHesapId: "PNID-1", disKullaniciId: "+905321112233" }, { tur: "metin", metin: "Merhaba" });
    expect(meta.gonderimler().at(-1)!.hesap).toBe("PNID-1");
    expect(meta.gonderilenler()[0]).toEqual({
      messaging_product: "whatsapp", recipient_type: "individual", to: "905321112233", type: "text", text: { body: "Merhaba", preview_url: false },
    });
  });

  it("telefonu olmayan kişiye BSUID ile `recipient` kullanır; 'varsayilan' hesapta WHATSAPP_PHONE_ID'den gönderir", async () => {
    ortam();
    await a.gonder({ kanalHesapId: "varsayilan", disKullaniciId: "TR.999" }, { tur: "metin", metin: "Merhaba" });
    expect(meta.gonderimler().at(-1)!.hesap).toBe("PNID-ENV");
    expect(meta.gonderilenler()[0]).toMatchObject({ recipient: "TR.999" });
    expect(meta.gonderilenler()[0]).not.toHaveProperty("to");
  });
});

describe("metniBol (ortak yardımcı)", () => {
  it("paragraf sınırını cümleden, cümleyi kelimeden önce tercih eder", () => {
    expect(metniBol("Birinci paragraf.\n\nİkinci paragraf.", 20)).toEqual(["Birinci paragraf.", "İkinci paragraf."]);
    expect(metniBol("Bir iki üç. Dört beş altı.", 15)).toEqual(["Bir iki üç.", "Dört beş altı."]);
    expect(metniBol("bir iki üç dört", 8)).toEqual(["bir iki", "üç dört"]);
  });

  it("bayt ölçüsüyle (Instagram) Türkçe karakterleri iki bayt sayar", () => {
    const p = metniBol("çğış çğış çğış", 10, utf8BaytSay);
    for (const x of p) expect(utf8BaytSay(x)).toBeLessThanOrEqual(10);
    expect(p.join(" ")).toBe("çğış çğış çğış");
  });
});
