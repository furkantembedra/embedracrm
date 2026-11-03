import SatisHattiGorunumu from "@/components/satis-hatti/satis-hatti-gorunumu";
import { getFirsatlar } from "@/components/satis-hatti/queries";

export default async function SatisHattiPage() {
  const firsatlar = await getFirsatlar();
  return <SatisHattiGorunumu firsatlar={firsatlar} />;
}
