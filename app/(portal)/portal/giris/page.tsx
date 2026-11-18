import { redirect } from "next/navigation";
import { portalOturumu } from "@/components/portal/oturum";
import GirisFormu from "@/components/giris/giris-formu";

export default async function PortalGirisPage({ searchParams }: { searchParams: Promise<{ sonra?: string; hata?: string }> }) {
  const [oturum, { sonra, hata }] = await Promise.all([portalOturumu(), searchParams]);
  if (oturum) redirect("/portal");
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 rounded-card border border-line bg-card p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Bayi girişi</h1>
        <p className="text-sm text-muted">Embedra bayi hesabınızla giriş yapın.</p>
      </div>
      {hata === "onay" && (
        <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">
          Onay bağlantısı geçersiz ya da süresi dolmuş. Giriş yapmayı deneyin ya da hesabı yeniden etkinleştirin.
        </p>
      )}
      <GirisFormu alan="portal" sonra={sonra ?? ""} />
    </div>
  );
}
