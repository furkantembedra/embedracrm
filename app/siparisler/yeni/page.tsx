import PageHeader from "@/components/layout/page-header";
import SiparisFormu from "@/components/siparisler/siparis-formu";
import { getStok } from "@/components/siparisler/queries";
import { getMusteriler } from "@/components/musteriler/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";

export default async function YeniSiparisPage() {
  const [musteriler, stok, fiyatListesi] = await Promise.all([getMusteriler(), getStok(), getFiyatListesi()]);
  return (
    <>
      <PageHeader title="Manuel sipariş" description="Telefon, e-posta veya fuardan gelen siparişi kaydedin" />
      <div className="w-full max-w-2xl rounded-card border border-line bg-card px-5 pt-5">
        <SiparisFormu
          stok={stok}
          fiyatListesi={fiyatListesi}
          musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, sehir: m.sehir, ulke: m.ulke, cihazlar: m.cihazlar.map((c) => ({ seriNo: c.seriNo, model: c.model })) }))}
        />
      </div>
    </>
  );
}
