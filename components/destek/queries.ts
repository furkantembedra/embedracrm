// Destek: veri okuma. Şimdilik demo veri döner;
// Supabase bağlanınca fonksiyonların içini supabase.from("tickets")... ile değiştirin.
import { KANALLAR, ONCELIKLER } from "@/lib/constants";

export type TalepDurumu = "yeni" | "islemde" | "beklemede" | "cozuldu";
export type Oncelik = (typeof ONCELIKLER)[number];
export type Kanal = (typeof KANALLAR)[number];
export const KONULAR = ["Bağlantı", "Flash / yazılım", "Lisans", "Donanım arızası", "Araç kapsamı isteği", "Diğer"] as const;
export type Konu = (typeof KONULAR)[number];

export type NotTuru = "acilis" | "not" | "gorusme" | "yapilacak" | "beklemede" | "cozuldu" | "islemde" | "yeniden";
export type TalepNotu = { tur: NotTuru; metin: string; zaman: string; dosya?: string }; // zaman: "2026-11-04T09:35"

export type Talep = {
  id: string; // "4821"
  durum: TalepDurumu;
  baslik: string;
  aciklama: string;
  oncelik: Oncelik;
  konu: Konu;
  kanal: Kanal;
  acilis: string; // "2026-11-04T09:02"
  dosya: string | null;
  musteriId: string | null;
  musteri: string;
  yetkili: string;
  telefon: string;
  eposta: string;
  seriNo: string | null;
  plan: string;
  firmware: string;
  arac: string;
  notlar: TalepNotu[]; // eskiden yeniye
};

export const DURUM_ADI: Record<TalepDurumu, string> = { yeni: "Yeni", islemde: "İşlemde", beklemede: "Beklemede", cozuldu: "Çözüldü" };

export const NOT_BILGI: Record<NotTuru, { ad: string; renk: string }> = {
  acilis: { ad: "Talep açıldı", renk: "#C9CCC2" },
  not: { ad: "Not", renk: "#2F4BFF" },
  gorusme: { ad: "Telefon görüşmesi", renk: "#2F4BFF" },
  yapilacak: { ad: "Yapılacak", renk: "#E58A2B" },
  beklemede: { ad: "Beklemeye alındı", renk: "#E58A2B" },
  cozuldu: { ad: "Çözüldü", renk: "#1F8A4C" },
  islemde: { ad: "İşleme alındı", renk: "#0E0F0C" },
  yeniden: { ad: "Yeniden açıldı", renk: "#0E0F0C" },
};

const DEMO: Talep[] = [
  {
    id: "4821", durum: "islemde", baslik: "Flash sonrası ECU yanıt vermiyor", oncelik: "Yüksek", konu: "Flash / yazılım", kanal: "E-posta",
    acilis: "2026-11-04T09:02", dosya: "onesuite_log_0211.txt",
    aciklama: "Flash işlemi %96'da durmuş, ECU artık hiçbir protokolde yanıt vermiyor. Müşteri log dosyasını e-postayla gönderdi; dosya talebe eklendi.",
    musteriId: "volant", musteri: "Volant Lenkung Service GmbH", yetkili: "Jonas Weber", telefon: "+49 711 555 0142", eposta: "j.weber@volant-service.de",
    seriNo: "EO1-2402-0611", plan: "Pro+", firmware: "v2.4.1", arac: "VW Golf 7 · kremayer EPS",
    notlar: [
      { tur: "acilis", metin: "E-postadaki bilgilerle kaydedildi, log dosyası eklendi.", zaman: "2026-11-04T09:02" },
      { tur: "gorusme", metin: "Flash sırasında besleme yaklaşık 11,4V imiş. Düşük voltaj kaynaklı kesinti olabilir.", zaman: "2026-11-04T09:35" },
      { tur: "yapilacak", metin: "Harici 12V besleme ile kurtarma modu adımları müşteriye anlatılacak.", zaman: "2026-11-04T10:20" },
    ],
  },
  {
    id: "4819", durum: "yeni", baslik: "Lisans aktivasyon kodu geçersiz", oncelik: "Yüksek", konu: "Lisans", kanal: "WhatsApp",
    acilis: "2026-11-04T10:15", dosya: null,
    aciklama: "İkinci cihazda aktivasyon kodu “geçersiz” hatası veriyor. Pro+ lisansı iki cihazı kapsıyor.",
    musteriId: "polska", musteri: "Polska EPS Serwis", yetkili: "Marta Nowak", telefon: "+48 61 555 0198", eposta: "marta@polskaeps.pl",
    seriNo: "EO1-2404-0391", plan: "Pro+", firmware: "v2.4.0", arac: "—",
    notlar: [{ tur: "acilis", metin: "WhatsApp mesajından kaydedildi.", zaman: "2026-11-04T10:15" }],
  },
  {
    id: "4817", durum: "islemde", baslik: "K-Line bağlantı hatası", oncelik: "Orta", konu: "Bağlantı", kanal: "Telefon",
    acilis: "2026-11-04T08:40", dosya: null,
    aciklama: "Doblo kolonunda K-Line ile bağlantı kurulamıyor, cihaz “no response” gösteriyor.",
    musteriId: "kaya", musteri: "Kaya Oto Elektronik", yetkili: "Serkan Kaya", telefon: "+90 533 290 41 77", eposta: "serkan@kayaotoelektronik.com",
    seriNo: "EO1-2406-0455", plan: "Pro", firmware: "v2.4.1", arac: "Fiat Doblo · kolon EPS",
    notlar: [
      { tur: "acilis", metin: "Telefonla bildirildi.", zaman: "2026-11-04T08:40" },
      { tur: "not", metin: "Pin kablosunun bağlantı fotoğrafı istendi.", zaman: "2026-11-04T08:52" },
    ],
  },
  {
    id: "4815", durum: "beklemede", baslik: "OLED ekran dokunmaya yanıt vermiyor", oncelik: "Orta", konu: "Donanım arızası", kanal: "E-posta",
    acilis: "2026-11-03T16:20", dosya: null,
    aciklama: "Cihaz açılıyor ama ekran dokunmaya tepki vermiyor. Yeniden başlatma işe yaramamış.",
    musteriId: "nordic", musteri: "Nordic Steering AB", yetkili: "Erik Lindqvist", telefon: "+46 31 555 0170", eposta: "erik@nordicsteering.se",
    seriNo: "EO1-2312-0412", plan: "Pro+", firmware: "v2.4.1", arac: "—",
    notlar: [
      { tur: "acilis", metin: "E-postadan kaydedildi.", zaman: "2026-11-03T16:20" },
      { tur: "beklemede", metin: "Cihazın servise gönderilmesi bekleniyor.", zaman: "2026-11-04T09:00" },
    ],
  },
  {
    id: "4802", durum: "cozuldu", baslik: "ONESuite kurulumu macOS", oncelik: "Düşük", konu: "Diğer", kanal: "Telefon",
    acilis: "2026-10-28T11:10", dosya: null,
    aciklama: "macOS'ta kurulum sırasında güvenlik uyarısı alınıyor.",
    musteriId: "bursa", musteri: "Bursa ECU Lab", yetkili: "Burak Şen", telefon: "+90 224 555 30 14", eposta: "burak@bursaeculab.com",
    seriNo: "EO1-2310-0218", plan: "Pro+", firmware: "v2.4.1", arac: "—",
    notlar: [
      { tur: "acilis", metin: "Telefonla bildirildi.", zaman: "2026-10-28T11:10" },
      { tur: "cozuldu", metin: "Sistem ayarlarından izin verme adımları anlatıldı.", zaman: "2026-10-28T11:40" },
    ],
  },
];

// Demo depo: sunucu belleğinde, sayfalar arasında paylaşılır (sunucu yeniden başlayınca sıfırlanır).
const g = globalThis as { __embedraTalepler?: Talep[] };
const DEPO = (g.__embedraTalepler ??= structuredClone(DEMO));
// Eski "Açık" durumundaki kayıtlar: not yazılmışsa İşlemde, yoksa Yeni sayılır (sunucuyu yeniden başlatmadan geçiş)
for (const t of DEPO) {
  if ((t.durum as string) === "acik") t.durum = t.notlar.some((n) => n.tur !== "acilis") ? "islemde" : "yeni";
}

export async function getTalepler(): Promise<Talep[]> {
  return DEPO;
}

export async function getTalep(id: string): Promise<Talep | null> {
  return DEPO.find((t) => t.id === id) ?? null;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function talepEkle(t: Omit<Talep, "id">): Promise<Talep> {
  const no = DEPO.reduce((enBuyuk, x) => Math.max(enBuyuk, Number(x.id) || 0), 0) + 1;
  const talep = { ...t, id: String(no) };
  DEPO.unshift(talep);
  return talep;
}

export async function talebiGuncelle(id: string, degisiklik: (t: Talep) => void): Promise<Talep | null> {
  const t = DEPO.find((x) => x.id === id);
  if (t) degisiklik(t);
  return t ?? null;
}

export async function sonrakiTalepNo(): Promise<string> {
  return String(DEPO.reduce((enBuyuk, x) => Math.max(enBuyuk, Number(x.id) || 0), 0) + 1);
}
