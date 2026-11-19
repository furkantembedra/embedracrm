// Bayi portalı "Lisanslar" verisi: müşterideki tüm cihaz lisansları, yenileme fiyatları (bayi iskontolu,
// bayinin para biriminde), 90 günlük yenileme tutarı, yenileme oranı ve 12 aylık bitiş takvimi.
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getHavuz } from "@/components/bayiler/lisans-havuzu";
import { getYenilemeTalepleri } from "./queries";
import { bayiFiyati, bayiFiyatlari } from "./katalog";
import { bayiVerisi, gunler } from "./veri";

const GUN = 86_400_000;
const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / GUN);
const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const YENILEME_PLANLARI = ["Basic", "Pro", "Pro+"] as const;
export const YENILEME_SURELERI = [12, 24, 36] as const;
/** Yenileme oranı hedefi (%) */
export const YENILEME_HEDEFI = 85;

export type PortalLisans = {
  seriNo: string;
  model: string;
  musteri: string;
  plan: string;
  baslangic: string | null;
  bitis: string | null;
  kalan: number | null; // gün, negatif = doldu
  talepVar: boolean;
};

export async function lisanslarVerisi() {
  const v = await bayiVerisi();
  const [hamFiyat, talepler, havuz] = await Promise.all([getFiyatListesi(), getYenilemeTalepleri(v.bayi.id), getHavuz(v.bayi.id)]);
  const { bugun } = gunler();
  const indirim = v.basvuru?.sozlesme.moq.indirim ?? 0;
  const { kosul, fiyat } = bayiFiyatlari(v.bayi.ulkeKodu, hamFiyat);
  const talepSeri = new Set(talepler.map((t) => t.seriNo));

  const lisanslar: PortalLisans[] = v.cihazlar
    .filter((c) => c.musteriId)
    .map((c) => ({
      seriNo: c.seriNo, model: c.model, musteri: c.musteri, plan: c.plan, baslangic: c.lisansBaslangic, bitis: c.lisansBitis,
      kalan: c.lisansBitis ? gunFarki(bugun, c.lisansBitis) : null, talepVar: talepSeri.has(c.seriNo),
    }))
    .sort((a, b) => (a.bitis ?? "0000").localeCompare(b.bitis ?? "0000"));

  // Yıllık fiyatlar (TL): liste ve bayi
  const fiyatlar = Object.fromEntries(
    YENILEME_PLANLARI.map((p) => [p, { liste: fiyat.lisans[p].fiyat ?? 0, bayi: bayiFiyati(fiyat.lisans[p].fiyat ?? 0, indirim) }]),
  ) as Record<(typeof YENILEME_PLANLARI)[number], { liste: number; bayi: number }>;
  const yillikBayi = (plan: string) => fiyatlar[plan as keyof typeof fiyatlar]?.bayi ?? 0;

  const doksan = lisanslar.filter((l) => l.kalan !== null && l.kalan >= 0 && l.kalan <= 90);
  const birYilOnce = new Date(Date.parse(bugun) - 365 * GUN).toISOString().slice(0, 10);
  const yenilenen = v.hareketler.filter((h) => h.tur === "lisans" && h.tarih >= birYilOnce).reduce((t, h) => t + Math.max(1, h.kalemler.length), 0);
  const dolmus = lisanslar.filter((l) => l.kalan !== null && l.kalan < 0 && l.bitis! >= birYilOnce).length;

  // Önümüzdeki 12 ay: ay başına biten lisans sayısı
  const simdi = new Date(bugun + "T12:00:00");
  const takvim = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() + i, 1);
    const anahtar = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ay = lisanslar.filter((l) => l.bitis?.startsWith(anahtar));
    return { anahtar, ad: `${AY_KISA[d.getMonth()]}${d.getMonth() === 0 || i === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ""}`, adet: ay.length, tutar: ay.reduce((t, l) => t + yillikBayi(l.plan), 0) };
  });

  return {
    bugun, bayiAd: v.bayi.ad, indirim, lisanslar, fiyatlar, takvim,
    havuz: havuz.map(({ paket, sureAy, adet, kaynak, tarih }) => ({ paket, sureAy, adet, kaynak, tarih })),
    paraBirimi: kosul.paraBirimi, kur: kosul.kur,
    ozet: {
      aktif: lisanslar.filter((l) => l.kalan !== null && l.kalan >= 0).length,
      otuz: lisanslar.filter((l) => l.kalan !== null && l.kalan >= 0 && l.kalan <= 30).length,
      dolmus: lisanslar.filter((l) => l.kalan !== null && l.kalan < 0).length,
      doksanAdet: doksan.length,
      doksanTutar: doksan.reduce((t, l) => t + yillikBayi(l.plan), 0),
      oran: yenilenen + dolmus ? Math.round((yenilenen / (yenilenen + dolmus)) * 100) : null,
    },
  };
}
