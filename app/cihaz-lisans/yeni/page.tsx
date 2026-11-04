import PageHeader from "@/components/layout/page-header";
import CihazFormu from "@/components/cihaz-lisans/cihaz-formu";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function YeniCihazPage() {
  const musteriler = await getMusteriler();
  return (
    <>
      <PageHeader title="Yeni cihaz" />
      <CihazFormu musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, ulke: m.ulke }))} />
    </>
  );
}
