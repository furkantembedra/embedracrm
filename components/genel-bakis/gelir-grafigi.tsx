// Son 12 ay gelir grafiği: donanım + lisans yığılmış sütunlar
import Card from "@/components/ui/card";
import { kisaTl } from "@/lib/format";

export type GelirAyi = { ay: string; donanim: number; lisans: number }; // TL

const DEMO: GelirAyi[] = [
  { ay: "Kas", donanim: 498_000, lisans: 276_000 },
  { ay: "Ara", donanim: 610_000, lisans: 292_000 },
  { ay: "Oca", donanim: 540_000, lisans: 301_000 },
  { ay: "Şub", donanim: 585_000, lisans: 318_000 },
  { ay: "Mar", donanim: 640_000, lisans: 334_000 },
  { ay: "Nis", donanim: 612_000, lisans: 351_000 },
  { ay: "May", donanim: 688_000, lisans: 368_000 },
  { ay: "Haz", donanim: 702_000, lisans: 389_000 },
  { ay: "Tem", donanim: 655_000, lisans: 402_000 },
  { ay: "Ağu", donanim: 590_000, lisans: 418_000 },
  { ay: "Eyl", donanim: 731_000, lisans: 447_000 },
  { ay: "Eki", donanim: 762_000, lisans: 522_500 },
];

// Eksenin üst değerini 4 eşit ve okunaklı adıma yuvarlar (ör. 1,4M → 350K adım)
function eksenUstu(max: number) {
  const kaba = max / 4 || 1;
  const us = 10 ** Math.floor(Math.log10(kaba));
  const adim = [1, 2, 2.5, 5, 10].map((k) => k * us).find((a) => a >= kaba) ?? kaba;
  return adim * 4;
}

export default function GelirGrafigi({ veri = DEMO }: { veri?: GelirAyi[] }) {
  if (veri.length === 0) return null;
  const ust = eksenUstu(Math.max(...veri.map((d) => d.donanim + d.lisans)));
  const eksen = [4, 3, 2, 1, 0].map((i) => (ust / 4) * i);
  const son = veri[veri.length - 1];
  const sutunlar = { gridTemplateColumns: `repeat(${veri.length}, minmax(0, 1fr))` };

  return (
    <Card title="Gelir dağılımı" description={`Son ${veri.length} ay · donanım satışı ve lisans`}>
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#474A42]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-ink" />
          Donanım (ONE)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-lime-dark" />
          Lisans
        </span>
      </div>

      <div className="flex gap-3">
        {/* Y ekseni */}
        <div aria-hidden="true" className="flex h-[220px] flex-col justify-between pt-7 text-right text-[11px] leading-none tabular-nums text-muted">
          {eksen.map((v) => (
            <span key={v}>{v === 0 ? "0" : kisaTl(v).replace("₺", "")}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-[480px]">
            <div
              role="img"
              aria-label={`${son.ay}: toplam ${kisaTl(son.donanim + son.lisans)}, donanım ${kisaTl(son.donanim)}, lisans ${kisaTl(son.lisans)}`}
              className="relative grid h-[220px] gap-2.5 border-b border-line pt-7"
              style={sutunlar}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-bg"
                  style={{ top: `calc(28px + ${(i / 4) * 100}% - ${(i / 4) * 28}px)` }}
                />
              ))}

              {veri.map((d, i) => {
                const sonMu = i === veri.length - 1;
                const toplam = d.donanim + d.lisans;
                return (
                  <div
                    key={d.ay}
                    title={`${d.ay}: ${kisaTl(toplam)} · donanım ${kisaTl(d.donanim)} · lisans ${kisaTl(d.lisans)}`}
                    className="relative flex h-full flex-col items-center justify-end"
                  >
                    {sonMu && (
                      <span
                        className="absolute z-10 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] font-bold tabular-nums text-lime"
                        style={{ bottom: `calc(${(toplam / ust) * 100}% + 6px)` }}
                      >
                        {kisaTl(toplam)}
                      </span>
                    )}
                    <div
                      className="w-full max-w-[30px] rounded-t-md bg-lime-dark"
                      style={{ height: `${(d.lisans / ust) * 100}%` }}
                    />
                    <div
                      className={`mt-[2px] w-full max-w-[30px] rounded-[2px] ${sonMu ? "bg-ink" : "bg-[#3A3C36]"}`}
                      style={{ height: `${(d.donanim / ust) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid gap-2.5 text-center text-[11px] font-semibold text-muted" style={sutunlar}>
              {veri.map((d) => (
                <span key={d.ay}>{d.ay}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
