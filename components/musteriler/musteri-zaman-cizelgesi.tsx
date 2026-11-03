// Müşteriye ait işlemler listesi
import type { Olay, OlayTuru } from "./queries";

const NOKTA: Record<OlayTuru, string> = {
  siparis: "bg-lime-dark",
  destek: "bg-[#E5484D]",
  demo: "bg-blue",
  teklif: "bg-ink",
  arama: "bg-[#E58A2B]",
  not: "bg-[#C9CCC2]",
};

export default function MusteriZamanCizelgesi({ olaylar }: { olaylar: Olay[] }) {
  if (olaylar.length === 0) return <p className="text-sm text-muted">Henüz kayıt yok.</p>;
  return (
    <ol className="ml-[5px] flex flex-col gap-3 border-l-2 border-line">
      {olaylar.map((o, i) => (
        <li key={i} className="relative flex flex-col gap-0.5 pl-4">
          <span aria-hidden="true" className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${NOKTA[o.tur]}`} />
          <span className="text-[13px] font-semibold leading-snug">{o.metin}</span>
          <span className="text-xs text-muted">{o.zaman}</span>
        </li>
      ))}
    </ol>
  );
}
