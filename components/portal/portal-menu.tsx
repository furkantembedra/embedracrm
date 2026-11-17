"use client";

// Portal kenar menüsü (CRM menüsüyle aynı görünüm): geniş ekranda solda dikey, telefonda üstte yatay kaydırılır.
// Seçili sayfa usePathname ile bulunur; Suspense içinde kullanılır.
import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuOgesi = { href: string; ad: string; icon: string };

const PORTAL_BOLUMLERI: { baslik: string; ogeler: MenuOgesi[] }[] = [
  {
    baslik: "BAYİ PORTALI",
    ogeler: [
      { href: "/portal", ad: "Özet", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
      { href: "/portal/siparis", ad: "Sipariş ver", icon: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" },
      { href: "/portal/cihazlar", ad: "Cihazlarım", icon: "M4 4h16v16H4zM9 9h6v6H9zM15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" },
      { href: "/portal/lisanslar", ad: "Lisanslar", icon: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78a5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" },
    ],
  },
  {
    baslik: "DESTEK & SATIŞ",
    ogeler: [
      { href: "/portal/destek", ad: "Destek", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5" },
      { href: "/portal/rma", ad: "Arıza / RMA", icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" },
      { href: "/portal/leadler", ad: "Lead'lerim", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
      { href: "/portal/dokumanlar", ad: "Dokümanlar", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
    ],
  },
];

export function MenuBaglantilari({ aktif }: { aktif: string }) {
  return (
    <nav aria-label="Bayi portalı" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-6 lg:overflow-visible lg:p-0">
      {PORTAL_BOLUMLERI.map((b) => (
        <div key={b.baslik} className="flex shrink-0 gap-1 lg:flex-col">
          <p className="hidden px-3 pb-2 text-[11px] font-bold tracking-[0.08em] text-[#8D9187] lg:block">{b.baslik}</p>
          {b.ogeler.map((m) => {
            const secili = m.href === "/portal" ? aktif === "/portal" : aktif === m.href || aktif.startsWith(m.href + "/");
            return (
              <Link key={m.href} href={m.href} aria-current={secili ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-control px-3 text-sm font-semibold transition-colors ${
                  secili ? "bg-lime text-ink" : "text-[#C3C6BC] hover:bg-[#23251F] hover:text-white"
                }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={m.icon} />
                </svg>
                {m.ad}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function PortalMenu() {
  return <MenuBaglantilari aktif={usePathname() ?? ""} />;
}
