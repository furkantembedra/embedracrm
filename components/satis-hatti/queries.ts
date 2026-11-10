// Satış Hattı: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca getFirsatlar() içini supabase.from("deals")... ile değiştirin.

export const ASAMALAR = ["yeni", "demo", "teklif", "muzakere", "kazanildi", "kaybedildi"] as const;
export type Asama = (typeof ASAMALAR)[number];

export const ASAMA_BILGI: Record<Asama, { ad: string; renk: string }> = {
  yeni: { ad: "Yeni lead", renk: "#C9CCC2" },
  demo: { ad: "Demo planlandı", renk: "#2F4BFF" },
  teklif: { ad: "Teklif gönderildi", renk: "#E58A2B" },
  muzakere: { ad: "Müzakere", renk: "#0E0F0C" },
  kazanildi: { ad: "Kazanıldı", renk: "#B6DD2E" },
  kaybedildi: { ad: "Kaybedildi", renk: "#D93F3F" },
};

/** Kazanıldı ve Kaybedildi kapalı aşamalardır: açık fırsat değerine ve gecikme uyarısına girmez */
export const KAPALI_ASAMALAR: readonly Asama[] = ["kazanildi", "kaybedildi"];

export const KAYIP_NEDENLERI = ["Fiyat yüksek bulundu", "Rakibi seçti", "Bütçe yok", "Yanıt vermiyor", "İhtiyacı kalmadı", "Diğer"] as const;
export type KayipNedeni = (typeof KAYIP_NEDENLERI)[number];
export type KayipBilgisi = { neden: KayipNedeni; aciklama?: string };

export const KAYNAKLAR = ["Web sitesi", "WhatsApp", "Instagram", "Bayi", "Fuar", "Mevcut müşteri"] as const;
export type Kaynak = (typeof KAYNAKLAR)[number];

/** WhatsApp yazışması: gelen mesajlar webhook'tan, giden notlar CRM'den */
export type WhatsappMesaji = { id: string; metin: string; zaman: string; yon: "gelen" | "giden"; tur: string }; // zaman: ISO

export type Firsat = {
  id: string;
  firma: string;
  konum: string;
  kaynak: Kaynak;
  icerik: string; // "2× ONE + Pro+ lisans"
  tutar: number; // TL
  asama: Asama;
  sonrakiAdim: string;
  sonrakiTarih: string; // "2026-11-05"
  kayipNedeni?: KayipNedeni; // yalnızca Kaybedildi aşamasında
  kayipAciklama?: string; // "Diğer" seçilince yazılan sebep
  kampanyaId?: string | null; // lead hangi pazarlama kampanyasından geldi
  telefon?: string; // "+905321234567" (WhatsApp lead'lerinde otomatik dolar)
  mesajlar?: WhatsappMesaji[]; // eskiden yeniye
  bayiId?: string | null; // lead bir bayiye yönlendirildiyse (bayi portalında görünür)
  sonHareket?: string; // "2026-11-06" son aşama / bilgi değişikliği (hatırlatmalardaki "hareketsiz" kuralı)
};

const DEMO: Firsat[] = [
  { id: "f1", firma: "Mert Usta Oto", konum: "Kocaeli, TR", kaynak: "Instagram", icerik: "1× ONE + Pro lisans", tutar: 184_000, asama: "yeni", sonrakiAdim: "İlk arama", sonrakiTarih: "2026-11-03" },
  { id: "f2", firma: "Sarajevo Auto Elektro", konum: "Bosna-Hersek", kaynak: "Web sitesi", icerik: "1× ONE + Basic", tutar: 142_000, asama: "yeni", sonrakiAdim: "Fiyat listesi gönder", sonrakiTarih: "2026-11-04" },
  { id: "f3", firma: "Konya Direksiyon Merkezi", konum: "Konya, TR", kaynak: "WhatsApp", icerik: "2× ONE + Pro+", tutar: 356_000, asama: "yeni", sonrakiAdim: "İhtiyaç analizi", sonrakiTarih: "2026-11-04" },
  { id: "f4", firma: "Iberia Dirección SL", konum: "Valencia, ES", kaynak: "Fuar", icerik: "3× ONE + Pro+", tutar: 520_000, asama: "demo", sonrakiAdim: "Online demo 14:00", sonrakiTarih: "2026-11-05" },
  { id: "f5", firma: "Ege Meslek Yüksekokulu", konum: "Manisa, TR", kaynak: "Mevcut müşteri", icerik: "Eğitim seti · 4 cihaz", tutar: 520_000, asama: "demo", sonrakiAdim: "Laboratuvar ziyareti", sonrakiTarih: "2026-11-07" },
  { id: "f6", firma: "Atelier Direction Lyon", konum: "Lyon, FR", kaynak: "Web sitesi", icerik: "Basic → Pro yükseltme", tutar: 106_000, asama: "teklif", sonrakiAdim: "Takip e-postası", sonrakiTarih: "2026-10-31" },
  { id: "f7", firma: "Başkent Rot & Direksiyon", konum: "Ankara, TR", kaynak: "Mevcut müşteri", icerik: "Pro yükseltme + 1 cihaz", tutar: 214_000, asama: "teklif", sonrakiAdim: "Teklif EMB-2026-342", sonrakiTarih: "2026-11-06" },
  { id: "f8", firma: "Polska EPS Serwis", konum: "Poznań, PL", kaynak: "Bayi", icerik: "10× ONE · bayi stoğu", tutar: 1_410_000, asama: "muzakere", sonrakiAdim: "MOQ ve bölge hakkı", sonrakiTarih: "2026-11-08" },
  { id: "f9", firma: "Nordic Steering AB", konum: "Göteborg, SE", kaynak: "Mevcut müşteri", icerik: "Pro+ yenileme · 2 yıl", tutar: 234_000, asama: "muzakere", sonrakiAdim: "İndirim onayı", sonrakiTarih: "2026-11-12" },
  { id: "f10", firma: "Volant Lenkung Service", konum: "Stuttgart, DE", kaynak: "Fuar", icerik: "2× ONE + Pro+", tutar: 359_000, asama: "kazanildi", sonrakiAdim: "Sevkiyat hazırlanıyor", sonrakiTarih: "2026-11-03" },
  { id: "f11", firma: "Bursa ECU Lab", konum: "Bursa, TR", kaynak: "WhatsApp", icerik: "Pro+ yenileme", tutar: 96_000, asama: "kazanildi", sonrakiAdim: "Fatura kesildi", sonrakiTarih: "2026-11-01" },
  { id: "f12", firma: "Rota Servis Konya", konum: "Konya, TR", kaynak: "Web sitesi", icerik: "1× ONE + Pro", tutar: 178_000, asama: "kaybedildi", sonrakiAdim: "6 ay sonra tekrar ara", sonrakiTarih: "2027-04-15", kayipNedeni: "Bütçe yok" },
];

// Lead'lerin geldiği kampanyalar (demo): pazarlama sayfasındaki "gelen lead / satışa dönen" buradan sayılır
const DEMO_KAMPANYA: Record<string, string> = { f1: "k-reels", f6: "k-pro", f3: "k-pro", f5: "k-ekim", f9: "k-yenileme", f11: "k-yenileme", f12: "k-reels" };

// Demo depo: sunucu belleğinde, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
const g = globalThis as { __embedraFirsatlar?: Firsat[] };
const DEPO = (g.__embedraFirsatlar ??= DEMO.map((f) => ({ ...f, kampanyaId: DEMO_KAMPANYA[f.id] ?? null })));

// Sonradan eklenen alanların demo değerleri (bellekte eski depo varsa da tamamlanır)
const DEMO_EK: Record<string, Partial<Firsat>> = {
  f3: { telefon: "+905321112233", mesajlar: [{ id: "demo-wa-1", metin: "Merhaba, 2 adet ONE ve Pro+ lisans için fiyat alabilir miyim?", zaman: "2026-11-03T10:12:00.000Z", yon: "gelen", tur: "text" }] },
  f11: { telefon: "+905441234567" },
  f2: { bayiId: "autotech", sonHareket: "2026-10-30" },
  f10: { bayiId: "volant-netz" },
  f8: { sonHareket: "2026-11-02" },
  f4: { sonHareket: "2026-11-04" },
};
for (const f of DEPO) for (const [k, v] of Object.entries(DEMO_EK[f.id] ?? {})) (f as Record<string, unknown>)[k] ??= v;

export async function getFirsatlar(): Promise<Firsat[]> {
  return DEPO;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function firsatKaydetDepo(f: Firsat) {
  const i = DEPO.findIndex((x) => x.id === f.id);
  const sonHareket = new Date().toISOString().slice(0, 10);
  if (i >= 0) {
    const e = DEPO[i];
    DEPO[i] = { ...f, asama: e.asama, kayipNedeni: e.kayipNedeni, kayipAciklama: e.kayipAciklama, telefon: f.telefon ?? e.telefon, mesajlar: e.mesajlar, sonHareket };
  } else DEPO.push({ ...f, sonHareket });
}

export async function firsatAsamasiDepo(id: string, asama: Asama, kayip?: KayipBilgisi) {
  const f = DEPO.find((x) => x.id === id);
  if (!f) return;
  f.asama = asama;
  f.sonHareket = new Date().toISOString().slice(0, 10);
  f.kayipNedeni = kayip?.neden;
  f.kayipAciklama = kayip?.aciklama;
}

export async function getFirsat(id: string): Promise<Firsat | null> {
  return DEPO.find((x) => x.id === id) ?? null;
}

/** Aşama dışındaki alanları günceller (teklif tutarı, WhatsApp mesajı, bayi yönlendirmesi) */
export async function firsatiGuncelle(id: string, f: (x: Firsat) => void): Promise<Firsat | null> {
  const x = DEPO.find((y) => y.id === id);
  if (!x) return null;
  f(x);
  x.sonHareket = new Date().toISOString().slice(0, 10);
  return x;
}

export async function firsatEkleDepo(f: Firsat) {
  DEPO.push({ ...f, sonHareket: f.sonHareket ?? new Date().toISOString().slice(0, 10) });
}
