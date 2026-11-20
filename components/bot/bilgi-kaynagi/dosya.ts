// P2.4b: yüklenen dosyanın boyut ve tür denetimi (sunucuda; tarayıcının bildirdiği MIME'a ve uzantıya güvenilmez,
// içerik sihirli baytlarla tanınır) ve Excel okuma. Storage bucket'ı da aynı sınırları uygular (migration).
import readXlsxFile from "read-excel-file/universal";

export * from "./sabitler";
import { AZAMI_DOSYA, type DosyaTuru } from "./sabitler";

const basla = (b: Uint8Array, imza: number[]) => imza.every((x, i) => b[i] === x);

/** İçerikten tür; desteklenmiyorsa null. CSV'nin imzası yok: .csv uzantısı + geçerli UTF-8 metin (NUL baytı yok). */
export function dosyaTuruBul(veri: Uint8Array, ad: string): DosyaTuru | null {
  const uzanti = ad.toLowerCase().split(".").pop() ?? "";
  if (basla(veri, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { girdi: "pdf", mime: "application/pdf" }; // %PDF-
  if (basla(veri, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { girdi: "gorsel", mime: "image/png" };
  if (basla(veri, [0xff, 0xd8, 0xff])) return { girdi: "gorsel", mime: "image/jpeg" };
  if (basla(veri, [0x50, 0x4b, 0x03, 0x04]) && uzanti === "xlsx") {
    return { girdi: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  if (uzanti === "csv" && !veri.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(veri);
      return { girdi: "csv", mime: "text/csv" };
    } catch {
      return null; // UTF-8 değil (ör. Windows-1254): kullanıcıdan UTF-8 kaydetmesi istenir
    }
  }
  return null;
}

export function dosyaDenetle(veri: Uint8Array, ad: string): { ok: true; tur: DosyaTuru } | { ok: false; hata: string } {
  if (!veri.byteLength) return { ok: false, hata: "Dosya boş." };
  if (veri.byteLength > AZAMI_DOSYA) return { ok: false, hata: `Dosya en çok ${AZAMI_DOSYA / 1024 / 1024} MB olabilir (bu dosya ${(veri.byteLength / 1024 / 1024).toFixed(1)} MB). Belgeyi bölün ya da sıkıştırın.` };
  const tur = dosyaTuruBul(veri, ad);
  if (!tur) {
    return { ok: false, hata: ad.toLowerCase().endsWith(".csv") ? "CSV dosyası UTF-8 olmalı (Excel'de \"CSV UTF-8\" olarak kaydedin)." : "Desteklenmeyen dosya: PDF, PNG, JPG, Excel (.xlsx) ya da CSV yükleyin." };
  }
  return { ok: true, tur };
}

/** Excel'in ilk dolu sayfasının hücreleri (yalnızca okuma; formüller hesaplanmış değeriyle gelir) */
export async function excelOku(veri: Uint8Array): Promise<{ sayfa: string; satirlar: unknown[][] }> {
  const ab = veri.buffer.slice(veri.byteOffset, veri.byteOffset + veri.byteLength) as ArrayBuffer;
  const sayfalar = await readXlsxFile(ab);
  const dolu = sayfalar.find((s) => s.data.some((r) => r.some((h) => h != null && String(h).trim() !== ""))) ?? sayfalar[0];
  return { sayfa: dolu?.sheet ?? "", satirlar: (dolu?.data ?? []) as unknown[][] };
}

/** CSV baytlarını metne çevirir (dosyaDenetle UTF-8 olduğunu doğruladı) */
export const csvMetni = (veri: Uint8Array) => new TextDecoder("utf-8").decode(veri);
