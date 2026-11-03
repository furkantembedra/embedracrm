import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/page-header";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import { getMusteri } from "@/components/musteriler/queries";

export default async function MusteriPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const musteri = await getMusteri(id);
  if (!musteri) notFound();

  return (
    <>
      <PageHeader title={musteri.ad} description={`${musteri.sehir}, ${musteri.ulke}`} />
      <div className="max-w-3xl">
        <MusteriDetay musteri={musteri} />
      </div>
    </>
  );
}
