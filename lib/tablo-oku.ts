// Tarayıcıda CSV ve Excel (.xlsx) dosyasını satır dizisine çevirir; ek kütüphane gerekmez.
// .xlsx bir ZIP arşividir: ilk sayfanın XML'i ve ortak metin tablosu açılıp okunur. Eski .xls desteklenmez.

/** CSV metnini satırlara böler; ayırıcı (; , veya sekme) ilk satırdan tahmin edilir. Tırnaklı alanlar desteklenir. */
export function csvCoz(metin: string): string[][] {
  const t = metin.replace(/^﻿/, "");
  const ilk = t.slice(0, t.indexOf("\n") >= 0 ? t.indexOf("\n") : undefined);
  const ayirici = [";", "\t", ","].map((a) => [a, ilk.split(a).length] as const).sort((x, y) => y[1] - x[1])[0][0];
  const satirlar: string[][] = [];
  let satir: string[] = [];
  let alan = "";
  let tirnak = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tirnak) {
      if (c === '"' && t[i + 1] === '"') {
        alan += '"';
        i++;
      } else if (c === '"') tirnak = false;
      else alan += c;
    } else if (c === '"' && alan === "") tirnak = true;
    else if (c === ayirici) {
      satir.push(alan);
      alan = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      satir.push(alan);
      satirlar.push(satir);
      satir = [];
      alan = "";
    } else alan += c;
  }
  if (alan !== "" || satir.length) {
    satir.push(alan);
    satirlar.push(satir);
  }
  return satirlar.map((s) => s.map((x) => x.trim())).filter((s) => s.some(Boolean));
}

/** Türkçe Excel'in kaydettiği CSV UTF-8 değil Windows-1254 olabilir; bozuk karakter görülürse onunla yeniden okunur */
async function metinOku(dosya: File) {
  const veri = await dosya.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(veri);
  return utf8.includes("�") ? new TextDecoder("windows-1254").decode(veri) : utf8;
}

/* ---------- XLSX ---------- */

async function zipDosyalari(veri: ArrayBuffer, istenen: (ad: string) => boolean) {
  const v = new DataView(veri);
  let son = -1;
  for (let i = veri.byteLength - 22; i >= Math.max(0, veri.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      son = i;
      break;
    }
  }
  if (son < 0) throw new Error("Dosya Excel (.xlsx) biçiminde değil.");
  const adet = v.getUint16(son + 10, true);
  let p = v.getUint32(son + 16, true);
  const cozucu = new TextDecoder();
  const sonuc = new Map<string, string>();
  for (let n = 0; n < adet; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const yontem = v.getUint16(p + 10, true);
    const boyut = v.getUint32(p + 20, true);
    const adUz = v.getUint16(p + 28, true);
    const ekUz = v.getUint16(p + 30, true);
    const yorumUz = v.getUint16(p + 32, true);
    const yerel = v.getUint32(p + 42, true);
    const ad = cozucu.decode(new Uint8Array(veri, p + 46, adUz));
    p += 46 + adUz + ekUz + yorumUz;
    if (!istenen(ad)) continue;
    const bas = yerel + 30 + v.getUint16(yerel + 26, true) + v.getUint16(yerel + 28, true);
    const ham = new Uint8Array(veri, bas, boyut);
    if (yontem === 0) sonuc.set(ad, cozucu.decode(ham));
    else if (yontem === 8) {
      const akis = new Blob([ham]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      sonuc.set(ad, await new Response(akis).text());
    }
  }
  return sonuc;
}

const xml = (metin: string) => new DOMParser().parseFromString(metin, "application/xml");
const etiket = (d: Document | Element, ad: string) => [...d.getElementsByTagNameNS("*", ad)];

/** "BC12" → 54 (0'dan başlayan sütun sırası) */
function sutunSirasi(ref: string) {
  let n = 0;
  for (const c of ref.replace(/\d+$/, "")) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

async function xlsxCoz(dosya: File): Promise<string[][]> {
  const veri = await dosya.arrayBuffer();
  const ust = await zipDosyalari(veri, (ad) => ad === "xl/workbook.xml" || ad === "xl/_rels/workbook.xml.rels" || ad === "xl/sharedStrings.xml");
  // İlk sayfanın dosyası: workbook.xml'deki ilk <sheet>'in r:id'si rels dosyasında aranır
  let sayfaYolu = "xl/worksheets/sheet1.xml";
  const wb = ust.get("xl/workbook.xml");
  const rels = ust.get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const ilk = etiket(xml(wb), "sheet")[0];
    const rid = ilk?.getAttribute("r:id") ?? ilk?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const hedef = etiket(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (hedef) sayfaYolu = hedef.startsWith("/") ? hedef.slice(1) : `xl/${hedef.replace(/^\.\//, "")}`;
  }
  const sayfa = (await zipDosyalari(veri, (ad) => ad === sayfaYolu)).get(sayfaYolu);
  if (!sayfa) throw new Error("Excel dosyasında sayfa bulunamadı.");
  const ortak = ust.get("xl/sharedStrings.xml");
  const metinler = ortak ? etiket(xml(ortak), "si").map((si) => etiket(si, "t").map((t) => t.textContent ?? "").join("")) : [];
  return etiket(xml(sayfa), "row")
    .map((r) => {
      const satir: string[] = [];
      for (const c of etiket(r, "c")) {
        const tur = c.getAttribute("t");
        const v = etiket(c, "v")[0]?.textContent ?? "";
        const deger = tur === "s" ? metinler[Number(v)] ?? "" : tur === "inlineStr" ? etiket(c, "t").map((t) => t.textContent).join("") : v;
        const ref = c.getAttribute("r");
        satir[ref ? sutunSirasi(ref) : satir.length] = deger.trim();
      }
      return Array.from(satir, (x) => x ?? "");
    })
    .filter((s) => s.some(Boolean));
}

/** Dosyanın uzantısına göre okur: .xlsx → Excel, diğerleri CSV / metin */
export async function tabloOku(dosya: File): Promise<string[][]> {
  if (/\.xls$/i.test(dosya.name)) throw new Error("Eski Excel (.xls) okunamıyor; dosyayı .xlsx ya da CSV olarak kaydedin.");
  if (/\.xlsx$/i.test(dosya.name)) return xlsxCoz(dosya);
  return csvCoz(await metinOku(dosya));
}
