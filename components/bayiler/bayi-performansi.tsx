// Aktif bayilerin satış, stok ve MOQ durumu
import Chip from "@/components/ui/chip";
import type { AktifBayi } from "./queries";
import { moqYuzde, stokDurumu } from "./ortak";

export default function BayiPerformansi({ bayiler }: { bayiler: AktifBayi[] }) {
  return (
    <section aria-labelledby="pf-baslik" className="flex w-full min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="pf-baslik" className="text-[17px] font-extrabold">Aktif bayi performansı</h2>
        <span className="text-xs font-semibold text-muted">Bu çeyrek · satış, stok ve MOQ durumu</span>
      </div>
      {bayiler.length === 0 && <p className="text-[13px] text-muted">Henüz aktif bayi yok.</p>}
      <ul className="flex flex-col gap-2.5">
        {bayiler.map((b) => {
          const stok = stokDurumu(b.stok);
          const moq = moqYuzde(b);
          const moqRenk = moq >= 80 ? "bg-[#1F8A4C]" : moq >= 50 ? "bg-[#E58A2B]" : "bg-[#D93F3F]";
          return (
            <li
              key={b.id}
              className="grid grid-cols-2 items-center gap-3 rounded-[14px] border border-line px-3.5 py-3 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]"
            >
              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-1">
                <b className="truncate text-sm">{b.ad}</b>
                <span className="text-xs text-muted">{b.bolge}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-muted">Satılan</span>
                <b className="tabular-nums">{b.satilan} cihaz</b>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted">Stok</span>
                <span className="flex items-center gap-1.5">
                  <b className="tabular-nums">{b.stok}</b>
                  <Chip ton={stok.ton} className="h-5 px-2 text-[11px]">{stok.ad}</Chip>
                </span>
              </div>
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <span className="text-xs font-semibold text-muted">MOQ hedefi</span>
                <div
                  className="h-1.5 rounded-full bg-bg"
                  role="img"
                  aria-label={`MOQ hedefinin yüzde ${moq}'i: ${b.moqGerceklesen}/${b.moqHedef} cihaz`}
                >
                  <div className={`h-full rounded-full ${moqRenk}`} style={{ width: `${moq}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums">%{moq} · {b.moqGerceklesen}/{b.moqHedef}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
