import { Suspense } from "react";
import { notFound } from "next/navigation";
import BayiGorunumu from "@/components/bayiler/bayi-gorunumu";
import { getAktifBayiler, getBasvurular } from "@/components/bayiler/queries";

// /bayiler/polska → bayi ekranı bu başvuru seçili açılır.
// params istek anında belli olur; Suspense dışında okunursa tüm sayfa bekletilir (cacheComponents).
export default function BasvuruPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <BasvuruIcerik params={params} />
    </Suspense>
  );
}

async function BasvuruIcerik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [basvurular, bayiler] = await Promise.all([getBasvurular(), getAktifBayiler()]);
  if (!basvurular.some((b) => b.id === id)) notFound();
  return <BayiGorunumu basvurular={basvurular} bayiler={bayiler} seciliIlk={id} />;
}

function Yukleniyor() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-9 w-72 rounded-control bg-line" />
      <div className="h-40 rounded-card border border-line bg-card" />
      <div className="h-[420px] rounded-card border border-line bg-card" />
    </div>
  );
}
