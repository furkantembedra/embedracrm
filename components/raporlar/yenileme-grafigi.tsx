"use client";

// Lisans yenileme oranı çizgi grafiği: son 12 ay, hedef çizgisi, üzerine gelince ay / oran ipucu
import { useState } from "react";
import Chip from "@/components/ui/chip";
import type { AylikYenileme } from "./queries";

const G = 600; // viewBox genişliği
const Y = 200; // viewBox yüksekliği
const ALT = 75; // y ekseni alt sınırı (%)
const UST = 95; // y ekseni üst sınırı (%)

const yuzde = (n: number) => `%${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;

export default function YenilemeGrafigi({ veri, hedef }: { veri: AylikYenileme[]; hedef: number }) {
  const [odak, setOdak] = useState<number | null>(null);
  const [tablo, setTablo] = useState(false);
  if (veri.length === 0) return null;

  const x = (i: number) => (veri.length === 1 ? G / 2 : (i / (veri.length - 1)) * G);
  const y = (oran: number) => Y - ((Math.min(UST, Math.max(ALT, oran)) - ALT) / (UST - ALT)) * Y;
  const cizgi = veri.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.oran).toFixed(1)}`).join(" ");
  const son = veri[veri.length - 1];
  const ilk = veri[0];
  const o = odak === null ? null : veri[odak];

  return (
    <section aria-labelledby="yn-baslik" className="flex w-full min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="yn-baslik" className="text-[17px] font-extrabold">Lisans yenileme oranı</h2>
          <span className="text-xs font-semibold text-muted">Aylık · hedef {yuzde(hedef)}</span>
        </div>
        <Chip ton={son.oran >= hedef ? "lime" : "warn"} className="ml-auto">{son.ay} {yuzde(son.oran)}</Chip>
        <button
          type="button"
          onClick={() => setTablo((t) => !t)}
          aria-pressed={tablo}
          className="min-h-9 cursor-pointer rounded-[10px] border border-line-strong px-3 text-xs font-bold hover:bg-[#F4F5F0]"
        >
          {tablo ? "Grafik" : "Tablo"}
        </button>
      </div>

      {tablo ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#F8F9F5] text-left text-xs text-muted">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Ay</th><th scope="col" className="px-3 py-2 text-right font-semibold">Yenileme</th><th scope="col" className="px-3 py-2 text-right font-semibold">Hedefe göre</th></tr>
            </thead>
            <tbody>
              {veri.map((d) => (
                <tr key={d.ay} className="border-t border-bg">
                  <td className="px-3 py-2 font-semibold">{d.ay}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{yuzde(d.oran)}</td>
                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${d.oran >= hedef ? "text-ok" : "text-warn"}`}>
                    {d.oran >= hedef ? "+" : ""}{(d.oran - hedef).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} puan
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <div aria-hidden="true" className="flex h-[200px] flex-col justify-between text-right text-[11px] tabular-nums text-muted">
            <span>%{UST}</span><span>%{(ALT + UST) / 2}</span><span>%{ALT}</span>
          </div>
          <div className="relative flex min-w-0 flex-1 flex-col gap-2">
            <svg
              viewBox={`0 0 ${G} ${Y}`}
              preserveAspectRatio="none"
              className="h-[200px] w-full overflow-visible"
              role="img"
              aria-label={`Lisans yenileme oranı ${ilk.ay} ayında ${yuzde(ilk.oran)}, ${son.ay} ayında ${yuzde(son.oran)}; hedef ${yuzde(hedef)}`}
              onMouseLeave={() => setOdak(null)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const i = Math.round(((e.clientX - r.left) / r.width) * (veri.length - 1));
                setOdak(Math.max(0, Math.min(veri.length - 1, i)));
              }}
            >
              <line x1="0" y1="0.5" x2={G} y2="0.5" stroke="#EEEFEA" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={Y / 2} x2={G} y2={Y / 2} stroke="#EEEFEA" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={Y - 0.5} x2={G} y2={Y - 0.5} stroke="#DADCD4" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={y(hedef)} x2={G} y2={y(hedef)} stroke="#8DB01C" strokeWidth="1.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
              <path d={`${cizgi} L${G} ${Y} L0 ${Y} Z`} fill="#0E0F0C" fillOpacity="0.05" />
              <path d={cizgi} fill="none" stroke="#0E0F0C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {odak !== null && (
                <line x1={x(odak)} y1="0" x2={x(odak)} y2={Y} stroke="#5E6259" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {/* Noktalar HTML'de: SVG esnetilince daire olarak kalsınlar */}
            {veri.map((d, i) => (
              <span
                key={d.ay}
                aria-hidden="true"
                className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-opacity ${
                  i === odak || i === veri.length - 1 ? "bg-ink opacity-100" : "opacity-0"
                }`}
                style={{ left: `${(x(i) / G) * 100}%`, top: `${(y(d.oran) / Y) * 200}px` }}
              />
            ))}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 rounded-md bg-card px-1.5 text-[11px] font-bold text-[#5C7300]"
              style={{ top: `${(y(hedef) / Y) * 200 - 18}px` }}
            >
              Hedef {yuzde(hedef)}
            </span>

            {o && odak !== null && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col rounded-[10px] bg-ink px-2.5 py-1.5 text-xs text-white shadow-[0_6px_18px_rgba(14,15,12,0.2)]"
                style={{ left: `clamp(48px, ${(x(odak) / G) * 100}%, calc(100% - 48px))` }}
              >
                <span className="font-semibold text-[#C3C6BC]">{o.ay}</span>
                <b className="tabular-nums">{yuzde(o.oran)}</b>
              </div>
            )}

            <div aria-hidden="true" className="grid text-center text-[11px] font-semibold text-muted" style={{ gridTemplateColumns: `repeat(${veri.length}, minmax(0, 1fr))` }}>
              {veri.map((d) => <span key={d.ay}>{d.ay}</span>)}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-[#474A42]">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 bg-ink" />Gerçekleşen</span>
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-[#8DB01C]" />Hedef</span>
      </div>
    </section>
  );
}
