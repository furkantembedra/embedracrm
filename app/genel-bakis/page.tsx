import Link from "next/link";
import PageHeader from "@/components/layout/page-header";
import OzetKartlari from "@/components/genel-bakis/ozet-kartlari";
import GelirGrafigi from "@/components/genel-bakis/gelir-grafigi";
import LisansDagilimi from "@/components/genel-bakis/lisans-dagilimi";
import SatisHattiOzeti from "@/components/genel-bakis/satis-hatti-ozeti";
import SuresiDolanlar from "@/components/genel-bakis/suresi-dolanlar";
import SonTalepler from "@/components/genel-bakis/son-talepler";
import SonIslemler from "@/components/genel-bakis/son-islemler";
import LeadKaynaklari from "@/components/genel-bakis/lead-kaynaklari";
import AracKapsamiTalepleri from "@/components/genel-bakis/arac-kapsami-talepleri";

// Satır düzeni: geniş ekranda yan yana, dar ekranda alt alta
const SATIR = "flex flex-wrap items-stretch gap-4";
const GENIS = "flex min-w-0 flex-[2_1_560px]";
const DAR = "flex min-w-0 flex-[1_1_300px]";
const YARIM = "flex min-w-0 flex-[1_1_420px]";

export default function GenelBakisPage() {
  return (
    <>
      <PageHeader title="Genel Bakış" description="Satış, lisans ve destek durumunun özeti">
        <Link
          href="/musteriler/yeni"
          className="inline-flex min-h-11 items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yeni müşteri
        </Link>
      </PageHeader>

      <OzetKartlari />

      <div className={SATIR}>
        <div className={GENIS}><GelirGrafigi /></div>
        <div className={DAR}><LisansDagilimi /></div>
      </div>

      <div className={SATIR}>
        <div className={YARIM}><SatisHattiOzeti /></div>
        <div className={YARIM}><SuresiDolanlar /></div>
      </div>

      <div className={SATIR}>
        <div className={GENIS}><SonTalepler /></div>
        <div className={DAR}><SonIslemler /></div>
      </div>

      <div className={SATIR}>
        <div className={YARIM}><LeadKaynaklari /></div>
        <div className={YARIM}><AracKapsamiTalepleri /></div>
      </div>
    </>
  );
}
