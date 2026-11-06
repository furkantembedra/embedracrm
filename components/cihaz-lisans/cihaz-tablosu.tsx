"use client";

// Cihaz listesi: seri no, model (ONE / ONE Lite), müşteri, lisans planı, lisans süresi, firmware, durum
import Link from "next/link";
import { Search } from "lucide-react";
import Chip from "@/components/ui/chip";
import { sayi } from "@/lib/format";
import { useBugun } from "@/lib/use-bugun";
import { useSimdi } from "@/lib/use-simdi";
import { DURUM_ADI, type Cihaz, type CihazDurumu, type LisansPlani } from "./queries";
import { CIHAZ_MODELLERI, URUN_BILGI, type CihazModeli } from "@/lib/urunler";
import {
  DURUM_TONU,
  PLAN_TONU,
  eskiFirmware,
  guncelDurum,
  bayiAdi,
  ilerlemeRengi,
  kalanYaz,
  lisansIlerleme,
  sonGorulmeYaz,
  tarihYaz,
} from "./ortak";

export type DurumSekmesi = "tumu" | "aktif" | "bitiyor" | "stokta";

const SEKMELER: { id: DurumSekmesi; ad: string }[] = [
  { id: "tumu", ad: "Tüm durumlar" },
  { id: "aktif", ad: "Aktif" },
  { id: "bitiyor", ad: "Süresi doluyor" },
  { id: "stokta", ad: "Bayi stoğunda" },
];

export type ModelSecimi = CihazModeli | "tumu";
export type PlanSecimi = LisansPlani | "tumu";
const PLANLAR: PlanSecimi[] = ["tumu", "Basic", "Pro", "Pro+"];
const MODEL_TONU = { ONE: "ink", "ONE Lite": "gray" } as const;

const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3";

export default function CihazTablosu({
  cihazlar,
  sekme,
  sayilar,
  arama,
  onSekme,
  onArama,
  onMusteriAc,
  yeniBildirenler,
  model = "tumu",
  modelSayilari,
  onModel,
  plan = "tumu",
  planSayilari,
  onPlan,
}: {
  cihazlar: Cihaz[];
  sekme: DurumSekmesi;
  sayilar: Record<DurumSekmesi, number>;
  arama: string;
  onSekme: (s: DurumSekmesi) => void;
  onArama: (v: string) => void;
  onMusteriAc?: (musteriId: string) => void; // verilirse müşteri adı sayfa yerine pencere açar
  yeniBildirenler?: Set<string>; // az önce bildirim gönderen cihazların satırı kısa süre vurgulanır
  model?: ModelSecimi;
  modelSayilari?: Record<CihazModeli, number>;
  onModel?: (m: ModelSecimi) => void;
  plan?: PlanSecimi;
  planSayilari?: Record<LisansPlani, number>;
  onPlan?: (p: PlanSecimi) => void;
}) {
  const bugun = useBugun();
  const simdi = useSimdi();

  return (
    <section aria-label="Cihaz listesi" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {onModel && (
            <div role="group" aria-label="Cihaz modeli" className="flex gap-1 rounded-control bg-bg p-1">
              {(["tumu", ...CIHAZ_MODELLERI] as ModelSecimi[]).map((m) => {
                const aktif = m === model;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => onModel(m)}
                    className={`min-h-8 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
                      aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
                    }`}
                  >
                    {m === "tumu" ? "Tüm modeller" : URUN_BILGI[m].ad}
                    {m !== "tumu" && modelSayilari && <span className="ml-1 tabular-nums opacity-70">{sayi(modelSayilari[m])}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {onPlan && (
            <div role="group" aria-label="Lisans planı" className="flex gap-1 rounded-control bg-bg p-1">
              {PLANLAR.map((p) => {
                const aktif = p === plan;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => onPlan(p)}
                    className={`min-h-8 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
                      aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
                    }`}
                  >
                    {p === "tumu" ? "Tüm lisanslar" : p}
                    {p !== "tumu" && planSayilari && <span className="ml-1 tabular-nums opacity-70">{sayi(planSayilari[p])}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div role="group" aria-label="Cihaz durumu" className="flex gap-1 rounded-control bg-bg p-1">
            {SEKMELER.map((d) => {
              const aktif = d.id === sekme;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => onSekme(d.id)}
                  className={`min-h-8 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
                    aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
                  }`}
                >
                  {d.ad}
                  {d.id !== "tumu" && <span className="ml-1 tabular-nums opacity-70">{sayi(sayilar[d.id])}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <label className="ml-auto flex h-10 min-w-[200px] flex-[0_1_260px] items-center gap-2 rounded-control border border-line bg-[#F4F5F0] px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Seri no ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => onArama(e.target.value)}
            placeholder="Seri no, model veya müşteri"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-4`}>Seri no</th>
              <th scope="col" className={TH}>Model</th>
              <th scope="col" className={TH}>Müşteri</th>
              <th scope="col" className={TH}>Lisans</th>
              <th scope="col" className={TH}>Lisans süresi</th>
              <th scope="col" className={TH}>Aktivasyon</th>
              <th scope="col" className={`${TH} pr-4`}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {cihazlar.map((c) => {
              const durum = guncelDurum(c, bugun);
              const ilerleme = lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun);
              const acil = ilerleme !== null && ilerleme.yuzde >= 95;
              const yeni = yeniBildirenler?.has(c.seriNo) ?? false;
              return (
                <tr key={c.seriNo} className={`transition-colors duration-700 ${yeni ? "bg-lime-bg" : "hover:bg-[#F6F7F2]"}`}>
                  <td className={`${TD} pl-4`}>
                    <Link href={`/cihaz-lisans/${c.seriNo}`} className="whitespace-nowrap font-mono text-xs font-semibold hover:underline">
                      {c.seriNo}
                    </Link>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col items-start gap-1">
                      <Chip ton={MODEL_TONU[c.model] ?? "gray"}>{URUN_BILGI[c.model]?.ad ?? c.model}</Chip>
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col gap-0.5">
                      {durum === "stokta" ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/bayiler?bayi=${c.bayiId}`} className="font-bold hover:underline" title="Bayi detayını aç">{bayiAdi(c)}</Link>
                          <Chip ton="gray" className="h-5 px-2 text-[11px]">Bayi stoğu</Chip>
                        </span>
                      ) : c.musteriId && onMusteriAc ? (
                        <button type="button" onClick={() => onMusteriAc(c.musteriId!)} className="cursor-pointer text-left font-bold hover:underline">
                          {c.musteri}
                        </button>
                      ) : c.musteriId ? (
                        <Link href={`/musteriler/${c.musteriId}`} className="font-bold hover:underline">{c.musteri}</Link>
                      ) : (
                        <b className="font-bold">{c.musteri}</b>
                      )}
                      <span className="text-xs text-muted">{c.ulke}</span>
                    </div>
                  </td>
                  <td className={TD}>{durum === "stokta" || durum === "lisanssiz" ? <span className="text-muted">—</span> : <Chip ton={PLAN_TONU[c.plan]}>{c.plan}</Chip>}</td>
                  <td className={`${TD} min-w-[150px]`}>
                    {durum === "stokta" ? (
                      <span className="flex flex-col gap-0.5 text-xs">
                        <span className="font-semibold text-[#474A42]">Satış bekleniyor</span>
                        {c.stogaGiris && bugun !== null && (
                          <span className="text-muted">{Math.max(0, Math.round((bugun - new Date(c.stogaGiris + "T00:00:00").getTime()) / 86_400_000))} gündür stokta</span>
                        )}
                      </span>
                    ) : durum === "lisanssiz" ? (
                      <span className="text-xs font-semibold text-muted">Lisans tanımlanmadı</span>
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
