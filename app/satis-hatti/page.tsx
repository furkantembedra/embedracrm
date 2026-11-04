import SatisHattiGorunumu from "@/components/satis-hatti/satis-hatti-gorunumu";
import { getFirsatlar } from "@/components/satis-hatti/queries";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function SatisHattiPage() {
  const [firsatlar, musteriler] = await Promise.all([getFirsatlar(), getMusteriler()]);
  return <SatisHattiGorunumu firsatlar={firsatlar} musteriler={musteriler} />;
}
