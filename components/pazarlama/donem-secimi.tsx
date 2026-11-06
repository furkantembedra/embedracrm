"use client";

// Sayfanın dönem seçimi: hazır aralıklar, iki tarih ve önceki / sonraki. Özet kartları ve içerik takvimi buna göre süzülür.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DONEM_ADI, donemKaydir, donemYaz, gunSayisi, hazirDonem, type Donem } from "./ortak";

const GEZ = "flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-control border border-line-strong bg-card text-[#474A42] hover:bg-[#F4F5F0]";
const TARIH = "min-h-10 rounded-control border border-line-strong bg-card px-2.5 text-[13px] font-semibold outline-none focus:border-ink";

export default function DonemSecimi({ donem, bugun, onDegis }: { donem: Donem | null; bugun: number | null; onDegis: (d: Donem) => void }) {
  const tarihDegis = (alan: "bas" | "bit", deger: string) => {
    if (!donem || !deger) return;
    let d = { ...donem, tur: "ozel" as const, [alan]: deger };
    if (d.bas > d.bit) d = alan === "bas" ? { ...d, bit: d.bas } : { ...d, bas: d.bit };
    onDegis(d);
  };
  return (
    <section aria-label="Dönem" className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-3">
      <div role="group" aria-label="Hazır dönemler" className="flex flex-wrap gap-1 rounded-control bg-bg p-1">
        {(Object.keys(DONEM_ADI) as (keyof typeof DONEM_ADI)[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={donem?.tur === t}
            disabled={bugun === null}
            onClick={() => bugun !== null && onDegis(hazirDonem(t, bugun))}
            className={`min-h-9 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${donem?.tur === t ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"}`}
          >
            {DONEM_ADI[t]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => donem && onDegis(donemKaydir(donem, -1))} aria-label="Önceki dönem" className={GEZ}><ChevronLeft size={18} aria-hidden="true" /></button>
        <label className="sr-only" htmlFor="donem-bas">Başlangıç</label>
        <input id="donem-bas" type="date" value={donem?.bas ?? ""} max={donem?.bit} onChange={(e) => tarihDegis("bas", e.target.value)} className={TARIH} />
        <span aria-hidden="true" className="text-muted">–</span>
        <label className="sr-only" htmlFor="donem-bit">Bitiş</label>
        <input id="donem-bit" type="date" value={donem?.bit ?? ""} min={donem?.bas} onChange={(e) => tarihDegis("bit", e.target.value)} className={TARIH} />
        <button type="button" onClick={() => donem && onDegis(donemKaydir(donem, 1))} aria-label="Sonraki dönem" className={GEZ}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <span className="ml-auto text-xs font-semibold text-muted" aria-live="polite">
        {donem ? `${donemYaz(donem)} · ${gunSayisi(donem.bas, donem.bit)} gün` : ""}
      </span>
    </section>
  );
}
