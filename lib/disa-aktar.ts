// Tarayıcıda dosya indirme yardımcıları (yalnızca istemci bileşenlerinden çağrılır)

/** Excel'in doğrudan açabildiği CSV: UTF-8 BOM + ";" ayırıcı (Türkçe Excel varsayılanı). */
export function csvIndir(satirlar: (string | number)[][], dosyaAdi: string) {
  const kacis = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const metin = "﻿" + satirlar.map((s) => s.map(kacis).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([metin], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  a.click();
  URL.revokeObjectURL(url);
}

const html = (v: string | number) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Tabloyu yeni pencerede yazdırma görünümünde açar; kullanıcı "PDF olarak kaydet"i seçer. */
export function pdfYazdir(baslik: string, altBaslik: string, satirlar: (string | number)[][]) {
  const [ust, ...govde] = satirlar;
  const pencere = window.open("", "_blank");
  if (!pencere) return false; // açılır pencere engellendi
  pencere.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${html(baslik)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0E0F0C;margin:32px}
  h1{font-size:20px;margin:0 0 4px} p{margin:0 0 20px;color:#5E6259;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;background:#F4F5F0;font-weight:600;color:#474A42}
  th,td{padding:7px 8px;border-bottom:1px solid #E3E5DE;vertical-align:top}
  @page{margin:16mm}
</style></head><body>
<h1>${html(baslik)}</h1><p>${html(altBaslik)} · Embedra CRM</p>
<table><thead><tr>${(ust ?? []).map((h) => `<th>${html(h)}</th>`).join("")}</tr></thead>
<tbody>${govde.map((s) => `<tr>${s.map((h) => `<td>${html(h)}</td>`).join("")}</tr>`).join("")}</tbody></table>
${govde.length === 0 ? "<p>Bu raporda kayıt yok.</p>" : ""}
</body></html>`);
  pencere.document.close();
  pencere.focus();
  pencere.print();
  return true;
}
