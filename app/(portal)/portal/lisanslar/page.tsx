import { lisanslarVerisi, YENILEME_HEDEFI } from "@/components/portal/lisanslar";
import LisanslarGorunumu from "@/components/portal/lisanslar-gorunumu";

export default async function PortalLisanslarPage() {
  const v = await lisanslarVerisi();
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Lisanslar</h1>
        <p className="text-sm text-muted">Müşterilerinizdeki ONESuite lisansları. Bitecek lisansları seçip tek siparişte yenileyin ya da müşterinize hazır hatırlatma gönderin.</p>
      </header>
      <LisanslarGorunumu
        bugun={v.bugun} bayiAd={v.bayiAd} indirim={v.indirim} lisanslar={v.lisanslar} fiyatlar={v.fiyatlar} takvim={v.takvim}
        paraBirimi={v.paraBirimi} kur={v.kur} hedef={YENILEME_HEDEFI} ozet={v.ozet} havuz={v.havuz}
      />
    </>
  );
}
