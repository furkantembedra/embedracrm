// Bayi & Distribütör: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("partner_applications")... ile değiştirin.

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
  DE: "Almanya", AT: "Avusturya", AZ: "Azerbaycan", BA: "Bosna-Hersek", BG: "Bulgaristan", CZ: "Çekya",
  FR: "Fransa", GE: "Gürcistan", GR: "Yunanistan", HR: "Hırvatistan", HU: "Macaristan", IT: "İtalya",
  NL: "Hollanda", PL: "Polonya", PT: "Portekiz", RO: "Romanya", RS: "Sırbistan", ES: "İspanya",
  SE: "İsveç", SK: "Slovakya", SI: "Slovenya", UA: "Ukrayna", GB: "Birleşik Krallık",
};

/** Bölge kapsamasında her zaman gösterilen hedef ülkeler (bayisi olmasa da) */
export const HEDEF_ULKELER = ["DE", "RO", "GR", "PL", "ES", "CZ", "RS", "BG", "FR", "IT"];

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

const BASVURULAR: Basvuru[] = [
  { id: "polska", sirket: "Polska EPS Serwis", yetkili: "Marta Nowak", ulkeKodu: "PL", bolge: "Polonya (tamamı)", asama: "degerlendirme", puan: 86, ilkSiparis: 10, tarih: "2026-10-28", eposta: "marta@polskaeps.pl", telefon: "+48 61 555 0198", vergiNo: "PL 7792 4410 22", kontroller: [true, false, true, false], gorusme: null },
  { id: "balkan", sirket: "Balkan Auto Diagnostics", yetkili: "Nikola Petrović", ulkeKodu: "RS", bolge: "Batı Balkanlar", asama: "basvuru", puan: 64, ilkSiparis: 5, tarih: "2026-11-01", eposta: "nikola@balkanautodiag.rs", telefon: "+381 11 555 0144", vergiNo: "RS 1093 4471", kontroller: [false, false, false, false], gorusme: null },
  { id: "iberia", sirket: "Iberia Dirección SL", yetkili: "Lucía Martín", ulkeKodu: "ES", bolge: "Valencia + Murcia", asama: "degerlendirme", puan: 72, ilkSiparis: 6, tarih: "2026-10-24", eposta: "lucia@iberiadireccion.es", telefon: "+34 96 555 0123", vergiNo: "ES B9844 1202", kontroller: [true, false, false, false], gorusme: null },
  { id: "hellas", sirket: "Hellas Steering Tech", yetkili: "Giorgos Papadakis", ulkeKodu: "GR", bolge: "Yunanistan + Kıbrıs", asama: "sozlesme", puan: 91, ilkSiparis: 12, tarih: "2026-10-09", eposta: "g.papadakis@hellassteering.gr", telefon: "+30 21 555 0187", vergiNo: "EL 8011 4392", kontroller: [true, true, true, false], gorusme: { tarih: "2026-11-06T11:00", not: "Destek taahhüdü maddesi" } },
  { id: "rizeni", sirket: "Řízení Servis s.r.o.", yetkili: "Tomáš Novák", ulkeKodu: "CZ", bolge: "Çekya + Slovakya", asama: "sozlesme", puan: 79, ilkSiparis: 8, tarih: "2026-10-02", eposta: "tomas@rizeni-servis.cz", telefon: "+420 2 555 0193", vergiNo: "CZ 2841 7720", kontroller: [true, true, false, false], gorusme: null },
  { id: "directie", sirket: "Direcție Pro SRL", yetkili: "Andrei Popescu", ulkeKodu: "RO", bolge: "Romanya", asama: "lansman", puan: 88, ilkSiparis: 10, tarih: "2026-09-14", eposta: "andrei@directiepro.ro", telefon: "+40 21 555 0110", vergiNo: "RO 4019 2281", kontroller: [true, true, true, true], gorusme: null },
];

const AKTIF_BAYILER: AktifBayi[] = [
  { id: "directie", ad: "Direcție Pro SRL", bolge: "Romanya", ulkeKodu: "RO", satilan: 18, stok: 4, moqHedef: 20, moqGerceklesen: 18 },
  { id: "autotech", ad: "AutoTech Distribution", bolge: "Bulgaristan", ulkeKodu: "BG", satilan: 11, stok: 9, moqHedef: 18, moqGerceklesen: 11 },
  { id: "volant-netz", ad: "Volant Partner Netz", bolge: "Almanya (Güney)", ulkeKodu: "DE", satilan: 26, stok: 12, moqHedef: 24, moqGerceklesen: 26 },
  { id: "kafkas", ad: "Kafkas Oto Teknik", bolge: "Azerbaycan + Gürcistan", ulkeKodu: "AZ", satilan: 6, stok: 1, moqHedef: 16, moqGerceklesen: 6 },
];

// Demo depo: sunucu belleğinde, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
const g = globalThis as { __embedraBayiler?: { basvurular: Basvuru[]; aktif: AktifBayi[] } };
const DEPO = (g.__embedraBayiler ??= { basvurular: structuredClone(BASVURULAR), aktif: structuredClone(AKTIF_BAYILER) });

export async function getBasvurular(): Promise<Basvuru[]> {
  return DEPO.basvurular;
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

export async function aktifBayiEkle(b: AktifBayi) {
  if (!DEPO.aktif.some((x) => x.id === b.id)) DEPO.aktif.unshift(b);
}
