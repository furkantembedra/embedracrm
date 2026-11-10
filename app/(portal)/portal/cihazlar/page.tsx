import Chip from "@/components/ui/chip";
import { DURUM_ADI } from "@/components/cihaz-lisans/queries";
import { portalSatisBildir } from "@/components/portal/actions";
import PortalFormu, { AlanHatasi } from "@/components/portal/portal-formu";
import { PORTAL_GIRDI } from "@/components/portal/stil";
import { bayiVerisi, gunler, tarihTr } from "@/components/portal/veri";

export default async function PortalCihazlarPage() {
  const v = await bayiVerisi();
  const { bugun } = gunler();
  const satilan = v.cihazlar.filter((c) => c.musteriId);
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Cihazlarım</h1>
        <p className="text-sm text-muted">Size sevk edilen cihazlar. Müşterinize sattığınız cihazı &quot;Satıldı&quot; olarak bildirin; lisans ve garanti müşteri adına başlar.</p>
      </header>

      <section aria-label="Stoktaki cihazlar" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <h2 className="text-[17px] font-extrabold">Stokta ({v.stokSeriler.length})</h2>
        {v.stokSeriler.length ? (
          <ul className="flex flex-col divide-y divide-bg">
            {v.stokSeriler.map((s) => (
              <li key={s.seriNo} className="flex flex-col gap-2 py-3">
                <details className="group">
                  <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-3 text-sm">
                    <b className="font-mono">{s.seriNo}</b>
                    <span className="text-muted">{s.model}</span>
                    <span className="ml-auto rounded-control border border-line-strong px-3 py-1.5 text-[13px] font-bold group-open:bg-bg">Satıldı bildir</span>
                  </summary>
                  <PortalFormu islem={portalSatisBildir} buton="Satışı bildir" className="mt-3 grid gap-3 rounded-xl bg-[#F4F5F0] p-3 sm:grid-cols-[1fr_180px_auto] sm:items-start">
                    <input type="hidden" name="seriNo" value={s.seriNo} />
                    <input type="hidden" name="model" value={s.model} />
                    <label className="flex flex-col gap-1 text-xs font-bold">
                      Müşteri (firma) adı
                      <input name="musteri" required className={PORTAL_GIRDI} />
                      <AlanHatasi ad="musteri" />
                      <AlanHatasi ad="seriler" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold">
                      Satış tarihi
                      <input name="tarih" type="date" defaultValue={bugun} max={bugun} className={PORTAL_GIRDI} />
                      <AlanHatasi ad="tarih" />
                    </label>
                  </PortalFormu>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Stokta seri numarası kayıtlı cihazınız yok.</p>
        )}
      </section>

      <section aria-label="Satılan cihazlar" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <h2 className="text-[17px] font-extrabold">Müşterilerinizdeki cihazlar ({satilan.length})</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2 pr-3">Seri no</th><th className="py-2 pr-3">Müşteri</th><th className="py-2 pr-3">Lisans</th><th className="py-2">Durum</th></tr></thead>
            <tbody>
              {satilan.map((c) => (
                <tr key={c.seriNo} className="border-b border-bg last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-xs">{c.seriNo}<span className="block font-sans text-muted">{c.model}</span></td>
                  <td className="py-2.5 pr-3">{c.musteri}</td>
                  <td className="py-2.5 pr-3">{c.lisansBitis ? `${c.plan} · ${tarihTr(c.lisansBitis)}` : "Lisanssız"}</td>
                  <td className="py-2.5"><Chip ton={c.durum === "aktif" ? "ok" : c.durum === "bitiyor" ? "err" : "gray"}>{DURUM_ADI[c.durum]}</Chip></td>
                </tr>
              ))}
              {!satilan.length && <tr><td colSpan={4} className="py-6 text-center text-muted">Henüz kayıtlı satış yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
