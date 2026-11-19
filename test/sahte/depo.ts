// Konuşma çekirdeği (components/konusma/isle.ts, kuyruk.ts, gonder.ts) testleri için bellek içi depo. Kullandıkları
// modüllerin (konuşma sorguları, satış hattı, müşteri, supabase db) yerine geçer ve veritabanının bu testler için önemli
// kurallarını taşır (SQL karşılıkları 20261119100706_konusma_kuyrugu.sql; aynı kurallar PGlite'ta test/kuyruk-sema.test.ts'te):
//  • konuşma (kanal, kanal_hesap_id, dis_kullanici_id) ve konusma_mesajlari.dis_mesaj_id tekil (ikinci yazma reddedilir)
//  • gelen_mesaj_kaydet: konuşma + mesaj + kuyruk işi tek adımda (araya başka istek girmez, SQL'de tek işlem)
//  • konuşma kilidi: kilitsiz ya da süresi geçmiş, en eski bekleyen işinin zamanı gelmiş konuşma alınır; sahibi bırakır
// Her çağrı bir olay döngüsü turu bekler, böylece eşzamanlı istekler gerçek veritabanındaki gibi iç içe geçer.
import type { Firsat, WhatsappMesaji } from "@/components/satis-hatti/queries";
import type { Musteri } from "@/components/musteriler/queries";
import { KAPALI_ASAMALAR } from "@/components/satis-hatti/sabitler";
import { telefonNormalize } from "@/components/whatsapp/telefon";
import type { GelenKayit, Kanal, KuyrukIsi, KuyrukKonusmasi, YeniMesaj } from "@/components/konusma/queries";

type Konusma = {
  id: number; kanal: Kanal; kanalHesapId: string; disKullaniciId: string; satisHattiId: number | null; musteriId: number | null;
  sonMusteriMesaji: string | null; profilAdi: string | null; botAktif: boolean; kilitSahibi: string | null; kilitBitis: number;
};
type Mesaj = YeniMesaj & { id: number };
type Is = { id: number; konusmaId: number; mesajId: number; tur: "musteri_mesaji" | "temsilci_mesaji"; durum: "bekliyor" | "tamam" | "hata"; deneme: number; sonrakiDeneme: number; sonHata: string | null };
type Yetkili = { musteri_id: number; y_tel: string; y_sira: number };

export const depo = {
  firsatlar: [] as Firsat[],
  musteriler: [] as Musteri[],
  yetkililer: [] as Yetkili[],
  konusmalar: [] as Konusma[],
  mesajlar: [] as Mesaj[],
  isler: [] as Is[],
  /** Bir sonraki firsatEkleDepo çağrısı bu hatayı fırlatır (hata sonrası geri alma testi) */
  firsatEklemeHatasi: null as Error | null,
  sayac: 100,
  /** Test için: konuşma kilidini yok sayar (kilit olmasa ne olurdu?) */
  kilitDevreDisi: false,
  /** Fırsat yazan işlemlerin (işleyicinin kritik bölümü) aynı anda en çok kaç tane çalıştığı */
  aktifYazma: 0,
  enCokAktifYazma: 0,
};

export function depoyuSifirla() {
  depo.firsatlar = [];
  depo.musteriler = [];
  depo.yetkililer = [];
  depo.konusmalar = [];
  depo.mesajlar = [];
  depo.isler = [];
  depo.firsatEklemeHatasi = null;
  depo.sayac = 100;
  depo.kilitDevreDisi = false;
  depo.aktifYazma = 0;
  depo.enCokAktifYazma = 0;
}

/** Gerçek veritabanı gibi araya başka isteklerin girebilmesi için bir olay döngüsü turu bekler */
const tur = () => new Promise((r) => setTimeout(r, 0));
const kopya = <T>(x: T): T => structuredClone(x);

export function firsatEkle(f: Partial<Firsat> & { id: string }) {
  depo.firsatlar.push({
    firma: "Örnek Firma", konum: "Türkiye", kaynak: "Web sitesi", icerik: "", tutar: 0, asama: "yeni",
    sonrakiAdim: "", sonrakiTarih: "", kampanyaId: null, ...f,
  });
}

export function musteriEkle(m: Partial<Musteri> & { id: string; ad: string }, telefon: string) {
  depo.musteriler.push({
    sehir: "", ulke: "", segment: "servis", plan: "Lead", lisansBitis: null, toplamDeger: null, sonTemas: "1 Kas",
    durum: "Aktif", yetkililer: [], vergiNo: "", acikTalep: 0, cihazlar: [], olaylar: [], ...m,
  } as Musteri);
  depo.yetkililer.push({ musteri_id: Number(m.id), y_tel: telefon, y_sira: 0 });
}

/* ---------- @/components/konusma/queries ---------- */
const konusmaBul = (id: number) => depo.konusmalar.find((x) => x.id === id)!;
const kilitli = (k: Konusma) => !depo.kilitDevreDisi && k.kilitSahibi !== null && k.kilitBitis >= Date.now();
const bekleyenler = (konusmaId: number) => depo.isler.filter((i) => i.konusmaId === konusmaId && i.durum === "bekliyor").sort((a, b) => a.id - b.id);
const basZamaniGeldi = (konusmaId: number) => {
  const bas = bekleyenler(konusmaId)[0];
  return !!bas && bas.sonrakiDeneme <= Date.now();
};
const konusmaGorunumu = (k: Konusma): KuyrukKonusmasi => ({
  id: k.id, kanal: k.kanal, kanalHesapId: k.kanalHesapId, disKullaniciId: k.disKullaniciId, satisHattiId: k.satisHattiId,
  musteriId: k.musteriId, profilAdi: k.profilAdi, sonMusteriMesaji: k.sonMusteriMesaji,
});

export const konusmaModulu = {
  VARSAYILAN_KANAL_HESABI: "varsayilan",
  async gelenMesajKaydet(m: GelenKayit) {
    await tur();
    // SQL'de tek işlem: bu blokta await yok, araya başka istek giremez
    let k = depo.konusmalar.find((x) => x.kanal === m.kanal && x.kanalHesapId === m.kanalHesapId && x.disKullaniciId === m.disKullaniciId);
    if (!k) {
      k = { id: ++depo.sayac, kanal: m.kanal, kanalHesapId: m.kanalHesapId, disKullaniciId: m.disKullaniciId, satisHattiId: null, musteriId: null,
        sonMusteriMesaji: null, profilAdi: null, botAktif: true, kilitSahibi: null, kilitBitis: 0 };
      depo.konusmalar.push(k);
    }
    if (depo.mesajlar.some((x) => x.disMesajId === m.disMesajId)) return null; // unique: on conflict do nothing
    const musteri = m.gonderen === "musteri";
    const mesajId = ++depo.sayac;
    depo.mesajlar.push({ id: mesajId, konusmaId: k.id, yon: musteri ? "gelen" : "giden", gonderen: m.gonderen, disMesajId: m.disMesajId, metin: m.metin, tur: m.tur, ek: m.ek, zaman: m.zaman, satisHattiId: null });
    depo.isler.push({ id: ++depo.sayac, konusmaId: k.id, mesajId, tur: musteri ? "musteri_mesaji" : "temsilci_mesaji", durum: "bekliyor", deneme: 0, sonrakiDeneme: 0, sonHata: null });
    if (musteri) {
      if (!k.sonMusteriMesaji || m.zaman > k.sonMusteriMesaji) k.sonMusteriMesaji = m.zaman;
      if (m.profilAdi?.trim()) k.profilAdi = m.profilAdi.trim();
    }
    return { konusmaId: k.id, mesajId };
  },
  async konusmaKilidiAl(sahip: string, sureSn: number, konusmaId?: number) {
    await tur();
    const aday = depo.isler
      .filter((i) => i.durum === "bekliyor" && (konusmaId === undefined || i.konusmaId === konusmaId))
      .sort((a, b) => a.id - b.id)
      .find((i) => bekleyenler(i.konusmaId)[0] === i && i.sonrakiDeneme <= Date.now() && !kilitli(konusmaBul(i.konusmaId)));
    if (!aday) return null;
    const k = konusmaBul(aday.konusmaId);
    k.kilitSahibi = sahip;
    k.kilitBitis = Date.now() + sureSn * 1000;
    return k.id;
  },
  async konusmaIsiBitir(isId: number, sahip: string, hata: string | null, sureSn: number) {
    await tur();
    const is = depo.isler.find((i) => i.id === isId)!;
    const k = konusmaBul(is.konusmaId);
    if (!depo.kilitDevreDisi && (k.kilitSahibi !== sahip || k.kilitBitis < Date.now())) return false;
    k.kilitBitis = Date.now() + sureSn * 1000;
    if (hata === null) is.durum = "tamam";
    else {
      is.sonrakiDeneme = Date.now() + 30_000 * 2 ** is.deneme;
      is.deneme++;
      is.sonHata = hata;
      if (is.deneme >= 5) is.durum = "hata";
    }
    return true;
  },
  async konusmaKilidiBirak(konusmaId: number, sahip: string, sureSn: number) {
    await tur();
    const k = konusmaBul(konusmaId);
    if (!depo.kilitDevreDisi && k.kilitSahibi !== sahip) return "kayip" as const;
    if (basZamaniGeldi(konusmaId)) {
      k.kilitBitis = Date.now() + sureSn * 1000;
      return "devam" as const;
    }
    k.kilitSahibi = null;
    k.kilitBitis = 0;
    return "birakildi" as const;
  },
  async bekleyenIsler(konusmaId: number): Promise<{ konusma: KuyrukKonusmasi; isler: KuyrukIsi[] }> {
    await tur();
    return {
      konusma: konusmaGorunumu(konusmaBul(konusmaId)),
      isler: bekleyenler(konusmaId).map((i) => {
        const m = depo.mesajlar.find((x) => x.id === i.mesajId)!;
        return { id: i.id, tur: i.tur, bekliyor: i.sonrakiDeneme > Date.now(), mesaj: { id: m.id, metin: m.metin, zaman: m.zaman, satisHattiId: m.satisHattiId ?? null } };
      }),
    };
  },
  async temsilciYazdi(konusmaId: number) {
    await tur();
    konusmaBul(konusmaId).botAktif = false;
  },
  async konusmaOku(konusmaId: number) {
    await tur();
    const k = depo.konusmalar.find((x) => x.id === konusmaId);
    return k ? konusmaGorunumu(k) : null;
  },
  async gidenMesajKaydet(m: Omit<YeniMesaj, "yon"> & { gonderen: "bot" | "temsilci" }) {
    await tur();
    const var_ = m.disMesajId ? depo.mesajlar.find((x) => x.disMesajId === m.disMesajId) : undefined;
    if (var_) {
      var_.gonderen = m.gonderen;
      return var_.id;
    }
    const id = ++depo.sayac;
    depo.mesajlar.push({ ...m, yon: "giden", id });
    return id;
  },
  async mesajiBagla(konusmaId: number, mesajId: number, b: { satisHattiId: number; musteriId: number | null }) {
    await tur();
    const m = depo.mesajlar.find((x) => x.id === mesajId)!;
    m.satisHattiId = b.satisHattiId;
    const k = konusmaBul(konusmaId);
    k.satisHattiId = b.satisHattiId;
    if (b.musteriId != null) k.musteriId = b.musteriId;
  },
};

/* ---------- @/components/satis-hatti/queries ---------- */
function firsatOku(id: string): Firsat | null {
  const f = depo.firsatlar.find((x) => x.id === id);
  if (!f) return null;
  const mesajlar: WhatsappMesaji[] = depo.mesajlar
    .filter((m) => String(m.satisHattiId) === id)
    .map((m) => ({ id: m.disMesajId ?? String(m.id), metin: m.metin, zaman: m.zaman, yon: m.yon, tur: m.tur }));
  return kopya({ ...f, mesajlar });
}

/** Fırsat yazımı birkaç tur sürer; bu sürede aynı anda kaç yazma olduğunu sayar (paralel işleme dedektörü) */
async function yazmaIzle() {
  depo.aktifYazma++;
  depo.enCokAktifYazma = Math.max(depo.enCokAktifYazma, depo.aktifYazma);
  await tur();
  await tur();
  depo.aktifYazma--;
}

export const satisHattiModulu = {
  KAPALI_ASAMALAR,
  async getFirsat(id: string) {
    await tur();
    return firsatOku(id);
  },
  async firsatEkleDepo(f: Firsat) {
    await yazmaIzle();
    if (depo.firsatEklemeHatasi) {
      const e = depo.firsatEklemeHatasi;
      depo.firsatEklemeHatasi = null;
      throw e;
    }
    f.id = String(++depo.sayac);
    depo.firsatlar.push(kopya({ ...f, mesajlar: undefined }));
  },
  async firsatiGuncelle(id: string, degisiklik: (f: Firsat) => void) {
    await yazmaIzle();
    const f = depo.firsatlar.find((x) => x.id === id);
    if (!f) return null;
    degisiklik(f);
    return firsatOku(id);
  },
};

/* ---------- @/components/musteriler/queries ---------- */
export const musteriModulu = {
  async getMusteri(id: string) {
    await tur();
    const m = depo.musteriler.find((x) => x.id === id);
    return m ? kopya(m) : null;
  },
  async musteriyiGuncelle(id: string, degisiklik: (m: Musteri) => void) {
    await tur();
    const m = depo.musteriler.find((x) => x.id === id);
    if (!m) return null;
    degisiklik(m);
    return kopya(m);
  },
};

/* ---------- @/lib/supabase/db: isle.ts'in iki doğrudan sorgusu için zincirlenebilir sahte istemci ---------- */
type Filtre = (satir: Record<string, unknown>) => boolean;

function sorgu(tablo: string) {
  const filtreler: Filtre[] = [];
  let sirala: { kolon: string; artan: boolean } | null = null;
  const satirlar = (): Record<string, unknown>[] => {
    if (tablo === "satis_hatti") {
      return depo.firsatlar.map((f) => ({ id: Number(f.id), f_telefon_normal: f.telefon ? telefonNormalize(f.telefon) || null : null, asama: { kod: f.asama } }));
    }
    if (tablo === "musteri_yetkilileri") {
      return depo.yetkililer.map((y) => ({ ...y, y_tel_normal: telefonNormalize(y.y_tel) || null }));
    }
    throw new Error(`Sahte db: beklenmeyen tablo ${tablo}`);
  };
  const zincir = {
    select: () => zincir,
    eq: (kolon: string, deger: unknown) => (filtreler.push((s) => s[kolon] === deger), zincir),
    not: (kolon: string, op: string, liste: string) => {
      if (op !== "in" || kolon !== "asama.kod") throw new Error(`Sahte db: desteklenmeyen not(${kolon}, ${op})`);
      const haric = liste.replace(/[()]/g, "").split(",");
      filtreler.push((s) => !haric.includes((s.asama as { kod: string }).kod));
      return zincir;
    },
    order: (kolon: string, ayar?: { ascending?: boolean }) => ((sirala = { kolon, artan: ayar?.ascending ?? true }), zincir),
    limit: () => zincir,
    maybeSingle: async () => {
      await tur();
      let l = satirlar().filter((s) => filtreler.every((f) => f(s)));
      if (sirala) {
        const { kolon, artan } = sirala;
        l = [...l].sort((a, b) => ((a[kolon] as number) - (b[kolon] as number)) * (artan ? 1 : -1));
      }
      return { data: l[0] ?? null, error: null };
    },
  };
  return zincir;
}

export const dbModulu = {
  db: async () => ({ from: sorgu }),
  sonuc: <T>(r: { data: T; error: { message: string } | null }, ne = "Veritabanı işlemi"): T => {
    if (r.error) throw new Error(`${ne} başarısız: ${r.error.message}`);
    return r.data;
  },
  sistemOlarak: <T>(is: () => Promise<T>) => is(),
};
