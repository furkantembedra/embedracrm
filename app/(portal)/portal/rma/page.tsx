import Chip from "@/components/ui/chip";
import { getRmalar, ARIZA_TIPLERI, ADIM_ADI, KARAR_ADI } from "@/components/rma/queries";
import { acikMi } from "@/components/rma/ortak";
import { portalRmaAc } from "@/components/portal/actions";
import PortalFormu, { AlanHatasi } from "@/components/portal/portal-formu";
import { PORTAL_ALAN, PORTAL_GIRDI } from "@/components/portal/stil";
import { bayiVerisi, tarihTr } from "@/components/portal/veri";

export default async function PortalRmaPage() {
  const v = await bayiVerisi();
  const seriler = new Set(v.cihazlar.map((c) => c.seriNo));
  const kayitlar = (await getRmalar()).filter((r) => r.sahip.id === v.bayi.id || seriler.has(r.seriNo));
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Arıza / RMA</h1>
        <p className="text-sm text-muted">Size ya da müşterilerinize ait arızalı cihaz için servis talebi açın. Garanti durumu seri numarasından otomatik hesaplanır.</p>
      </header>
      <section aria-label="Yeni RMA talebi" className="rounded-card border border-line bg-card p-5">
        <h2 className="mb-3 text-[17px] font-extrabold">Yeni talep</h2>
        <PortalFormu islem={portalRmaAc} buton="Talebi gönder">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={PORTAL_ALAN}>
              Cihaz *
              <select name="seriNo" defaultValue="" className={PORTAL_GIRDI}>
                <option value="" disabled>Seçin…</option>
                {v.cihazlar.map((c) => <option key={c.seriNo} value={c.seriNo}>{c.seriNo} · {c.model} · {c.musteriId ? c.musteri : "stokta"}</option>)}
              </select>
              <AlanHatasi ad="seriNo" />
            </label>
            <label className={PORTAL_ALAN}>
              Arıza tipi *
              <select name="arizaTipi" defaultValue="" className={PORTAL_GIRDI}>
                <option value="" disabled>Seçin…</option>
                {ARIZA_TIPLERI.map((a) => <option key={a}>{a}</option>)}
              </select>
              <AlanHatasi ad="arizaTipi" />
            </label>
            <label className={`${PORTAL_ALAN} sm:col-span-2`}>
              Arıza açıklaması *
              <textarea name="ariza" rows={3} maxLength={1000} className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
              <AlanHatasi ad="ariza" />
            </label>
          </div>
        </PortalFormu>
      </section>
      <section aria-label="Taleplerim" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <h2 className="text-[17px] font-extrabold">Taleplerim</h2>
        <ul className="flex flex-col divide-y divide-bg">
          {kayitlar.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
              <b>{r.id}</b>
              <span className="font-mono text-xs">{r.seriNo}</span>
              <span>{r.arizaTipi}</span>
              <span className="text-muted">{tarihTr(r.acilis)}</span>
              <span className="ml-auto flex items-center gap-2">
                {r.karar && <span className="text-xs text-muted">{KARAR_ADI[r.karar]}</span>}
                <Chip ton={acikMi(r) ? "info" : "ok"}>{ADIM_ADI[r.adim]}</Chip>
              </span>
            </li>
          ))}
          {!kayitlar.length && <li className="py-6 text-center text-sm text-muted">Talep yok.</li>}
        </ul>
      </section>
    </>
  );
}
