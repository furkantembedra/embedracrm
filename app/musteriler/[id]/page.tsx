import PageHeader from "@/components/layout/page-header";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import MusteriZamanCizelgesi from "@/components/musteriler/musteri-zaman-cizelgesi";

export default async function MusteriPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void id; // detay verisini id ile çekin
  return (
    <>
      <PageHeader title="Müşteri" />
      <MusteriDetay />
      <MusteriZamanCizelgesi />
    </>
  );
}
