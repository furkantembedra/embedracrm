"use client";

// Aktif bayilerin bu çeyrekteki satış, stok ve asgari alım (MOQ) durumu — bayi hareketlerinden hesaplanır.
// Satıra tıklayınca bayi detayı (dönem seçimi, sevk / satış / lisans) ortada açılır.
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import type { AktifBayi, BayiHareketi } from "./queries";
import { bayiOzeti, buCeyrek, moqRengi, stokDurumu, type Donem } from "./ortak";

export default function BayiPerformansi({
  bayiler,
  hareketler,
  onAc,
}: {
  bayiler: AktifBayi[];
  hareketler: BayiHareketi[];
  onAc?: (id: string) => void;
}) {
  const bugun = useBugun();
  const c = bugun === null ? { yil: 2026, ceyrek: 4 } : buCeyrek(bugun);
  const donem: Donem = { yil: c.yil, ceyrekler: [c.ceyrek] };
  const [arama, setArama] = useState("");
  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const ozetler = bayiler.map((b) => ({ b, o: bayiOzeti(b, hareketler, donem) }));
  const gorunen = q ? ozetler.filter(({ b }) => [b.ad, b.bolge].some((a) => a.toLocaleLowerCase("tr-TR").includes(q))) : ozetler;
  const kritik = ozetler.filter(({ o }) => o.stok.toplam <= 1).length;
  const geride = ozetler.filter(({ o }) => o.moqYuzde < 50).length;

  return (
    <section aria-labelledby="pf-baslik" className="flex w-full min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="pf-baslik" className="text-[17px] font-extrabold">Aktif bayi performansı</h2>
          <span className="text-xs font-semibold text-muted">
            {c.yil} Ç{c.ceyrek} · satış, stok ve asgari alım hedefi · ayrıntı için bayiye tıklayın
          </span>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {kritik > 0 && <Chip ton="err">{kritik} bayide stok kritik</Chip>}
          {geride > 0 && <Chip ton="warn">{geride} bayi hedefin gerisinde</Chip>}
        </div>
      </div>
      {bayiler.length > 0 && (
        <label className="flex h-10 min-w-[180px] w-full sm:w-[280px] items-center gap-2 rounded-control border border-line bg-[#F4F5F0] px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Bayi ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Bayi adı veya ülke"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      )}
      {bayiler.length > 0 && gorunen.length === 0 && <p className="text-[13px] text-muted">&quot;{arama.trim()}&quot; ile eşleşen bayi yok.</p>}
      {bayiler.length === 0 && <p className="text-[13px] text-muted">Henüz aktif bayi yok.</p>}
      <ul className="flex flex-col gap-2.5">
        {gorunen.map(({ b, o }) => {
          const stok = stokDurumu(o.stok.toplam);
          const icerik = (
            <>
              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-1">
                <b className="truncate text-sm">{b.ad}</b>
                <span className="text-xs text-muted">{b.bolge}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-muted">Satılan</span>
                <b className="tabular-nums">{o.satis.toplam} cihaz</b>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted">Stok</span>
                <span className="flex items-center gap-1.5">
                  <b className="tabular-nums">{o.stok.toplam}</b>
                  <Chip ton={stok.ton} className="h-5 px-2 text-[11px]">{stok.ad}</Chip>
                </span>
              </div>
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <span className="text-xs font-semibold text-muted" title="MOQ: sözleşmedeki çeyreklik asgari alım">Asgari alım (MOQ)</span>
                <div className="h-1.5 rounded-full bg-bg" role="img" aria-label={`Asgari alım hedefinin yüzde ${o.moqYuzde}'i: ${o.sevk.toplam}/${o.moqHedef} cihaz`}>
                  <div className={`h-full rounded-full ${moqRengi(o.moqYuzde)}`} style={{ width: `${o.moqYuzde}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums">%{o.moqYuzde} · {o.sevk.toplam}/{o.moqHedef}</span>
              </div>
            </>
          );
          const sinif = "grid w-full grid-cols-2 items-center gap-3 rounded-[14px] border border-line px-3.5 py-3 text-left sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_20px]";
          return (
            <li key={b.id}>
              {onAc ? (
                <button type="button" onClick={() => onAc(b.id)} aria-label={`${b.ad} ayrıntıları`} className={`${sinif} cursor-pointer transition-colors hover:bg-[#F6F7F2]`}>
                  {icerik}
                  <ChevronRight size={18} aria-hidden="true" className="hidden text-muted sm:block" />
                </button>
              ) : (
                <div className={sinif}>{icerik}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
