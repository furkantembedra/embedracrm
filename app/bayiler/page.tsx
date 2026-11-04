import BayiGorunumu from "@/components/bayiler/bayi-gorunumu";
import { getAktifBayiler, getBasvurular } from "@/components/bayiler/queries";

export default async function BayilerPage() {
  const [basvurular, bayiler] = await Promise.all([getBasvurular(), getAktifBayiler()]);
  return <BayiGorunumu basvurular={basvurular} bayiler={bayiler} />;
}
