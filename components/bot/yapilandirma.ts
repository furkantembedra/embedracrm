// Bot yapılandırması: model, effort ve döngü sınırları tek yerde. Modeli ya da effort'u değiştirmek için yalnızca bu
// dosya değişir (P5.1 değerlendirme setinde Haiku 5.5 / Sonnet 5.5 kararı burada uygulanır).
//
// Kaynak (claude-api becerisi, 2026-11): claude-haiku-5-5 düşünme varsayılan olarak açık (adaptive), effort varsayılanı
// "medium" (bu yüzden açıkça yazılır), budget_tokens ve sıcaklık vb. 400 döner, refusal'da sunucu tarafı yedek model yok.
// Fiyat (≤100K token istem): girdi 0,10 $ / 1M, çıktı 0,50 $ / 1M; cache okuma girdinin 0,1 katı, 5 dk cache yazma
// 1,25 katı. Fiyatlar değişirse aşağıdaki tablo güncellenir (bot_kullanim.maliyet_usd buradan hesaplanır).

/** Claude model kimliği */
export const BOT_MODELI = "claude-haiku-5-5";
/** output_config.effort: low | medium | high | xhigh | max */
export const BOT_EFFORT = "low" as const;

/** Tek API çağrısının çıktı sınırı (düşünme dahil). Mesajlaşma cevabı kısa; düşünmeye pay bırakılır. */
export const BOT_AZAMI_CIKTI = 2048;
/** Bir bot turunda en çok kaç API çağrısı (araç döngüsü); aşılırsa tur hata sayılır ve konuşma devredilir */
export const BOT_AZAMI_API_CAGRISI = 4;
/** Tek API çağrısının zaman aşımı (ms). Kuyruk kilidi 120 sn; tur bunun çok altında kalmalı. */
export const BOT_ZAMAN_ASIMI_MS = 25_000;
/** SDK'nın kendi yeniden denemesi (429 / 5xx / bağlantı) */
export const BOT_YENIDEN_DENEME = 1;
/** Modele verilen son mesaj sayısı */
export const BOT_SON_MESAJ = 20;
/** Tek mesajın modele giden azami uzunluğu (karakter) */
export const BOT_MESAJ_KIRP = 2000;
/**
 * Debounce: son müşteri mesajından bu kadar saniye sonra bot turu (SQL: gelen_mesaj_kaydet, interval '6 seconds';
 * değiştirilirse migration ile birlikte değişmeli).
 */
export const BOT_BEKLEME_SN = 6;
/** bot_ayarlari okunamazsa kullanılacak varsayılanlar (tablo varsayılanlarıyla aynı) */
export const VARSAYILAN_TUR_SINIRI = 20;
export const VARSAYILAN_GUNLUK_MALIYET_USD = 5;

/** USD / 1M token */
type Fiyat = { girdi: number; cikti: number; cacheYazma: number; cacheOkuma: number };
const FIYATLAR: Record<string, Fiyat> = {
  "claude-haiku-5-5": { girdi: 0.1, cikti: 0.5, cacheYazma: 0.125, cacheOkuma: 0.01 },
  "claude-sonnet-5-5": { girdi: 2, cikti: 10, cacheYazma: 2.5, cacheOkuma: 0.1 },
  "claude-opus-5-5": { girdi: 4, cikti: 20, cacheYazma: 5, cacheOkuma: 0.2 },
};

export type TokenKullanimi = { girdi: number; cikti: number; cacheYazma: number; cacheOkuma: number };

/** Kullanımın USD maliyeti (6 ondalık). Bilinmeyen modelde en pahalı satır kullanılır (sınır gevşemesin). */
export function maliyetHesapla(model: string, u: TokenKullanimi): number {
  const f = FIYATLAR[model] ?? FIYATLAR["claude-opus-5-5"];
  const usd = (u.girdi * f.girdi + u.cikti * f.cikti + u.cacheYazma * f.cacheYazma + u.cacheOkuma * f.cacheOkuma) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
