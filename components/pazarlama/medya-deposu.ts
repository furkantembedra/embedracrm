// İçerik görselleri / videoları. Şimdilik sunucu belleğinde (yeniden başlatınca silinir).
// Supabase bağlanınca Storage'a ("marketing-media" bucket) yükleyin; tarayıcı doğrudan imzalı URL ile yükleyebilir.
export type MedyaDosyasi = { ad: string; tip: string; veri: Uint8Array };

const g = globalThis as { __embedraMedya?: Map<string, MedyaDosyasi> };
const DEPO = (g.__embedraMedya ??= new Map());

export const MEDYA_SINIRI = 25 * 1024 * 1024; // 25 MB
export const MEDYA_TIPLERI = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"];

export function medyaKaydet(d: MedyaDosyasi) {
  const id = crypto.randomUUID();
  DEPO.set(id, d);
  return id;
}
export const medyaGetir = (id: string) => DEPO.get(id) ?? null;
