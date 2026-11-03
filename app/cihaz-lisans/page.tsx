import PageHeader from "@/components/layout/page-header";
import OzetKartlari from "@/components/cihaz-lisans/ozet-kartlari";
import CihazTablosu from "@/components/cihaz-lisans/cihaz-tablosu";
import FirmwareDagilimi from "@/components/cihaz-lisans/firmware-dagilimi";
import ServisKuyrugu from "@/components/cihaz-lisans/servis-kuyrugu";
import LisansPlanlari from "@/components/cihaz-lisans/lisans-planlari";

export default function CihazLisansPage() {
  return (
    <>
      <PageHeader title="Cihaz & Lisans" />
      <OzetKartlari />
      <CihazTablosu />
      <FirmwareDagilimi />
      <ServisKuyrugu />
      <LisansPlanlari />
    </>
  );
}
