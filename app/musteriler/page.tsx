import MusteriGorunumu from "@/components/musteriler/musteri-gorunumu";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function MusterilerPage() {
  const musteriler = await getMusteriler();
  return <MusteriGorunumu musteriler={musteriler} />;
}
