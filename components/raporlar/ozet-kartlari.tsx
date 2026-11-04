// Dönem özeti kartları
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Kpi } from "./queries";

export default function OzetKartlari({ kpi }: { kpi: Kpi[] }) {
  return (
    <section aria-label="Dönem özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpi.map((k) => {
        const Ok = k.iyi ? ArrowUpRight : ArrowDownRight;
        return (
          <div key={k.etiket} className="flex flex-col gap-1.5 rounded-card border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">{k.etiket}</span>
            <b className="text-[26px] font-extrabold tabular-nums">{k.deger}</b>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs">
              <span className={`inline-flex items-center gap-0.5 whitespace-nowrap font-bold ${k.iyi ? "text-ok" : "text-err"}`}>
                <Ok size={14} aria-hidden="true" />
                {k.degisim}
              </span>
              <span className="whitespace-nowrap font-semibold text-muted">önceki döneme göre</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
