import CihazGorunumu from "@/components/cihaz-lisans/cihaz-gorunumu";
import { getCihazlar, getCihazOzeti, getRmaKuyrugu } from "@/components/cihaz-lisans/queries";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function CihazLisansPage() {
  const [cihazlar, ozet, rma, musteriler] = await Promise.all([
    getCihazlar(),
    getCihazOzeti(),
    getRmaKuyrugu(),
    getMusteriler(),
  ]);
  return (
    <CihazGorunumu
      cihazlar={cihazlar}
      ozet={ozet}
      rma={rma}
      musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, ulke: m.ulke }))}
    />
  );
}
