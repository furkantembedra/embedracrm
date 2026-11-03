import PageHeader from "@/components/layout/page-header";
import CihazDetay from "@/components/cihaz-lisans/cihaz-detay";
import LisansFormu from "@/components/cihaz-lisans/lisans-formu";

export default async function CihazPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void id; // detay verisini id ile çekin
  return (
    <>
      <PageHeader title="Cihaz" />
      <CihazDetay />
      <LisansFormu />
    </>
  );
}
