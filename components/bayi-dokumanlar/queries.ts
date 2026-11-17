// Bayi dokümanları, duyurular ve eğitim tamamlama kayıtları (demo: sunucu belleğinde).
// TODO: Supabase'de bayi_dokumanlari / bayi_duyurulari / bayi_egitim tabloları; dosyalar Storage "dealer-docs" bucket'ında.
import type { BayiDokumani, Duyuru } from "./ortak";

const DEMO_DOKUMANLAR: BayiDokumani[] = [
  { id: "d-brosur-one", baslik: "EmbedraONE ürün broşürü", aciklama: "AMOLED dokunmatik ekranlı model: özellikler, kutu içeriği, desteklenen protokoller.", kategori: "Ürün broşürleri", tur: "pdf", dosyaAdi: "EmbedraONE-brosur.pdf", boyut: 2_400_000, tarih: "2026-10-05", hedef: "hepsi", demo: true },
  { id: "d-brosur-lite", baslik: "EmbedraONE LITE ürün broşürü", aciklama: "Ekransız model ve ONE ile karşılaştırma tablosu.", kategori: "Ürün broşürleri", tur: "pdf", dosyaAdi: "EmbedraONE-LITE-brosur.pdf", boyut: 1_800_000, tarih: "2026-10-05", hedef: "hepsi", demo: true },
  { id: "d-onesuite", baslik: "ONESuite lisans paketleri", aciklama: "Basic, Pro, Pro+, Premium ve Enterprise paketlerinin farkları.", kategori: "Ürün broşürleri", tur: "pdf", dosyaAdi: "ONESuite-paketler.pdf", boyut: 950_000, tarih: "2026-11-03", hedef: "hepsi", demo: true },
  { id: "d-kurulum", baslik: "Kurulum kılavuzu", aciklama: "Kutudan çıkarma, ilk açılış, ONESuite eşleştirme ve lisans aktivasyonu.", kategori: "Teknik dokümanlar", tur: "pdf", dosyaAdi: "Kurulum-kilavuzu.pdf", boyut: 3_100_000, tarih: "2026-09-12", hedef: "hepsi", demo: true },
  { id: "d-kullanim", baslik: "Kullanım kılavuzu", aciklama: "Teşhis, kalibrasyon ve raporlama ekranları adım adım.", kategori: "Teknik dokümanlar", tur: "pdf", dosyaAdi: "Kullanim-kilavuzu.pdf", boyut: 5_600_000, tarih: "2026-09-12", hedef: "hepsi", demo: true },
  { id: "d-sss", baslik: "Sık sorulan sorular", aciklama: "Bağlantı, lisans ve garanti hakkında en çok sorulanlar.", kategori: "Teknik dokümanlar", tur: "pdf", dosyaAdi: "SSS.pdf", boyut: 420_000, tarih: "2026-11-08", hedef: "hepsi", demo: true },
  { id: "d-fw241", baslik: "Firmware v2.4.1 sürüm notları", aciklama: "K-Line kararlılık düzeltmesi, yeni araç kapsamı, ekran parlaklığı ayarı.", kategori: "Teknik dokümanlar", tur: "pdf", dosyaAdi: "Firmware-v2.4.1-notlar.pdf", boyut: 180_000, tarih: "2026-11-11", hedef: "hepsi", demo: true },
  { id: "d-kapsam", baslik: "Araç kapsam listesi (Kasım 2026)", aciklama: "Marka / model / yıl bazında desteklenen EPS ve direksiyon sistemleri.", kategori: "Teknik dokümanlar", tur: "pdf", dosyaAdi: "Arac-kapsam-listesi.pdf", boyut: 1_200_000, tarih: "2026-11-01", hedef: "hepsi", demo: true },
  { id: "e-kurulum", baslik: "Modül 1 · Kurulum ve ilk çalıştırma", aciklama: "Cihazı müşteride kurma, ONESuite hesabı açma ve lisans aktivasyonu.", kategori: "Eğitim", tur: "pdf", dosyaAdi: "Egitim-1-kurulum.pdf", boyut: 1_400_000, tarih: "2026-09-15", hedef: "hepsi", sure: "12 dk", demo: true },
  { id: "e-lisans", baslik: "Modül 2 · Lisans ve yenileme yönetimi", aciklama: "Bitiş takibi, yenileme siparişi, paket yükseltme.", kategori: "Eğitim", tur: "pdf", dosyaAdi: "Egitim-2-lisans.pdf", boyut: 900_000, tarih: "2026-09-15", hedef: "hepsi", sure: "8 dk", demo: true },
  { id: "e-teshis", baslik: "Modül 3 · Arıza teşhisi ve RMA", aciklama: "Sık arızalar, sahada kontrol listesi, RMA açma ve cihaz gönderimi.", kategori: "Eğitim", tur: "pdf", dosyaAdi: "Egitim-3-teshis.pdf", boyut: 2_000_000, tarih: "2026-10-01", hedef: "hepsi", sure: "20 dk", demo: true },
  { id: "e-satis", baslik: "Modül 4 · Satış sunumu ve demo", aciklama: "Atölyede 15 dakikalık demo akışı ve sık itirazlara cevaplar.", kategori: "Eğitim", tur: "pdf", dosyaAdi: "Egitim-4-satis.pdf", boyut: 1_100_000, tarih: "2026-10-20", hedef: "hepsi", sure: "15 dk", demo: true },
  { id: "d-kosullar", baslik: "Bayilik genel koşulları", aciklama: "Sipariş, ödeme, iade ve garanti koşulları (sözleşme eki 1).", kategori: "Sözleşme ekleri", tur: "pdf", dosyaAdi: "Bayilik-genel-kosullari.pdf", boyut: 640_000, tarih: "2026-09-14", hedef: "hepsi", demo: true },
  { id: "d-marka", baslik: "Marka kullanım kılavuzu", aciklama: "Logo, renk, yazı tipi ve 'Yetkili Embedra bayisi' rozeti kullanımı (sözleşme eki 2).", kategori: "Sözleşme ekleri", tur: "pdf", dosyaAdi: "Marka-kullanim-kilavuzu.pdf", boyut: 3_800_000, tarih: "2026-09-14", hedef: "hepsi", demo: true },
];

const DEMO_DUYURULAR: Duyuru[] = [
  { id: "y-1", baslik: "Firmware v2.4.1 yayında", metin: "K-Line bağlantı kopması düzeltildi ve 38 yeni araç modeli kapsama eklendi. Müşterilerinize cihazlarını ONESuite üzerinden güncellemelerini hatırlatın.", onem: "onemli", tarih: "2026-11-11T09:30", hedef: "hepsi", okuyanlar: [] },
  { id: "y-2", baslik: "Q1 2027 fiyat listesi 1 Ocak'ta güncelleniyor", metin: "Cihaz fiyatlarında %4 artış planlanıyor; lisans fiyatları değişmiyor. 31 Aralık'a kadar verilen siparişler mevcut fiyatlardan işlenir.", onem: "onemli", tarih: "2026-11-05T14:00", hedef: "hepsi", okuyanlar: ["volant-netz"] },
  { id: "y-3", baslik: "Automechanika Bükreş stand desteği", metin: "Mart 2027 fuarı için Romanya bayimize stand malzemesi ve demo cihaz desteği verilecek. Detaylar için temsilcinizle görüşün.", onem: "normal", tarih: "2026-10-28T11:00", hedef: ["directie"], okuyanlar: [] },
];

const g = globalThis as { __embedraBayiDok?: { dokumanlar: BayiDokumani[]; duyurular: Duyuru[]; dosyalar: Map<string, Uint8Array>; egitim: Map<string, Set<string>> } };
const DEPO = (g.__embedraBayiDok ??= {
  dokumanlar: structuredClone(DEMO_DOKUMANLAR),
  duyurular: structuredClone(DEMO_DUYURULAR),
  dosyalar: new Map(),
  egitim: new Map([["directie", new Set(["e-kurulum", "e-lisans"])]]),
});

export async function getDokumanlar() { return DEPO.dokumanlar; }
export async function getDokuman(id: string) { return DEPO.dokumanlar.find((d) => d.id === id) ?? null; }
export async function dokumanEkle(d: BayiDokumani, veri: Uint8Array) { DEPO.dosyalar.set(d.id, veri); DEPO.dokumanlar.unshift(d); }
export async function dokumanSilDepo(id: string) { DEPO.dokumanlar = DEPO.dokumanlar.filter((d) => d.id !== id); DEPO.dosyalar.delete(id); }
export const dokumanDosyasi = (id: string) => DEPO.dosyalar.get(id) ?? null;

export async function getDuyurular() { return DEPO.duyurular; }
export async function duyuruEkle(d: Duyuru) { DEPO.duyurular.unshift(d); }
export async function duyuruSilDepo(id: string) { DEPO.duyurular = DEPO.duyurular.filter((d) => d.id !== id); }
export async function duyuruOkundu(id: string, bayiId: string) {
  const d = DEPO.duyurular.find((x) => x.id === id);
  if (d && !d.okuyanlar.includes(bayiId)) d.okuyanlar.push(bayiId);
  return d ?? null;
}

export async function getEgitimTamamlanan(bayiId: string) { return [...(DEPO.egitim.get(bayiId) ?? [])]; }
export async function getTumEgitimler() { return new Map([...DEPO.egitim].map(([k, v]) => [k, [...v]])); }
export async function egitimTamamla(bayiId: string, dokumanId: string, tamam: boolean) {
  const s = DEPO.egitim.get(bayiId) ?? new Set<string>();
  if (tamam) s.add(dokumanId); else s.delete(dokumanId);
  DEPO.egitim.set(bayiId, s);
}

/* ---------- Örnek PDF (demo dokümanlar ve sözleşme özeti için) ---------- */

// Standart PDF yazı tipleri Türkçe karakterleri içermez: ASCII'ye çevrilir
const ascii = (s: string) => s.replace(/[çÇğĞıİöÖşŞüÜăâîșțĂÂÎȘȚ€]/g, (c) => ({ ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U", ă: "a", â: "a", î: "i", ș: "s", ț: "t", Ă: "A", Â: "A", Î: "I", Ș: "S", Ț: "T", "€": "EUR" })[c] ?? c).replace(/[^\x20-\x7E]/g, "?");
const kacis = (s: string) => ascii(s).replace(/[\\()]/g, (c) => `\\${c}`);

/** Tek sayfalık basit PDF: başlık + satırlar */
export function ornekPdf(baslik: string, satirlar: string[]): Uint8Array {
  const icerik = [
    "BT /F1 20 Tf 56 780 Td (" + kacis(baslik) + ") Tj ET",
    "BT /F1 9 Tf 56 760 Td (Embedra Teknoloji - embedra.com) Tj ET",
    ...satirlar.slice(0, 48).map((s, i) => `BT /F1 11 Tf 56 ${728 - i * 15} Td (${kacis(s)}) Tj ET`),
  ].join("\n");
  const nesneler = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const konumlar: number[] = [];
  nesneler.forEach((n, i) => { konumlar.push(pdf.length); pdf += `${i + 1} 0 obj\n${n}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n${konumlar.map((k) => `${String(k).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
