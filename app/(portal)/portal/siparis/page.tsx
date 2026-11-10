import { tl } from "@/lib/format";
import { CIHAZ_MODELLERI } from "@/lib/urunler";
import { cihazTamAdi } from "@/components/teklifler/ortak";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { portalSiparisVer } from "@/components/portal/actions";
import PortalFormu, { AlanHatasi } from "@/components/portal/portal-formu";
import { PORTAL_ALAN, PORTAL_GIRDI } from "@/components/portal/stil";
import { bayiVerisi } from "@/components/portal/veri";

export default async function PortalSiparisPage() {
  const [v, fiyat] = await Promise.all([bayiVerisi(), getFiyatListesi()]);
  const indirim = v.basvuru?.sozlesme.moq.indirim ?? 0;
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Sipariş ver</h1>
        <p className="text-sm text-muted">Bayi iskontonuz: <b className="text-ink">%{indirim}</b> · Fiyatlar KDV hariç, TL. Ödeme proforma fatura ile.</p>
      </header>
      <section className="rounded-card border border-line bg-card p-5">
        <PortalFormu islem={portalSiparisVer} buton="Siparişi gönder">
          <div className="grid gap-4 sm:grid-cols-2">
            {CIHAZ_MODELLERI.map((m) => {
              const liste = fiyat.cihaz[m];
              const net = Math.round(liste * (1 - indirim / 100));
              return (
                <label key={m} className={PORTAL_ALAN}>
                  <span>{cihazTamAdi(m)} <span className="font-normal text-muted">· liste {tl(liste)} → bayi {tl(net)}</span></span>
                  <input name={`adet-${m}`} type="number" min={0} max={500} defaultValue={0} inputMode="numeric" className={PORTAL_GIRDI} />
                  <AlanHatasi ad={m} />
                </label>
              );
            })}
            <label className={`${PORTAL_ALAN} sm:col-span-2`}>
              Not
              <textarea name="not" rows={2} maxLength={300} placeholder="Teslim adresi farklıysa, acil durum…" className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
            </label>
          </div>
        </PortalFormu>
      </section>
    </>
  );
}
