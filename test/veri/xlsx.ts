// Testler için en küçük geçerli .xlsx (Office Open XML) üretici: tek sayfa, paylaşılan dizeler + sayılar.
// Gerçek bir Excel dosyasıyla aynı paket yapısı (Content_Types, workbook, rels, sharedStrings, sheet1).
import { strToU8, zipSync } from "fflate";

const kac = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sutunAdi = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export function xlsxUret(satirlar: (string | number | null)[][], sayfaAdi = "Sayfa1"): Uint8Array {
  const dizeler: string[] = [];
  const dizeNo = (s: string) => {
    const i = dizeler.indexOf(s);
    return i >= 0 ? i : dizeler.push(s) - 1;
  };
  const satirXml = satirlar.map((s, r) => `<row r="${r + 1}">${s.map((h, c) => {
    if (h == null) return "";
    const ref = `${sutunAdi(c)}${r + 1}`;
    return typeof h === "number" ? `<c r="${ref}"><v>${h}</v></c>` : `<c r="${ref}" t="s"><v>${dizeNo(h)}</v></c>`;
  }).join("")}</row>`).join("");
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${kac(sayfaAdi)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${ns}><sheetData>${satirXml}</sheetData></worksheet>`),
    "xl/sharedStrings.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${ns} count="${dizeler.length}" uniqueCount="${dizeler.length}">${dizeler.map((d) => `<si><t xml:space="preserve">${kac(d)}</t></si>`).join("")}</sst>`),
  });
}
