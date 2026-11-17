// "Satış bildir" penceresinin verisi: stoktaki seriler ve bayinin müşteri listesi
// (daha önce cihaz sattığı müşteriler + kendi lead'leri). Sunucuda okunur, istemciye düz veri olarak gider.
import { havuzOzeti } from "@/components/bayiler/lisans-havuzu";
import { seriBilinmeyenStok } from "@/components/bayiler/ortak";
import { getBayiLeadleri } from "./lead-queries";
import { bayiVerisi, gunler } from "./veri";

export type MusteriSecenegi = { ad: string; etiket: string }; // etiket: "3 cihaz" / "Lead · Demo"
export type SatisFormVerisi = { bugun: string; stok: { seriNo: string; model: string }[]; musteriler: MusteriSecenegi[]; havuz: Record<string, number>; seriBilinmeyen: Record<string, number> };

export async function satisFormVerisi(): Promise<SatisFormVerisi> {
  const v = await bayiVerisi();
  const leadler = await getBayiLeadleri(v.bayi.id);
  const sayilar = new Map<string, number>();
  for (const c of v.cihazlar) if (c.musteriId) sayilar.set(c.musteri, (sayilar.get(c.musteri) ?? 0) + 1);
  const musteriler: MusteriSecenegi[] = [...sayilar].map(([ad, n]) => ({ ad, etiket: `${n} cihaz` }));
  const ASAMA: Record<string, string> = { yeni: "Yeni", gorusuldu: "Görüşüldü", demo: "Demo", teklif: "Teklif", kazanildi: "Kazanıldı" };
  for (const l of leadler) {
    if (l.asama === "kaybedildi" || sayilar.has(l.firma)) continue;
    musteriler.push({ ad: l.firma, etiket: `Lead · ${ASAMA[l.asama]}` });
  }
  musteriler.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  return { bugun: gunler().bugun, stok: v.stokSeriler.map((s) => ({ seriNo: s.seriNo, model: s.model })), musteriler, havuz: await havuzOzeti(v.bayi.id), seriBilinmeyen: seriBilinmeyenStok(v.bayi.id, v.tumHareketler) };
}
