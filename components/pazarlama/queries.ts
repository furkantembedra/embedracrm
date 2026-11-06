// Pazarlama & Bülten: veri okuma. Şimdilik demo veri döner (sunucu belleğinde, sayfalar arasında paylaşılır).
// Supabase bağlanınca fonksiyonların içini supabase.from("contents" | "campaigns" | "segments")... ile değiştirin.
// E-posta ve WhatsApp kampanyaları CRM'den toplu gönderilir (lib/ileti-gonder.ts); sağlayıcı anahtarı yoksa demo modunda çalışır.

export const ICERIK_KANALLARI = ["Instagram", "Bülten / e-posta", "Blog", "WhatsApp", "LinkedIn"] as const;
export type IcerikKanali = (typeof ICERIK_KANALLARI)[number];
export const KAMPANYA_KANALLARI = ["E-posta", "Instagram", "WhatsApp", "Fuar"] as const;
export type KampanyaKanali = (typeof KAMPANYA_KANALLARI)[number];
export const KAMPANYA_DURUMLARI = ["Taslak", "Aktif", "Tamamlandı"] as const;
export type KampanyaDurumu = (typeof KAMPANYA_DURUMLARI)[number];

/** İçeriğe eklenen görsel / video. Dosyanın kendisi medya deposunda durur, /api/medya/<id> adresinden okunur. */
export type Medya = { id: string; ad: string; tur: "gorsel" | "video"; boyut: number };

export type Icerik = {
  id: string;
  tarih: string; // "2026-11-04"
  kanal: IcerikKanali;
  baslik: string;
  paylasildi: boolean;
  kampanyaId: string | null;
  aciklama: string; // paylaşım metni (caption)
  hashtaglar: string[]; // "#" olmadan: ["CANFD", "otoelektrik"]
  medya: Medya[];
};

/** E-posta ve WhatsApp kampanyalarının mesajı. {ad} ve {firma} alanları kişiye göre doldurulur. */
export type KampanyaMesaji = {
  konu: string; // e-posta konusu (WhatsApp'ta kullanılmaz)
  metin: string;
  sablon: string; // WhatsApp: Meta'da onaylı şablonun adı ({ad} → {{1}}, {firma} → {{2}})
};
/** Otomatik gönderim: "yok" yalnızca elle · "planli" belirtilen zamanda bir kez · "surekli" listeye yeni girenlere (kampanya tarihleri içinde) */
export type Otomasyon = { tur: "yok" | "planli" | "surekli"; zaman: string | null }; // zaman: "2026-11-10T10:00" (planlı)

export type Kampanya = {
  id: string;
  ad: string;
  kanal: KampanyaKanali;
  listeId: string; // hedef liste
  baslangic: string; // "2026-11-01"
  bitis: string | null; // tek günlükse null
  durum: KampanyaDurumu;
  not: string;
  mesaj?: KampanyaMesaji;
  otomasyon?: Otomasyon;
};

export type GonderimKanali = "eposta" | "whatsapp";
/** Bir toplu gönderimin özeti (kişi başı sonuçlar tutulmaz, yalnızca hatalar) */
export type Gonderim = {
  id: string;
  kampanyaId: string;
  kanal: GonderimKanali;
  zaman: string; // "2026-11-06T14:05"
  tur: "elle" | "planli" | "otomatik" | "test";
  alici: number; // denenen kişi
  basarili: number;
  hatali: number;
  atlanan: number; // izinsiz, adresi eksik, daha önce gönderilmiş ya da abonelikten çıkmış
  demo: boolean; // sağlayıcı anahtarı yoksa gerçek gönderim yapılmaz
  hatalar: string[]; // ilk birkaç hata: "ali@x.com: geçersiz adres"
};

/** Hazır listeler CRM kayıtlarından süzülür; kullanıcı ayrıca filtreli liste kaydedebilir */
export type HazirListe = "bitiyor" | "basic" | "izinli" | "bayiler" | "kayip";
import type { IzinKanali } from "@/components/musteriler/izin";
/** izin: "" fark etmez · "herhangi" en az bir kanalda izinli · kanal adı yalnızca o kanalda izinli */
export type ListeFiltresi = { segment: string; plan: string; ulke: string; izin: "" | "herhangi" | IzinKanali };
/** CSV / Excel'den içe aktarılan kişi. kanallar: içe aktarırken beyan edilen izinler */
export type AktarilanKisi = { firma: string; kisi: string; eposta: string; telefon: string; ulke: string; kanallar: IzinKanali[] };
/** Kaydedilmiş liste: ya müşteri kayıtlarından filtreyle süzülür ya da dosyadan içe aktarılmış kişilerdir (aktarim) */
export type OzelListe = {
  id: string;
  ad: string;
  filtre: ListeFiltresi;
  aktarim?: { kaynak: string; tarih: string; izinKaynagi: string; kisiler: AktarilanKisi[] };
};

export const HAZIR_LISTELER: { id: HazirListe; ad: string; ipucu: string }[] = [
  { id: "bitiyor", ad: "Lisansı 30 gün içinde bitenler", ipucu: "bitiş tarihine göre" },
  { id: "basic", ad: "Basic plan kullanıcıları", ipucu: "plan alanına göre" },
  { id: "izinli", ad: "Duyuru izni olanlar", ipucu: "en az bir kanalda izinli yetkililer" },
  { id: "bayiler", ad: "Aktif bayiler", ipucu: "lansmanı yapılan bayiler" },
  { id: "kayip", ad: "Kaybedilen lead'ler", ipucu: "satış hattında kaybedildi" },
];

const DEMO_ICERIK_HAM: Omit<Icerik, "aciklama" | "hashtaglar" | "medya">[] = [
  { id: "i1", tarih: "2026-11-02", kanal: "Instagram", baslik: "Reels: AMOLED ekranda canlı voltaj", paylasildi: true, kampanyaId: "k-reels" },
  { id: "i2", tarih: "2026-11-03", kanal: "Blog", baslik: "Kolon EPS'de en sık 10 hata kodu", paylasildi: true, kampanyaId: null },
  { id: "i3", tarih: "2026-11-04", kanal: "WhatsApp", baslik: "Basic kullanıcılara Pro teklifi", paylasildi: true, kampanyaId: "k-pro" },
  { id: "i4", tarih: "2026-11-04", kanal: "Instagram", baslik: "Story: müşteri atölyesi", paylasildi: false, kampanyaId: null },
  { id: "i5", tarih: "2026-11-05", kanal: "Bülten / e-posta", baslik: "Kasım duyurusu", paylasildi: true, kampanyaId: "k-kasim" },
  { id: "i6", tarih: "2026-11-06", kanal: "Instagram", baslik: "Karusel: K-Line ve CAN-FD farkı", paylasildi: false, kampanyaId: null },
  { id: "i7", tarih: "2026-11-08", kanal: "Instagram", baslik: "Haftalık soru-cevap", paylasildi: false, kampanyaId: null },
  { id: "i8", tarih: "2026-11-10", kanal: "LinkedIn", baslik: "Bayi ağımıza Romanya katıldı", paylasildi: false, kampanyaId: null },
  { id: "i9", tarih: "2026-11-12", kanal: "Blog", baslik: "FlexRay nedir, hangi araçlarda var?", paylasildi: false, kampanyaId: null },
  { id: "i10", tarih: "2026-11-13", kanal: "WhatsApp", baslik: "Lisansı bitenlere yenileme hatırlatması", paylasildi: false, kampanyaId: "k-yenileme" },
  { id: "i11", tarih: "2026-11-18", kanal: "Instagram", baslik: "Reels: Flash öncesi besleme kontrolü", paylasildi: false, kampanyaId: null },
  { id: "i12", tarih: "2026-11-24", kanal: "Bülten / e-posta", baslik: "Black Friday: Pro+ yükseltme", paylasildi: false, kampanyaId: null },
];

const DEMO_ICERIK: Icerik[] = DEMO_ICERIK_HAM.map((i) => ({
  ...i,
  aciklama: i.id === "i6" ? "K-Line mi CAN-FD mi? Direksiyon kutusunun hangi hattan konuştuğunu bilmek teşhisin yarısı. Kaydırın 👉" : "",
  hashtaglar: i.id === "i6" ? ["EmbedraONE", "CANFD", "otoelektrik", "EPS"] : [],
  medya: [],
}));

const DEMO_KAMPANYA: Kampanya[] = [
  { id: "k-yenileme", ad: "Lisans yenileme hatırlatması", kanal: "E-posta", listeId: "bitiyor", baslangic: "2026-11-01", bitis: "2026-11-30", durum: "Aktif", not: "Bitişe 30, 7 ve 1 gün kala" },
  { id: "k-pro", ad: "Basic → Pro yükseltme", kanal: "WhatsApp", listeId: "basic", baslangic: "2026-10-20", bitis: "2026-11-20", durum: "Aktif", not: "İlk yıl %10 indirim" },
  { id: "k-ekim", ad: "Ekim duyurusu", kanal: "E-posta", listeId: "izinli", baslangic: "2026-10-07", bitis: null, durum: "Tamamlandı", not: "" },
  { id: "k-reels", ad: "ONE ile 4 adımda EPS onarımı", kanal: "Instagram", listeId: "izinli", baslangic: "2026-10-14", bitis: null, durum: "Tamamlandı", not: "Reels paylaşımı" },
  { id: "k-kasim", ad: "Kasım duyurusu", kanal: "E-posta", listeId: "izinli", baslangic: "2026-11-05", bitis: null, durum: "Tamamlandı", not: "" },
  { id: "k-kit", ad: "Bayilere marka kiti", kanal: "E-posta", listeId: "bayiler", baslangic: "2026-11-15", bitis: null, durum: "Taslak", not: "Logo, broşür ve fiyat listesi" },
];

const DEMO_GONDERIM: Gonderim[] = [
  { id: "g1", kampanyaId: "k-kasim", kanal: "eposta", zaman: "2026-11-05T10:00", tur: "elle", alici: 6, basarili: 6, hatali: 0, atlanan: 2, demo: true, hatalar: [] },
  { id: "g2", kampanyaId: "k-ekim", kanal: "eposta", zaman: "2026-10-07T10:00", tur: "elle", alici: 5, basarili: 5, hatali: 0, atlanan: 1, demo: true, hatalar: [] },
  { id: "g3", kampanyaId: "k-pro", kanal: "whatsapp", zaman: "2026-10-21T11:30", tur: "elle", alici: 2, basarili: 2, hatali: 0, atlanan: 0, demo: true, hatalar: [] },
];
const DEMO_MESAJ: Record<string, KampanyaMesaji> = {
  "k-yenileme": { konu: "{firma} · lisansınız yakında bitiyor", metin: "Merhaba {ad},\n\nEmbedraONE lisansınızın bitiş tarihi yaklaşıyor. Kesintisiz kullanım için yenilemeyi şimdiden yapabilirsiniz.\n\nSorularınız için bu e-postayı yanıtlamanız yeterli.", sablon: "" },
  "k-pro": { konu: "", metin: "Merhaba {ad}, {firma} için Basic'ten Pro'ya geçişte ilk yıl %10 indirim tanımladık. Detay için bu mesajı yanıtlayabilirsiniz.", sablon: "pro_yukseltme_teklifi" },
};

type Depo = { icerikler: Icerik[]; kampanyalar: Kampanya[]; listeler: OzelListe[]; gonderimler: Gonderim[]; ulasilan: Record<string, string[]>; engelli: string[] };
const g = globalThis as { __embedraPazarlama?: Depo };
const DEPO = (g.__embedraPazarlama ??= {
  icerikler: structuredClone(DEMO_ICERIK),
  kampanyalar: structuredClone(DEMO_KAMPANYA),
  listeler: [],
  gonderimler: structuredClone(DEMO_GONDERIM),
  ulasilan: {},
  engelli: [],
});
// Sonradan eklenen alanlar (sunucu yeniden başlatılmadan eski kayıtlara)
DEPO.gonderimler ??= structuredClone(DEMO_GONDERIM);
DEPO.ulasilan ??= {};
DEPO.engelli ??= [];
for (const i of DEPO.icerikler) {
  i.aciklama ??= "";
  i.hashtaglar ??= [];
  i.medya ??= [];
}
for (const k of DEPO.kampanyalar) {
  if (!k.mesaj && DEMO_MESAJ[k.id]) k.mesaj = structuredClone(DEMO_MESAJ[k.id]);
  k.otomasyon ??= { tur: k.id === "k-yenileme" ? "surekli" : "yok", zaman: null };
}

export async function getIcerikler(): Promise<Icerik[]> {
  return DEPO.icerikler;
}
export async function getKampanyalar(): Promise<Kampanya[]> {
  return DEPO.kampanyalar;
}
export async function getGonderimler(): Promise<Gonderim[]> {
  return DEPO.gonderimler;
}
/** Kampanyanın daha önce ulaştığı kişiler (kanal anahtarı: e-posta ya da telefon). Aynı kişiye iki kez gönderilmez. */
export async function getUlasilan(kampanyaId: string): Promise<string[]> {
  return DEPO.ulasilan[kampanyaId] ?? [];
}
/** Abonelikten çıkan e-posta / telefonlar: hangi listede olursa olsun gönderilmez */
export async function getEngelli(): Promise<string[]> {
  return DEPO.engelli;
}
export async function getOzelListeler(): Promise<OzelListe[]> {
  // Eski kayıtlar: "sadeceIzinli" kutusu kanal seçimine çevrilir (sunucu yeniden başlatılmadan)
  for (const l of DEPO.listeler as (OzelListe & { filtre: { sadeceIzinli?: boolean } })[]) {
    if (l.filtre.izin === undefined) l.filtre.izin = l.filtre.sadeceIzinli ? "herhangi" : "";
  }
  return DEPO.listeler;
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır. TODO: Supabase bağlanınca insert/update/delete sorgularına dönüşecek.
export async function icerikEkle(i: Icerik) {
  DEPO.icerikler.push(i);
}
export async function icerigiGuncelle(id: string, f: (i: Icerik) => void) {
  const i = DEPO.icerikler.find((x) => x.id === id);
  if (i) f(i);
  return i ?? null;
}
export async function icerigiSil(id: string) {
  const n = DEPO.icerikler.length;
  DEPO.icerikler = DEPO.icerikler.filter((x) => x.id !== id);
  return DEPO.icerikler.length < n;
}
export async function gonderimEkle(gd: Gonderim, ulasilan: string[]) {
  DEPO.gonderimler.unshift(gd);
  if (gd.tur !== "test") DEPO.ulasilan[gd.kampanyaId] = [...new Set([...(DEPO.ulasilan[gd.kampanyaId] ?? []), ...ulasilan])];
}
export async function engelliEkle(anahtar: string) {
  if (!DEPO.engelli.includes(anahtar)) DEPO.engelli.push(anahtar);
}
export async function aktarilanKisiGuncelle(listeId: string, f: (k: AktarilanKisi[]) => void) {
  const l = DEPO.listeler.find((x) => x.id === listeId);
  if (l?.aktarim) f(l.aktarim.kisiler);
}
export async function kampanyaKaydetDepo(k: Kampanya) {
  const i = DEPO.kampanyalar.findIndex((x) => x.id === k.id);
  if (i >= 0) DEPO.kampanyalar[i] = k;
  else DEPO.kampanyalar.unshift(k);
}
export async function ozelListeEkle(l: OzelListe) {
  DEPO.listeler.push(l);
}
export async function ozelListeSil(id: string) {
  DEPO.listeler = DEPO.listeler.filter((x) => x.id !== id);
}
