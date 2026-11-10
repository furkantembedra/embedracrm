import { redirect } from "next/navigation";
import { portalOturumu } from "@/components/portal/oturum";
import PortalGirisFormu from "@/components/portal/giris-formu";
import { DEMO_SIFRE } from "@/components/portal/queries";

export default async function PortalGirisPage() {
  if (await portalOturumu()) redirect("/portal");
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 rounded-card border border-line bg-card p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Bayi girişi</h1>
        <p className="text-sm text-muted">Embedra bayi hesabınızla giriş yapın.</p>
      </div>
      <PortalGirisFormu />
      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-control bg-info-bg px-3 py-2 text-xs font-semibold text-info">
          Demo: andrei@directiepro.ro · şifre {DEMO_SIFRE}
        </p>
      )}
    </div>
  );
}
