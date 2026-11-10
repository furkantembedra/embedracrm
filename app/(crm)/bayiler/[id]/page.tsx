import { Suspense } from "react";
import { notFound } from "next/navigation";
import BayiGorunumu from "@/components/bayiler/bayi-gorunumu";
import { getAktifBayiler, getBasvurular, getBayiHareketleri } from "@/components/bayiler/queries";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getMusteriler } from "@/components/musteriler/queries";

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
  const [basvurular, bayiler, musteriler, hareketler, cihazlar] = await Promise.all([getBasvurular(), getAktifBayiler(), getMusteriler(), getBayiHareketleri(), getCihazlar()]);
  if (!basvurular.some((b) => b.id === id)) notFound();
  return <BayiGorunumu basvurular={basvurular} bayiler={bayiler} musteriler={musteriler} hareketler={hareketler} bayiCihazlari={cihazlar.filter((c) => c.bayiId)} seciliIlk={id} />;
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
