"use client";

// Koyu kenar menü. Geniş ekranda solda sabit sütun, telefonda üstte yatay kaydırılan menü.
// Yola bağlı kısım (seçili öğe) Suspense içinde: cacheComponents açıkken parametreli
// rotalarda (/musteriler/[id] vb.) usePathname istek anına kadar askıda kalır.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

type MenuOgesi = { href: string; label: string; icon: string };

const ANA_MENU: MenuOgesi[] = [
  { href: "/genel-bakis", label: "Genel Bakış", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  { href: "/musteriler", label: "Müşteriler", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/satis-hatti", label: "Satış Hattı", icon: "M3 3h18v18H3zM8 7v7M12 7v4M16 7v9" },
  { href: "/cihaz-lisans", label: "Cihaz & Lisans", icon: "M4 4h16v16H4zM9 9h6v6H9zM15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" },
  { href: "/destek", label: "Destek", icon: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4.93 4.93l4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" },
  { href: "/bayiler", label: "Bayi & Distribütör", icon: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M2 12h20M12 2a15.3 15.3 0 0 1 4 10a15.3 15.3 0 0 1-4 10a15.3 15.3 0 0 1-4-10a15.3 15.3 0 0 1 4-10z" },
];

const OPERASYON: MenuOgesi[] = [
  { href: "/siparisler", label: "Sipariş & Sevkiyat", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" },
  { href: "/pazarlama", label: "Pazarlama & Bülten", icon: "m3 11 18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" },
  { href: "/operasyon", label: "Operasyon", icon: "M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.17-2.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.8 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
  { href: "/bayiler/raporlama", label: "Raporlar", icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3" },
];

function MenuBolumu({ baslik, ogeler, aktif }: { baslik: string; ogeler: MenuOgesi[]; aktif: string }) {
  return (
    <div className="flex shrink-0 gap-1 lg:flex-col">
      <p className="hidden px-3 pb-2 text-[11px] font-bold tracking-[0.08em] text-[#8D9187] lg:block">{baslik}</p>
      {ogeler.map((o) => {
        const secili = aktif === o.href || aktif.startsWith(o.href + "/");
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={secili ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-control px-3 text-sm font-semibold transition-colors ${
              secili ? "bg-lime text-ink" : "text-[#C3C6BC] hover:bg-[#23251F] hover:text-white"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={o.icon} />
            </svg>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

function Menu({ aktif }: { aktif: string }) {
  // /bayiler/raporlama açıkken "Bayi & Distribütör" de seçili görünmesin
  const bayiAktif = aktif.startsWith("/bayiler/raporlama") ? "" : aktif;
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-6 lg:overflow-visible lg:p-0">
      <MenuBolumu baslik="ANA MENÜ" ogeler={ANA_MENU} aktif={bayiAktif} />
      <MenuBolumu baslik="OPERASYON" ogeler={OPERASYON} aktif={aktif} />
    </div>
  );
}

function AktifMenu() {
  return <Menu aktif={usePathname() ?? ""} />;
}

export default function Sidebar() {
  return (
    <aside className="bg-ink text-white lg:sticky lg:top-0 lg:h-screen lg:w-[248px] lg:shrink-0">
      <nav aria-label="Ana menü" className="flex h-full flex-col gap-4 px-3.5 py-4 lg:gap-6 lg:py-5">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-lime text-lg font-extrabold text-ink">e</div>
          <span className="text-[19px] font-extrabold tracking-tight">embedra</span>
          <span className="ml-auto rounded-full bg-[#23251F] px-2 py-0.5 text-[11px] font-bold text-lime">CRM</span>
        </div>

        <Suspense fallback={<Menu aktif="" />}>
          <AktifMenu />
        </Suspense>

        <div className="mt-auto hidden items-center gap-3 border-t border-[#23251F] px-2 pt-3 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue text-sm font-bold">DA</div>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-bold">Deniz Arslan</span>
            <span className="text-xs text-[#A4A79D]">Yönetici</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}
