import { Suspense } from "react";
import type { Metadata } from "next";
import { portalOturumu } from "@/components/portal/oturum";
import { cikisYap } from "@/components/portal/actions";
import PortalMenu, { MenuBaglantilari } from "@/components/portal/portal-menu";

export const metadata: Metadata = { title: "Embedra Bayi Portalı" };

// Bayi portalı: CRM ile aynı kabuk (solda koyu menü, sağda sayfa) ama yalnızca bayinin kendi verisi.
// Oturum çerezden okunduğu için menü ve sayfalar Suspense içinde (cacheComponents).
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink lg:flex-row">
      <Suspense fallback={<aside className="h-[116px] bg-ink lg:sticky lg:top-0 lg:h-screen lg:w-[248px] lg:shrink-0" />}>
        <KenarMenu />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-10 pt-6 sm:px-7 print:p-0">
        <Suspense fallback={null}>
          <YoneticiBandi />
        </Suspense>
        <Suspense fallback={<div aria-busy="true" aria-label="Yükleniyor" className="h-80 animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

function basHarfler(ad: string) {
  return ad.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toLocaleUpperCase("tr")).join("");
}

async function KenarMenu() {
  const o = await portalOturumu();
  const cikisEtiketi = o?.mod === "yonetici" ? "CRM'e dön" : "Çıkış";
  return (
    <aside className="bg-ink text-white print:hidden lg:sticky lg:top-0 lg:h-screen lg:w-[248px] lg:shrink-0">
      <div className="flex h-full flex-col gap-4 px-3.5 py-4 lg:gap-6 lg:py-5">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-lime text-lg font-extrabold text-ink">e</div>
          <span className="text-[19px] font-extrabold tracking-tight">embedra</span>
          <span className="rounded-full bg-[#23251F] px-2 py-0.5 text-[11px] font-bold text-lime">BAYİ</span>
          {o && (
            <form action={cikisYap} className="ml-auto lg:hidden">
              <button type="submit" className="min-h-10 cursor-pointer rounded-control border border-[#3A3D35] px-3 text-sm font-bold hover:bg-[#23251F]">
                {cikisEtiketi}
              </button>
            </form>
          )}
        </div>

        {o && (
          <Suspense fallback={<MenuBaglantilari aktif="" />}>
            <PortalMenu />
          </Suspense>
        )}

        {o && (
          <div className="mt-auto hidden flex-col gap-3 border-t border-[#23251F] px-2 pt-3 lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue text-sm font-bold">{basHarfler(o.bayi.ad)}</div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold" title={o.bayi.ad}>{o.bayi.ad}</span>
                <span className="truncate text-xs text-[#A4A79D]">{o.bayi.bolge}</span>
              </div>
            </div>
            <form action={cikisYap}>
              <button type="submit" className="min-h-10 w-full cursor-pointer rounded-control border border-[#3A3D35] px-3 text-sm font-bold hover:bg-[#23251F]">
                {cikisEtiketi}
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}

async function YoneticiBandi() {
  const o = await portalOturumu();
  if (o?.mod !== "yonetici") return null;
  return (
    <div className="rounded-card bg-lime px-4 py-2.5 text-[13px] font-bold text-ink">
      Yönetici olarak <b>{o.bayi.ad}</b> bayisinin portalını görüntülüyorsunuz. Yaptığınız işlemler bu bayi adına kaydedilir.
    </div>
  );
}
