// isle.ts testleri için bellek içi depo. isle.ts'in kullandığı modüllerin (konuşma, satış hattı, müşteri,
// supabase db) yerine geçer ve veritabanının bu testler için önemli kuralını taşır:
// konusma_mesajlari.dis_mesaj_id tekil (aynı kimlikle ikinci yazma reddedilir; eşzamanlı yazmada ilk gelen kazanır).
import type { Firsat, WhatsappMesaji } from "@/components/satis-hatti/queries";
import type { Musteri } from "@/components/musteriler/queries";
import { KAPALI_ASAMALAR } from "@/components/satis-hatti/sabitler";
import { telefonNormalize } from "@/components/whatsapp/telefon";
import type { YeniMesaj } from "@/components/konusma/queries";

type Konusma = { id: number; kanal: string; disKullaniciId: string; satisHattiId: number | null; musteriId: number | null; sonMusteriMesaji: string | null };
type Mesaj = YeniMesaj & { id: number };
type Yetkili = { musteri_id: number; y_tel: string; y_sira: number };

export const depo = {
  firsatlar: [] as Firsat[],
  musteriler: [] as Musteri[],
  yetkililer: [] as Yetkili[],
  konusmalar: [] as Konusma[],
  mesajlar: [] as Mesaj[],
  /** Bir sonraki firsatEkleDepo çağrısı bu hatayı fırlatır (hata sonrası geri alma testi) */
  firsatEklemeHatasi: null as Error | null,
  sayac: 100,
};

export function depoyuSifirla() {
  depo.firsatlar = [];
  depo.musteriler = [];
  depo.yetkililer = [];
  depo.konusmalar = [];
  depo.mesajlar = [];
  depo.firsatEklemeHatasi = null;
  depo.sayac = 100;
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
export const konusmaModulu = {
  async konusmaGetirVeyaAc(kanal: string, disKullaniciId: string) {
    await tur();
    let k = depo.konusmalar.find((x) => x.kanal === kanal && x.disKullaniciId === disKullaniciId);
    if (!k) {
      k = { id: ++depo.sayac, kanal, disKullaniciId, satisHattiId: null, musteriId: null, sonMusteriMesaji: null };
      depo.konusmalar.push(k);
    }
    return { id: k.id, satisHattiId: k.satisHattiId };
  },
  async mesajKaydet(m: YeniMesaj) {
    await tur();
    if (m.disMesajId && depo.mesajlar.some((x) => x.disMesajId === m.disMesajId)) return null; // unique (23505)
    const id = ++depo.sayac;
    depo.mesajlar.push({ ...m, id });
    return id;
  },
  async mesajiGeriAl(mesajId: number) {
    depo.mesajlar = depo.mesajlar.filter((x) => x.id !== mesajId);
  },
  async mesajiBagla(konusmaId: number, mesajId: number, b: { satisHattiId: number; musteriId: number | null; sonMusteriMesaji: string | null }) {
    await tur();
    const m = depo.mesajlar.find((x) => x.id === mesajId)!;
    m.satisHattiId = b.satisHattiId;
    const k = depo.konusmalar.find((x) => x.id === konusmaId)!;
    k.satisHattiId = b.satisHattiId;
    if (b.musteriId != null) k.musteriId = b.musteriId;
    if (b.sonMusteriMesaji) k.sonMusteriMesaji = b.sonMusteriMesaji;
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

export const satisHattiModulu = {
  KAPALI_ASAMALAR,
  async getFirsat(id: string) {
    await tur();
    return firsatOku(id);
  },
  async firsatEkleDepo(f: Firsat) {
    await tur();
    if (depo.firsatEklemeHatasi) {
      const e = depo.firsatEklemeHatasi;
      depo.firsatEklemeHatasi = null;
      throw e;
    }
    f.id = String(++depo.sayac);
    depo.firsatlar.push(kopya({ ...f, mesajlar: undefined }));
  },
  async firsatiGuncelle(id: string, degisiklik: (f: Firsat) => void) {
    await tur();
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
