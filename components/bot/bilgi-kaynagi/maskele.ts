// P2.4b: yüklenen bilgi kaynaklarında kişisel veri maskeleme ve şüpheli satır işaretleme. Saf modül (sunucu ve
// istemci): sunucu yüklemede maskeler ve işaretler; istemci düzenlenen taslağın işaretlerini anında yeniden hesaplar,
// sunucu her kayıtta / onayda yeniden hesaplar.
//
// Maskelenenler: e-posta, IBAN, telefon, TC kimlik no, plaka, adres, hitap / etiketle ya da sohbet satırının
// başında geçen kişi adı. Sonra P2.3'teki bot:istem-kaynaklari denetiminin (kisiselVeriBul: telefon / e-posta gibi
// görünen satır) yakaladığı kalan numara dizileri de [numara] olur; böylece maskelenmiş metin o denetimden her zaman
// geçer. Ad tespiti kalıpla sınırlıdır (serbest metindeki adı kod bilemez): PDF ve görsellerde adları çıkarım
// sırasında Claude maskeler; kalan şüpheli satırlar "kisisel" olarak işaretlenir ve Yönetici onaydan önce görür.
//
// İşaretler (onayı engellemez, Yönetici'ye gösterilir): kisisel (maskelenemeyen kişisel veri şüphesi), fiyat (fiyat,
// iskonto, kampanya: bot bu satırlardaki rakamları kullanmaz, değişmez kural 1), talimat (botu yönlendirmeye çalışan
// metin: bot uygulamaz, istem enjeksiyonu), kesik (çıkarım çıktı sınırında kesildi).
import { kisiselVeriBul } from "../ayar-surumu";

export type IsaretTuru = "kisisel" | "fiyat" | "talimat" | "kesik";
export type Isaret = { satir: number; tur: IsaretTuru; not: string };

export const ISARET_ADI: Record<IsaretTuru, string> = {
  kisisel: "Kişisel veri olabilir",
  fiyat: "Fiyat / iskonto",
  talimat: "Talimat gibi",
  kesik: "Kesik",
};

const BUYUK = "A-ZÇĞİÖŞÜ";
const KUCUK = "a-zçğıöşü";
const KELIME = `[${BUYUK}][${KUCUK}]+`;

/** Satır başında "Ad Soyad:" olsa da kişi adı sayılmayan etiketler */
const GUVENLI_ETIKET = /^(müşteri|satışçı|satici|satıcı|bot|asistan|embedra|soru|cevap|yanıt|itiraz|not|örnek|konu|başlık|ürün|plan|cihaz|garanti|kurulum|teslim|ödeme|açıklama|adım|uyarı|sonuç|ad|adı|isim|soyad|yetkili|ilgili|iletişim|gönderen|alıcı|adres|telefon|merkez|şube|fatura|sipariş|servis|destek|teknik|genel|sık)\b/i;

/** Plaka sanılmaması gereken birimler ("12 V 100", "3 KW 200") */
const BIRIMLER = new Set(["V", "A", "W", "KW", "KVA", "MW", "AH", "MAH", "HZ", "KHZ", "MHZ", "MB", "GB", "TB", "KB", "TL", "KG", "G", "MG", "CM", "MM", "KM", "M", "NM", "RPM", "MS", "S", "DK", "SA", "ADET", "BAR", "PSI", "DB", "LT", "L", "ML", "C", "F", "K", "X", "IP", "USD", "EUR", "TRY", "OBD", "ECU", "PIN", "CAN", "LIN", "ABS", "ESP"]);

type Kural = { ad: string; ifade: RegExp; yerine: string | ((...e: string[]) => string) };

const KURALLAR: Kural[] = [
  { ad: "eposta", ifade: /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[a-z]{2,}/gi, yerine: "[e-posta]" },
  { ad: "iban", ifade: /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, yerine: "[iban]" },
  // Türkiye telefonu: +90 / 0090 / 0 ile ya da yalnızca 5xx / 2xx-4xx alan koduyla, 10 hane
  { ad: "telefon", ifade: /(?<![\d\w(])\(?(?:(?:\+|00)\s?90[\s.-]?|0[\s.-]?)?\(?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?![\d])/g, yerine: "[telefon]" },
  // Uluslararası telefon (+ ile başlayan 8-15 hane)
  { ad: "telefon", ifade: /\+\d[\d\s().-]{7,18}\d/g, yerine: "[telefon]" },
  // TC kimlik no (11 hane, 0 ile başlamaz)
  { ad: "kimlik", ifade: /(?<!\d)[1-9]\d{10}(?!\d)/g, yerine: "[kimlik no]" },
  // Plaka: il kodu (01-81) + 1-3 harf + 2-4 rakam
  {
    ad: "plaka",
    ifade: new RegExp(`(?<![\\d${BUYUK}${KUCUK}])(0[1-9]|[1-7]\\d|8[01])\\s?([${BUYUK}]{1,3})\\s?(\\d{2,4})(?![\\d${BUYUK}${KUCUK}])`, "g"),
    yerine: (tum: string, _il: string, harf: string) => (BIRIMLER.has(harf) ? tum : "[plaka]"),
  },
  // Adres: mahalle / cadde / sokak / bulvar / apartman sözcüğü ve ardından satırın (; ya da satır sonuna kadar) devamı
  {
    ad: "adres",
    ifade: new RegExp(`(?:[^\\s,;:]+\\s+){0,3}(?:Mahallesi|Mah\\.|Mh\\.|Caddesi|Cad\\.|Cd\\.|Sokağı|Sokak|Sok\\.|Sk\\.|Bulvarı|Blv\\.|Apartmanı|Apt\\.|Sitesi)(?=[\\s,.;:]|$)[^\\n;]*`, "g"),
    yerine: "[adres]",
  },
  // Etiketli ad: "Ad Soyad: …", "Yetkili: …", "Müşteri adı: …"
  {
    ad: "ad",
    ifade: /^(\s*(?:ad(?:ı)?\s*soyad(?:ı)?|ad|adı|isim|isim soyisim|müşteri adı|yetkili|yetkili kişi|ilgili kişi|iletişim kişisi|gönderen|alıcı)\s*:\s*)(?!\[)(.+)$/gim,
    yerine: "$1[ad]",
  },
  // Hitapla ad: "Sayın Ahmet Yılmaz", "Ahmet Bey", "Ayşe Hanım"
  { ad: "ad", ifade: new RegExp(`\\b(Sayın|Sn\\.|Bay|Bayan|Dr\\.|Av\\.|Müh\\.)\\s+${KELIME}(?:\\s+${KELIME})?`, "g"), yerine: "$1 [ad]" },
  // Yalnızca tek ad ("Hasan Bey"): iki sözcük alınırsa cümle başındaki sözcük de ad sanılır ("Kurulumu Hasan Bey")
  { ad: "ad", ifade: new RegExp(`(?<![${BUYUK}${KUCUK}])${KELIME}\\s+(Bey|Hanım|Beyefendi|Hanımefendi)\\b`, "g"), yerine: "[ad] $1" },
  // WhatsApp dışa aktarımı: "20.11.2026 14:05 - Ahmet Yılmaz: mesaj" ya da "[20.11.26 14:05:11] Ahmet: mesaj".
  // Zaman damgası atılır (bot için anlamsız; P2.3 denetimi tarih + saati numara sanar), gönderen adı maskelenir.
  {
    ad: "ad",
    ifade: /^\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*(?:-\s*)?([^:\n[\]]{1,40}):\s/gm,
    yerine: (_t: string, kisi: string) => `${GUVENLI_ETIKET.test(kisi.trim()) ? kisi.trim() : "[ad]"}: `,
  },
  // Satır başında iki büyük harfli sözcük ve iki nokta: "Ahmet Yılmaz: …" (güvenli etiketler hariç)
  {
    ad: "ad",
    ifade: new RegExp(`^(\\s*)(${KELIME}\\s+${KELIME})(\\s*:\\s)`, "gm"),
    yerine: (tum: string, on: string, kisi: string, son: string) => (GUVENLI_ETIKET.test(kisi) ? tum : `${on}[ad]${son}`),
  },
];

// P2.3 betiği / ayar-surumu ile aynı geniş ifadeler (kalan numaralar ve e-posta benzerleri)
const GENIS_TELEFON = /(?:\+|00)?\d[\d\s().-]{8,}\d/g;
const GENIS_EPOSTA = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/gi;

/** Metni normalize eder: satır sonları \n, kontrol karakterleri atılır, satır sonu boşlukları kırpılır */
export function metniTemizle(t: string): string {
  return t
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, "")
    .split("\n").map((s) => s.replace(/[ \t]+$/g, "")).join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** Kişisel verileri maskeler; maskelenen parça sayısını döner. Sonuç kisiselVeriBul'dan her zaman geçer. */
export function maskele(metin: string): { metin: string; sayi: number } {
  let sayi = 0;
  let t = metin;
  for (const k of KURALLAR) {
    t = t.replace(k.ifade, (...e: unknown[]) => {
      const tum = e[0] as string;
      const yeni = typeof k.yerine === "string"
        ? k.yerine.replace(/\$(\d)/g, (_s, n) => String(e[Number(n)] ?? ""))
        : k.yerine(...(e.filter((x) => typeof x === "string") as string[]));
      if (yeni !== tum) sayi++;
      return yeni;
    });
  }
  // Kalan geniş eşleşmeler (ör. biçimi bilinmeyen numaralar). Tarih ve tutar aralıkları da buraya düşebilir:
  // P2.3 denetimi bu satırları reddettiği için maskelenir ve satır "kisisel" olarak işaretlenir (Yönetici düzeltir).
  t = t.replace(GENIS_EPOSTA, () => (sayi++, "[e-posta]"));
  t = t.replace(GENIS_TELEFON, () => (sayi++, "[numara]"));
  return { metin: t, sayi };
}

const SAYI_DIZISI = /\d[\d\s.-]{5,}\d/; // 7+ karakterlik rakam dizisi (sipariş, seri no, hesap no olabilir)
const KISISEL_SOZCUK = /(?<![\p{L}\p{N}])(t\.?c\.?(?:\s*kimlik)?|kimlik\s*no|vergi\s*no|vkn|iban|hesap\s*no|plaka|adres|doğum\s*tarihi|ev\s*telefonu)(?![\p{L}\p{N}])/iu;
const ADI_GECIYOR = new RegExp(`^\\s*${KELIME}\\s+${KELIME}\\s*:`);
// \b Türkçe harfleri (ü, ı, ş…) sözcük karakteri saymaz: sözcük sınırı Unicode harf sınıfıyla yazılır
const HARF_YOK_ONCE = "(?<![\\p{L}\\p{N}])";
const HARF_YOK_SONRA = "(?![\\p{L}\\p{N}])";
const FIYAT = new RegExp(
  `(\\d[\\d.,]*\\s*(?:tl|₺|try|usd|eur|€|\\$|lira|euro|dolar)${HARF_YOK_SONRA})|((?:₺|\\$|€)\\s*\\d)|(%\\s*\\d)|(\\d\\s*%)|${HARF_YOK_ONCE}(fiyat|ücret|indirim|iskonto|kampanya|taksit|bedava|kdv)`,
  "iu",
);
const TALIMAT = /((önceki|yukarıdaki|tüm)\s+(talimat|kural|yönerge)\w*)|((talimat|kural|yönerge)\w*\s+(yok\s*say|unut|görmezden|uyma))|(sistem\s+istem)|(system\s+prompt)|(ignore\s+(all\s+|the\s+)?(previous|above|prior))|(you\s+are\s+now)|(sen\s+artık)|(rolünü\s+değiştir)|(disregard)|(jailbreak)|(developer\s+mode)|(<\s*\/?\s*[a-z_]+\s*>)|(asistan\s+olduğunu\s+söyleme)|(insan\s+gibi\s+davran)/i;

/** Satır bazında işaretler (en çok 300). Metin içermez: satır numarası + tür + kısa not. */
export function isaretle(metin: string, kesik = false): Isaret[] {
  const satirlar = metin.split("\n");
  const sonuc: Isaret[] = [];
  for (let i = 0; i < satirlar.length && sonuc.length < 300; i++) {
    const s = satirlar[i];
    const temiz = s.replace(/\[[^\]]{1,20}\]/g, " ");
    if (kisiselVeriBul(s) || /\[numara\]/.test(s)) {
      sonuc.push({ satir: i + 1, tur: "kisisel", not: "Numara dizisi maskelendi ya da kaldı; tarih / ölçü ise yeniden yazın, kişisel veriyse silin." });
    } else if (SAYI_DIZISI.test(temiz) || KISISEL_SOZCUK.test(temiz) || (ADI_GECIYOR.test(s) && !GUVENLI_ETIKET.test(s.trim()))) {
      sonuc.push({ satir: i + 1, tur: "kisisel", not: "Kişisel veri olabilir (numara, kimlik, adres ya da ad); kontrol edin." });
    }
    if (FIYAT.test(s)) sonuc.push({ satir: i + 1, tur: "fiyat", not: "Fiyat / iskonto / kampanya: bot bu satırdaki rakamları kullanmaz, fiyatı yalnızca fiyat listesinden okur." });
    if (TALIMAT.test(s)) sonuc.push({ satir: i + 1, tur: "talimat", not: "Botu yönlendirmeye çalışan bir ifade gibi; bot kaynak metnindeki talimatları uygulamaz. Gereksizse silin." });
  }
  if (kesik) sonuc.push({ satir: satirlar.length, tur: "kesik", not: "Çıkarım çıktı sınırında kesildi; belgenin sonu eksik olabilir. Belgeyi bölerek yükleyin." });
  return sonuc;
}

/** Yükleme / kayıt sonrası tek adım: temizle → maskele → işaretle */
export function kaynakMetniHazirla(ham: string, kesik = false): { metin: string; maskelenen: number; isaretler: Isaret[] } {
  const m = maskele(metniTemizle(ham));
  return { metin: m.metin, maskelenen: m.sayi, isaretler: isaretle(m.metin, kesik) };
}

/** Veritabanındaki işaret dizisini tipe çevirir */
export function isaretleriOku(x: unknown): Isaret[] {
  if (!Array.isArray(x)) return [];
  const turler: IsaretTuru[] = ["kisisel", "fiyat", "talimat", "kesik"];
  return x.flatMap((o) => {
    const r = o && typeof o === "object" ? (o as Record<string, unknown>) : null;
    if (!r || !turler.includes(r.tur as IsaretTuru) || !Number.isInteger(r.satir)) return [];
    return [{ satir: r.satir as number, tur: r.tur as IsaretTuru, not: typeof r.not === "string" ? r.not.slice(0, 300) : "" }];
  });
}
