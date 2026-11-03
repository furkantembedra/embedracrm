import PageHeader from "@/components/layout/page-header";
import OzetKartlari from "@/components/satis-hatti/ozet-kartlari";
import Kanban from "@/components/satis-hatti/kanban";

export default function SatisHattiPage() {
  return (
    <>
      <PageHeader title="Satış Hattı" />
      <OzetKartlari />
      <Kanban />
    </>
  );
}
