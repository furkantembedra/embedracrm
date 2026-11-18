// components/whatsapp/isle.ts kuralları: açık fırsata ekleme, yeni lead açma, müşteri yetkilisi eşleşmesi,
// aynı mesajın iki kez (sırayla ve aynı anda) gelmesi, hata olursa mesajın geri alınması.
// Veritabanı yerine bellek içi depo kullanılır (test/sahte/depo.ts); dis_mesaj_id tekilliğini depo uygular.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { depo, depoyuSifirla, firsatEkle, musteriEkle } from "./sahte/depo";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/db", async () => (await import("./sahte/depo")).dbModulu);
vi.mock("@/components/konusma/queries", async () => (await import("./sahte/depo")).konusmaModulu);
vi.mock("@/components/satis-hatti/queries", async () => (await import("./sahte/depo")).satisHattiModulu);
vi.mock("@/components/musteriler/queries", async () => (await import("./sahte/depo")).musteriModulu);

const { whatsappMesajiIsle } = await import("@/components/whatsapp/isle");

let sira = 0;
const mesaj = (waId: string, metin = "Merhaba, fiyat alabilir miyim?", ek: Partial<Parameters<typeof whatsappMesajiIsle>[0]> = {}) => ({
  waId, ad: "Ahmet Usta", metin, tur: "text", mesajId: `wamid.TEST${++sira}`, zaman: "2026-11-18T10:00:00.000Z", ...ek,
});

beforeEach(() => depoyuSifirla());

describe("açık fırsata ekleme", () => {
  it("numara açık bir fırsatta kayıtlıysa mesaj o fırsata eklenir, yeni lead açılmaz", async () => {
    firsatEkle({ id: "3", firma: "Konya Direksiyon Merkezi", telefon: "+90 532 111 22 33", asama: "demo", sonrakiAdim: "Demo yap" });
    const s = await whatsappMesajiIsle(mesaj("905321112233"));
    expect(s?.yeni).toBe(false);
    expect(s?.firsat.id).toBe("3");
    expect(s?.firsat.sonrakiAdim).toBe("WhatsApp'tan dönüş yap");
    expect(s?.firsat.mesajlar).toEqual([expect.objectContaining({ metin: "Merhaba, fiyat alabilir miyim?", yon: "gelen" })]);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.konusmalar).toEqual([expect.objectContaining({ kanal: "whatsapp", disKullaniciId: "+905321112233", satisHattiId: 3, sonMusteriMesaji: "2026-11-18T10:00:00.000Z" })]);
  });

  it("aynı numaranın birden çok açık fırsatı varsa en yenisine ekler", async () => {
    firsatEkle({ id: "3", telefon: "+905321112233", asama: "teklif" });
    firsatEkle({ id: "7", telefon: "0532 111 22 33", asama: "yeni" });
    expect((await whatsappMesajiIsle(mesaj("905321112233")))?.firsat.id).toBe("7");
  });

  it("aynı numaranın yalnızca kapalı (kazanıldı / kaybedildi) fırsatı varsa yeni lead açar", async () => {
    firsatEkle({ id: "3", telefon: "+905321112233", asama: "kazanildi" });
    firsatEkle({ id: "4", telefon: "+905321112233", asama: "kaybedildi" });
    const s = await whatsappMesajiIsle(mesaj("905321112233"));
    expect(s?.yeni).toBe(true);
    expect(depo.firsatlar).toHaveLength(3);
  });
});

describe("yeni lead açma", () => {
  it("bilinmeyen numaradan gelen mesaj 'Yeni lead' aşamasında WhatsApp kaynaklı fırsat açar", async () => {
    const s = await whatsappMesajiIsle(mesaj("905339998877"));
    expect(s?.yeni).toBe(true);
    expect(s?.firsat).toMatchObject({ firma: "Ahmet Usta", kaynak: "WhatsApp", asama: "yeni", telefon: "+905339998877", konum: "Türkiye", sonrakiAdim: "WhatsApp'tan dönüş yap" });
    expect(s?.firsat.mesajlar).toHaveLength(1);
    expect(depo.konusmalar[0]).toMatchObject({ satisHattiId: Number(s!.firsat.id), musteriId: null });
  });

  it("profil adı yoksa firma adı olarak okunur telefon kullanılır; yurt dışı numarada konum boş kalır", async () => {
    const s = await whatsappMesajiIsle(mesaj("497115550142", "Hallo", { ad: "  " }));
    expect(s?.firsat).toMatchObject({ firma: "+497115550142", konum: "—" });
  });

  it("metinsiz medya mesajı tür açıklamasıyla kaydedilir", async () => {
    const s = await whatsappMesajiIsle(mesaj("905339998877", "", { tur: "image" }));
    expect(s?.firsat.mesajlar?.[0].metin).toBe("📷 Fotoğraf");
  });

  it("çözülemeyen numara hiçbir şey yazmadan null döner", async () => {
    expect(await whatsappMesajiIsle(mesaj("123"))).toBeNull();
    expect(depo.konusmalar).toHaveLength(0);
    expect(depo.mesajlar).toHaveLength(0);
    expect(depo.firsatlar).toHaveLength(0);
  });
});

describe("müşteri yetkilisi eşleşmesi", () => {
  it("numara bir müşteri yetkilisine aitse firma ve konum müşteriden alınır, mesaj müşterinin zaman çizelgesine düşer", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu", sehir: "İzmir", ulke: "Türkiye" }, "0 532 444 55 66");
    const s = await whatsappMesajiIsle(mesaj("905324445566", "Lisans yenileme hakkında bilgi alabilir miyim?"));
    expect(s?.yeni).toBe(true);
    expect(s?.firsat).toMatchObject({ firma: "Ege Meslek Yüksekokulu", konum: "İzmir, Türkiye" });
    const m = depo.musteriler[0];
    expect(m.sonTemas).toBe("Bugün");
    expect(m.olaylar[0]).toMatchObject({ metin: "WhatsApp: “Lisans yenileme hakkında bilgi alabilir miyim?”", tur: "arama" });
    expect(depo.konusmalar[0].musteriId).toBe(5);
  });

  it("yetkilinin açık fırsatı varsa yeni lead açmaz ama zaman çizelgesine yine yazar", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu", sehir: "İzmir", ulke: "Türkiye" }, "+905324445566");
    firsatEkle({ id: "9", firma: "Ege Meslek Yüksekokulu", telefon: "+905324445566", asama: "muzakere" });
    const s = await whatsappMesajiIsle(mesaj("905324445566"));
    expect(s?.yeni).toBe(false);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.musteriler[0].olaylar).toHaveLength(1);
  });

  it("numara kimseye ait değilse müşteriye dokunulmaz", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu" }, "+905324445566");
    await whatsappMesajiIsle(mesaj("905339998877"));
    expect(depo.musteriler[0].olaylar).toHaveLength(0);
  });
});

describe("aynı mesajın iki kez gelmesi", () => {
  it("Meta aynı mesajı tekrar gönderirse ikincisi işlenmez", async () => {
    const m = mesaj("905339998877");
    expect(await whatsappMesajiIsle(m)).not.toBeNull();
    expect(await whatsappMesajiIsle(m)).toBeNull();
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.mesajlar).toHaveLength(1);
  });

  it("aynı mesaj iki webhook'la aynı anda gelirse yalnızca biri işlenir", async () => {
    const m = mesaj("905339998877");
    const sonuclar = await Promise.all([whatsappMesajiIsle(m), whatsappMesajiIsle({ ...m })]);
    expect(sonuclar.filter(Boolean)).toHaveLength(1);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.mesajlar).toHaveLength(1);
    expect(depo.konusmalar).toHaveLength(1);
  });

  it("aynı numaradan gelen farklı mesajlar aynı konuşmada toplanır", async () => {
    await whatsappMesajiIsle(mesaj("905339998877", "Merhaba"));
    const s = await whatsappMesajiIsle(mesaj("905339998877", "Fiyat?"));
    expect(s?.yeni).toBe(false);
    expect(s?.firsat.mesajlar?.map((x) => x.metin)).toEqual(["Merhaba", "Fiyat?"]);
    expect(depo.konusmalar).toHaveLength(1);
  });
});

describe("hata olursa", () => {
  it("fırsat açılamazsa mesaj geri alınır; Meta tekrar gönderince işlenir", async () => {
    const m = mesaj("905339998877");
    depo.firsatEklemeHatasi = new Error("Fırsat kaydedilirken başarısız: bağlantı koptu");
    await expect(whatsappMesajiIsle(m)).rejects.toThrow(/bağlantı koptu/);
    expect(depo.mesajlar).toHaveLength(0);
    expect(depo.firsatlar).toHaveLength(0);
    const s = await whatsappMesajiIsle(m);
    expect(s?.yeni).toBe(true);
    expect(depo.mesajlar).toHaveLength(1);
  });
});
