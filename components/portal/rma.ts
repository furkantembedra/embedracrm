// Bayi portalı "Arıza / RMA" verisi: bayinin talepleri (adım, süre, karar, ücret, kargo, bayiye açık geçmiş)
// ve talep formu için cihazlar (garanti durumuyla). İç teknik notlar bayiye gösterilmez.
import { garantiBilgisi } from "@/components/rma/garanti";
import { getRmalar, ADIM_ADI, KARAR_ADI, HEDEF_GUN, RMA_ADIMLARI } from "@/components/rma/queries";
import { acikMi, kapsamda, onayBekliyor } from "@/components/rma/ortak";
import { getKargoFirmalari, getServisAdresi } from "@/components/operasyon/queries";
import { bayiVerisi, gunler } from "./veri";

const GUN = 86_400_000;
const gunFarki = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / GUN));


export type PortalRma = {
  id: string;
  seriNo: string;
  model: string;
  musteri: string;
  arizaTipi: string;
  ariza: string;
  acilis: string;
  kapanis: string | null;
  acik: boolean;
  adim: number; // 0–5 (RMA_ADIMLARI sırası)
  adimAdi: string;
  gun: number;
  hedefAsildi: boolean;
  oncelik: string;
  garantide: boolean;
  karar: string | null;
  yeniSeri: string | null;
  ucret: number | null;
  ucretOnay: boolean;
  ucretOdendi: boolean;
  onayBekliyor: boolean;
  cihazBekleniyor: boolean; // talep açık, cihaz servise gönderilmemiş
  gelis: string | null; // bayinin girdiği gönderim bilgisi
  kargo: string | null; // servisten geri gönderim
  ekler: { id: string; ad: string; boyut: number }[];
  gecmis: { zaman: string; metin: string; bayi: boolean }[];
};

export type FormCihazi = { seriNo: string; model: string; sahibi: string; garantide: boolean; garantiBitis: string | null; acikRma: string | null };

export async function rmaVerisi() {
  const v = await bayiVerisi();
  const { bugun } = gunler();
  const [rmalar, kargoFirmalari, servis] = await Promise.all([getRmalar(), getKargoFirmalari(), getServisAdresi()]);
  const seriler = new Set(v.cihazlar.map((c) => c.seriNo));
  const kendi = rmalar.filter((r) => r.sahip.id === v.bayi.id || seriler.has(r.seriNo)).sort((a, b) => b.acilis.localeCompare(a.acilis));

  const talepler: PortalRma[] = kendi.map((r) => {
    const acik = acikMi(r);
    const gun = gunFarki(r.acilis, r.kapanis ?? bugun);
    return {
      id: r.id, seriNo: r.seriNo, model: r.model, musteri: r.sahip.ad, arizaTipi: r.arizaTipi, ariza: r.ariza, acilis: r.acilis, kapanis: r.kapanis,
      acik, adim: RMA_ADIMLARI.indexOf(r.adim), adimAdi: ADIM_ADI[r.adim], gun, hedefAsildi: acik && gun > HEDEF_GUN, oncelik: r.oncelik,
      garantide: kapsamda(r), karar: r.karar ? KARAR_ADI[r.karar] : null, yeniSeri: r.yeniSeri,
      ucret: r.ucret, ucretOnay: r.ucretOnay, ucretOdendi: r.ucretOdendi, onayBekliyor: acik && onayBekliyor(r),
      cihazBekleniyor: r.adim === "talep" && !r.gelis, gelis: r.gelis?.takipNo ?? null,
      kargo: r.kargo ? `${r.kargo.firma} · ${r.kargo.takipNo}` : null,
      ekler: r.ekler.map(({ id, ad, boyut }) => ({ id, ad, boyut })),
      // Bayiye açık geçmiş: sistem adımları ve bayinin kendi notları (iç notlar ve müşteri görüşmeleri hariç)
      gecmis: r.gecmis
        .filter((g) => (g.tur ?? "sistem") === "sistem" || g.yazan === v.bayi.ad)
        .map((g) => ({ zaman: g.zaman, metin: g.metin, bayi: g.yazan === v.bayi.ad })),
    };
  });

  const acikSeriler = new Map(kendi.filter((r) => acikMi(r)).map((r) => [r.seriNo, r.id]));
  const bilgiler = await Promise.all(v.cihazlar.map((c) => garantiBilgisi(c.seriNo, bugun)));
  const cihazlar: FormCihazi[] = v.cihazlar.map((c, i) => ({
    seriNo: c.seriNo, model: c.model, sahibi: c.musteriId ? c.musteri : "Stokta",
    garantide: bilgiler[i]?.garantide ?? false, garantiBitis: bilgiler[i]?.garantiBitis ?? null, acikRma: acikSeriler.get(c.seriNo) ?? null,
  }));

  const acik = talepler.filter((t) => t.acik);
  return {
    bugun, talepler, cihazlar, kargoFirmalari, servis, hedefGun: HEDEF_GUN, adimlar: RMA_ADIMLARI.map((a) => ADIM_ADI[a]),
    ozet: {
      acik: acik.length,
      bekleniyor: acik.filter((t) => t.cihazBekleniyor).length,
      serviste: acik.filter((t) => t.adim >= 1 && t.adim <= 3).length,
      onay: acik.filter((t) => t.onayBekliyor).length,
    },
  };
}
