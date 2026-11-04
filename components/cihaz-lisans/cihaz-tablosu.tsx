"use client";

// Cihaz listesi: seri no, müşteri, plan, lisans süresi, firmware, durum
import Link from "next/link";
import { Search, X } from "lucide-react";
import Chip from "@/components/ui/chip";
import { sayi } from "@/lib/format";
import { useBugun } from "@/lib/use-bugun";
import { DURUM_ADI, type Cihaz, type CihazDurumu } from "./queries";
import {
  DURUM_TONU,
  PLAN_TONU,
  eskiFirmware,
  guncelDurum,
  ilerlemeRengi,
  kalanYaz,
  lisansIlerleme,
  tarihYaz,
} from "./ortak";

export type DurumSekmesi = "tumu" | Exclude<CihazDurumu, "lisanssiz">;

const SEKMELER: { id: DurumSekmesi; ad: string }[] = [
  { id: "tumu", ad: "Tümü" },
  { id: "aktif", ad: "Aktif" },
  { id: "bitiyor", ad: "Süresi doluyor" },
  { id: "serviste", ad: "Serviste" },
];

const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3";

export default function CihazTablosu({
  cihazlar,
  sekme,
  sayilar,
  arama,
  eskiFiltre,
  onSekme,
  onArama,
  onEskiFiltre,
}: {
  cihazlar: Cihaz[];
  sekme: DurumSekmesi;
  sayilar: Record<DurumSekmesi, number>;
  arama: string;
  eskiFiltre: boolean;
  onSekme: (s: DurumSekmesi) => void;
  onArama: (v: string) => void;
  onEskiFiltre: (v: boolean) => void;
}) {
  const bugun = useBugun();

  return (
    <section aria-label="Cihaz listesi" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-3">
        <div role="group" aria-label="Cihaz durumu" className="flex flex-wrap gap-1.5">
          {SEKMELER.map((s) => {
            const aktif = s.id === sekme;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={aktif}
                onClick={() => onSekme(s.id)}
                className={`min-h-10 cursor-pointer rounded-control border px-3.5 text-[13px] font-bold transition-colors ${
                  aktif ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:bg-[#F4F5F0]"
                }`}
              >
                {s.ad} <span className="tabular-nums opacity-70">{sayi(sayilar[s.id])}</span>
              </button>
            );
          })}
          {eskiFiltre && (
            <button
              type="button"
              onClick={() => onEskiFiltre(false)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-warn-bg bg-warn-bg px-3 text-[13px] font-bold text-warn"
            >
              Eski firmware
              <X size={14} aria-hidden="true" />
              <span className="sr-only">filtresini kaldır</span>
            </button>
          )}
        </div>
        <label className="ml-auto flex h-10 min-w-[200px] flex-[0_1_260px] items-center gap-2 rounded-control border border-line bg-[#F4F5F0] px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Seri no ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => onArama(e.target.value)}
            placeholder="Seri no veya müşteri"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-4`}>Seri no</th>
              <th scope="col" className={TH}>Müşteri</th>
              <th scope="col" className={TH}>Plan</th>
              <th scope="col" className={TH}>Lisans süresi</th>
              <th scope="col" className={TH}>Firmware</th>
              <th scope="col" className={TH}>Aktivasyon</th>
              <th scope="col" className={`${TH} pr-4`}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {cihazlar.map((c) => {
              const durum = guncelDurum(c, bugun);
              const ilerleme = lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun);
              const acil = ilerleme !== null && ilerleme.yuzde >= 95;
              return (
                <tr key={c.seriNo} className="transition-colors hover:bg-[#F6F7F2]">
                  <td className={`${TD} pl-4`}>
                    <Link href={`/cihaz-lisans/${c.seriNo}`} className="whitespace-nowrap font-mono text-xs font-semibold hover:underline">
                      {c.seriNo}
                    </Link>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col gap-0.5">
                      {c.musteriId ? (
                        <Link href={`/musteriler/${c.musteriId}`} className="font-bold hover:underline">{c.musteri}</Link>
                      ) : (
                        <b className="font-bold">{c.musteri}</b>
                      )}
                      <span className="text-xs text-muted">{c.ulke}</span>
                    </div>
                  </td>
                  <td className={TD}><Chip ton={PLAN_TONU[c.plan]}>{c.plan}</Chip></td>
                  <td className={`${TD} min-w-[150px]`}>
                    {durum === "serviste" || durum === "lisanssiz" ? (
                      <span className="text-xs font-semibold text-muted">{durum === "serviste" ? "Serviste" : "Lisans tanımlanmadı"}</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="font-semibold tabular-nums">{tarihYaz(c.lisansBitis)}</span>
                          <span className={`font-bold tabular-nums ${acil ? "text-err" : "text-[#474A42]"}`}>
                            {ilerleme ? kalanYaz(ilerleme.kalan) : ""}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg" aria-hidden="true">
                          <div
                            className={`h-full rounded-full ${ilerleme ? ilerlemeRengi(ilerleme.yuzde) : "bg-ink"}`}
                            style={{ width: `${ilerleme?.yuzde ?? 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{c.firmware}</span>
                      {eskiFirmware(c.firmware) && (
                        <Chip ton="warn" className="h-5 px-2 text-[11px]">Eski</Chip>
                      )}
                    </div>
                  </td>
                  <td className={`${TD} whitespace-nowrap tabular-nums text-[#474A42]`}>{tarihYaz(c.lisansBaslangic)}</td>
                  <td className={`${TD} pr-4`}>
                    <Chip ton={DURUM_TONU[durum]}>
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
                      {DURUM_ADI[durum]}
                    </Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cihazlar.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">Bu filtreye uyan cihaz yok.</p>
        )}
      </div>

      <div className="border-t border-bg px-4 py-3 text-[13px] text-muted">{cihazlar.length} kayıt gösteriliyor</div>
    </section>
  );
}
