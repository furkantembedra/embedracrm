import PageHeader from "@/components/layout/page-header";
import OzetKartlari from "@/components/genel-bakis/ozet-kartlari";
import GelirGrafigi from "@/components/genel-bakis/gelir-grafigi";
import LisansDagilimi from "@/components/genel-bakis/lisans-dagilimi";
import SatisHattiOzeti from "@/components/genel-bakis/satis-hatti-ozeti";
import SuresiDolanlar from "@/components/genel-bakis/suresi-dolanlar";
import SonTalepler from "@/components/genel-bakis/son-talepler";
import SonIslemler from "@/components/genel-bakis/son-islemler";
import LeadKaynaklari from "@/components/genel-bakis/lead-kaynaklari";
import BugunYapilacaklar from "@/components/hatirlatmalar/bugun-yapilacaklar";
import { getCihazlar } from "@/components/cihaz-lisans/queries";

// Satır düzeni: geniş ekranda yan yana, dar ekranda alt alta
const SATIR = "flex flex-wrap items-stretch gap-4";
const GENIS = "flex min-w-0 flex-[2_1_560px]";
const DAR = "flex min-w-0 flex-[1_1_300px]";
const YARIM = "flex min-w-0 flex-[1_1_420px]";

export default async function GenelBakisPage() {
  const cihazlar = await getCihazlar();
  return (
    <>
      <PageHeader title="Genel Bakış" description="Satış, lisans ve destek durumunun özeti">
      </PageHeader>

      <OzetKartlari />

      <BugunYapilacaklar />

      <div className={SATIR}>
        <div className={GENIS}><GelirGrafigi /></div>
        <div className={DAR}><LisansDagilimi /></div>
      </div>

      <div className={SATIR}>
        <div className={YARIM}><SatisHattiOzeti /></div>
        <div className={YARIM}><SuresiDolanlar cihazlar={cihazlar} /></div>
      </div>

      <div className={SATIR}>
        <div className={GENIS}><SonTalepler /></div>
        <div className={DAR}><SonIslemler /></div>
      </div>

      <LeadKaynaklari />
    </>
  );
}
