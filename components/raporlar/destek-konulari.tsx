"use client";

// Destek talepleri konu dağılımı: segmentli çubuk + her rengin yanında ad ve yüzde
import { useState } from "react";
import type { KonuPayi } from "./queries";

export default function DestekKonulari({ konular, donem }: { konular: KonuPayi[]; donem: string }) {
  const [odak, setOdak] = useState<string | null>(null);
  const aciklama = konular.map((k) => `${k.ad} yüzde ${k.yuzde}`).join(", ");

  return (
    <section aria-labelledby="dk-baslik" className="flex w-full min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="dk-baslik" className="text-[17px] font-extrabold">Destek talepleri · konuya göre</h2>
        <span className="text-xs font-semibold text-muted">{donem} · kaydedilen talepler</span>
      </div>

      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={aciklama} onMouseLeave={() => setOdak(null)}>
        {konular.map((k) => (
          <div
            key={k.ad}
            title={`${k.ad}: %${k.yuzde}`}
            onMouseEnter={() => setOdak(k.ad)}
            className={`h-full transition-opacity ${odak && odak !== k.ad ? "opacity-40" : ""}`}
            style={{ width: `${k.yuzde}%`, background: k.renk }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-4 gap-y-2">
        {konular.map((k) => (
          <li
            key={k.ad}
            onMouseEnter={() => setOdak(k.ad)}
            onMouseLeave={() => setOdak(null)}
            className={`flex items-center gap-2 text-[13px] transition-opacity ${odak && odak !== k.ad ? "opacity-50" : ""}`}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: k.renk }} />
            <span className="flex-1">{k.ad}</span>
            <b className="tabular-nums">%{k.yuzde}</b>
          </li>
        ))}
      </ul>

      <p className="rounded-[14px] bg-[#F4F5F0] px-3.5 py-3 text-xs leading-normal text-[#474A42]">
        <b className="text-ink">İçgörü:</b> Bağlantı taleplerinin yarısı pin kablosu kurulumundan geliyor; kurulum videosu talep sayısını azaltabilir.
      </p>
    </section>
  );
}
