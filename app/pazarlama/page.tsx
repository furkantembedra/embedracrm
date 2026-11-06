import PazarlamaGorunumu from "@/components/pazarlama/pazarlama-gorunumu";
import { getGonderimler, getIcerikler, getKampanyalar, getOzelListeler } from "@/components/pazarlama/queries";
import { getListeVerisi } from "@/components/pazarlama/kitle";
import { SEGMENT_ADI } from "@/components/musteriler/queries";
import { getFirsatlar } from "@/components/satis-hatti/queries";

export default async function PazarlamaPage() {
  const [icerikler, kampanyalar, ozelListeler, gonderimler, veri, firsatlar] = await Promise.all([
    getIcerikler(), getKampanyalar(), getOzelListeler(), getGonderimler(), getListeVerisi(), getFirsatlar(),
  ]);
  return (
    <PazarlamaGorunumu
      icerikler={icerikler}
      kampanyalar={kampanyalar}
      ozelListeler={ozelListeler}
      gonderimler={gonderimler}
      veri={veri}
      firsatlar={firsatlar.map((f) => ({ kampanyaId: f.kampanyaId ?? null, asama: f.asama }))}
      segmentler={SEGMENT_ADI}
    />
  );
}
