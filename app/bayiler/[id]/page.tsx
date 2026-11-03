import PageHeader from "@/components/layout/page-header";
import BasvuruDetay from "@/components/bayiler/basvuru-detay";

export default async function BasvuruPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void id; // detay verisini id ile çekin
  return (
    <>
      <PageHeader title="Başvuru" />
      <BasvuruDetay />
    </>
  );
}
