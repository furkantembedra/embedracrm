// Malzeme ihtiyacı (MRP) hesabı — tarayıcıda çalışır, saf fonksiyon.
//
// 1) Cihaz talebi: açık siparişlerde (ödeme bekliyor / hazırlanıyor) henüz seri atanmamış cihazlar
//    + isteğe bağlı olası talep: teklif (%40) ve müzakere (%60) aşamasındaki fırsatlar, olasılıkla ağırlıklı.
// 2) Cihaz arzı: depodaki cihaz stoğu + üretimde / kalitede olan partiler + ufuk içinde planlanmış partiler.
// 3) Eksik cihaz kadar ek üretim gerekir. Bileşen ihtiyacı = (planlı partiler + ek üretim) × reçete.
// 4) Bileşen arzı: stok + açık tedarik siparişleri (sipariş / yolda) + iç üretim emirlerinin kalan adedi.
// Önerilen sipariş: ihtiyaç karşılandıktan sonra kalan stok kritik seviyenin altına iniyorsa hedef seviyeye tamamlar.
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";
import { icerikCoz } from "@/components/satis-hatti/urun-secimi";
import type { Firsat } from "@/components/satis-hatti/queries";
import type { Siparis } from "@/components/siparisler/queries";
import type { BilesenKalemi, IcUretimEmri, Recete, TedarikSiparisi, UretimPartisi } from "./queries";

export const OLASILIK: Partial<Record<Firsat["asama"], number>> = { teklif: 0.4, muzakere: 0.6 };

export type IhtiyacGirdisi = {
  siparisler: Siparis[];
  firsatlar: Firsat[];
  cihazStogu: Record<CihazModeli, number>;
  partiler: UretimPartisi[];
  bilesenler: BilesenKalemi[];
  recete: Recete;
  tedarik: TedarikSiparisi[];
  icUretim: IcUretimEmri[];
  bugun: string; // "2026-11-10"
  ufukGun: number;
  olasiDahil: boolean;
};

export type CihazSatiri = { model: CihazModeli; kesin: number; olasi: number; depo: number; yapimda: number; planli: number; ekUretim: number; uretilebilir: number; darbogaz: string | null };
export type BilesenSatiri = { kod: string; ad: string; kaynak: BilesenKalemi["kaynak"]; gereken: number; stok: number; gelen: number; netEksik: number; oneri: number; kritik: number; hedef: number };

const gunEkle = (t: string, g: number) => {
  const d = new Date(t + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + g);
  return d.toISOString().slice(0, 10);
};

export function malzemeIhtiyaci(g: IhtiyacGirdisi) {
  const sinir = gunEkle(g.bugun, g.ufukGun);
  const sifir = () => Object.fromEntries(CIHAZ_MODELLERI.map((m) => [m, 0])) as Record<CihazModeli, number>;

  const kesin = sifir();
  for (const s of g.siparisler) {
    if (s.durum !== "odeme" && s.durum !== "hazirlaniyor") continue;
    let atanmis = s.seriNolar.length;
    for (const k of s.kalemler) {
      if (k.tur !== "cihaz") continue;
      const dusen = Math.min(atanmis, k.adet);
      atanmis -= dusen;
      kesin[k.model] += k.adet - dusen;
    }
  }

  const olasi = sifir();
  for (const f of g.firsatlar) {
    const p = OLASILIK[f.asama];
    if (!p || f.sonrakiTarih > sinir) continue;
    const u = icerikCoz(f.icerik);
    if (u.model) olasi[u.model] += u.adet * p;
  }

  const yapimda = sifir();
  const planli = sifir();
  for (const p of g.partiler) {
    if (p.durum === "uretimde" || p.durum === "kalite") yapimda[p.model] += p.adet;
    if (p.durum === "planlandi" && p.hedefTarih <= sinir) planli[p.model] += p.adet;
  }

  const cihazlar: CihazSatiri[] = CIHAZ_MODELLERI.map((model) => {
    const talep = kesin[model] + (g.olasiDahil ? Math.ceil(olasi[model]) : 0);
    const arz = g.cihazStogu[model] + yapimda[model] + planli[model];
    const kodlar = g.recete[model] ?? [];
    let uretilebilir = kodlar.length ? Infinity : 0;
    let darbogaz: string | null = null;
    for (const kod of kodlar) {
      const b = g.bilesenler.find((x) => x.kod === kod);
      const adet = b?.adet ?? 0;
      if (adet < uretilebilir) [uretilebilir, darbogaz] = [adet, b?.ad ?? kod];
    }
    return {
      model, kesin: kesin[model], olasi: Math.round(olasi[model] * 10) / 10, depo: g.cihazStogu[model], yapimda: yapimda[model], planli: planli[model],
      ekUretim: Math.max(0, talep - arz), uretilebilir: Number.isFinite(uretilebilir) ? uretilebilir : 0, darbogaz,
    };
  });

  const bilesenler: BilesenSatiri[] = g.bilesenler.map((b) => {
    const gereken = cihazlar.reduce((s, c) => s + ((g.recete[c.model] ?? []).includes(b.kod) ? c.planli + c.ekUretim : 0), 0);
    const tedarik = g.tedarik.filter((t) => t.kalemKodu === b.kod && t.durum !== "teslim").reduce((s, t) => s + t.adet, 0);
    const ic = g.icUretim.filter((e) => e.kalemKodu === b.kod).reduce((s, e) => s + Math.max(0, e.hedef - e.girisler.reduce((x, y) => x + y.adet, 0)), 0);
    const gelen = tedarik + ic;
    const kalan = b.adet + gelen - gereken;
    return {
      kod: b.kod, ad: b.ad, kaynak: b.kaynak, gereken, stok: b.adet, gelen, kritik: b.kritik, hedef: b.hedef,
      netEksik: Math.max(0, -kalan),
      oneri: kalan < b.kritik ? Math.max(0, b.hedef - kalan) : 0,
    };
  });

  return { cihazlar, bilesenler, sinir };
}
