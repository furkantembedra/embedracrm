import RaporlarGorunumu from "@/components/raporlar/raporlar-gorunumu";
import { getRaporOzeti } from "@/components/raporlar/queries";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getTalepler } from "@/components/destek/queries";
import { getAktifBayiler } from "@/components/bayiler/queries";

export default async function RaporlarPage() {
  const [ozet, cihazlar, talepler, bayiler] = await Promise.all([
    getRaporOzeti(),
    getCihazlar(),
    getTalepler(),
    getAktifBayiler(),
  ]);
  return <RaporlarGorunumu ozet={ozet} cihazlar={cihazlar} talepler={talepler} bayiler={bayiler} />;
}
