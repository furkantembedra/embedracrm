import { Suspense } from "react";
import { notFound } from "next/navigation";
import TeklifDetay from "@/components/teklifler/teklif-detay";
import { getTeklifler } from "@/components/teklifler/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";

// params istek anında belli olur; Suspense dışında okunursa tüm sayfa bekletilir (cacheComponents).
export default function TeklifPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Yükleniyor" className="h-[720px] animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />}>
      <TeklifIcerik params={params} />
    </Suspense>
  );
}

async function TeklifIcerik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [teklifler, fiyatListesi] = await Promise.all([getTeklifler(), getFiyatListesi()]);
  const teklif = teklifler.find((t) => t.id === id);
  if (!teklif) notFound();
  const surumler = teklifler.filter((t) => t.kok === teklif.kok).sort((a, b) => a.versiyon - b.versiyon);
  return <TeklifDetay teklif={teklif} surumler={surumler} fiyatListesi={fiyatListesi} />;
}
