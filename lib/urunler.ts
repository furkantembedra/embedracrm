// EmbedraONE donanım ürünleri. Fiyatlar KDV hariç, TL.
// Lisans (Basic / Pro / Pro+) ayrı satılır; her iki cihaz da ONESuite olmadan çalışmaz.

export const CIHAZ_MODELLERI = ["ONE", "ONE Lite"] as const;
export type CihazModeli = (typeof CIHAZ_MODELLERI)[number];

export const URUN_BILGI: Record<CihazModeli, { ad: string; fiyat: number; ekran: string }> = {
  ONE: { ad: "ONE", fiyat: 98_000, ekran: "AMOLED dokunmatik ekranlı" },
  "ONE Lite": { ad: "ONE LITE", fiyat: 70_000, ekran: "AMOLED ekransız" },
};

/** [{model:"ONE"},{model:"ONE"},{model:"ONE Lite"}] → "2× ONE · 1× ONE Lite" */
export function modelOzeti(cihazlar: { model: CihazModeli }[]) {
  return CIHAZ_MODELLERI.map((m) => [m, cihazlar.filter((c) => c.model === m).length] as const)
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n}× ${m}`)
    .join(" · ");
}
