// Seri numarasından garanti durumu: satış tarihi siparişten, bayi satış hareketinden,
// bayiye sevk tarihinden ya da ilk lisans başlangıcından (bu sırayla) bulunur.
import { getCihaz } from "@/components/cihaz-lisans/queries";
import { getSiparisler } from "@/components/siparisler/queries";
import { getBayiHareketleri, getAktifBayiler } from "@/components/bayiler/queries";
import { getGarantiAy, getRmalar, type RmaKaydi } from "./queries";

export function ayEkleGun(tarih: string, ay: number) {
  const d = new Date(tarih + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + ay);
  return d.toISOString().slice(0, 10);
}

export type GarantiBilgisi = {
  seriNo: string;
  model: RmaKaydi["model"];
  sahip: RmaKaydi["sahip"];
  satisTarihi: string | null;
  satisKaynagi: string;
  garantiBitis: string | null;
  garantide: boolean;
  lisans: { plan: string; bitis: string | null; durum: string };
  bayi: string | null;
  siparisId: string | null;
  rmalar: Pick<RmaKaydi, "id" | "acilis" | "arizaTipi" | "karar" | "adim">[];
};

export async function garantiBilgisi(seriNo: string, bugun: string): Promise<GarantiBilgisi | null> {
  const cihaz = await getCihaz(seriNo);
  if (!cihaz) return null;
  const [siparisler, hareketler, bayiler, garantiAy, rmalar] = await Promise.all([getSiparisler(), getBayiHareketleri(), getAktifBayiler(), getGarantiAy(), getRmalar()]);
  const siparis = siparisler.find((s) => s.seriNolar.includes(seriNo)) ?? null;
  const bayiSatis = hareketler.find((h) => h.tur === "satis" && h.kalemler.some((k) => k.seriNo === seriNo));
  const ilkLisans = [...cihaz.gecmis].sort((a, b) => a.baslangic.localeCompare(b.baslangic))[0]?.baslangic ?? cihaz.lisansBaslangic;

  let satisTarihi: string | null = null;
  let satisKaynagi = "Bilinmiyor";
  if (siparis) [satisTarihi, satisKaynagi] = [(siparis.teslimTarihi ?? siparis.tarih).slice(0, 10), `Sipariş #${siparis.id}`];
  else if (bayiSatis) [satisTarihi, satisKaynagi] = [bayiSatis.tarih, "Bayi satış bildirimi"];
  else if (cihaz.stogaGiris) [satisTarihi, satisKaynagi] = [cihaz.stogaGiris, "Bayiye sevk tarihi"];
  else if (ilkLisans) [satisTarihi, satisKaynagi] = [ilkLisans, "İlk lisans başlangıcı"];

  const garantiBitis = satisTarihi ? ayEkleGun(satisTarihi, garantiAy) : null;
  const bayi = cihaz.bayiId ? bayiler.find((b) => b.id === cihaz.bayiId) ?? null : null;
  const sahip: RmaKaydi["sahip"] = cihaz.musteriId
    ? { tur: "musteri", id: cihaz.musteriId, ad: cihaz.musteri }
    : bayi ? { tur: "bayi", id: bayi.id, ad: bayi.ad } : { tur: "musteri", id: null, ad: cihaz.musteri || "—" };

  return {
    seriNo, model: cihaz.model, sahip, satisTarihi, satisKaynagi, garantiBitis,
    garantide: !!garantiBitis && garantiBitis >= bugun,
    lisans: { plan: cihaz.plan, bitis: cihaz.lisansBitis, durum: cihaz.durum },
    bayi: bayi?.ad ?? null,
    siparisId: siparis?.id ?? null,
    rmalar: rmalar.filter((r) => r.seriNo === seriNo).map(({ id, acilis, arizaTipi, karar, adim }) => ({ id, acilis, arizaTipi, karar, adim })),
  };
}
