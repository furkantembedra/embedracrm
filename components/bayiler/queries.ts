// Bayi & Distribütör: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("partner_applications")... ile değiştirin.
import type { CihazModeli } from "@/lib/urunler";
import type { LisansPlani } from "@/components/cihaz-lisans/queries";

export const ASAMALAR = ["basvuru", "degerlendirme", "sozlesme", "lansman"] as const;
export type BayiAsamasi = (typeof ASAMALAR)[number];

export const ASAMA_BILGI: Record<BayiAsamasi, { ad: string; aciklama: string }> = {
  basvuru: { ad: "Başvuru", aciklama: "Ad, e-posta, telefon, ülke, şirket ve vergi no kaydedilir" },
  degerlendirme: { ad: "Değerlendirme", aciklama: "Bölge ve iş modeli uygunluk incelemesi" },
  sozlesme: { ad: "Sözleşme", aciklama: "Bölge hakkı, MOQ ve marka standartları" },
  lansman: { ad: "Lansman", aciklama: "İlk stok sevkiyatı ve satış başlangıcı" },
};

export const KONTROL_LISTESI = [
  { baslik: "Bölge bütünlüğü", not: "Bölgesel dağıtım hakları netleştirildi" },
  { baslik: "Minimum sipariş (MOQ)", not: "İşletme ölçeğine göre giriş seviyesi" },
  { baslik: "Marka standartları", not: "EmbedraONE marka kiti paylaşıldı" },
  { baslik: "Destek taahhüdü", not: "Teknik destek ve yerel uzmanlık ayrımı" },
] as const;

export const ULKELER: Record<string, string> = {
  // Türkiye ve yakın çevre
  TR: "Türkiye", AZ: "Azerbaycan", GE: "Gürcistan", KZ: "Kazakistan", UZ: "Özbekistan", TM: "Türkmenistan", KG: "Kırgızistan",
  // Batı ve Orta Avrupa
  DE: "Almanya", AT: "Avusturya", CH: "İsviçre", FR: "Fransa", BE: "Belçika", NL: "Hollanda", LU: "Lüksemburg",
  GB: "Birleşik Krallık", IE: "İrlanda", ES: "İspanya", PT: "Portekiz", IT: "İtalya", MT: "Malta",
  // Kuzey Avrupa
  SE: "İsveç", NO: "Norveç", DK: "Danimarka", FI: "Finlandiya", EE: "Estonya", LV: "Letonya", LT: "Litvanya",
  // Doğu Avrupa ve Balkanlar
  PL: "Polonya", CZ: "Çekya", SK: "Slovakya", HU: "Macaristan", RO: "Romanya", BG: "Bulgaristan", MD: "Moldova", UA: "Ukrayna",
  GR: "Yunanistan", CY: "Kıbrıs", SI: "Slovenya", HR: "Hırvatistan", BA: "Bosna-Hersek", RS: "Sırbistan", ME: "Karadağ",
  MK: "Kuzey Makedonya", AL: "Arnavutluk", XK: "Kosova",
  // Orta Doğu ve Kuzey Afrika
  IQ: "Irak", SA: "Suudi Arabistan", AE: "Birleşik Arap Emirlikleri", QA: "Katar", KW: "Kuveyt", JO: "Ürdün", IL: "İsrail",
  EG: "Mısır", MA: "Fas", TN: "Tunus", DZ: "Cezayir",
};

/** Bölge kapsamasında her zaman gösterilen hedef ülkeler (bayisi olmasa da) */
// Bölge kapsamasında her zaman listelenen ülkeler (bayi yoksa "Bayi aranıyor")
export const HEDEF_ULKELER = Object.keys(ULKELER);

export const DESTEK_KALEMLERI = ["Kurulum", "Kullanıcı eğitimi", "Standart Teknik Destek", "Yedek parça"] as const;
export type DestekKalemi = (typeof DESTEK_KALEMLERI)[number];

/** Sözleşme kontrol listesinin her maddesinde kararlaştırılanlar. Boş alan: henüz girilmedi. */
export type SozlesmeDetayi = {
  bolge: { kapsam: string; munhasir: boolean | null };
  moq: { one: number | null; lite: number | null; yillik: number | null; indirim: number | null }; // indirim: %
  marka: { kitTarihi: string; logoOnay: boolean; not: string }; // kitTarihi: "2026-10-28"
  destek: { bayi: DestekKalemi[] };
};

export const bosSozlesme = (bolge = ""): SozlesmeDetayi => ({
  bolge: { kapsam: bolge, munhasir: null },
  moq: { one: null, lite: null, yillik: null, indirim: null },
  marka: { kitTarihi: "", logoOnay: false, not: "" },
  destek: { bayi: [] },
});

export type Basvuru = {
  id: string;
  sirket: string;
  yetkili: string;
  ulkeKodu: string; // "PL"
  bolge: string; // talep edilen bölge: "Polonya (tamamı)"
  asama: BayiAsamasi;
  puan: number | null; // uygunluk 0–100, değerlendirmede verilir
  ilkSiparis: number; // cihaz adedi
  tarih: string; // "2026-10-28"
  eposta: string;
  telefon: string;
  vergiNo: string;
  kontroller: boolean[]; // KONTROL_LISTESI sırasıyla
  sozlesme: SozlesmeDetayi; // kontrol listesi maddelerinin ayrıntısı
  gorusme: { tarih: string; not: string } | null; // "2026-11-06T14:00"
};

export type AktifBayi = {
  id: string;
  ad: string;
  bolge: string;
  ulkeKodu: string;
  satilan: number; // bu çeyrek, cihaz
  stok: number;
  moqHedef: number; // çeyreklik minimum sipariş, cihaz
  moqGerceklesen: number;
};

const BASVURULAR = ([
  { id: "polska", sirket: "Polska EPS Serwis", yetkili: "Marta Nowak", ulkeKodu: "PL", bolge: "Polonya (tamamı)", asama: "degerlendirme", puan: 86, ilkSiparis: 10, tarih: "2026-10-28", eposta: "marta@polskaeps.pl", telefon: "+48 61 555 0198", vergiNo: "PL 7792 4410 22", kontroller: [true, false, true, false], gorusme: null },
  { id: "balkan", sirket: "Balkan Auto Diagnostics", yetkili: "Nikola Petrović", ulkeKodu: "RS", bolge: "Batı Balkanlar", asama: "basvuru", puan: 64, ilkSiparis: 5, tarih: "2026-11-01", eposta: "nikola@balkanautodiag.rs", telefon: "+381 11 555 0144", vergiNo: "RS 1093 4471", kontroller: [false, false, false, false], gorusme: null },
  { id: "iberia", sirket: "Iberia Dirección SL", yetkili: "Lucía Martín", ulkeKodu: "ES", bolge: "Valencia + Murcia", asama: "degerlendirme", puan: 72, ilkSiparis: 6, tarih: "2026-10-24", eposta: "lucia@iberiadireccion.es", telefon: "+34 96 555 0123", vergiNo: "ES B9844 1202", kontroller: [true, false, false, false], gorusme: null },
  { id: "hellas", sirket: "Hellas Steering Tech", yetkili: "Giorgos Papadakis", ulkeKodu: "GR", bolge: "Yunanistan + Kıbrıs", asama: "sozlesme", puan: 91, ilkSiparis: 12, tarih: "2026-10-09", eposta: "g.papadakis@hellassteering.gr", telefon: "+30 21 555 0187", vergiNo: "EL 8011 4392", kontroller: [true, true, true, false], gorusme: { tarih: "2026-11-06T11:00", not: "Destek taahhüdü maddesi" } },
  { id: "rizeni", sirket: "Řízení Servis s.r.o.", yetkili: "Tomáš Novák", ulkeKodu: "CZ", bolge: "Çekya + Slovakya", asama: "sozlesme", puan: 79, ilkSiparis: 8, tarih: "2026-10-02", eposta: "tomas@rizeni-servis.cz", telefon: "+420 2 555 0193", vergiNo: "CZ 2841 7720", kontroller: [true, true, false, false], gorusme: null },
  { id: "directie", sirket: "Direcție Pro SRL", yetkili: "Andrei Popescu", ulkeKodu: "RO", bolge: "Romanya", asama: "lansman", puan: 88, ilkSiparis: 10, tarih: "2026-09-14", eposta: "andrei@directiepro.ro", telefon: "+40 21 555 0110", vergiNo: "RO 4019 2281", kontroller: [true, true, true, true], gorusme: null },
] as Omit<Basvuru, "sozlesme">[]) as Basvuru[];

const AKTIF_BAYILER: AktifBayi[] = [
  { id: "directie", ad: "Direcție Pro SRL", bolge: "Romanya", ulkeKodu: "RO", satilan: 18, stok: 4, moqHedef: 20, moqGerceklesen: 18 },
  { id: "autotech", ad: "AutoTech Distribution", bolge: "Bulgaristan", ulkeKodu: "BG", satilan: 11, stok: 9, moqHedef: 18, moqGerceklesen: 11 },
  { id: "volant-netz", ad: "Volant Partner Netz", bolge: "Almanya (Güney)", ulkeKodu: "DE", satilan: 26, stok: 12, moqHedef: 24, moqGerceklesen: 26 },
  { id: "kafkas", ad: "Kafkas Oto Teknik", bolge: "Azerbaycan + Gürcistan", ulkeKodu: "AZ", satilan: 6, stok: 1, moqHedef: 16, moqGerceklesen: 6 },
];

// Demo: işaretli maddelerin ayrıntısı dolu gelsin
const ORNEK_SOZLESME: Record<string, Partial<SozlesmeDetayi>> = {
  polska: { bolge: { kapsam: "Polonya (tamamı)", munhasir: true }, marka: { kitTarihi: "2026-10-29", logoOnay: true, not: "" } },
  iberia: { bolge: { kapsam: "Valencia + Murcia", munhasir: false } },
  hellas: {
    bolge: { kapsam: "Yunanistan + Kıbrıs", munhasir: true },
    moq: { one: 8, lite: 4, yillik: 48, indirim: 18 },
    marka: { kitTarihi: "2026-10-20", logoOnay: true, not: "Yunanca broşür bayi tarafında" },
    destek: { bayi: ["Kurulum", "Kullanıcı eğitimi"] },
  },
  rizeni: { bolge: { kapsam: "Çekya + Slovakya", munhasir: true }, moq: { one: 6, lite: 2, yillik: 32, indirim: 15 } },
  directie: {
    bolge: { kapsam: "Romanya", munhasir: true },
    moq: { one: 7, lite: 3, yillik: 80, indirim: 18 },
    marka: { kitTarihi: "2026-09-20", logoOnay: true, not: "" },
    destek: { bayi: ["Kurulum", "Kullanıcı eğitimi", "Standart Teknik Destek"] },
  },
};
for (const b of BASVURULAR) b.sozlesme = { ...bosSozlesme(b.bolge), ...ORNEK_SOZLESME[b.id] };

// Demo depo: sunucu belleğinde, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
/* ---------- Bayi hareketleri: bayiye sevkiyat, bayinin bildirdiği satış, bayinin sattığı lisans ---------- */

export type HareketTuru = "sevkiyat" | "satis" | "lisans";
export const HAREKET_ADI: Record<HareketTuru, string> = { sevkiyat: "Bayiye sevkiyat", satis: "Müşteriye satış", lisans: "Lisans satışı" };

export type BayiHareketi = {
  id: string;
  bayiId: string;
  tur: HareketTuru;
  tarih: string; // "2026-10-14"
  kalemler: { model: CihazModeli; seriNo: string | null }[]; // seri no girilmeden sevk edilen stokta null
  musteri?: { id: string | null; ad: string }; // satış / lisans: son kullanıcı
  plan?: LisansPlani; // lisans
  sureAy?: number; // lisans
  not?: string;
};

// Demo geçmiş: her bayi için çeyrek çeyrek sevkiyat ve satış. Bugünkü (2026 Ç4) stok / satış / MOQ
// karttaki eski sabit değerlerle tutarlı olacak şekilde üretilir. Seri numaraları temsilidir.
const DEMO_MUSTERILER = ["Oto Elektrik Merkezi", "Direksiyon Usta", "Servis Point", "Kale Oto", "Teknik Garaj", "Rota Servis", "Mega Oto", "Prime Steering"];
function demoHareketler(): BayiHareketi[] {
  const sonuc: BayiHareketi[] = [];
  let n = 0;
  const seri = (yil: number) => `EO1-${String(yil).slice(2)}${String((n % 12) + 1).padStart(2, "0")}-${String(5000 + n).padStart(4, "0")}`;
  const kalem = (adet: number, yil: number, seriVar = true) =>
    Array.from({ length: adet }, () => {
      n++;
      return { model: (n % 10 < 7 ? "ONE" : "ONE Lite") as CihazModeli, seriNo: seriVar ? seri(yil) : null };
    });
  const plan: { id: string; bas: [number, number]; desen: number[]; q4Sevk: number; q4Satis: number; stok: number }[] = [
    { id: "directie", bas: [2026, 3], desen: [8], q4Sevk: 18, q4Satis: 18, stok: 4 },
    { id: "autotech", bas: [2025, 1], desen: [6, 7, 9, 10, 8, 9, 11], q4Sevk: 11, q4Satis: 11, stok: 9 },
    { id: "volant-netz", bas: [2025, 1], desen: [14, 16, 18, 22, 19, 21, 24], q4Sevk: 26, q4Satis: 26, stok: 12 },
    { id: "kafkas", bas: [2025, 2], desen: [4, 5, 7, 5, 6, 8], q4Sevk: 6, q4Satis: 6, stok: 1 },
  ];
  const gun = (yil: number, c: number, ay: number, g: number) => `${yil}-${String((c - 1) * 3 + ay).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  for (const p of plan) {
    let [yil, c] = p.bas;
    const stok: BayiHareketi["kalemler"] = []; // satışlar stoktan, ilk giren ilk çıkar
    const sevk = (adet: number, y: number) => {
      const k = kalem(adet, y);
      stok.push(...k);
      return k;
    };
    const sat = (adet: number) => stok.splice(0, adet);
    const temel = p.stok - p.q4Sevk + p.q4Satis; // Ç4 öncesi elde kalan
    p.desen.forEach((adet, i) => {
      sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "sevkiyat", tarih: gun(yil, c, 1, 8), kalemler: sevk(adet + (i === 0 ? temel : 0), yil) });
      const satilan = sat(adet);
      sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "satis", tarih: gun(yil, c, 2, 18), kalemler: satilan, musteri: { id: null, ad: DEMO_MUSTERILER[n % 8] } });
      sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "lisans", tarih: gun(yil, c, 2, 19), kalemler: satilan.slice(0, Math.ceil(adet / 2)), musteri: { id: null, ad: DEMO_MUSTERILER[n % 8] }, plan: n % 3 ? "Pro" : "Pro+", sureAy: 12 });
      c++;
      if (c > 4) [yil, c] = [yil + 1, 1];
    });
    // 2026 Ç4 (bugüne kadar)
    const ilk = Math.ceil(p.q4Sevk / 2);
    sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "sevkiyat", tarih: "2026-10-06", kalemler: sevk(ilk, 2026) });
    sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "sevkiyat", tarih: "2026-10-27", kalemler: sevk(p.q4Sevk - ilk, 2026) });
    const s1 = Math.ceil(p.q4Satis / 2);
    sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "satis", tarih: "2026-10-15", kalemler: sat(s1), musteri: { id: null, ad: DEMO_MUSTERILER[n % 8] } });
    sonuc.push({ id: `h${++n}`, bayiId: p.id, tur: "satis", tarih: "2026-11-03", kalemler: sat(p.q4Satis - s1), musteri: { id: null, ad: DEMO_MUSTERILER[n % 8] } });
  }
  return sonuc.sort((a, b) => b.tarih.localeCompare(a.tarih));
}

const g = globalThis as { __embedraBayiler?: { basvurular: Basvuru[]; aktif: AktifBayi[]; hareketler?: BayiHareketi[] } };
const DEPO = (g.__embedraBayiler ??= { basvurular: structuredClone(BASVURULAR), aktif: structuredClone(AKTIF_BAYILER) });
// Hareketler sonradan eklendi: bellekte eski depo varsa (sunucu yeniden başlatılmadan) demo geçmişi ekle.
// Sonradan lansmanı yapılmış bayilerin ilk stoğu da sevkiyat olarak işlenir.
// v2: demo satışlar sevk edilen stoktan düşer. Eski üretimi (v1) bellekte bulursa yenisiyle değiştirir; elle girilenler korunur.
if (!DEPO.hareketler || !DEPO.hareketler.some((h) => h.id === "demo-v2")) {
  const elle = (DEPO.hareketler ?? []).filter((h) => !/^h\d+$/.test(h.id) && !h.id.startsWith("ilk-"));
  DEPO.hareketler = [...elle, ...demoHareketler(), { id: "demo-v2", bayiId: "", tur: "sevkiyat", tarih: "2000-01-01", kalemler: [] }];
  for (const b of DEPO.aktif) {
    if (DEPO.hareketler.some((h) => h.bayiId === b.id)) continue;
    DEPO.hareketler.push({ id: `ilk-${b.id}`, bayiId: b.id, tur: "sevkiyat", tarih: "2026-11-05", kalemler: Array.from({ length: b.stok }, () => ({ model: "ONE" as CihazModeli, seriNo: null })), not: "İlk stok (lansman)" });
  }
}
const HAREKETLER = DEPO.hareketler;

// Sözleşme ayrıntısı eklenmeden önce bellekte kalan kayıtlar (sunucuyu yeniden başlatmadan geçiş)
for (const b of DEPO.basvurular) {
  b.sozlesme ??= BASVURULAR.find((x) => x.id === b.id)?.sozlesme ?? bosSozlesme(b.bolge);
}

export async function getBasvurular(): Promise<Basvuru[]> {
  return DEPO.basvurular;
}

export async function getBayiHareketleri(): Promise<BayiHareketi[]> {
  return HAREKETLER;
}

export async function hareketEkle(h: BayiHareketi) {
  HAREKETLER.unshift(h);
}

export async function aktifBayiyiGuncelle(id: string, degisiklik: (b: AktifBayi) => void): Promise<AktifBayi | null> {
  const b = DEPO.aktif.find((x) => x.id === id);
  if (b) degisiklik(b);
  return b ?? null;
}

export async function getAktifBayiler(): Promise<AktifBayi[]> {
  return DEPO.aktif;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function basvuruEkle(b: Basvuru) {
  DEPO.basvurular.unshift(b);
}

export async function basvuruyuGuncelle(id: string, degisiklik: (b: Basvuru) => void): Promise<Basvuru | null> {
  const b = DEPO.basvurular.find((x) => x.id === id);
  if (b) degisiklik(b);
  return b ?? null;
}

export async function basvuruyuSil(id: string): Promise<boolean> {
  const i = DEPO.basvurular.findIndex((x) => x.id === id);
  if (i < 0) return false;
  DEPO.basvurular.splice(i, 1);
  return true;
}

export async function aktifBayiEkle(b: AktifBayi) {
  if (!DEPO.aktif.some((x) => x.id === b.id)) DEPO.aktif.unshift(b);
}
