import { Suspense } from "react";
import type { Metadata } from "next";
import { portalOturumu } from "@/components/portal/oturum";
import { cikisYap } from "@/components/portal/actions";
import PortalMenu, { MenuBaglantilari } from "@/components/portal/portal-menu";

export const metadata: Metadata = { title: "Embedra Bayi Portalı" };

// Bayi portalı: CRM menüsü yok, yalnızca bayinin kendi verisi. Oturum çerezden okunduğu için
// başlık ve sayfalar Suspense içinde (cacheComponents).
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Suspense fallback={<header className="h-[116px] bg-ink" />}>
        <Baslik />
      </Suspense>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-10 pt-6 sm:px-7">
        <Suspense fallback={<div aria-busy="true" aria-label="Yükleniyor" className="h-80 animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

async function Baslik() {
  const o = await portalOturumu();
  return (
    <header className="bg-ink text-white">
      {o?.mod === "yonetici" && (
        <div className="bg-lime px-4 py-2 text-center text-[13px] font-bold text-ink">
          Yönetici olarak <b>{o.bayi.ad}</b> bayisinin portalını görüntülüyorsunuz. Yaptığınız işlemler bu bayi adına kaydedilir.
        </div>
      )}
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-lime text-lg font-extrabold text-ink">e</div>
          <span className="text-[19px] font-extrabold tracking-tight">embedra</span>
          <span className="rounded-full bg-[#23251F] px-2 py-0.5 text-[11px] font-bold text-lime">BAYİ PORTALI</span>
          {o && (
            <form action={cikisYap} className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm font-semibold text-[#C3C6BC] sm:inline">{o.bayi.ad} · {o.bayi.bolge}</span>
              <button type="submit" className="min-h-10 cursor-pointer rounded-control border border-[#3A3D35] px-3 text-sm font-bold hover:bg-[#23251F]">
                {o.mod === "yonetici" ? "CRM'e dön" : "Çıkış"}
              </button>
            </form>
          )}
        </div>
        {o && (
          <Suspense fallback={<MenuBaglantilari aktif="" />}>
            <PortalMenu />
          </Suspense>
        )}
      </div>
    </header>
  );
}
