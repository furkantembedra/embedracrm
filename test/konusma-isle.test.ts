// Kanaldan bağımsız konuşma çekirdeği (components/konusma/isle.ts) kuralları, webhook'la aynı yoldan:
// mesaj kuyruğa yazılır (kuyrugaYaz) → işleyici işler (kuyruguIsle). Kurallar P0.3'teki isle.ts testleriyle aynı:
// açık fırsata ekleme, yeni lead açma, müşteri yetkilisi eşleşmesi, aynı mesajın iki kez gelmesi, hata olursa tekrar.
// P1.1 ekleri: kişi eşleştirmesi kanal + hesap + kullanıcı kimliğiyle, telefonsuz kimlik (BSUID), echo kuralı.
// Veritabanı yerine bellek içi depo (test/sahte/depo.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { depo, depoyuSifirla, firsatEkle, firsatMesajlari, musteriEkle } from "./sahte/depo";
import type { GelenMesaj } from "@/components/konusma/kanallar/tur";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/db", async () => (await import("./sahte/depo")).dbModulu);
vi.mock("@/components/konusma/queries", async () => (await import("./sahte/depo")).konusmaModulu);
vi.mock("@/components/satis-hatti/queries", async () => (await import("./sahte/depo")).satisHattiModulu);
vi.mock("@/components/musteriler/queries", async () => (await import("./sahte/depo")).musteriModulu);

const { kuyrugaYaz, kuyruguIsle } = await import("@/components/konusma/kuyruk");
const { getFirsat } = await import("@/components/satis-hatti/queries");

let sira = 0;
const mesaj = (disKullaniciId: string, metin = "Merhaba, fiyat alabilir miyim?", ek: Partial<GelenMesaj> = {}): GelenMesaj => ({
  kanal: "whatsapp", kanalHesapId: "varsayilan", disKullaniciId, disMesajId: `wamid.TEST${++sira}`, tur: "metin", metin, ek: {},
  zaman: "2026-11-18T10:00:00.000Z", echo: false, profilAdi: "Ahmet Usta", ...ek,
});

/** Webhook gibi kuyruğa yazar, işleyiciyi çalıştırır; mesaj işlendiyse fırsatı döner, tekrar ise null */
async function isle(m: GelenMesaj) {
  const [kayit] = await kuyrugaYaz([m]);
  if (!kayit) return null;
  const r = await kuyruguIsle();
  const s = r.sonuclar.find((x) => x.mesajId === kayit.mesajId);
  if (!s) throw new Error(`işlenmedi: ${JSON.stringify(r)}`);
  return { yeni: s.yeni, firsat: s.firsatId ? (await getFirsat(s.firsatId))! : null };
}

beforeEach(() => depoyuSifirla());

describe("açık fırsata ekleme", () => {
  it("numara açık bir fırsatta kayıtlıysa mesaj o fırsata eklenir, yeni lead açılmaz", async () => {
    firsatEkle({ id: "3", firma: "Konya Direksiyon Merkezi", telefon: "+90 532 111 22 33", asama: "demo", sonrakiAdim: "Demo yap" });
    const s = await isle(mesaj("+905321112233"));
    expect(s?.yeni).toBe(false);
    expect(s?.firsat?.id).toBe("3");
    expect(s?.firsat?.sonrakiAdim).toBe("WhatsApp'tan dönüş yap");
    expect(firsatMesajlari(s?.firsat?.id)).toEqual([expect.objectContaining({ metin: "Merhaba, fiyat alabilir miyim?", yon: "gelen" })]);
    expect(s?.firsat?.konusma).toMatchObject({ kanal: "whatsapp", sonMesaj: { metin: "Merhaba, fiyat alabilir miyim?", yon: "gelen", gonderen: "musteri" } });
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.konusmalar).toEqual([expect.objectContaining({ kanal: "whatsapp", disKullaniciId: "+905321112233", satisHattiId: 3, sonMusteriMesaji: "2026-11-18T10:00:00.000Z" })]);
  });

  it("aynı numaranın birden çok açık fırsatı varsa en yenisine ekler", async () => {
    firsatEkle({ id: "3", telefon: "+905321112233", asama: "teklif" });
    firsatEkle({ id: "7", telefon: "0532 111 22 33", asama: "yeni" });
    expect((await isle(mesaj("+905321112233")))?.firsat?.id).toBe("7");
  });

  it("aynı numaranın yalnızca kapalı (kazanıldı / kaybedildi) fırsatı varsa yeni lead açar", async () => {
    firsatEkle({ id: "3", telefon: "+905321112233", asama: "kazanildi" });
    firsatEkle({ id: "4", telefon: "+905321112233", asama: "kaybedildi" });
    const s = await isle(mesaj("+905321112233"));
    expect(s?.yeni).toBe(true);
    expect(depo.firsatlar).toHaveLength(3);
  });
});

describe("yeni lead açma", () => {
  it("bilinmeyen numaradan gelen mesaj 'Yeni lead' aşamasında kanalın kaynağıyla fırsat açar", async () => {
    const s = await isle(mesaj("+905339998877"));
    expect(s?.yeni).toBe(true);
    expect(s?.firsat).toMatchObject({ firma: "Ahmet Usta", kaynak: "WhatsApp", asama: "yeni", telefon: "+905339998877", konum: "Türkiye", sonrakiAdim: "WhatsApp'tan dönüş yap" });
    expect(firsatMesajlari(s?.firsat?.id)).toHaveLength(1);
    expect(depo.konusmalar[0]).toMatchObject({ satisHattiId: Number(s!.firsat!.id), musteriId: null });
  });

  it("profil adı yoksa firma adı olarak okunur telefon kullanılır; yurt dışı numarada konum boş kalır", async () => {
    const s = await isle(mesaj("+497115550142", "Hallo", { profilAdi: "  " }));
    expect(s?.firsat).toMatchObject({ firma: "+497115550142", konum: "—" });
    const t = await isle(mesaj("+905339998877", "Merhaba", { profilAdi: undefined }));
    expect(t?.firsat?.firma).toBe("+90 533 999 88 77");
  });

  it("telefonsuz kimlikle (WhatsApp kullanıcı adı / BSUID) gelen mesaj da lead açar; telefon alanı boş kalır", async () => {
    const s = await isle(mesaj("TR.13491208655302741918", "Merhaba", { profilAdi: undefined }));
    expect(s?.yeni).toBe(true);
    expect(s?.firsat).toMatchObject({ firma: "WhatsApp kullanıcısı", konum: "—", kaynak: "WhatsApp" });
    expect(s?.firsat?.telefon).toBeUndefined();
  });
});

describe("kişi eşleştirmesi: kanal + hesap + dış kullanıcı kimliği", () => {
  it("konuşmanın bağlı fırsatı açıksa telefonu fırsatta yazılı olmasa da mesaj ona eklenir", async () => {
    const ilk = await isle(mesaj("TR.BSUID1", "Merhaba"));
    const ikinci = await isle(mesaj("TR.BSUID1", "Fiyat?"));
    expect(ikinci?.yeni).toBe(false);
    expect(ikinci?.firsat?.id).toBe(ilk?.firsat?.id);
    expect(firsatMesajlari(ikinci?.firsat?.id).map((x) => x.metin)).toEqual(["Merhaba", "Fiyat?"]);
  });

  it("konuşmanın fırsatı kapanmışsa (ve telefonla açık fırsat yoksa) yeni lead açılır", async () => {
    const ilk = await isle(mesaj("TR.BSUID1", "Merhaba"));
    depo.firsatlar.find((f) => f.id === ilk!.firsat!.id)!.asama = "kaybedildi";
    const ikinci = await isle(mesaj("TR.BSUID1", "Yeniden merhaba"));
    expect(ikinci?.yeni).toBe(true);
    expect(depo.firsatlar).toHaveLength(2);
    expect(depo.konusmalar).toHaveLength(1);
    expect(depo.konusmalar[0].satisHattiId).toBe(Number(ikinci!.firsat!.id));
  });

  it("aynı kullanıcı kimliği başka hesapta ayrı konuşmadır", async () => {
    await isle(mesaj("TR.BSUID1", "Merhaba", { kanalHesapId: "PNID-1" }));
    await isle(mesaj("TR.BSUID1", "Merhaba", { kanalHesapId: "PNID-2" }));
    expect(depo.konusmalar.map((k) => k.kanalHesapId)).toEqual(["PNID-1", "PNID-2"]);
    expect(depo.firsatlar).toHaveLength(2); // telefon yok: hesaplar arası eşleşme yapılmaz (P4.4 kanal birleştirme)
  });

  it("aynı telefon başka WhatsApp numarasına yazarsa ayrı konuşmadır ama telefonla aynı açık fırsata eklenir", async () => {
    await isle(mesaj("+905339998877", "Merhaba", { kanalHesapId: "PNID-1" }));
    await isle(mesaj("+905339998877", "Merhaba", { kanalHesapId: "PNID-2" }));
    expect(depo.konusmalar.map((k) => k.kanalHesapId)).toEqual(["PNID-1", "PNID-2"]);
    expect(depo.firsatlar).toHaveLength(1);
  });
});

describe("müşteri yetkilisi eşleşmesi", () => {
  it("numara bir müşteri yetkilisine aitse firma ve konum müşteriden alınır, mesaj müşterinin zaman çizelgesine düşer", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu", sehir: "İzmir", ulke: "Türkiye" }, "0 532 444 55 66");
    const s = await isle(mesaj("+905324445566", "Lisans yenileme hakkında bilgi alabilir miyim?"));
    expect(s?.yeni).toBe(true);
    expect(s?.firsat).toMatchObject({ firma: "Ege Meslek Yüksekokulu", konum: "İzmir, Türkiye" });
    const m = depo.musteriler[0];
    expect(m.sonTemas).toBe("Bugün");
    expect(m.olaylar[0]).toMatchObject({ metin: "WhatsApp: “Lisans yenileme hakkında bilgi alabilir miyim?”", zaman: "Bugün · WhatsApp", tur: "arama" });
    expect(depo.konusmalar[0].musteriId).toBe(5);
  });

  it("yetkilinin açık fırsatı varsa yeni lead açmaz ama zaman çizelgesine yine yazar", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu", sehir: "İzmir", ulke: "Türkiye" }, "+905324445566");
    firsatEkle({ id: "9", firma: "Ege Meslek Yüksekokulu", telefon: "+905324445566", asama: "muzakere" });
    const s = await isle(mesaj("+905324445566"));
    expect(s?.yeni).toBe(false);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.musteriler[0].olaylar).toHaveLength(1);
  });

  it("konuşma müşteriye bağlandıktan sonra sonraki mesajlar da zaman çizelgesine düşer", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu" }, "+905324445566");
    await isle(mesaj("+905324445566", "Bir"));
    depo.yetkililer = []; // yetkili kaydı değişse de konuşmanın müşterisi bilinir
    await isle(mesaj("+905324445566", "İki"));
    expect(depo.musteriler[0].olaylar.map((o) => o.metin)).toEqual(["WhatsApp: “İki”", "WhatsApp: “Bir”"]);
  });

  it("numara kimseye ait değilse müşteriye dokunulmaz", async () => {
    musteriEkle({ id: "5", ad: "Ege Meslek Yüksekokulu" }, "+905324445566");
    await isle(mesaj("+905339998877"));
    expect(depo.musteriler[0].olaylar).toHaveLength(0);
  });
});

describe("aynı mesajın iki kez gelmesi", () => {
  it("Meta aynı mesajı tekrar gönderirse ikincisi kaydedilmez ve işlenmez", async () => {
    const m = mesaj("+905339998877");
    expect(await isle(m)).not.toBeNull();
    expect(await isle(m)).toBeNull();
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.mesajlar).toHaveLength(1);
    expect(depo.isler).toHaveLength(1);
  });

  it("aynı mesaj iki webhook'la aynı anda gelirse yalnızca biri kaydedilir", async () => {
    const m = mesaj("+905339998877");
    const kayitlar = await Promise.all([kuyrugaYaz([m]), kuyrugaYaz([{ ...m }])]);
    expect(kayitlar.flat()).toHaveLength(1);
    await kuyruguIsle();
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.mesajlar).toHaveLength(1);
    expect(depo.konusmalar).toHaveLength(1);
  });

  it("aynı numaradan gelen farklı mesajlar aynı konuşmada toplanır", async () => {
    await isle(mesaj("+905339998877", "Merhaba"));
    const s = await isle(mesaj("+905339998877", "Fiyat?"));
    expect(s?.yeni).toBe(false);
    expect(firsatMesajlari(s?.firsat?.id).map((x) => x.metin)).toEqual(["Merhaba", "Fiyat?"]);
    expect(depo.konusmalar).toHaveLength(1);
  });
});

describe("hata olursa", () => {
  it("fırsat açılamazsa mesaj kayıtlı kalır, iş tekrar beklemesine alınır; zamanı gelince işlenir", async () => {
    const m = mesaj("+905339998877");
    depo.firsatEklemeHatasi = new Error("Fırsat kaydedilirken başarısız: bağlantı koptu");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await kuyrugaYaz([m]);
    const r = await kuyruguIsle();
    expect(r).toMatchObject({ islenen: 0, hatali: 1 });
    expect(depo.mesajlar).toHaveLength(1);
    expect(depo.firsatlar).toHaveLength(0);
    expect(depo.isler[0]).toMatchObject({ durum: "bekliyor", deneme: 1, sonHata: expect.stringContaining("bağlantı koptu") });
    expect(depo.isler[0].sonrakiDeneme).toBeGreaterThan(Date.now() + 25_000);
    expect(depo.konusmalar[0].kilitSahibi).toBeNull(); // kilit bırakıldı

    expect((await kuyruguIsle()).islenen).toBe(0); // zamanı gelmedi
    depo.isler[0].sonrakiDeneme = 0;
    const r2 = await kuyruguIsle();
    expect(r2.sonuclar).toEqual([expect.objectContaining({ yeni: true })]);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.isler[0].durum).toBe("tamam");
  });

  it("5 denemeden sonra iş 'hata'da kalır ve konuşmanın sonraki işleri devam eder", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await kuyrugaYaz([mesaj("+905339998877", "Bir")]);
    for (let i = 0; i < 5; i++) {
      depo.firsatEklemeHatasi = new Error("bozuk");
      depo.isler[0].sonrakiDeneme = 0;
      await kuyruguIsle();
    }
    expect(depo.isler[0]).toMatchObject({ durum: "hata", deneme: 5 });
    await kuyrugaYaz([mesaj("+905339998877", "İki")]);
    expect((await kuyruguIsle()).islenen).toBe(1);
    expect(depo.firsatlar).toHaveLength(1);
  });

  it("hatalı işin arkasındaki işler sırayı korumak için bekler", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    depo.firsatEklemeHatasi = new Error("bozuk");
    await kuyrugaYaz([mesaj("+905339998877", "Bir"), mesaj("+905339998877", "İki")]);
    await kuyruguIsle();
    expect(depo.isler.map((i) => i.durum)).toEqual(["bekliyor", "bekliyor"]);
    expect(depo.mesajlar.every((m) => m.satisHattiId == null)).toBe(true);
  });
});

describe("echo: işletme hesabından CRM dışında yazılan mesaj", () => {
  it("gönderen temsilci olarak yazılır, konuşmanın fırsatına bağlanır ve bot susar ('temsilci yazdı')", async () => {
    const ilk = await isle(mesaj("+905339998877", "Merhaba"));
    expect(depo.konusmalar[0].botAktif).toBe(true);
    const e = await isle(mesaj("+905339998877", "Merhaba, size nasıl yardımcı olabiliriz?", { echo: true, profilAdi: undefined }));
    expect(e).toMatchObject({ yeni: false });
    expect(depo.mesajlar[1]).toMatchObject({ yon: "giden", gonderen: "temsilci", satisHattiId: Number(ilk!.firsat!.id) });
    expect(depo.konusmalar[0].botAktif).toBe(false);
    expect(depo.firsatlar).toHaveLength(1);
    expect(depo.konusmalar[0].sonMusteriMesaji).toBe("2026-11-18T10:00:00.000Z"); // echo pencereyi açmaz
  });

  it("işletme yeni bir numaraya ilk yazan tarafsa lead açılmaz, mesaj konuşmaya kaydedilir", async () => {
    const e = await isle(mesaj("+905339998877", "Merhaba, teklifiniz hazır", { echo: true }));
    expect(e).toEqual({ yeni: false, firsat: null });
    expect(depo.firsatlar).toHaveLength(0);
    expect(depo.konusmalar[0]).toMatchObject({ botAktif: false, sonMusteriMesaji: null, profilAdi: null });
  });

  it("CRM'in / botun kendi gönderdiği mesajın echo'su dis_mesaj_id ile tanınır, ikinci kez yazılmaz ve bot susmaz", async () => {
    await isle(mesaj("+905339998877", "Merhaba"));
    const { gidenMesajKaydet } = await import("@/components/konusma/queries");
    await gidenMesajKaydet({ konusmaId: depo.konusmalar[0].id, gonderen: "bot", disMesajId: "wamid.BOT1", metin: "Merhaba, ben Embedra asistanı.", tur: "metin", zaman: "2026-11-18T10:00:05.000Z" });
    expect(await isle(mesaj("+905339998877", "Merhaba, ben Embedra asistanı.", { echo: true, disMesajId: "wamid.BOT1" }))).toBeNull();
    expect(depo.mesajlar.filter((m) => m.disMesajId === "wamid.BOT1")).toEqual([expect.objectContaining({ gonderen: "bot" })]);
    expect(depo.konusmalar[0].botAktif).toBe(true);
  });
});

describe("tür ve ek bilgi", () => {
  it("adaptörün verdiği ortak tür ve ek bilgi olduğu gibi yazılır; profil adı konuşmada güncellenir", async () => {
    await isle(mesaj("+905339998877", "📷 Fotoğraf", { tur: "gorsel", ek: { ek_dosya_turu: "image/jpeg" } }));
    await isle(mesaj("+905339998877", "Evet", { ek: { yanitlanan_mesaj_id: "wamid.BIZIM", kaynak_tur: "interactive" }, profilAdi: "Ahmet Yılmaz" }));
    expect(depo.mesajlar.map((m) => [m.tur, m.ek])).toEqual([
      ["gorsel", { ek_dosya_turu: "image/jpeg" }],
      ["metin", { yanitlanan_mesaj_id: "wamid.BIZIM", kaynak_tur: "interactive" }],
    ]);
    expect(depo.konusmalar[0].profilAdi).toBe("Ahmet Yılmaz");
  });

  it("adaptörü olmayan kanalın işi hata verir (kanal adına göre dal yok, adaptör zorunlu)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await kuyrugaYaz([mesaj("IGSID-1", "Merhaba", { kanal: "instagram", kanalHesapId: "IG-1" })]);
    const r = await kuyruguIsle();
    expect(r.hatali).toBe(1);
    expect(depo.isler[0].sonHata).toContain("Kanal adaptörü yok");
  });
});
