import PageHeader from "@/components/layout/page-header";
import OzetKartlari from "@/components/pazarlama/ozet-kartlari";
import IcerikTakvimi from "@/components/pazarlama/icerik-takvimi";
import KampanyaTablosu from "@/components/pazarlama/kampanya-tablosu";
import HedefListeler from "@/components/pazarlama/hedef-listeler";

export default function PazarlamaPage() {
  return (
    <>
      <PageHeader title="Pazarlama & Bülten" />
      <OzetKartlari />
      <IcerikTakvimi />
      <KampanyaTablosu />
      <HedefListeler />
    </>
  );
}
