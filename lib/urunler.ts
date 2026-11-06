// EmbedraONE donanım ürünleri. Fiyatlar KDV hariç, TL.
// Lisans (Basic / Pro / Pro+) ayrı satılır; her iki cihaz da ONESuite olmadan çalışmaz.

export const CIHAZ_MODELLERI = ["ONE", "ONE Lite"] as const;
export type CihazModeli = (typeof CIHAZ_MODELLERI)[number];

export const URUN_BILGI: Record<CihazModeli, { ad: string; fiyat: number; ekran: string }> = {
  ONE: { ad: "ONE", fiyat: 98_000, ekran: "AMOLED dokunmatik ekranlı" },
  "ONE Lite": { ad: "ONE LITE", fiyat: 70_000, ekran: "AMOLED ekransız" },
};

/** Cihazlara KDV eklenir; lisanslar KDV'siz satılır. */
export const KDV_ORANI = 0.2;

/** ONESuite lisans paketleri, 12 aylık. fiyat: yıllık ücret (KDV hariç, TL), null = özel fiyat.
 *  cihaz: bir lisansın kapsadığı cihaz sayısı, null = özel (Enterprise). */
export const LISANS_PAKETLERI = {
  Basic: { fiyat: 42_000, cihaz: 1 },
  Pro: { fiyat: 70_000, cihaz: 1 },
  "Pro+": { fiyat: 100_800, cihaz: 3 },
  Premium: { fiyat: null, cihaz: 5 },
  Enterprise: { fiyat: null, cihaz: null },
} as const satisfies Record<string, { fiyat: number | null; cihaz: number | null }>;

export type LisansPaketi = keyof typeof LISANS_PAKETLERI;

/** Satışta kullanılan güncel fiyatlar. Operasyon › Ayarlar'dan değiştirilir; buradaki sabitler başlangıç değeridir. */
export type FiyatListesi = {
  cihaz: Record<CihazModeli, number>;
  lisans: Record<LisansPaketi, { fiyat: number | null; cihaz: number | null }>;
  kdv: number; // 0.2 = %20, yalnızca cihaz ve aksesuara eklenir
};
export const VARSAYILAN_FIYAT: FiyatListesi = {
  cihaz: { ONE: URUN_BILGI.ONE.fiyat, "ONE Lite": URUN_BILGI["ONE Lite"].fiyat },
  lisans: Object.fromEntries(Object.entries(LISANS_PAKETLERI).map(([k, v]) => [k, { ...v }])) as FiyatListesi["lisans"],
  kdv: KDV_ORANI,
};

/** [{model:"ONE"},{model:"ONE"},{model:"ONE Lite"}] → "2× ONE · 1× ONE Lite" */
export function modelOzeti(cihazlar: { model: CihazModeli }[]) {
  return CIHAZ_MODELLERI.map((m) => [m, cihazlar.filter((c) => c.model === m).length] as const)
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n}× ${m}`)
    .join(" · ");
}
