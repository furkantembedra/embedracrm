// P2.4b: isteme giren toplam ek metin sınırı (P2.3 / P2.4 ile aynı 40.000 karakter: docs kaynakları + ayar metinleri +
// onaylı bilgi kaynakları). Saf modül; sunucu onayda kesin denetler, arayüz anında gösterir.
import { AZAMI_TOPLAM, toplamUzunluk, UYARI_ORANI, type BilgiKaynagi, type IstemAyarlari } from "../ayar-surumu";

export type SinirDurumu = { toplam: number; sinir: number; uyari: boolean; asim: boolean; ek: number };

/**
 * Aktif sürüme bu kaynak (onaylanırsa: yeni metniyle) eklendiğinde toplam. Aynı kimlikli kaynak zaten aktif sürümdeyse
 * yerine geçer (iki kez sayılmaz).
 */
export function kaynakSiniri(ayarlar: IstemAyarlari, aktifKaynaklar: readonly BilgiKaynagi[], kaynak?: { id: number; metin: string }): SinirDurumu {
  const digerleri = kaynak ? aktifKaynaklar.filter((k) => k.id !== kaynak.id) : aktifKaynaklar;
  const liste = kaynak ? [...digerleri, { id: kaynak.id, baslik: "", hedef: "bilgi_bankasi" as const, metin: kaynak.metin }] : digerleri;
  const toplam = toplamUzunluk(ayarlar, liste);
  return { toplam, sinir: AZAMI_TOPLAM, uyari: toplam > AZAMI_TOPLAM * UYARI_ORANI, asim: toplam > AZAMI_TOPLAM, ek: kaynak?.metin.length ?? 0 };
}

export const sinirMetni = (d: SinirDurumu) =>
  `İsteme giren metin toplamı ${d.toplam.toLocaleString("tr-TR")} / ${d.sinir.toLocaleString("tr-TR")} karakter`;
