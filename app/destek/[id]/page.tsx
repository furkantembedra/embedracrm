import { Suspense } from "react";
import { notFound } from "next/navigation";
import DestekGorunumu from "@/components/destek/destek-gorunumu";
import { getTalepler, sonrakiTalepNo } from "@/components/destek/queries";
import { getMusteriler } from "@/components/musteriler/queries";

// /destek/4821 → destek ekranı bu talep seçili açılır.
// params istek anında belli olur; Suspense dışında okunursa tüm sayfa bekletilir (cacheComponents).
export default function TalepPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <TalepIcerik params={params} />
    </Suspense>
  );
}

async function TalepIcerik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [talepler, musteriler, sonrakiNo] = await Promise.all([getTalepler(), getMusteriler(), sonrakiTalepNo()]);
  if (!talepler.some((t) => t.id === id)) notFound();

  return (
    <DestekGorunumu
      talepler={talepler}
      sonrakiNo={sonrakiNo}
      seciliIlk={id}
      musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, cihazlar: m.cihazlar.map((c) => ({ seriNo: c.seriNo, firmware: c.firmware })) }))}
    />
  );
}

function Yukleniyor() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-9 w-72 rounded-control bg-line" />
      <div className="h-[520px] rounded-card border border-line bg-card" />
    </div>
  );
}
