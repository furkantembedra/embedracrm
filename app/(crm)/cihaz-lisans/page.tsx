import CihazGorunumu from "@/components/cihaz-lisans/cihaz-gorunumu";
import { getCihazlar, getCihazOzeti } from "@/components/cihaz-lisans/queries";
import { getMusteriler } from "@/components/musteriler/queries";
import { getAktifBayiler } from "@/components/bayiler/queries";

export default async function CihazLisansPage() {
  const [cihazlar, ozet, musteriler, bayiler] = await Promise.all([
    getCihazlar(),
    getCihazOzeti(),
    getMusteriler(),
    getAktifBayiler(),
  ]);
  return (
    <CihazGorunumu
      cihazlar={cihazlar}
      ozet={ozet}
      musteriler={musteriler}
      bayiler={bayiler.map((b) => ({ id: b.id, ad: b.ad }))}
    />
  );
}
