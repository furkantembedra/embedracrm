import PageHeader from "@/components/layout/page-header";
import SegmentKartlari from "@/components/musteriler/segment-kartlari";
import MusteriTablosu from "@/components/musteriler/musteri-tablosu";
import MusteriDetay from "@/components/musteriler/musteri-detay";

export default function MusterilerPage() {
  return (
    <>
      <PageHeader title="Müşteriler" />
      <SegmentKartlari />
      <MusteriTablosu />
      <MusteriDetay />
    </>
  );
}
