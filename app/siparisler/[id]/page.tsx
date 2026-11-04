import { Suspense } from "react";
import PageHeader from "@/components/layout/page-header";
import SiparisDetay from "@/components/siparisler/siparis-detay";
import SiparisAdimlari from "@/components/siparisler/siparis-adimlari";

// params istek anında belli olur; Suspense dışında okunursa build hata verir (cacheComponents).
export default function SiparisPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Yükleniyor" className="h-72 animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />}>
      <SiparisIcerik params={params} />
    </Suspense>
  );
}

async function SiparisIcerik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  void id; // detay verisini id ile çekin
  return (
    <>
      <PageHeader title="Sipariş" />
      <SiparisDetay />
      <SiparisAdimlari />
    </>
  );
}
