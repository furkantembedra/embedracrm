import PageHeader from "@/components/layout/page-header";
import TalepListesi from "@/components/destek/talep-listesi";
import TalepDetay from "@/components/destek/talep-detay";
import MusteriBilgiPaneli from "@/components/destek/musteri-bilgi-paneli";

export default function DestekPage() {
  return (
    <>
      <PageHeader title="Destek" />
      <TalepListesi />
      <TalepDetay />
      <MusteriBilgiPaneli />
    </>
  );
}
