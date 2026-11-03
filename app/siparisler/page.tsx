import PageHeader from "@/components/layout/page-header";
import OzetKartlari from "@/components/siparisler/ozet-kartlari";
import SiparisTablosu from "@/components/siparisler/siparis-tablosu";
import SiparisDetay from "@/components/siparisler/siparis-detay";
import DepoStoku from "@/components/siparisler/depo-stoku";
import IadeListesi from "@/components/siparisler/iade-listesi";

export default function SiparislerPage() {
  return (
    <>
      <PageHeader title="Sipariş & Sevkiyat" />
      <OzetKartlari />
      <SiparisTablosu />
      <SiparisDetay />
      <DepoStoku />
      <IadeListesi />
    </>
  );
}
