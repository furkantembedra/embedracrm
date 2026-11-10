import TeklifListesi from "@/components/teklifler/teklif-listesi";
import { getTeklifler } from "@/components/teklifler/queries";
import { getFirsatlar, KAPALI_ASAMALAR } from "@/components/satis-hatti/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";

export default async function TekliflerPage() {
  const [teklifler, firsatlar, fiyatListesi] = await Promise.all([getTeklifler(), getFirsatlar(), getFiyatListesi()]);
  return (
    <TeklifListesi
      teklifler={teklifler}
      firsatlar={firsatlar.filter((f) => !KAPALI_ASAMALAR.includes(f.asama)).map((f) => ({ id: f.id, firma: f.firma, icerik: f.icerik }))}
      fiyatListesi={fiyatListesi}
    />
  );
}
