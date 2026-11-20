// P2.4b: CSV ve Excel (.xlsx) kaynaklarını kodla okur (Claude'a gitmez). Saf modül (Excel okuma hariç tamamı istemcide
// de çalışır): CSV ayrıştırma (ayraç tespiti, tırnaklı alanlar), sütun eşleme önizlemesi (kişisel veri sütunları
// varsayılan olarak dışarıda) ve seçilen sütunlardan bot için metin üretimi. Metin sonra maskelenir (./maskele.ts).
import type { BilgiKaynagi } from "../ayar-surumu";

export const AZAMI_SATIR = 2000;
export const AZAMI_SUTUN = 40;
const AZAMI_HUCRE = 2000;
const ONIZLEME_SATIRI = 8;

export type Tablo = { basliklar: string[]; satirlar: string[][] };

/** Önizleme: başlıklar, ilk satırlar, önerilen eşleme (kişisel sütunlar dışarıda) */
export type TabloOnizleme = {
  basliklar: string[];
  ornek: string[][];
  satirSayisi: number;
  /** Önerilen: sütun dahil mi */
  dahil: boolean[];
  /** Sütun kişisel veri gibi (başlığa göre) */
  kisisel: boolean[];
  kirpildi: boolean;
};

/** İlk satırda en çok geçen ayraç (tırnak içi sayılmaz) */
function ayracBul(metin: string): string {
  const ilk = metin.split("\n").slice(0, 5).join("\n");
  let enIyi = ",";
  let enCok = -1;
  for (const a of [",", ";", "\t", "|"]) {
    let tirnak = false;
    let n = 0;
    for (const c of ilk) {
      if (c === '"') tirnak = !tirnak;
      else if (!tirnak && c === a) n++;
    }
    if (n > enCok) { enCok = n; enIyi = a; }
  }
  return enIyi;
}

/** RFC 4180 CSV: tırnaklı alan, "" kaçışı, alan içinde satır sonu; ayraç otomatik (, ; sekme |) */
export function csvAyristir(girdi: string): string[][] {
  const metin = girdi.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
  const ayrac = ayracBul(metin);
  const satirlar: string[][] = [];
  let satir: string[] = [];
  let alan = "";
  let tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) {
      if (c === '"') {
        if (metin[i + 1] === '"') { alan += '"'; i++; } else tirnak = false;
      } else alan += c;
    } else if (c === '"' && alan.trim() === "") {
      alan = "";
      tirnak = true;
    } else if (c === ayrac) {
      satir.push(alan); alan = "";
    } else if (c === "\n") {
      satir.push(alan); satirlar.push(satir); satir = []; alan = "";
      if (satirlar.length > AZAMI_SATIR + 1) break;
    } else alan += c;
  }
  if (alan !== "" || satir.length) { satir.push(alan); satirlar.push(satir); }
  return satirlar.filter((s) => s.some((h) => h.trim() !== ""));
}

const hucre = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim().slice(0, AZAMI_HUCRE);
};

/** Ham satırlardan tablo: ilk dolu satır başlık; boş başlıklar "Sütun N"; satır / sütun sınırı */
export function tabloKur(ham: unknown[][]): Tablo & { kirpildi: boolean } {
  const satirlar = ham.map((s) => (Array.isArray(s) ? s.map(hucre) : [])).filter((s) => s.some(Boolean));
  if (!satirlar.length) return { basliklar: [], satirlar: [], kirpildi: false };
  const genislik = Math.min(AZAMI_SUTUN, Math.max(...satirlar.map((s) => s.length)));
  const kirpildi = satirlar.length - 1 > AZAMI_SATIR || satirlar.some((s) => s.length > AZAMI_SUTUN);
  const doldur = (s: string[]) => Array.from({ length: genislik }, (_, i) => s[i] ?? "");
  const basliklar = doldur(satirlar[0]).map((b, i) => b || `Sütun ${i + 1}`);
  return { basliklar, satirlar: satirlar.slice(1, AZAMI_SATIR + 1).map(doldur), kirpildi };
}

const KISISEL_BASLIK = /^(ad|adı|isim|soyad|soyadı|ad\s*soyad|adı\s*soyadı|isim\s*soyisim|müşteri\s*ad[ıi]?|kişi|yetkili|ilgili|telefon|tel|gsm|cep|cep\s*telefonu|mobil|e-?posta|email|e-?mail|mail|adres|açık\s*adres|plaka|tc|t\.c\.|tckn|kimlik|kimlik\s*no|vergi\s*no|vkn|iban|doğum\s*tarihi|ip|kullanıcı\s*adı|profil|instagram|whatsapp)\b/i;

export const kisiselSutunMu = (baslik: string) => KISISEL_BASLIK.test(baslik.trim());

export function onizleme(t: Tablo & { kirpildi?: boolean }): TabloOnizleme {
  const kisisel = t.basliklar.map(kisiselSutunMu);
  return {
    basliklar: t.basliklar,
    ornek: t.satirlar.slice(0, ONIZLEME_SATIRI),
    satirSayisi: t.satirlar.length,
    kisisel,
    dahil: kisisel.map((k, i) => !k && t.satirlar.some((s) => s[i])),
    kirpildi: !!t.kirpildi,
  };
}

/**
 * Seçilen sütunlardan metin. İki sütunda (ör. İtiraz / Cevap, Soru / Cevap) her satır iki satırlık blok, bloklar boş
 * satırla ayrılır; daha çok sütunda her satır "Başlık: değer · Başlık: değer". Örnek konuşmalarda tablo tek konuşma
 * sayılır (satırlar arka arkaya; "---" satırı yeni konuşma başlatır).
 */
export function tablodanMetin(t: Tablo, dahil: readonly boolean[], hedef: BilgiKaynagi["hedef"]): string {
  const sutunlar = t.basliklar.map((_, i) => i).filter((i) => dahil[i]);
  if (!sutunlar.length) return "";
  const parcalar = t.satirlar.flatMap((s) => {
    const alanlar = sutunlar.filter((i) => s[i]).map((i) => ({ b: t.basliklar[i], d: s[i] }));
    if (!alanlar.length) return [];
    if (hedef === "ornek_konusmalar") return [alanlar.length === 1 ? alanlar[0].d : alanlar.map((a) => (sutunlar.length === 2 && a === alanlar[0] ? `${a.d}:` : a.d)).join(" ")];
    if (sutunlar.length <= 2) return [alanlar.map((a) => `${a.b}: ${a.d}`).join("\n")];
    return [alanlar.map((a) => `${a.b}: ${a.d}`).join(" · ")];
  });
  const ayrac = hedef === "ornek_konusmalar" ? "\n" : sutunlar.length <= 2 ? "\n\n" : "\n";
  return parcalar.join(ayrac);
}
