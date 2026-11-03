// Para, sayı ve yüzde biçimlendirme yardımcıları (tüm sayfalarda kullanılır)

const tlBicim = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const sayiBicim = new Intl.NumberFormat("tr-TR");

/** 1284500 → "₺1.284.500" */
export const tl = (n: number) => tlBicim.format(n);

/** 1246 → "1.246" */
export const sayi = (n: number) => sayiBicim.format(n);

/** 1420000 → "₺1,42M" · 762000 → "₺762K" · 950 → "₺950" */
export function kisaTl(n: number) {
  if (Math.abs(n) >= 1_000_000) {
    return `₺${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}M`;
  }
  if (Math.abs(n) >= 1_000) return `₺${Math.round(n / 1_000)}K`;
  return tl(n);
}

/** 12.4 → "%12,4" */
export const yuzde = (n: number) => `%${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;

/** "Akdeniz Direksiyon Servisi" → "AD" */
export function basHarfler(ad: string) {
  return ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0].toLocaleUpperCase("tr-TR"))
    .join("");
}
