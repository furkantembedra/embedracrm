"use client";

// Sol liste: arama ve Açık / Beklemede / Çözüldü filtresi
import { Search } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import { DURUM_ADI, type Talep, type TalepDurumu } from "./queries";
import { ONCELIK_TONU, zamanYaz } from "./ortak";

const FILTRELER: TalepDurumu[] = ["acik", "beklemede", "cozuldu"];

export default function TalepListesi({
  talepler,
  filtre,
  sayilar,
  arama,
  seciliId,
  onFiltre,
  onArama,
  onSec,
}: {
  talepler: Talep[];
  filtre: TalepDurumu;
  sayilar: Record<TalepDurumu, number>;
  arama: string;
  seciliId: string | null;
  onFiltre: (d: TalepDurumu) => void;
  onArama: (v: string) => void;
  onSec: (id: string) => void;
}) {
  const bugun = useBugun();
  return (
    <section aria-label="Talep listesi" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex flex-col gap-2.5 border-b border-bg p-4 pb-3">
        <label className="flex h-10 items-center gap-2 rounded-control border border-line bg-[#F4F5F0] px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Talep ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => onArama(e.target.value)}
            placeholder="Talep no, müşteri, seri no"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
        <div role="group" aria-label="Durum" className="flex gap-1 rounded-control bg-bg p-1">
          {FILTRELER.map((d) => {
            const aktif = d === filtre;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={aktif}
                onClick={() => onFiltre(d)}
                className={`min-h-9 flex-1 cursor-pointer rounded-[9px] text-[13px] font-bold transition-colors ${
                  aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
                }`}
              >
                {DURUM_ADI[d]} <span className="tabular-nums opacity-70">{sayilar[d]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="flex flex-col">
        {talepler.map((t) => {
          const secili = t.id === seciliId;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSec(t.id)}
                aria-current={secili ? "true" : undefined}
                className={`flex w-full cursor-pointer flex-col gap-1.5 border-b border-bg px-4 py-3.5 text-left transition-colors ${
                  secili ? "bg-[#F3FBD6] shadow-[inset_3px_0_0_var(--color-lime-dark)]" : "bg-card hover:bg-[#F6F7F2]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums text-muted">#{t.id}</span>
                  <Chip ton={ONCELIK_TONU[t.oncelik]} className="h-5 px-2 text-[11px]">{t.oncelik}</Chip>
                  <span className="ml-auto text-xs text-muted">{zamanYaz(t.acilis, bugun)}</span>
                </span>
                <span className="text-sm font-bold leading-snug">{t.baslik}</span>
                <span className="text-xs text-muted">{t.musteri}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {talepler.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted">Bu durumda talep yok.</p>}
    </section>
  );
}
