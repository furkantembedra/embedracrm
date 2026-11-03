import PageHeader from "@/components/layout/page-header";
import DonemSecici from "@/components/raporlar/donem-secici";
import OzetKartlari from "@/components/raporlar/ozet-kartlari";
import YenilemeGrafigi from "@/components/raporlar/yenileme-grafigi";
import UlkeGelirleri from "@/components/raporlar/ulke-gelirleri";
import DestekKonulari from "@/components/raporlar/destek-konulari";
import KaynakDonusumu from "@/components/raporlar/kaynak-donusumu";
import HazirRaporlar from "@/components/raporlar/hazir-raporlar";

export default function RaporlarPage() {
  return (
    <>
      <PageHeader title="Raporlar" />
      <DonemSecici />
      <OzetKartlari />
      <YenilemeGrafigi />
      <UlkeGelirleri />
      <DestekKonulari />
      <KaynakDonusumu />
      <HazirRaporlar />
    </>
  );
}
