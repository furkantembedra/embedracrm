import { Suspense } from "react";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/page-header";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import { getMusteri } from "@/components/musteriler/queries";

// params istek anında belli olur; Suspense dışında okunursa tüm sayfa bekletilir (cacheComponents).
export default function MusteriPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <MusteriIcerik params={params} />
    </Suspense>
  );
}

async function MusteriIcerik({ params }: { params: Promise<{ id: string }> }) {
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

function Yukleniyor() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="flex max-w-3xl animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-9 w-64 rounded-control bg-line" />
      <div className="h-96 rounded-card border border-line bg-card" />
    </div>
  );
}
