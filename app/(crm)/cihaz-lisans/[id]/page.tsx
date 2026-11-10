import { Suspense } from "react";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/page-header";
import CihazDetay from "@/components/cihaz-lisans/cihaz-detay";
import { getCihaz } from "@/components/cihaz-lisans/queries";
import Link from "next/link";
import Chip from "@/components/ui/chip";
import { getCihazRmalari, ADIM_ADI, KARAR_ADI } from "@/components/rma/queries";
import { acikMi, tarihYaz } from "@/components/rma/ortak";

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
  const rmalar = await getCihazRmalari(cihaz.seriNo);

  return (
    <>
      <PageHeader title={cihaz.seriNo} description={`${cihaz.musteri} · ${cihaz.ulke}`} />
      <CihazDetay cihaz={cihaz} />
      <section aria-label="Servis geçmişi" className="flex max-w-3xl flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-extrabold">Servis (RMA) geçmişi</h2>
          <Link href={`/rma`} className="ml-auto text-[13px] font-bold text-info hover:underline">Garanti & RMA →</Link>
        </div>
        {rmalar.length ? (
          <ul className="flex flex-col divide-y divide-bg">
            {rmalar.map((r) => (
              <li key={r.id}>
                <Link href={`/rma?kayit=${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:underline">
                  <b>{r.id}</b>
                  <span className="text-muted">{tarihYaz(r.acilis)}</span>
                  <span>{r.arizaTipi}</span>
                  {r.yeniSeri === cihaz.seriNo && <span className="text-xs text-muted">(değişimle verildi, eski cihaz {r.seriNo})</span>}
                  <span className="ml-auto flex items-center gap-2">
                    {r.karar && <span className="text-xs text-muted">{KARAR_ADI[r.karar]}</span>}
                    <Chip ton={acikMi(r) ? "info" : "ok"}>{ADIM_ADI[r.adim]}</Chip>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Bu cihaz için servis kaydı yok.</p>
        )}
      </section>
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
