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

export async function getFirsatlar(): Promise<Firsat[]> {
  return DEPO;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function firsatKaydetDepo(f: Firsat) {
  const i = DEPO.findIndex((x) => x.id === f.id);
  if (i >= 0) DEPO[i] = { ...f, asama: DEPO[i].asama, kayipNedeni: DEPO[i].kayipNedeni, kayipAciklama: DEPO[i].kayipAciklama };
  else DEPO.push(f);
}

export async function firsatAsamasiDepo(id: string, asama: Asama, kayip?: KayipBilgisi) {
  const f = DEPO.find((x) => x.id === id);
  if (!f) return;
  f.asama = asama;
  f.kayipNedeni = kayip?.neden;
  f.kayipAciklama = kayip?.aciklama;
}
