import Sidebar from "@/components/layout/sidebar";

// Yönetim paneli kabuğu: solda menü, sağda sayfa. Bayi portalı (/portal) bu düzeni kullanmaz.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-10 pt-6 text-ink sm:px-7 print:p-0">
        {children}
      </main>
    </div>
  );
}
