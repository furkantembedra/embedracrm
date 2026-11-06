"use client";

// Sipariş listesi: durum sekmeleri, arama ve seçilebilir satırlar
import { Search, X } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import type { Siparis, StokKalemi } from "./queries";
import { DURUM_ADI, DURUM_TONU, SEKMELER, icerikOzeti, para, tarihEtiketi, type Sekme } from "./ortak";

const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3 align-middle";

export default function SiparisTablosu({
  siparisler,
  stok,
  sekme,
  sayilar,
  faturasiz,
  onFaturaKapat,
  arama,
  seciliId,
  onSekme,
  onArama,
  onSec,
}: {
  siparisler: Siparis[];
  stok: StokKalemi[];
  sekme: Sekme;
  sayilar: Record<Sekme, number>;
  faturasiz: number | null; // "Fatura bekleyen" filtresi açıksa listelenen sayı
  onFaturaKapat: () => void;
  arama: string;
  seciliId: string | null;
  onSekme: (s: Sekme) => void;
  onArama: (v: string) => void;
  onSec: (id: string) => void;
}) {
  const bugun = useBugun();
  return (
    <section aria-label="Sipariş listesi" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-3">
        <div role="tablist" aria-label="Sipariş durumu" className="flex flex-wrap gap-1 rounded-control bg-bg p-1">
          {SEKMELER.map((s) => {
            const aktif = faturasiz === null && s.id === sekme;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={aktif}
                onClick={() => onSekme(s.id)}
                className={`min-h-9 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
                  aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
                }`}
              >
                {s.ad}
                <span className="ml-1.5 tabular-nums opacity-60">{sayilar[s.id]}</span>
              </button>
            );
          })}
          {faturasiz !== null && (
            <button
              type="button"
              role="tab"
              aria-selected
              onClick={onFaturaKapat}
              aria-label="Fatura bekleyen filtresini kaldır"
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[9px] bg-warn-bg px-3 text-[13px] font-bold text-warn"
            >
              Fatura bekleyen
              <span className="tabular-nums opacity-70">{faturasiz}</span>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <label className="ml-auto flex h-10 min-w-[180px] flex-[0_1_260px] items-center gap-2 rounded-control border border-line bg-[#F4F5F0] px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Sipariş ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => onArama(e.target.value)}
            placeholder="Sipariş no, müşteri, takip veya seri no"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-4`}>Sipariş</th>
              <th scope="col" className={TH}>Müşteri</th>
              <th scope="col" className={TH}>İçerik</th>
              <th scope="col" className={`${TH} text-right`}>Tutar</th>
              <th scope="col" className={TH}>Ödeme</th>
              <th scope="col" className={`${TH} pr-4`}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {siparisler.map((s) => {
              const secili = s.id === seciliId;
              const zemin = secili ? "bg-[#F3FBD6]" : "";
              return (
                <tr key={s.id} onClick={() => onSec(s.id)} aria-selected={secili} className={`cursor-pointer transition-colors ${secili ? "" : "hover:bg-[#F6F7F2]"}`}>
                  <td className={`${TD} pl-4 ${zemin} ${secili ? "shadow-[inset_3px_0_0_var(--color-lime-dark)]" : ""}`}>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSec(s.id);
                        }}
                        className="cursor-pointer self-start whitespace-nowrap font-bold tabular-nums hover:underline"
                      >
                        #{s.id}
                      </button>
                      <span className="whitespace-nowrap text-xs text-muted">{tarihEtiketi(s.tarih, bugun)}</span>
                    </div>
                  </td>
                  <td className={`${TD} ${zemin}`}>
                    <div className="flex flex-col gap-0.5">
                      <b className="line-clamp-2 max-w-[180px]">{s.musteri}</b>
                      <span className="text-xs text-muted">{s.bayiId ? `${s.ulke} · bayi` : s.ulke}</span>
                    </div>
                  </td>
                  <td className={`${TD} ${zemin} text-[#474A42]`}>{icerikOzeti(s, stok)}</td>
                  <td className={`${TD} ${zemin} whitespace-nowrap text-right font-bold tabular-nums`}>{para(s.tutar, s.paraBirimi)}</td>
                  <td className={`${TD} ${zemin}`}>
                    <Chip ton={s.odeme === "Proforma" ? "warn" : "gray"}>{s.odeme}</Chip>
                  </td>
                  <td className={`${TD} ${zemin} pr-4`}>
                    <Chip ton={DURUM_TONU[s.durum]}>{DURUM_ADI[s.durum]}</Chip>
                  </td>
                </tr>
              );
            })}
            {siparisler.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-muted">
                  {arama.trim() ? `"${arama.trim()}" ile eşleşen sipariş yok.` : faturasiz !== null ? "Faturası kesilmemiş sipariş yok." : "Bu durumda sipariş yok."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
