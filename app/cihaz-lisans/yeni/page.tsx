import PageHeader from "@/components/layout/page-header";
import CihazFormu from "@/components/cihaz-lisans/cihaz-formu";
import LisansFormu from "@/components/cihaz-lisans/lisans-formu";

export default function YeniCihazPage() {
  return (
    <>
      <PageHeader title="Yeni cihaz" />
      <CihazFormu />
      <LisansFormu />
    </>
  );
}
