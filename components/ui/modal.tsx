"use client";

// Ekranın ortasında açılan pencere. Esc, dışarı tıklama veya X ile kapanır; odak pencerenin içinde kalır.
// Örn: <Modal acik={acik} onKapat={() => setAcik(false)} baslik="Yeni fırsat">...</Modal>
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  acik,
  onKapat,
  baslik,
  aciklama,
  children,
}: {
  acik: boolean;
  onKapat: () => void;
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const baslikId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (acik && !d.open) d.showModal();
    if (!acik && d.open) d.close();
  }, [acik]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={baslikId}
      onClose={onKapat}
      onClick={(e) => {
        if (e.target === e.currentTarget) onKapat(); // arka plana tıklama
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[720px] max-h-[calc(100dvh-64px)] overflow-hidden rounded-card border border-line bg-card p-0 text-ink shadow-[0_24px_64px_rgba(14,15,12,0.25)] backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:scale-100 open:opacity-100 starting:open:scale-95 starting:open:opacity-0 transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-line px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1">
           <h2 id={baslikId} className="text-xl font-extrabold">{baslik}</h2>
            {aciklama && <p className="text-[13px] text-muted">{aciklama}</p>}
          </div>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="-mr-2 ml-auto flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-[#474A42] transition-colors hover:bg-bg"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {/* overflow-x-hidden: kaydırma çubukları "her zaman göster" ayarındaki Mac'lerde formun
            altında yatay kaydırma çubuğu izi (ince çizgi) çıkmasın */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pt-5">{acik && children}</div>
      </div>
    </dialog>
  );
}
