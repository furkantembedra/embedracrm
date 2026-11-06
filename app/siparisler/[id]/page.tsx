import { Suspense } from "react";
import { notFound } from "next/navigation";
import SiparisGorunumu from "@/components/siparisler/siparis-gorunumu";
import { getIadeler, getSiparisler, getStok } from "@/components/siparisler/queries";
import { getMusteriler } from "@/components/musteriler/queries";
import { getFiyatListesi, getHavuz, getKargoFirmalari } from "@/components/operasyon/queries";

// /siparisler/S-26-1184 → sipariş ekranı bu sipariş seçili açılır.
// params istek anında belli olur; Suspense dışında okunursa tüm sayfa bekletilir (cacheComponents).
export default function SiparisPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <SiparisIcerik params={params} />
    </Suspense>
  );
}

async function SiparisIcerik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [siparisler, stok, iadeler, musteriler, havuz, kargoFirmalari, fiyatListesi] = await Promise.all([
    getSiparisler(), getStok(), getIadeler(), getMusteriler(), getHavuz(), getKargoFirmalari(), getFiyatListesi(),
  ]);
  if (!siparisler.some((s) => s.id === id)) notFound();
  return <SiparisGorunumu siparisler={siparisler} stok={stok} iadeler={iadeler} musteriler={musteriler} seciliIlk={id} havuz={havuz} kargoFirmalari={kargoFirmalari} fiyatListesi={fiyatListesi} />;
}

function Yukleniyor() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-9 w-72 rounded-control bg-line" />
      <div className="h-[520px] rounded-card border border-line bg-card" />
    </div>
  );
}
