// Plan önerisi senaryoları: gerçek katalog (docs/bot/ozellikler.md) + başlangıç fiyat listesi (VARSAYILAN_FIYAT,
// 19 Kasım 2026'da embedra.net ve Ayarlar'la aynı: Basic 42.000 / Pro 70.000 / Pro+ 100.800 ₺ 3 cihaz).
//
// Yeni senaryo eklemek için bir satır ekleyin. "musteri" yalnızca açıklamadır: cümleyi özellik kimliklerine ve cihaz
// adedine çevirmek P2'de modelin işi; burada denenen, o çeviri doğruysa kodun doğru planı ve tutarı verdiğidir.
// P5.1'de gerçek konuşmalardan gelen satırlar da buraya eklenebilir.
//
// Cihaz adedi yalnızca müşteri açıkça söylediğinde yazılır. Eleman, tezgâh ya da şube sayısı cihaz sayısı demek
// değildir; bot bunlardan adet çıkarmaz, kaç cihaz kullanılacağını sorar (P2'de model kuralı).
import type { CihazModeli, LisansPaketi } from "@/lib/urunler";

export type PlanSenaryosu = {
  musteri: string;
  ozellikler: string[];
  cihaz: number;
  model?: CihazModeli;
  /** Beklenen öneri; tutar null = özel fiyat (satışçı belirler) */
  plan: LisansPaketi;
  lisans: number;
  tutar: number | null;
  /** Beklenen en ucuz yükseltme; null = önerilecek yükseltme yok; yazılmazsa denetlenmez */
  ust?: { plan: LisansPaketi; lisans: number; tutar: number | null; ekTutar: number | null } | null;
  bilinmeyen?: string[];
  modelUyumsuz?: boolean;
};

export const PLAN_SENARYOLARI: PlanSenaryosu[] = [
  {
    musteri: "Arada bir kutu test ediyorum, tek cihaz yeter",
    ozellikler: ["temel-direksiyon-testi"], cihaz: 1,
    plan: "Basic", lisans: 1, tutar: 42_000,
    ust: { plan: "Pro", lisans: 1, tutar: 70_000, ekTutar: 28_000 },
  },
  {
    musteri: "İki cihazla sadece test yapacağız",
    ozellikler: ["temel-direksiyon-testi", "can-protokolu"], cihaz: 2,
    plan: "Basic", lisans: 2, tutar: 84_000,
    ust: { plan: "Pro+", lisans: 1, tutar: 100_800, ekTutar: 16_800 },
  },
  {
    musteri: "3 cihaz alacağız, test yapacağız",
    ozellikler: ["temel-direksiyon-testi"], cihaz: 3,
    plan: "Pro+", lisans: 1, tutar: 100_800, // Basic × 3 = 126.000'den ucuz
    ust: { plan: "Premium", lisans: 1, tutar: null, ekTutar: null },
  },
  {
    musteri: "4 cihaz, sadece test",
    ozellikler: ["temel-direksiyon-testi"], cihaz: 4,
    plan: "Basic", lisans: 4, tutar: 168_000,
    ust: { plan: "Pro+", lisans: 2, tutar: 201_600, ekTutar: 33_600 },
  },
  {
    musteri: "5 cihaz, sadece test",
    ozellikler: ["temel-direksiyon-testi"], cihaz: 5,
    plan: "Pro+", lisans: 2, tutar: 201_600, // Basic × 5 = 210.000'den ucuz
  },
  {
    musteri: "7 cihaz kullanacağım, test yeter",
    ozellikler: ["temel-direksiyon-testi", "can-protokolu", "k-line-protokolu"], cihaz: 7,
    plan: "Basic", lisans: 7, tutar: 294_000,
    ust: { plan: "Pro+", lisans: 3, tutar: 302_400, ekTutar: 8_400 }, // Pro × 7 (+196.000) değil
  },
  {
    musteri: "CAN-FD'li araçlar da geliyor",
    ozellikler: ["can-fd-protokolu"], cihaz: 1,
    plan: "Pro", lisans: 1, tutar: 70_000,
    ust: { plan: "Premium", lisans: 1, tutar: null, ekTutar: null }, // Pro+ özellik eklemez
  },
  {
    musteri: "Hata kodlarını okuyup silmek istiyorum",
    ozellikler: ["ariza-teshisi"], cihaz: 1,
    plan: "Pro", lisans: 1, tutar: 70_000,
  },
  {
    musteri: "Kutulara yazılım atacağım, iki cihaz",
    ozellikler: ["flash"], cihaz: 2,
    plan: "Pro+", lisans: 1, tutar: 100_800, // Pro × 2 = 140.000'den ucuz
  },
  {
    musteri: "7 cihazda flash ve canlı veri lazım",
    ozellikler: ["flash", "canli-veri"], cihaz: 7,
    plan: "Pro+", lisans: 3, tutar: 302_400, // Pro × 7 = 490.000
  },
  {
    musteri: "Laptop bağlamadan çalışsın, ONE Lite düşünüyorum",
    ozellikler: ["bilgisayarsiz-kullanim"], cihaz: 1, model: "ONE Lite",
    plan: "Basic", lisans: 1, tutar: 42_000, modelUyumsuz: true,
  },
  {
    musteri: "ONE Lite aldım, kutuya VIN yazmam lazım",
    ozellikler: ["ozel-fonksiyonlar"], cihaz: 1, model: "ONE Lite",
    plan: "Pro", lisans: 1, tutar: 70_000, modelUyumsuz: true,
  },
  {
    musteri: "Yapay zekâ arızayı kendisi bulsun",
    ozellikler: ["oneassist"], cihaz: 1,
    plan: "Basic", lisans: 1, tutar: 42_000, bilinmeyen: ["oneassist"], // bot plan söylemez, devreder
  },
  {
    musteri: "5 cihaz, öncelikli destek istiyoruz",
    ozellikler: ["oncelikli-destek"], cihaz: 5,
    plan: "Premium", lisans: 1, tutar: null,
    ust: { plan: "Enterprise", lisans: 1, tutar: null, ekTutar: null },
  },
  {
    musteri: "Distribütörüz, 20 cihaz, bize özel bir muhatap lazım",
    ozellikler: ["hesap-yoneticisi"], cihaz: 20,
    plan: "Enterprise", lisans: 1, tutar: null, ust: null,
  },
];
