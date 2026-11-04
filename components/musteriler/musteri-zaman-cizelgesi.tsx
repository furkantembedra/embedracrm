"use client";

// Müşteriye ait işlemler listesi.
// GORUNEN_KAYIT kadar kayıt tam görünür; fazlası listenin içinde kaydırılır (panel aşağı uzamaz).
// Yükseklik piksel değil kayıt sayısına göre hesaplanır, çünkü uzun notlar birkaç satır tutar.
import { useLayoutEffect, useRef, useState } from "react";
import type { Olay, OlayTuru } from "./queries";

const GORUNEN_KAYIT = 4;
const SONRAKINI_GOSTER = 28; // altta bir sonraki kaydın üst kısmı görünsün ki kaydırılabildiği anlaşılsın

const NOKTA: Record<OlayTuru, string> = {
  siparis: "bg-lime-dark",
  destek: "bg-[#E5484D]",
  demo: "bg-blue",
  teklif: "bg-ink",
  arama: "bg-[#E58A2B]",
  not: "bg-[#C9CCC2]",
};

export default function MusteriZamanCizelgesi({ olaylar }: { olaylar: Olay[] }) {
  const kutu = useRef<HTMLDivElement>(null);
  const [yukseklik, setYukseklik] = useState<number | null>(null);
  const tasiyor = olaylar.length > GORUNEN_KAYIT;

  useLayoutEffect(() => {
    const el = kutu.current;
    if (!el || !tasiyor) {
      setYukseklik(null);
      return;
    }
    const olc = () => {
      const son = el.querySelectorAll("li")[GORUNEN_KAYIT - 1];
      if (!son) return;
      const ust = el.getBoundingClientRect().top - el.scrollTop;
      setYukseklik(Math.ceil(son.getBoundingClientRect().bottom - ust + SONRAKINI_GOSTER));
    };
    olc();
    // Panel genişliği değişince (pencere boyutu) satırlar yeniden kırılır; yüksekliği tekrar hesapla
    const izle = new ResizeObserver(olc);
    izle.observe(el);
    return () => izle.disconnect();
  }, [olaylar, tasiyor]);

  if (olaylar.length === 0) return <p className="text-sm text-muted">Henüz kayıt yok.</p>;

  return (
    <div
      ref={kutu}
      tabIndex={tasiyor ? 0 : undefined}
      aria-label={tasiyor ? "Zaman çizelgesi, kaydırılabilir" : undefined}
      style={yukseklik ? { maxHeight: yukseklik } : undefined}
      className="overflow-y-auto overscroll-contain rounded-xl pr-2 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-blue [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]"
    >
      <ol className="ml-[5px] flex flex-col gap-3 border-l-2 border-line">
        {olaylar.map((o, i) => (
          <li key={i} className="relative flex flex-col gap-0.5 pl-4">
            <span aria-hidden="true" className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${NOKTA[o.tur]}`} />
            <span className="break-words text-[13px] font-semibold leading-snug">{o.metin}</span>
            <span className="text-xs text-muted">{o.zaman}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
