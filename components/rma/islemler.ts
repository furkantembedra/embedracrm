// RMA kaydı açma: CRM formu ve bayi portalı ortak kullanır (Server Action değildir, sunucu içinden çağrılır).
import { revalidatePath } from "next/cache";
import { garantiBilgisi } from "./garanti";
import { musteriyiGuncelle } from "@/components/musteriler/queries";
import { ARIZA_TIPLERI, rmaEkle, sonrakiRmaNo, type ArizaTipi, type RmaKaydi } from "./queries";

const p2 = (n: number) => String(n).padStart(2, "0");
export function simdiYerel(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function rmaYenile() {
  for (const y of ["/rma", "/cihaz-lisans", "/musteriler", "/operasyon", "/siparisler", "/portal/rma", "/portal"]) revalidatePath(y);
}

export async function rmaOlustur(v: {
  seriNo: string; arizaTipi: string; ariza: string; fotograflar: string[]; destekTalebiId: string | null;
  kaynak: RmaKaydi["kaynak"]; bayiId?: string; ucret?: number | null; oncelik?: string;
}): Promise<{ rma?: RmaKaydi; hatalar?: Record<string, string> }> {
  const hatalar: Record<string, string> = {};
  const simdi = simdiYerel();
  const bilgi = await garantiBilgisi(v.seriNo, simdi.slice(0, 10));
  if (!bilgi) hatalar.seriNo = "Bu seri no CRM'de kayıtlı değil.";
  else if (v.bayiId && bilgi.sahip.id !== v.bayiId && !(bilgi.bayi && bilgi.sahip.tur === "musteri")) hatalar.seriNo = "Bu cihaz bayinize ait değil.";
  else if (bilgi.rmalar.some((r) => r.adim !== "tamamlandi" && r.adim !== "gonderildi")) hatalar.seriNo = `Bu cihaz için açık RMA var: ${bilgi.rmalar.find((r) => r.adim !== "tamamlandi" && r.adim !== "gonderildi")!.id}`;
  if (!ARIZA_TIPLERI.includes(v.arizaTipi as ArizaTipi)) hatalar.arizaTipi = "Arıza tipini seçin.";
  if (v.ariza.trim().length < 5) hatalar.ariza = "Arızayı kısaca anlatın.";
  if (v.ucret != null && (!Number.isFinite(v.ucret) || v.ucret < 0)) hatalar.ucret = "Ücret geçersiz.";
  if (Object.keys(hatalar).length || !bilgi) return { hatalar };

  const rma: RmaKaydi = {
    id: await sonrakiRmaNo(),
    seriNo: v.seriNo,
    model: bilgi.model,
    sahip: bilgi.sahip,
    arizaTipi: v.arizaTipi as ArizaTipi,
    ariza: v.ariza.trim().slice(0, 1000),
    fotograflar: v.fotograflar.slice(0, 10),
    garantide: bilgi.garantide,
    garantiElle: null,
    ucret: bilgi.garantide ? null : v.ucret ?? null,
    adim: "talep",
    karar: null,
    kullanilanParcalar: {},
    yeniSeri: null,
    destekTalebiId: v.destekTalebiId,
    iadeId: null,
    kaynak: v.kaynak,
    acilis: simdi.slice(0, 10),
    kapanis: null,
    gelis: null,
    kargo: null,
    ucretOdendi: false,
    oncelik: v.oncelik === "Acil" ? "Acil" : "Normal",
    gecmis: [{ tur: "sistem", zaman: simdi, metin: `RMA açıldı${v.kaynak === "bayi-portali" ? " (bayi portalından)" : ""}. ${bilgi.garantide ? `Garanti kapsamında (bitiş ${bilgi.garantiBitis?.split("-").reverse().join(".")}).` : "Garanti dışı."}` }],
  };
  await rmaEkle(rma);
  // Müşterinin zaman çizelgesine düşer
  if (rma.sahip.tur === "musteri" && rma.sahip.id) {
    await musteriyiGuncelle(rma.sahip.id, (m) => m.olaylar.unshift({ metin: `${rma.id} açıldı · ${rma.seriNo} · ${rma.arizaTipi}`, zaman: "Bugün · RMA", tur: "destek" }));
  }
  rmaYenile();
  return { rma };
}
