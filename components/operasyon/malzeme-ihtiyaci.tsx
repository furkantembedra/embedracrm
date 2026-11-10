"use client";

// Operasyon › Malzeme ihtiyacı: açık siparişler (+ olası fırsatlar) ve planlı üretim için hangi bileşenden
// ne kadar eksik olduğunu gösterir; seçilen satırlar için tedarik siparişi / iç üretim emri açar.
import { useMemo, useState } from "react";
import Chip from "@/components/ui/chip";
import { sayi } from "@/lib/format";
import { URUN_BILGI, type CihazModeli } from "@/lib/urunler";
import { malzemeIhtiyaci, type IhtiyacGirdisi } from "./ihtiyac";

const UFUKLAR = [7, 30, 90];

export default function MalzemeIhtiyaci({
  girdi,
  bekliyor,
  onOlustur,
}: {
  girdi: Omit<IhtiyacGirdisi, "ufukGun" | "olasiDahil">;
  bekliyor: boolean;
  onOlustur: (secimler: { kod: string; adet: number }[]) => void;
}) {
  const [ufuk, setUfuk] = useState(30);
  const [olasi, setOlasi] = useState(false);
  const sonuc = useMemo(() => malzemeIhtiyaci({ ...girdi, ufukGun: ufuk, olasiDahil: olasi }), [girdi, ufuk, olasi]);
  const [secili, setSecili] = useState<Record<string, number>>({});
  const onerilen = sonuc.bilesenler.filter((b) => b.oneri > 0);
  const secimler = Object.entries(secili).filter(([kod, adet]) => adet > 0 && sonuc.bilesenler.some((b) => b.kod === kod)).map(([kod, adet]) => ({ kod, adet }));
  const ekUretim = sonuc.cihazlar.reduce((s, c) => s + c.ekUretim, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Zaman ufku" className="flex gap-1 rounded-control bg-card p-1 shadow-[0_0_0_1px_var(--color-line)]">
          {UFUKLAR.map((g) => (
            <button key={g} type="button" aria-pressed={ufuk === g} onClick={() => setUfuk(g)}
              className={`min-h-10 cursor-pointer rounded-[9px] px-3.5 text-[13px] font-bold ${ufuk === g ? "bg-ink text-white" : "text-[#474A42] hover:bg-bg"}`}>
              {g} gün
            </button>
          ))}
        </div>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-bold">
          <input type="checkbox" checked={olasi} onChange={(e) => setOlasi(e.target.checked)} className="h-4 w-4 accent-ink" />
          Olası talebi dahil et <span className="font-normal text-muted">(teklif %40, müzakere %60)</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">Ek üretilmesi gereken cihaz</span>
          <b className="text-2xl tabular-nums">{ekUretim}</b>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">Eksik bileşen kalemi</span>
          <b className={`text-2xl tabular-nums ${sonuc.bilesenler.some((b) => b.netEksik > 0) ? "text-err" : ""}`}>{sonuc.bilesenler.filter((b) => b.netEksik > 0).length}</b>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">Sipariş önerilen kalem</span>
          <b className="text-2xl tabular-nums">{onerilen.length}</b>
        </div>
      </div>

      <section aria-label="Cihaz talebi" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <h2 className="text-[17px] font-extrabold">Cihaz talebi ve üretim kapasitesi</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold text-muted">
                <th className="py-2 pr-3">Model</th><th className="py-2 pr-3 text-right">Kesin talep</th><th className="py-2 pr-3 text-right">Olası</th>
                <th className="py-2 pr-3 text-right">Depoda</th><th className="py-2 pr-3 text-right">Üretimde</th><th className="py-2 pr-3 text-right">Planlı</th>
                <th className="py-2 pr-3 text-right">Ek üretim</th><th className="py-2">Stoktaki bileşenle üretilebilir</th>
              </tr>
            </thead>
            <tbody>
              {sonuc.cihazlar.map((c) => (
                <tr key={c.model} className="border-b border-bg last:border-0">
                  <td className="py-2.5 pr-3 font-bold">{URUN_BILGI[c.model as CihazModeli].ad}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{c.kesin}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted">{c.olasi ? `~${c.olasi}` : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{c.depo}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{c.yapimda}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{c.planli}</td>
                  <td className={`py-2.5 pr-3 text-right font-bold tabular-nums ${c.ekUretim ? "text-warn" : ""}`}>{c.ekUretim}</td>
                  <td className="py-2.5"><b className="tabular-nums">{c.uretilebilir}</b>{c.darbogaz && <span className="text-xs text-muted"> · darboğaz: {c.darbogaz}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Bileşen ihtiyacı" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[17px] font-extrabold">Bileşen ihtiyacı · {sonuc.sinir.split("-").reverse().join(".")} tarihine kadar</h2>
          <button type="button" disabled={!onerilen.length} onClick={() => setSecili(Object.fromEntries(onerilen.map((b) => [b.kod, b.oneri])))}
            className="min-h-10 cursor-pointer rounded-control border border-line-strong px-3 text-[13px] font-bold hover:bg-[#F4F5F0] disabled:cursor-not-allowed disabled:opacity-50">
            Önerilenleri seç
          </button>
          <button type="button" disabled={!secimler.length || bekliyor} onClick={() => { onOlustur(secimler); setSecili({}); }}
            className="min-h-10 cursor-pointer rounded-control bg-ink px-4 text-[13px] font-bold text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50">
            {bekliyor ? "Oluşturuluyor…" : `Seçilenler için sipariş / emir aç (${secimler.length})`}
          </button>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold text-muted">
                <th className="py-2 pr-2"><span className="sr-only">Seç</span></th><th className="py-2 pr-3">Bileşen</th><th className="py-2 pr-3">Kaynak</th>
                <th className="py-2 pr-3 text-right">Gereken</th><th className="py-2 pr-3 text-right">Stokta</th><th className="py-2 pr-3 text-right">Gelecek</th>
                <th className="py-2 pr-3 text-right">Net eksik</th><th className="py-2 text-right">Sipariş adedi</th>
              </tr>
            </thead>
            <tbody>
              {sonuc.bilesenler.map((b) => {
                const sec = b.kod in secili;
                return (
                  <tr key={b.kod} className={`border-b border-bg last:border-0 ${b.netEksik ? "bg-err-bg/40" : ""}`}>
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={sec} aria-label={`${b.ad} seç`} className="h-4 w-4 cursor-pointer accent-ink"
                        onChange={(e) => setSecili((s) => {
                          const y = { ...s };
                          if (e.target.checked) y[b.kod] = b.oneri || b.netEksik || Math.max(1, b.hedef - b.stok);
                          else delete y[b.kod];
                          return y;
                        })} />
                    </td>
                    <td className="py-2 pr-3"><b>{b.ad}</b><span className="block text-xs text-muted">{b.kod} · kritik {b.kritik} / hedef {b.hedef}</span></td>
                    <td className="py-2 pr-3"><Chip ton={b.kaynak === "ic" ? "info" : "gray"}>{b.kaynak === "ic" ? "İç üretim" : "Dış tedarik"}</Chip></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{sayi(b.gereken)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{sayi(b.stok)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{b.gelen ? `+${sayi(b.gelen)}` : "—"}</td>
                    <td className={`py-2 pr-3 text-right font-bold tabular-nums ${b.netEksik ? "text-err" : "text-muted"}`}>{b.netEksik ? sayi(b.netEksik) : "—"}</td>
                    <td className="py-2 text-right">
                      {sec ? (
                        <input type="number" min={1} inputMode="numeric" aria-label={`${b.ad} sipariş adedi`} value={secili[b.kod]}
                          onChange={(e) => setSecili((s) => ({ ...s, [b.kod]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                          className="min-h-9 w-24 rounded-lg border border-line-strong bg-card px-2 text-right text-sm font-bold tabular-nums" />
                      ) : (
                        <span className={`tabular-nums ${b.oneri ? "font-bold" : "text-muted"}`}>{b.oneri ? `öneri ${sayi(b.oneri)}` : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Dış tedarik kalemleri için son tedarikçiye 14 gün teslimli sipariş, iç üretim kalemleri için bugünden başlayan iş emri açılır. Açılan kayıtlar Üretim &amp; tedarik sekmesinde görünür.</p>
      </section>
    </div>
  );
}
