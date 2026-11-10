"use client";

// Portal formları için ortak kabuk: gönder, hata / başarı mesajı, başarıda formu sıfırla ve sayfayı yenile.
// Alan hataları <AlanHatasi ad="..."/> ile gösterilir.
import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PortalFormDurumu } from "./actions";

const HataBaglami = createContext<Record<string, string>>({});

export function AlanHatasi({ ad }: { ad: string }) {
  const m = useContext(HataBaglami)[ad];
  return m ? <span className="text-xs font-semibold text-err">{m}</span> : null;
}


export default function PortalFormu({
  islem,
  buton,
  children,
  className = "flex flex-col gap-4",
  ikincil = false,
}: {
  islem: (o: PortalFormDurumu, f: FormData) => Promise<PortalFormDurumu>;
  buton: string;
  children: React.ReactNode;
  className?: string;
  ikincil?: boolean;
}) {
  const [durum, gonder, bekliyor] = useActionState(islem, {});
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const son = useRef<number | undefined>(undefined);
  const [, baslat] = useTransition();
  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) {
      son.current = durum.zaman;
      ref.current?.reset();
      router.refresh();
    }
  }, [durum, router]);
  const genel = durum.hata ?? durum.hatalar?.genel;
  return (
    <HataBaglami.Provider value={durum.hatalar ?? {}}>
      <form
        ref={ref}
        noValidate
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const veri = new FormData(e.currentTarget);
          baslat(() => gonder(veri));
        }}
      >
        {children}
        {genel && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{genel}</p>}
        {durum.tamam && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{durum.tamam}</p>}
        <button
          type="submit"
          disabled={bekliyor}
          className={`min-h-11 w-fit cursor-pointer rounded-control px-5 text-sm font-bold disabled:opacity-60 ${ikincil ? "border border-ink hover:bg-[#F4F5F0]" : "bg-ink text-white hover:bg-ink-soft"}`}
        >
          {bekliyor ? "Gönderiliyor…" : buton}
        </button>
      </form>
    </HataBaglami.Provider>
  );
}
