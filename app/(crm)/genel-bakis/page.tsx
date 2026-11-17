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
import { getGenelBakis } from "@/components/genel-bakis/queries";

// Satır düzeni: geniş ekranda yan yana, dar ekranda alt alta
const SATIR = "flex flex-wrap items-stretch gap-4";
const GENIS = "flex min-w-0 flex-[2_1_560px]";
const DAR = "flex min-w-0 flex-[1_1_300px]";
const YARIM = "flex min-w-0 flex-[1_1_420px]";

export default async function GenelBakisPage() {
  const v = await getGenelBakis();
  return (
    <>
      <PageHeader title="Genel Bakış" description="Satış, lisans ve destek durumunun özeti">
      </PageHeader>

      <OzetKartlari veri={v.ozet} />

      <BugunYapilacaklar />

      <div className={SATIR}>
        <div className={GENIS}><GelirGrafigi veri={v.gelirAylari} /></div>
        <div className={DAR}><LisansDagilimi veri={v.lisans} /></div>
      </div>

      <div className={SATIR}>
        <div className={YARIM}><SatisHattiOzeti veri={v.hat} /></div>
        <div className={YARIM}><SuresiDolanlar cihazlar={v.cihazlar} /></div>
      </div>

      <div className={SATIR}>
        <div className={GENIS}><SonTalepler veri={v.sonTalepler} /></div>
        <div className={DAR}><SonIslemler veri={v.sonIslemler} /></div>
      </div>

      <LeadKaynaklari veri={v.leadKaynaklari} />
    </>
  );
}
