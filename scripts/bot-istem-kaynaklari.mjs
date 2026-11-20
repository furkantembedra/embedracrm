// docs/bot/ornek-konusmalar/*.md ve docs/bot/itirazlar.md → components/bot/istem-kaynaklari.ts
//
// Botun sabit sistem istemine (components/bot/istem.ts) girecek gerçek satış konuşmaları ve itiraz cevapları belgede
// tutulur; istem çalışma anında dosya okumaz (Vercel paketinde docs/ yok, önbellek öneki her çağrıda bayt bayt aynı
// kalmalı). Belge değişince bu betik çalıştırılır ve üretilen dosya commit'lenir:
//
//   npm run bot:istem-kaynaklari
//
// test/bot-istem.test.ts üretilen dosyanın belgelerle aynı olduğunu denetler (betik unutulursa test düşer).
// Kişisel veri koruması (değişmez kural 7): telefon numarası ya da e-posta adresi gibi görünen bir şey bulunursa betik
// dosyayı yazmaz ve hatanın yerini söyler; konuşmalar önce temizlenmeli.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** İsteme girecek toplam metin sınırı (karakter). Sabit istem her çağrıda gider; önbellekte bile maliyeti var. */
export const AZAMI_TOPLAM = 40_000;

const TELEFON = /(?:\+|00)?\d[\d\s().-]{8,}\d/;
const EPOSTA = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i;

/** Metinde kişisel veri gibi görünen ilk satırı döner (yoksa null) */
export function kisiselVeriBul(metin) {
  const satirlar = metin.split("\n");
  for (let i = 0; i < satirlar.length; i++) {
    if (TELEFON.test(satirlar[i]) || EPOSTA.test(satirlar[i])) return i + 1;
  }
  return null;
}

const temizle = (m) => m.replace(/\r/g, "").trim();

/** Belgeleri okur, üretilecek TypeScript kaynağını döner. Hata varsa fırlatır. */
export function uret(kok) {
  const klasor = path.join(kok, "docs/bot/ornek-konusmalar");
  const itirazDosyasi = path.join(kok, "docs/bot/itirazlar.md");
  const hatalar = [];

  const ornekler = existsSync(klasor)
    ? readdirSync(klasor).filter((d) => d.endsWith(".md") && !d.startsWith("_") && d.toLowerCase() !== "readme.md").sort()
        .map((d) => ({ dosya: d, metin: temizle(readFileSync(path.join(klasor, d), "utf8")) }))
        .filter((o) => o.metin.length > 0)
    : [];
  const itirazlar = existsSync(itirazDosyasi) ? temizle(readFileSync(itirazDosyasi, "utf8")) || null : null;

  for (const o of ornekler) {
    const satir = kisiselVeriBul(o.metin);
    if (satir) hatalar.push(`docs/bot/ornek-konusmalar/${o.dosya}:${satir} telefon ya da e-posta gibi görünüyor`);
  }
  if (itirazlar) {
    const satir = kisiselVeriBul(itirazlar);
    if (satir) hatalar.push(`docs/bot/itirazlar.md:${satir} telefon ya da e-posta gibi görünüyor`);
  }
  const toplam = ornekler.reduce((t, o) => t + o.metin.length, 0) + (itirazlar?.length ?? 0);
  if (toplam > AZAMI_TOPLAM) hatalar.push(`Toplam ${toplam} karakter; sınır ${AZAMI_TOPLAM}. Konuşmaları kısaltın ya da azaltın.`);
  if (hatalar.length) throw new Error(`İstem kaynakları üretilmedi:\n- ${hatalar.join("\n- ")}`);

  return `// BU DOSYA ÜRETİLİR, ELLE DEĞİŞTİRMEYİN. Kaynak: docs/bot/ornek-konusmalar/*.md ve docs/bot/itirazlar.md
// Yeniden üretmek için: npm run bot:istem-kaynaklari (ayrıntı scripts/bot-istem-kaynaklari.mjs)

/** Gerçek satış konuşmaları (kişisel bilgiler temizlenmiş), dosya adına göre sıralı */
export const ORNEK_KONUSMALAR: readonly { dosya: string; metin: string }[] = ${JSON.stringify(ornekler, null, 2)};

/** Sık duyulan itirazlar ve cevapları; belge yoksa null */
export const ITIRAZLAR: string | null = ${JSON.stringify(itirazlar)};
`;
}

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hedef = path.join(kok, "components/bot/istem-kaynaklari.ts");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    writeFileSync(hedef, uret(kok));
    console.log("components/bot/istem-kaynaklari.ts güncellendi. İstem değiştiyse components/bot/istem.ts içindeki ISTEM_SURUMU'nu artırın.");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
