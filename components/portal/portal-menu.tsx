"use client";

// Portal üst menüsü (seçili sayfa usePathname ile; Suspense içinde kullanılır)
import Link from "next/link";
import { usePathname } from "next/navigation";

export const PORTAL_MENU = [
  { href: "/portal", ad: "Özet" },
  { href: "/portal/siparis", ad: "Sipariş ver" },
  { href: "/portal/cihazlar", ad: "Cihazlarım" },
  { href: "/portal/lisanslar", ad: "Lisanslar" },
  { href: "/portal/rma", ad: "Arıza / RMA" },
  { href: "/portal/leadler", ad: "Lead'lerim" },
  { href: "/portal/dokumanlar", ad: "Dokümanlar" },
];

export function MenuBaglantilari({ aktif }: { aktif: string }) {
  return (
    <nav aria-label="Bayi portalı" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {PORTAL_MENU.map((m) => {
        const secili = m.href === "/portal" ? aktif === "/portal" : aktif.startsWith(m.href);
        return (
          <Link key={m.href} href={m.href} aria-current={secili ? "page" : undefined}
            className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-control px-3 text-sm font-semibold ${secili ? "bg-lime text-ink" : "text-[#C3C6BC] hover:bg-[#23251F] hover:text-white"}`}>
            {m.ad}
          </Link>
        );
      })}
    </nav>
  );
}

export default function PortalMenu() {
  return <MenuBaglantilari aktif={usePathname() ?? ""} />;
}
