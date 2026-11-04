// Müşteriler: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("customers")... ile değiştirin.

export type Segment = "servis" | "muhendislik" | "egitim" | "bayi";
export type Plan = "Basic" | "Pro" | "Pro+" | "Lead";
export type CihazDurumu = "Lisans aktif" | "Süresi doluyor" | "Serviste";
export type OlayTuru = "siparis" | "destek" | "demo" | "teklif" | "arama" | "not";

export type Cihaz = { seriNo: string; firmware: string; durum: CihazDurumu };
export type Olay = { metin: string; zaman: string; tur: OlayTuru };

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
  yetkili: string;
  telefon: string;
  eposta: string;
  vergiNo: string;
  acikTalep: number;
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
    yetkili: "Jonas Weber", telefon: "+49 711 555 0142", eposta: "j.weber@volant-service.de", vergiNo: "DE 284 117 903", acikTalep: 1,
    cihazlar: [
      { seriNo: "EO1-2402-0611", firmware: "v2.4.1", durum: "Lisans aktif" },
      { seriNo: "EO1-2402-0612", firmware: "v2.3.0", durum: "Lisans aktif" },
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
    yetkili: "Hakan Yıldız", telefon: "+90 532 410 22 18", eposta: "hakan@akdenizdireksiyon.com", vergiNo: "0612 448 2190", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2309-0142", firmware: "v2.2.4", durum: "Süresi doluyor" }],
    olaylar: [
      { metin: "Lisans yenilemesi için arandı", zaman: "30 Eki · Telefon", tur: "arama" },
      { metin: "Fiyat sorusu: Pro → Pro+ geçiş", zaman: "22 Eki · WhatsApp", tur: "not" },
      { metin: "Lisans aktivasyonu", zaman: "6 Kas 2025", tur: "siparis" },
    ],
  },
  {
    id: "kaya", ad: "Kaya Oto Elektronik", sehir: "İzmir", ulke: "Türkiye", segment: "servis",
    plan: "Pro", lisansBitis: "2027-06-02", toplamDeger: 412_000, sonTemas: "Bugün", durum: "Aktif",
    yetkili: "Serkan Kaya", telefon: "+90 533 290 41 77", eposta: "serkan@kayaotoelektronik.com", vergiNo: "5310 772 0184", acikTalep: 1,
    cihazlar: [
      { seriNo: "EO1-2406-0455", firmware: "v2.4.1", durum: "Lisans aktif" },
      { seriNo: "EO1-2406-0456", firmware: "v2.4.1", durum: "Lisans aktif" },
    ],
    olaylar: [
      { metin: "Destek #4817 · K-Line bağlantı hatası", zaman: "Bugün 08:40 · Telefon", tur: "destek" },
      { metin: "Eğitim videosu paylaşıldı: Flash adımları", zaman: "25 Eki", tur: "not" },
    ],
  },
  {
    id: "polska", ad: "Polska EPS Serwis", sehir: "Poznań", ulke: "Polonya", segment: "bayi",
    plan: "Pro+", lisansBitis: "2027-01-30", toplamDeger: 2_310_000, sonTemas: "Bugün", durum: "Bayi adayı",
    yetkili: "Marta Nowak", telefon: "+48 61 555 0198", eposta: "marta@polskaeps.pl", vergiNo: "PL 7792 4410 22", acikTalep: 2,
    cihazlar: [
      { seriNo: "EO1-2404-0390", firmware: "v2.4.0", durum: "Lisans aktif" },
      { seriNo: "EO1-2404-0391", firmware: "v2.4.0", durum: "Lisans aktif" },
    ],
    olaylar: [
      { metin: "Distribütörlük başvurusu değerlendirmede", zaman: "Bugün · Bayi kaydı", tur: "teklif" },
      { metin: "Destek #4819 · Aktivasyon kodu", zaman: "Bugün 10:15", tur: "destek" },
    ],
  },
  {
    id: "ege", ad: "Ege Meslek Yüksekokulu", sehir: "Manisa", ulke: "Türkiye", segment: "egitim",
    plan: "Pro", lisansBitis: "2026-11-19", toplamDeger: 520_000, sonTemas: "27 Eki", durum: "Yenileme yakın",
    yetkili: "Dr. Ayşe Demir", telefon: "+90 236 555 08 40", eposta: "ayse.demir@egemyo.edu.tr", vergiNo: "—", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2311-0322", firmware: "v2.3.2", durum: "Süresi doluyor" }],
    olaylar: [{ metin: "Eğitim lisansı teklif talebi (4 cihaz)", zaman: "27 Eki · E-posta", tur: "teklif" }],
  },
  {
    id: "nordic", ad: "Nordic Steering AB", sehir: "Göteborg", ulke: "İsveç", segment: "muhendislik",
    plan: "Pro+", lisansBitis: "2026-11-28", toplamDeger: 690_000, sonTemas: "19 Eki", durum: "Aktif",
    yetkili: "Erik Lindqvist", telefon: "+46 31 555 0170", eposta: "erik@nordicsteering.se", vergiNo: "SE 5590 1144 01", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2312-0390", firmware: "v2.4.1", durum: "Lisans aktif" }],
    olaylar: [{ metin: "FlexRay test raporu paylaşıldı", zaman: "19 Eki", tur: "not" }],
  },
  {
    id: "baskent", ad: "Başkent Rot & Direksiyon", sehir: "Ankara", ulke: "Türkiye", segment: "servis",
    plan: "Basic", lisansBitis: "2027-04-11", toplamDeger: 164_000, sonTemas: "31 Eki", durum: "Yükseltme adayı",
    yetkili: "Mustafa Aydın", telefon: "+90 312 555 61 20", eposta: "info@baskentrot.com.tr", vergiNo: "1450 228 9031", acikTalep: 1,
    cihazlar: [{ seriNo: "EO1-2404-0418", firmware: "v2.4.1", durum: "Lisans aktif" }],
    olaylar: [{ metin: "Yeni model talebi · Hyundai Tucson", zaman: "31 Eki · Telefon", tur: "destek" }],
  },
  {
    id: "iberia", ad: "Iberia Dirección SL", sehir: "Valencia", ulke: "İspanya", segment: "servis",
    plan: "Lead", lisansBitis: null, toplamDeger: null, sonTemas: "Bugün", durum: "Demo planlı",
    yetkili: "Lucía Martín", telefon: "+34 96 555 0123", eposta: "lucia@iberiadireccion.es", vergiNo: "ES B9844 1202", acikTalep: 0,
    cihazlar: [],
    olaylar: [{ metin: "Demo tarihi girildi · 5 Kas 14:00", zaman: "Bugün · Satış hattı", tur: "demo" }],
  },
  {
    id: "bursa", ad: "Bursa ECU Lab", sehir: "Bursa", ulke: "Türkiye", segment: "muhendislik",
    plan: "Pro+", lisansBitis: "2026-11-11", toplamDeger: 356_000, sonTemas: "1 Kas", durum: "Yenileme yakın",
    yetkili: "Burak Şen", telefon: "+90 224 555 30 14", eposta: "burak@bursaeculab.com", vergiNo: "1880 554 2071", acikTalep: 0,
    cihazlar: [{ seriNo: "EO1-2310-0218", firmware: "v2.4.1", durum: "Süresi doluyor" }],
    olaylar: [{ metin: "Yenileme teklifi gönderildi", zaman: "1 Kas", tur: "teklif" }],
  },
];

// Demo depo: sunucu belleğinde tutulur, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
// globalThis'te durur ki geliştirmede dosya kaydedilince (HMR) eklenenler kaybolmasın.
const g = globalThis as { __embedraMusteriler?: Musteri[] };
const DEPO = (g.__embedraMusteriler ??= [...DEMO]);

export async function getMusteriler(): Promise<Musteri[]> {
  return DEPO;
}

export async function getMusteri(id: string): Promise<Musteri | null> {
  return DEPO.find((m) => m.id === id) ?? null;
}

/** "Volant Lenkung Service" ile "Volant Lenkung Service GmbH" aynı firma sayılır. */
export async function musteriBulAdla(ad: string): Promise<Musteri | null> {
  const n = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const aranan = n(ad);
  if (!aranan) return null;
  return DEPO.find((m) => n(m.ad) === aranan || n(m.ad).startsWith(aranan + " ") || aranan.startsWith(n(m.ad) + " ")) ?? null;
}

/** Yalnızca sunucu tarafındaki actions dosyalarından çağrılır. */
export async function musteriEkle(m: Musteri) {
  DEPO.unshift(m);
  // TODO: Supabase bağlanınca: await supabase.from("customers").insert({ ... });
}
