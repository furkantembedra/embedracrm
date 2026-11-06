// Müşteriler: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("customers")... ile değiştirin.
import type { CihazModeli } from "@/lib/urunler";
import { getCihazlar } from "@/components/cihaz-lisans/queries";

export type Segment = "servis" | "muhendislik" | "egitim" | "bayi";
export type Plan = "Basic" | "Pro" | "Pro+" | "Lead";
export type CihazDurumu = "Lisans aktif" | "Süresi doluyor" | "Serviste" | "Lisanssız";
export type OlayTuru = "siparis" | "destek" | "demo" | "teklif" | "arama" | "not";

export type Cihaz = { seriNo: string; model: CihazModeli; firmware: string; durum: CihazDurumu };
export type Olay = { metin: string; zaman: string; tur: OlayTuru };

import { type IzinKanali, type IzinKaydi } from "./izin";
export * from "./izin";

/** Firmadaki iletişim kişisi. Boş alanlar "" olarak tutulur. İlk sıradaki birincil yetkilidir. */
export type Yetkili = { id: string; ad: string; unvan: string; telefon: string; eposta: string; izinler?: Partial<Record<IzinKanali, IzinKaydi>> };

export type Musteri = {
  id: string;
  ad: string;
  sehir: string;
  ulke: string;
  segment: Segment;
  plan: Plan;
  lisansBitis: string | null; // "2027-03-14"
  toplamDeger: number | null; // TL
  sonTemas: string;
  durum: string;
  yetkililer: Yetkili[]; // ilk sıradaki birincil yetkili (Ara / WhatsApp / E-posta düğmeleri)
  vergiNo: string; // boşsa ""
  acikTalep: number;
  /** @deprecated izinler artık yetkili ve kanal bazında: Yetkili.izinler */
  duyuruIzni?: boolean;
  cihazlar: Cihaz[];
  olaylar: Olay[];
};

export const SEGMENT_ADI: Record<Segment, string> = {
  servis: "Servis",
  muhendislik: "Mühendislik",
  egitim: "Eğitim",
  bayi: "Bayi",
};

const DEMO: Musteri[] = [
  {
    id: "volant", ad: "Volant Lenkung Service GmbH", sehir: "Stuttgart", ulke: "Almanya", segment: "servis",
    plan: "Pro+", lisansBitis: "2027-03-14", toplamDeger: 1_860_000, sonTemas: "Bugün", durum: "Aktif · VIP",
    yetkililer: [
      { id: "volant-1", ad: "Jonas Weber", unvan: "Servis müdürü", telefon: "+49 711 555 0142", eposta: "j.weber@volant-service.de" },
      { id: "volant-2", ad: "Anna Schmidt", unvan: "Satın alma", telefon: "+49 711 555 0150", eposta: "a.schmidt@volant-service.de" },
    ], vergiNo: "DE 284 117 903", acikTalep: 1,
    cihazlar: [
      { seriNo: "EO1-2402-0611", model: "ONE", firmware: "v2.4.1", durum: "Lisans aktif" },
      { seriNo: "EO1-2402-0612", model: "ONE", firmware: "v2.3.0", durum: "Lisans aktif" },
    ],
    olaylar: [
      { metin: "2× ONE + Pro+ lisans siparişi", zaman: "Bugün 11:24 · Sipariş", tur: "siparis" },
      { metin: "Destek #4821 açıldı · Flash sonrası ECU", zaman: "Bugün 09:02 · E-posta", tur: "destek" },
      { metin: "Demo: Mercedes kolon EPS simülasyonu", zaman: "28 Eki · Online", tur: "demo" },
      { metin: "Teklif EMB-2026-311 kabul edildi", zaman: "21 Eki", tur: "teklif" },
    ],
  },
  {
    id: "akdeniz", ad: "Akdeniz Direksiyon Servisi", sehir: "Antalya", ulke: "Türkiye", segment: "servis",
    plan: "Pro", lisansBitis: "2026-11-06", toplamDeger: 248_000, sonTemas: "30 Eki", durum: "Yenileme riski",
    yetkililer: [{ id: "akdeniz-1", ad: "Hakan Yıldız", unvan: "", telefon: "+90 532 410 22 18", eposta: "hakan@akdenizdireksiyon.com" }], vergiNo: "0612 448 2190", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2309-0142", model: "ONE", firmware: "v2.2.4", durum: "Süresi doluyor" }],
    olaylar: [
      { metin: "Lisans yenilemesi için arandı", zaman: "30 Eki · Telefon", tur: "arama" },
      { metin: "Fiyat sorusu: Pro → Pro+ geçiş", zaman: "22 Eki · WhatsApp", tur: "not" },
      { metin: "Lisans aktivasyonu", zaman: "6 Kas 2025", tur: "siparis" },
    ],
  },
  {
    id: "kaya", ad: "Kaya Oto Elektronik", sehir: "İzmir", ulke: "Türkiye", segment: "servis",
    plan: "Pro", lisansBitis: "2027-06-02", toplamDeger: 412_000, sonTemas: "Bugün", durum: "Aktif",
    yetkililer: [{ id: "kaya-1", ad: "Serkan Kaya", unvan: "", telefon: "+90 533 290 41 77", eposta: "serkan@kayaotoelektronik.com" }], vergiNo: "5310 772 0184", acikTalep: 1,
    cihazlar: [
      { seriNo: "EO1-2406-0455", model: "ONE", firmware: "v2.4.1", durum: "Lisans aktif" },
      { seriNo: "EO1-2406-0456", model: "ONE", firmware: "v2.4.1", durum: "Lisans aktif" },
    ],
    olaylar: [
      { metin: "Destek #4817 · K-Line bağlantı hatası", zaman: "Bugün 08:40 · Telefon", tur: "destek" },
      { metin: "Eğitim videosu paylaşıldı: Flash adımları", zaman: "25 Eki", tur: "not" },
    ],
  },
  {
    id: "polska", ad: "Polska EPS Serwis", sehir: "Poznań", ulke: "Polonya", segment: "bayi",
    plan: "Pro+", lisansBitis: "2027-01-30", toplamDeger: 2_310_000, sonTemas: "Bugün", durum: "Bayi adayı",
    yetkililer: [{ id: "polska-1", ad: "Marta Nowak", unvan: "", telefon: "+48 61 555 0198", eposta: "marta@polskaeps.pl" }], vergiNo: "PL 7792 4410 22", acikTalep: 2,
    cihazlar: [
      { seriNo: "EO1-2404-0390", model: "ONE", firmware: "v2.4.0", durum: "Lisans aktif" },
      { seriNo: "EO1-2404-0391", model: "ONE", firmware: "v2.4.0", durum: "Lisans aktif" },
    ],
    olaylar: [
      { metin: "Distribütörlük başvurusu değerlendirmede", zaman: "Bugün · Bayi kaydı", tur: "teklif" },
      { metin: "Destek #4819 · Aktivasyon kodu", zaman: "Bugün 10:15", tur: "destek" },
    ],
  },
  {
    id: "ege", ad: "Ege Meslek Yüksekokulu", sehir: "Manisa", ulke: "Türkiye", segment: "egitim",
    plan: "Pro", lisansBitis: "2026-11-19", toplamDeger: 520_000, sonTemas: "27 Eki", durum: "Yenileme yakın",
    yetkililer: [{ id: "ege-1", ad: "Dr. Ayşe Demir", unvan: "", telefon: "+90 236 555 08 40", eposta: "ayse.demir@egemyo.edu.tr" }], vergiNo: "", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2311-0322", model: "ONE", firmware: "v2.3.2", durum: "Süresi doluyor" }],
    olaylar: [{ metin: "Eğitim lisansı teklif talebi (4 cihaz)", zaman: "27 Eki · E-posta", tur: "teklif" }],
  },
  {
    id: "nordic", ad: "Nordic Steering AB", sehir: "Göteborg", ulke: "İsveç", segment: "muhendislik",
    plan: "Pro+", lisansBitis: "2026-11-28", toplamDeger: 690_000, sonTemas: "19 Eki", durum: "Aktif",
    yetkililer: [{ id: "nordic-1", ad: "Erik Lindqvist", unvan: "", telefon: "+46 31 555 0170", eposta: "erik@nordicsteering.se" }], vergiNo: "SE 5590 1144 01", acikTalep: 0,
    cihazlar: [
      { seriNo: "EO1-2312-0390", model: "ONE", firmware: "v2.4.1", durum: "Lisans aktif" },
      { seriNo: "EO1-2312-0412", model: "ONE", firmware: "v2.4.1", durum: "Serviste" },
    ],
    olaylar: [{ metin: "FlexRay test raporu paylaşıldı", zaman: "19 Eki", tur: "not" }],
  },
  {
    id: "baskent", ad: "Başkent Rot & Direksiyon", sehir: "Ankara", ulke: "Türkiye", segment: "servis",
    plan: "Basic", lisansBitis: "2027-04-11", toplamDeger: 164_000, sonTemas: "31 Eki", durum: "Yükseltme adayı",
    yetkililer: [{ id: "baskent-1", ad: "Mustafa Aydın", unvan: "", telefon: "+90 312 555 61 20", eposta: "info@baskentrot.com.tr" }], vergiNo: "1450 228 9031", acikTalep: 1,
    cihazlar: [{ seriNo: "EO1-2404-0418", model: "ONE Lite", firmware: "v2.4.1", durum: "Lisans aktif" }],
    olaylar: [{ metin: "Yeni model talebi · Hyundai Tucson", zaman: "31 Eki · Telefon", tur: "destek" }],
  },
  {
    id: "iberia", ad: "Iberia Dirección SL", sehir: "Valencia", ulke: "İspanya", segment: "servis",
    plan: "Lead", lisansBitis: null, toplamDeger: null, sonTemas: "Bugün", durum: "Demo planlı",
    yetkililer: [{ id: "iberia-1", ad: "Lucía Martín", unvan: "", telefon: "+34 96 555 0123", eposta: "lucia@iberiadireccion.es" }], vergiNo: "ES B9844 1202", acikTalep: 0,
    cihazlar: [],
    olaylar: [{ metin: "Demo tarihi girildi · 5 Kas 14:00", zaman: "Bugün · Satış hattı", tur: "demo" }],
  },
  {
    id: "bursa", ad: "Bursa ECU Lab", sehir: "Bursa", ulke: "Türkiye", segment: "muhendislik",
    plan: "Pro+", lisansBitis: "2026-11-11", toplamDeger: 356_000, sonTemas: "1 Kas", durum: "Yenileme yakın",
    yetkililer: [{ id: "bursa-1", ad: "Burak Şen", unvan: "", telefon: "+90 224 555 30 14", eposta: "burak@bursaeculab.com" }], vergiNo: "1880 554 2071", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2310-0218", model: "ONE", firmware: "v2.4.1", durum: "Süresi doluyor" }],
    olaylar: [{ metin: "Yenileme teklifi gönderildi", zaman: "1 Kas", tur: "teklif" }],
  },
];

// Demo depo: sunucu belleğinde tutulur, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
// globalThis'te durur ki geliştirmede dosya kaydedilince (HMR) eklenenler kaybolmasın.
const g = globalThis as { __embedraMusteriler?: Musteri[] };
const DEPO = (g.__embedraMusteriler ??= [...DEMO]);
// Model alanı sonradan eklendi: belleğe daha önce alınmış müşteri cihazlarına modeli işle
// İletişim izinleri sonradan eklendi: demo müşterilerin birincil yetkilisine izin işlenir,
// eski firma bazlı "duyuruIzni" alanı yetkili + kanal bazına taşınır (sunucu yeniden başlatılmadan)
const DEMO_IZIN: Record<string, { kanallar: IzinKanali[]; tarih: string; kaynak: string }> = {
  volant: { kanallar: ["eposta", "whatsapp"], tarih: "2026-03-14", kaynak: "Lisans aktivasyonu" },
  akdeniz: { kanallar: ["whatsapp", "arama"], tarih: "2025-11-06", kaynak: "Telefon görüşmesi" },
  kaya: { kanallar: ["eposta", "whatsapp", "sms"], tarih: "2026-06-02", kaynak: "Lisans aktivasyonu" },
  ege: { kanallar: ["eposta"], tarih: "2025-11-19", kaynak: "Fuar formu" },
  bursa: { kanallar: ["eposta", "whatsapp"], tarih: "2025-11-11", kaynak: "Web sitesi formu" },
  baskent: { kanallar: ["whatsapp"], tarih: "2026-04-11", kaynak: "WhatsApp onayı" },
  nordic: { kanallar: ["eposta"], tarih: "2025-11-28", kaynak: "Sipariş" },
};
for (const m of DEPO) {
  const ilk = m.yetkililer?.[0];
  if (!ilk || ilk.izinler) continue;
  const d = DEMO_IZIN[m.id] ?? (m.duyuruIzni ? { kanallar: ["eposta"] as IzinKanali[], tarih: "2026-11-01", kaynak: "Müşteri formu" } : null);
  ilk.izinler = d ? Object.fromEntries(d.kanallar.map((k) => [k, { verildi: true, tarih: d.tarih, kaynak: d.kaynak, cekilme: null }])) : {};
}

for (const m of DEPO) {
  for (const c of m.cihazlar) {
    if (!c.model) c.model = DEMO.flatMap((d) => d.cihazlar).find((d) => d.seriNo === c.seriNo)?.model ?? "ONE";
  }
}

// Bellekte eski yapıyla (tek yetkili / telefon / eposta) kalmış kayıtları yeni yapıya çevirir.
// Geliştirmede HMR globalThis'i silmediği için gerekli; Supabase'e geçince kaldırabilirsiniz.
for (const m of DEPO as (Musteri & { yetkili?: string; telefon?: string; eposta?: string })[]) {
  if (Array.isArray(m.yetkililer)) continue;
  const dolu = (v?: string) => (v && v !== "—" ? v : "");
  m.yetkililer = dolu(m.yetkili) || dolu(m.telefon) || dolu(m.eposta)
    ? [{ id: `${m.id}-1`, ad: dolu(m.yetkili) || m.ad, unvan: "", telefon: dolu(m.telefon), eposta: dolu(m.eposta) }]
    : [];
  if (m.vergiNo === "—") m.vergiNo = "";
  delete m.yetkili;
  delete m.telefon;
  delete m.eposta;
}

const CIHAZ_DURUMU = { aktif: "Lisans aktif", bitiyor: "Süresi doluyor", serviste: "Serviste", lisanssiz: "Lisanssız", stokta: "Lisanssız" } as const; // stokta: müşteri cihazı olamaz, tip için

/** Müşterinin cihazları: cihaz kayıtlarındakiler (güncel lisans/model) + yalnızca müşteri kaydında olanlar.
 *  TODO: Supabase'de devices.customer_id ile tek sorguda gelecek. */
async function cihazlarlaBirlestir(liste: Musteri[]): Promise<Musteri[]> {
  const kayitlar = await getCihazlar();
  return liste.map((m) => {
    const kayittan: Cihaz[] = kayitlar
      .filter((c) => c.musteriId === m.id)
      .map((c) => ({ seriNo: c.seriNo, model: c.model, firmware: c.firmware, durum: CIHAZ_DURUMU[c.durum] }));
    const sadeceMusteride = m.cihazlar.filter((c) => !kayittan.some((k) => k.seriNo === c.seriNo));
    return { ...m, cihazlar: [...kayittan, ...sadeceMusteride] };
  });
}

export async function getMusteriler(): Promise<Musteri[]> {
  return cihazlarlaBirlestir(DEPO);
}

export async function getMusteri(id: string): Promise<Musteri | null> {
  const m = DEPO.find((x) => x.id === id);
  return m ? (await cihazlarlaBirlestir([m]))[0] : null;
}

/** "Volant Lenkung Service" ile "Volant Lenkung Service GmbH" aynı firma sayılır. */
export async function musteriBulAdla(ad: string): Promise<Musteri | null> {
  const n = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const aranan = n(ad);
  if (!aranan) return null;
  return DEPO.find((m) => n(m.ad) === aranan || n(m.ad).startsWith(aranan + " ") || aranan.startsWith(n(m.ad) + " ")) ?? null;
}

/** Kaydı yerinde günceller (getMusteri kopya döndürür). Yalnızca actions dosyalarından çağrılır. */
export async function musteriyiGuncelle(id: string, degisiklik: (m: Musteri) => void): Promise<Musteri | null> {
  const m = DEPO.find((x) => x.id === id);
  if (m) degisiklik(m);
  return m ?? null;
}

/** Yalnızca sunucu tarafındaki actions dosyalarından çağrılır. */
export async function musteriEkle(m: Musteri) {
  DEPO.unshift(m);
  // TODO: Supabase bağlanınca: await supabase.from("customers").insert({ ... });
}
