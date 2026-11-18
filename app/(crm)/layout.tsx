import { Suspense } from "react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { bayiHesabi, crmKullanicisi } from "@/lib/oturum";
import { cikisYap } from "@/components/giris/actions";

// Yönetim paneli kabuğu: solda menü, sağda sayfa. Bayi portalı (/portal) bu düzeni kullanmaz.
// Oturum istek anında okunduğu için kullanıcı kartı ve yetki kontrolü Suspense içinde (cacheComponents).
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      <Sidebar
        kullanici={
          <Suspense fallback={<div className="mt-auto hidden h-[58px] lg:block" />}>
            <KullaniciKarti />
          </Suspense>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-10 pt-6 text-ink sm:px-7 print:p-0">
        {children}
      </main>
    </div>
  );
}

/** Oturumdaki ekip üyesi. Ekipte olmayan hesap (ör. bayi) CRM'e giremez; veriyi zaten RLS kapatır, burada yönlendirilir. */
async function KullaniciKarti() {
  const k = await crmKullanicisi();
  if (!k) redirect((await bayiHesabi()) ? "/portal" : "/giris");
  const harfler = k.ad.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toLocaleUpperCase("tr")).join("");
  return (
    <div className="mt-auto hidden items-center gap-3 border-t border-[#23251F] px-2 pt-3 lg:flex">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue text-sm font-bold">{harfler}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-bold" title={k.ad}>{k.ad}</span>
        <span className="truncate text-xs text-[#A4A79D]">{k.rol}</span>
      </div>
      <form action={cikisYap}>
        <button type="submit" title="Çıkış" aria-label="Çıkış yap" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-[#C3C6BC] hover:bg-[#23251F] hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </form>
    </div>
  );
}
