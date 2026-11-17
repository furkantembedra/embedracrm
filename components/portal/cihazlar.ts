// Bayi portalı "Cihazlarım" verisi: stoktaki seriler (sevk tarihi, bekleme süresi) ve müşterideki cihazlar
// (lisans, garanti, bağlantı, firmware, servis geçmişi). Yalnızca oturumdaki bayinin kayıtları.
import { getRmalar, ADIM_ADI, KARAR_ADI } from "@/components/rma/queries";
import { acikMi } from "@/components/rma/ortak";
import { garantiBilgisi } from "@/components/rma/garanti";
import { GUNCEL_FIRMWARE, DURUM_ADI } from "@/components/cihaz-lisans/queries";
import { getDuzeltmeTalepleri, getYenilemeTalepleri } from "./queries";
import { bayiVerisi, gunler } from "./veri";

const GUN = 86_400_000;
const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / GUN);

export type StokCihazi = { seriNo: string; model: string; sevk: string | null; gun: number };
export type MusteriCihazi = {
  seriNo: string;
  model: string;
  musteri: string;
  satisTarihi: string | null;
  plan: string;
  lisansBaslangic: string | null;
  lisansBitis: string | null;
  lisansKalan: number | null; // gün; negatif = doldu
  durum: string; // Aktif / Süresi doluyor / Lisanssız
  durumKod: "aktif" | "bitiyor" | "lisanssiz" | "stokta";
  garantiBitis: string | null;
  garantide: boolean;
  uzatmaAy: number;
  sonGorulme: string | null; // ISO
  firmware: string;
  eskiFirmware: boolean;
  acikRma: string | null; // açık servis kaydı varsa id
  talepVar: boolean; // yenileme talebi gönderilmiş
  lisansGecmisi: { plan: string; baslangic: string; bitis: string }[];
  surumGecmisi: { zaman: string; eski: string; yeni: string }[];
  rmalar: { id: string; acilis: string; arizaTipi: string; durum: string }[];
  duzeltmeler: { id: string; tarih: string; metin: string; durum: "acik" | "cozuldu"; cozum?: string }[];
};

export async function cihazlarimVerisi() {
  const v = await bayiVerisi();
  const { bugun } = gunler();
  const [rmalar, talepler, duzeltmeler] = await Promise.all([getRmalar(), getYenilemeTalepleri(v.bayi.id), getDuzeltmeTalepleri(v.bayi.id)]);
  const talepSeri = new Set(talepler.map((t) => t.seriNo));

  // Stok: seri başına sevk tarihi
  const sevkTarihi = new Map<string, string>();
  const satisTarihi = new Map<string, string>();
  for (const h of v.hareketler) {
    for (const k of h.kalemler) {
      if (!k.seriNo) continue;
      if (h.tur === "sevkiyat") sevkTarihi.set(k.seriNo, h.tarih);
      if (h.tur === "satis") satisTarihi.set(k.seriNo, h.tarih);
    }
  }
  const stok: StokCihazi[] = v.stokSeriler
    .map((s) => {
      const sevk = sevkTarihi.get(s.seriNo) ?? null;
      return { seriNo: s.seriNo, model: s.model, sevk, gun: sevk ? gunFarki(sevk, bugun) : 0 };
    })
    .sort((a, b) => b.gun - a.gun);

  // Müşterideki cihazlar
  const musteride = v.cihazlar.filter((c) => c.musteriId);
  const garantiler = await Promise.all(musteride.map((c) => garantiBilgisi(c.seriNo, bugun)));
  const cihazlar: MusteriCihazi[] = musteride.map((c, i) => {
    const g = garantiler[i];
    const kendiRma = rmalar.filter((r) => r.seriNo === c.seriNo).sort((a, b) => b.acilis.localeCompare(a.acilis));
    return {
      seriNo: c.seriNo,
      model: c.model,
      musteri: c.musteri,
      satisTarihi: satisTarihi.get(c.seriNo) ?? g?.satisTarihi ?? null,
      plan: c.plan,
      lisansBaslangic: c.lisansBaslangic,
      lisansBitis: c.lisansBitis,
      lisansKalan: c.lisansBitis ? gunFarki(bugun, c.lisansBitis) : null,
      durum: DURUM_ADI[c.durum],
      durumKod: c.durum,
      garantiBitis: g?.garantiBitis ?? null,
      garantide: g?.garantide ?? false,
      uzatmaAy: g?.uzatmalar.reduce((t, u) => t + u.ay, 0) ?? 0,
      sonGorulme: c.sonGorulme ?? null,
      firmware: c.firmware,
      eskiFirmware: c.firmware !== "—" && !c.firmware.startsWith(GUNCEL_FIRMWARE),
      acikRma: kendiRma.find((r) => acikMi(r))?.id ?? null,
      talepVar: talepSeri.has(c.seriNo),
      lisansGecmisi: c.gecmis,
      surumGecmisi: (c.surumGecmisi ?? []).map(({ zaman, eski, yeni }) => ({ zaman, eski, yeni })),
      duzeltmeler: duzeltmeler.filter((d) => d.seriNo === c.seriNo).map(({ id, tarih, metin, durum, cozum }) => ({ id, tarih, metin, durum, cozum })),
      rmalar: kendiRma.map((r) => ({ id: r.id, acilis: r.acilis, arizaTipi: r.arizaTipi, durum: r.karar && !acikMi(r) ? KARAR_ADI[r.karar] : ADIM_ADI[r.adim] })),
    };
  }).sort((a, b) => (a.lisansBitis ?? "9999").localeCompare(b.lisansBitis ?? "9999"));

  const serviste = new Set(rmalar.filter((r) => acikMi(r) && (r.sahip.id === v.bayi.id || v.cihazlar.some((c) => c.seriNo === r.seriNo))).map((r) => r.seriNo));

  return {
    bugun,
    bayiAd: v.bayi.ad,
    stok,
    cihazlar,
    guncelFirmware: GUNCEL_FIRMWARE,
    ozet: {
      stok: stok.length,
      musteride: cihazlar.length,
      bitiyor: cihazlar.filter((c) => c.lisansKalan !== null && c.lisansKalan <= 30).length,
      serviste: serviste.size,
    },
  };
}
