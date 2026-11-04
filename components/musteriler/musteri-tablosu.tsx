"use client";

// Müşteri listesi: arama ve satır seçimi
import { Search } from "lucide-react";
import Chip from "@/components/ui/chip";
import { basHarfler, kisaTl } from "@/lib/format";
import { SEGMENT_ADI, type Musteri } from "./queries";
import { useBugun } from "@/lib/use-bugun";
import { modelOzeti } from "@/lib/urunler";
import { PLAN_TONU, avatarRengi, kalanGun, tarihYaz } from "./ortak";

const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3";

export default function MusteriTablosu({
  musteriler,
  seciliId,
  arama,
  onArama,
  onSec,
}: {
  musteriler: Musteri[];
  seciliId: string | null;
  arama: string;
  onArama: (v: string) => void;
  onSec: (id: string) => void;
}) {
  const bugun = useBugun();
  return (
    <section aria-label="Müşteri listesi" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="p-4 pb-3">
        <label className="flex h-11 items-center gap-2.5 rounded-control border border-line bg-[#F4F5F0] px-3.5">
          <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Müşteri ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => onArama(e.target.value)}
            placeholder="Firma, kişi, şehir, seri no veya model"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-4`}>Müşteri</th>
              <th scope="col" className={TH}>Segment</th>
              <th scope="col" className={TH}>Plan</th>
              <th scope="col" className={TH}>Cihazlar</th>
              <th scope="col" className={TH}>Lisans bitişi</th>
              <th scope="col" className={`${TH} text-right`}>Toplam değer</th>
              <th scope="col" className={`${TH} pr-4`}>Son temas</th>
            </tr>
          </thead>
          <tbody>
            {musteriler.map((m) => {
              const secili = m.id === seciliId;
              const gun = kalanGun(m.lisansBitis, bugun);
              const yakin = gun !== null && gun <= 30;
              const zemin = secili ? "bg-[#F3FBD6]" : "";
              return (
                <tr
                  key={m.id}
                  onClick={() => onSec(m.id)}
                  aria-selected={secili}
                  className={`cursor-pointer transition-colors ${secili ? "" : "hover:bg-[#F6F7F2]"}`}
                >
                  <td className={`${TD} pl-4 ${zemin} ${secili ? "shadow-[inset_3px_0_0_var(--color-lime-dark)]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold ${avatarRengi(m.id)}`}>
                        {basHarfler(m.ad)}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSec(m.id);
                          }}
                          className="cursor-pointer truncate text-left text-sm font-bold"
                        >
                          {m.ad}
                        </button>
                        <span className="text-xs text-muted">{m.sehir} · {m.ulke}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`${TD} ${zemin}`}><Chip>{SEGMENT_ADI[m.segment]}</Chip></td>
                  <td className={`${TD} ${zemin}`}><Chip ton={PLAN_TONU[m.plan]}>{m.plan}</Chip></td>
                  <td className={`${TD} ${zemin} whitespace-nowrap text-xs font-bold tabular-nums`}>
                    {m.cihazlar.length ? modelOzeti(m.cihazlar) : <span className="font-semibold text-muted">—</span>}
                  </td>
                  <td className={`${TD} ${zemin} whitespace-nowrap font-semibold tabular-nums ${yakin ? "text-err" : ""}`}>
                    {tarihYaz(m.lisansBitis)}
                  </td>
                  <td className={`${TD} ${zemin} text-right font-bold tabular-nums`}>
                    {m.toplamDeger === null ? "—" : kisaTl(m.toplamDeger)}
                  </td>
                  <td className={`${TD} ${zemin} pr-4 text-[#474A42]`}>{m.sonTemas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {musteriler.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">Aramanıza uyan müşteri yok.</p>
        )}
      </div>

      <div className="border-t border-bg px-4 py-3 text-[13px] text-muted">{musteriler.length} kayıt gösteriliyor</div>
    </section>
  );
}
