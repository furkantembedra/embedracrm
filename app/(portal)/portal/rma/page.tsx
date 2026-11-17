import { ARIZA_TIPLERI } from "@/components/rma/queries";
import { rmaVerisi } from "@/components/portal/rma";
import RmaGorunumu from "@/components/portal/rma-gorunumu";

export default async function PortalRmaPage({ searchParams }: { searchParams: Promise<{ seri?: string }> }) {
  const [v, { seri }] = await Promise.all([rmaVerisi(), searchParams]);
  const ilkSeri = seri && v.cihazlar.some((c) => c.seriNo === seri && !c.acikRma) ? seri : "";
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Arıza / RMA</h1>
        <p className="text-sm text-muted">Size ya da müşterilerinize ait arızalı cihaz için servis talebi açın ve süreci buradan takip edin. Garanti durumu seri numarasından otomatik hesaplanır.</p>
      </header>
      <RmaGorunumu
        talepler={v.talepler} cihazlar={v.cihazlar} kargoFirmalari={v.kargoFirmalari} hedefGun={v.hedefGun} adimlar={v.adimlar}
        arizaTipleri={ARIZA_TIPLERI} servis={v.servis} ozet={v.ozet} ilkSeri={ilkSeri}
      />
    </>
  );
}
