import { Suspense } from "react";
import type { Metadata } from "next";
import GirisFormu from "@/components/giris/giris-formu";

export const metadata: Metadata = { title: "Giriş · Embedra CRM" };

// CRM girişi: menüsüz, ortalanmış kart. Oturum açıkken proxy / CRM kabuğu kullanıcıyı içeri alır.
export default function GirisPage({ searchParams }: { searchParams: Promise<{ sonra?: string; hata?: string }> }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-card border border-line bg-card p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-lime text-lg font-extrabold text-ink">e</div>
          <span className="text-[19px] font-extrabold tracking-tight">embedra</span>
          <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-lime">CRM</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Giriş</h1>
          <p className="text-sm text-muted">Embedra ekip hesabınızla giriş yapın.</p>
        </div>
        <Suspense fallback={<GirisFormu />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: Promise<{ sonra?: string; hata?: string }> }) {
  const { sonra, hata } = await searchParams;
  return (
    <>
      {hata === "onay" && (
        <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">
          Onay bağlantısı geçersiz ya da süresi dolmuş. Giriş yapmayı deneyin ya da hesabı yeniden etkinleştirin.
        </p>
      )}
      <GirisFormu alan="crm" sonra={sonra ?? ""} />
    </>
  );
}
