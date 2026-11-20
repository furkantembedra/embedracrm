// P2.4b bilgi kaynakları: istemcide de kullanılan sabitler ve tipler (Excel okuyucuyu istemci paketine sokmamak için
// ./dosya.ts'ten ayrı).
import type { BilgiKaynagi } from "../ayar-surumu";

/** Vercel'de Server Action gövdesi en çok 4,5 MB (next.config.ts); çok parçalı form ek baytına pay bırakılır */
export const AZAMI_DOSYA = 4 * 1024 * 1024;
/** Elle yapıştırılan / çıkarılan taslak metin üst sınırı (SQL: 60.000) */
export const AZAMI_TASLAK = 60_000;

export type GirdiTuru = "pdf" | "gorsel" | "xlsx" | "csv" | "metin";
export type DosyaTuru = { girdi: Exclude<GirdiTuru, "metin">; mime: "application/pdf" | "image/png" | "image/jpeg" | "text/csv" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

export const GIRDI_ADI: Record<GirdiTuru, string> = { pdf: "PDF", gorsel: "Ekran görüntüsü", xlsx: "Excel", csv: "CSV", metin: "Elle metin" };
export const HEDEF_ADI: Record<BilgiKaynagi["hedef"], string> = { bilgi_bankasi: "Bilgi bankası", itirazlar: "İtirazlar ve cevapları", ornek_konusmalar: "Örnek konuşmalar" };
export const HEDEFLER = Object.keys(HEDEF_ADI) as BilgiKaynagi["hedef"][];
export const KABUL_EDILEN = ".pdf,.png,.jpg,.jpeg,.xlsx,.csv";

