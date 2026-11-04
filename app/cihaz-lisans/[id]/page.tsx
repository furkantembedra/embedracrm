import { Suspense } from "react";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/page-header";
import CihazDetay from "@/components/cihaz-lisans/cihaz-detay";
import { getCihaz } from "@/components/cihaz-lisans/queries";

// params istek anında belli olur; Suspense dışında okunursa tüm sayfa bekletilir (cacheComponents).
export default function CihazPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <CihazIcerik params={params} />
    </Suspense>
  );
}

async function CihazIcerik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cihaz = await getCihaz(decodeURIComponent(id));
  if (!cihaz) notFound();

  return (
    <>
      <PageHeader title={cihaz.seriNo} description={`${cihaz.musteri} · ${cihaz.ulke}`} />
      <CihazDetay cihaz={cihaz} />
    </>
  );
}

function Yukleniyor() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="flex max-w-3xl animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-9 w-64 rounded-control bg-line" />
      <div className="h-72 rounded-card border border-line bg-card" />
    </div>
  );
}
