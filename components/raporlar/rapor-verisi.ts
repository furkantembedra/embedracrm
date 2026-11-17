// Raporlar: dönem özetleri CRM kayıtlarından hesaplanır (siparişler, cihaz lisansları, destek talepleri, satış hattı,
// bayi hareketleri). Bayi portalından gelen siparişler (gelir), bayinin müşteriye satışları (sell-out) ve portaldan açılan
// destek talepleri aynı kayıtlarda olduğu için buraya kendiliğinden yansır. Yalnızca sunucuda import edin.
import { connection } from "next/server";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { KONULAR, getTalepler } from "@/components/destek/queries";
import { getFirsatlar, KAYNAKLAR } from "@/components/satis-hatti/queries";
import { getSiparisler, getStok } from "@/components/siparisler/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getBayiHareketleri } from "@/components/bayiler/queries";
import { AY_KISA, ayEkle, cihazSayisi, gelireSayilir, gunEkle, gunStr, siparisGeliri, ulkeKodu, yenilemeSayaci } from "./hesap";
import type { AylikYenileme, Donem, DonemRaporu, Kpi, KonuPayi, RaporOzeti } from "./queries";

// Konu renkleri sabit sırada (KONULAR ile aynı sıra)
const KONU_RENGI = ["#2a78d6", "#eb6834", "#1baf7a", "#e87ba4", "#eda100", "#8a8d84"];
const YENILEME_HEDEFI = 85;

const kisaTl = (n: number) =>
  n >= 1_000_000 ? `₺${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}M` : n >= 1000 ? `₺${Math.round(n / 1000).toLocaleString("tr-TR")}K` : `₺${Math.round(n)}`;
const yuzdeDegisim = (simdi: number, once: number) => {
  if (!once) return "";
  const d = ((simdi - once) / once) * 100;
  return `${d >= 0 ? "+" : "-"}%${Math.abs(d).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
};
const adetDegisim = (simdi: number, once: number) => `${simdi - once >= 0 ? "+" : "-"}${Math.abs(simdi - once)} adet`;
const kpi = (etiket: string, deger: string, degisim: string, iyi: boolean, not?: string): Kpi => ({ etiket, deger, degisim, iyi, ...(not ? { not } : {}) });

/** Dönemin [başlangıç, bitiş] günleri ve karşılaştırılan önceki aralık (aynı uzunlukta) */
function araliklar(d: Donem, bugun: string) {
  const yil = Number(bugun.slice(0, 4)), ay = Number(bugun.slice(5, 7));
  if (d === "30g") return { bas: gunEkle(bugun, -29), son: bugun, oBas: gunEkle(bugun, -59), oSon: gunEkle(bugun, -30), etiket: "Son 30 gün" };
  if (d === "ceyrek") {
    const ilkAy = Math.floor((ay - 1) / 3) * 3 + 1;
    const bas = `${yil}-${String(ilkAy).padStart(2, "0")}-01`;
    const gun = Math.round((Date.parse(bugun) - Date.parse(bas)) / 86_400_000);
    const oBas = `${ayEkle(bas.slice(0, 7), -3)}-01`;
    return { bas, son: bugun, oBas, oSon: gunEkle(oBas, gun), etiket: `${AY_KISA[ilkAy - 1]} – ${AY_KISA[ilkAy + 1]} ${yil} · bugüne kadar` };
  }
  const bas = `${yil}-01-01`;
  return { bas, son: bugun, oBas: `${yil - 1}-01-01`, oSon: `${yil - 1}${bugun.slice(4)}`, etiket: `${yil} yılbaşından bugüne` };
}

export async function getRaporOzeti(): Promise<RaporOzeti> {
  await connection();
  const bugun = gunStr(new Date());
  const [siparisler, cihazlar, talepler, firsatlar, fiyat, stok, hareketler] = await Promise.all([
    getSiparisler(), getCihazlar(), getTalepler(), getFirsatlar(), getFiyatListesi(), getStok(), getBayiHareketleri(),
  ]);
  const gecerli = siparisler.filter(gelireSayilir);
  const aralikta = (t: string, bas: string, son: string) => t.slice(0, 10) >= bas && t.slice(0, 10) <= son;

  // Lead kaynağı → kazanılan (fırsatlarda tarih tutulmadığı için tüm kayıtlar)
  const kaynaklar = KAYNAKLAR.map((ad) => ({
    ad, lead: firsatlar.filter((f) => f.kaynak === ad).length, musteri: firsatlar.filter((f) => f.kaynak === ad && f.asama === "kazanildi").length,
  })).filter((k) => k.lead > 0);
  const kapanan = firsatlar.filter((f) => f.asama === "kazanildi" || f.asama === "kaybedildi");
  const kazanan = firsatlar.filter((f) => f.asama === "kazanildi").length;

  const donemRaporu = (d: Donem): DonemRaporu => {
    const a = araliklar(d, bugun);
    const bu = gecerli.filter((s) => aralikta(s.tarih, a.bas, a.son));
    const once = gecerli.filter((s) => aralikta(s.tarih, a.oBas, a.oSon));
    const gelir = (l: typeof bu) => l.reduce((t, s) => t + siparisGeliri(s, fiyat, stok).toplam, 0);
    const [gBu, gOnce] = [gelir(bu), gelir(once)];
    const [cBu, cOnce] = [bu.reduce((t, s) => t + cihazSayisi(s), 0), once.reduce((t, s) => t + cihazSayisi(s), 0)];
    const sellOut = (bas: string, son: string) => hareketler.filter((h) => h.tur === "satis" && h.bayiId && aralikta(h.tarih, bas, son)).reduce((t, h) => t + h.kalemler.length, 0);
    const [soBu, soOnce] = [sellOut(a.bas, a.son), sellOut(a.oBas, a.oSon)];
    const yBu = yenilemeSayaci(cihazlar, a.bas, a.son), yOnce = yenilemeSayaci(cihazlar, a.oBas, a.oSon);
    const ortBu = bu.length ? gBu / bu.length : 0, ortOnce = once.length ? gOnce / once.length : 0;

    // Ülke gelirleri
    const ulke = new Map<string, number>();
    for (const s of bu) ulke.set(s.ulke, (ulke.get(s.ulke) ?? 0) + siparisGeliri(s, fiyat, stok).toplam);
    const ulkeler = [...ulke.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([ad, tutar]) => ({ kod: ulkeKodu(ad), ad, tutar: Math.round(tutar) }));

    // Destek konuları
    const donemTalepleri = talepler.filter((t) => aralikta(t.acilis, a.bas, a.son));
    const konular: KonuPayi[] = KONULAR.map((ad, i) => ({ ad, n: donemTalepleri.filter((t) => t.konu === ad).length, renk: KONU_RENGI[i] }))
      .filter((k) => k.n > 0)
      .map(({ ad, n, renk }) => ({ ad, renk, yuzde: Math.round((n / donemTalepleri.length) * 100) }));

    return {
      etiket: a.etiket,
      kpi: [
        kpi("Toplam gelir", kisaTl(gBu), yuzdeDegisim(gBu, gOnce), gBu >= gOnce),
        kpi("Satılan cihaz", String(cBu), cOnce || cBu ? adetDegisim(cBu, cOnce) : "", cBu >= cOnce),
        kpi("Bayi sell-out", String(soBu), soOnce || soBu ? adetDegisim(soBu, soOnce) : "", soBu >= soOnce, soOnce || soBu ? undefined : "bayi satışı yok"),
        kpi(
          "Yenileme oranı", yBu.oran === null ? "—" : `%${Math.round(yBu.oran)}`,
          yBu.oran !== null && yOnce.oran !== null ? `${yBu.oran >= yOnce.oran ? "+" : "-"}${Math.abs(Math.round(yBu.oran - yOnce.oran))} puan` : "",
          (yBu.oran ?? 0) >= (yOnce.oran ?? 0),
          yBu.oran === null ? "dönemde biten lisans yok" : `${yBu.yenilenen}/${yBu.biten} lisans`,
        ),
        kpi("Ort. sipariş değeri", bu.length ? kisaTl(ortBu) : "—", yuzdeDegisim(ortBu, ortOnce), ortBu >= ortOnce, bu.length ? undefined : "dönemde sipariş yok"),
        kpi("Lead → müşteri", kapanan.length ? `%${Math.round((kazanan / Math.max(1, firsatlar.length)) * 100)}` : "—", "", true, `${kazanan} / ${firsatlar.length} fırsat · tüm kayıtlar`),
      ],
      ulkeler,
      konular,
      kaynaklar,
    };
  };

  // Aylık yenileme oranı: son 12 ay, yalnızca lisansı biten ay
  const buAy = bugun.slice(0, 7);
  const yenileme: AylikYenileme[] = Array.from({ length: 12 }, (_, i) => ayEkle(buAy, i - 11)).flatMap((ay) => {
    const son = ay === buAy ? bugun : gunEkle(`${ayEkle(ay, 1)}-01`, -1);
    const y = yenilemeSayaci(cihazlar, `${ay}-01`, son);
    return y.oran === null ? [] : [{ ay: AY_KISA[Number(ay.slice(5, 7)) - 1], oran: Math.round(y.oran * 10) / 10, biten: y.biten, yenilenen: y.yenilenen }];
  });

  return {
    donemler: { "30g": donemRaporu("30g"), ceyrek: donemRaporu("ceyrek"), yil: donemRaporu("yil") },
    yenileme,
    yenilemeHedefi: YENILEME_HEDEFI,
  };
}
