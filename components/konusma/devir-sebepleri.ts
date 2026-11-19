// Botun konuşmayı insana devretme sebepleri (konusmalar.devir_sebebi kısıtıyla aynı liste; SQL: 20261119160000_devral_devret.sql).
// P2.2'deki insana_devret aracının sebep listesi + P2.1'in kendi devretmeleri (hata / zaman aşımı / refusal, tur sınırı).
// Kanal bilmez; arayüz ve sunucu aynı listeyi kullanır.

export const DEVIR_SEBEPLERI = {
  fiyat_pazarligi: "Fiyat pazarlığı",
  sikayet: "Şikâyet",
  ozel_fiyat: "Özel fiyat talebi",
  emin_degil: "Bot emin değil",
  musteri_istedi: "Müşteri insanla görüşmek istedi",
  bayi_bolgesi: "Münhasır bayi bölgesi",
  desteklenmeyen_dil: "Desteklenmeyen dil",
  veri_silme: "Veri silme talebi",
  bot_hatasi: "Bot cevap veremedi (hata)",
  tur_siniri: "Tur sınırı aşıldı",
  diger: "Diğer",
} as const;

export type DevirSebebi = keyof typeof DEVIR_SEBEPLERI;

export const devirSebebiMi = (x: unknown): x is DevirSebebi => typeof x === "string" && Object.hasOwn(DEVIR_SEBEPLERI, x);

export const devirSebebiAdi = (x: string | null | undefined) => (x && devirSebebiMi(x) ? DEVIR_SEBEPLERI[x] : "Diğer");
