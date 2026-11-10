import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { ASAMA_BILGI, KAPALI_ASAMALAR, KAYIP_NEDENLERI, getFirsatlar } from "@/components/satis-hatti/queries";
import { portalLeadGuncelle } from "@/components/portal/actions";
import PortalFormu, { AlanHatasi } from "@/components/portal/portal-formu";
import { PORTAL_GIRDI } from "@/components/portal/stil";
import { bayiVerisi, tarihTr } from "@/components/portal/veri";

export default async function PortalLeadlerPage() {
  const v = await bayiVerisi();
  const leadler = (await getFirsatlar()).filter((f) => f.bayiId === v.bayi.id);
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Lead&apos;lerim</h1>
        <p className="text-sm text-muted">Embedra&apos;nın bölgenize yönlendirdiği potansiyel müşteriler. Görüştükçe durumu güncelleyin.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {leadler.map((f) => {
          const kapali = KAPALI_ASAMALAR.includes(f.asama);
          return (
            <li key={f.id} className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-base">{f.firma}</b>
                <span className="text-sm text-muted">{f.konum}</span>
                <Chip ton={f.asama === "kazanildi" ? "lime" : f.asama === "kaybedildi" ? "err" : "info"}>{ASAMA_BILGI[f.asama].ad}</Chip>
                <span className="ml-auto text-sm font-bold tabular-nums">{f.tutar ? tl(f.tutar) : ""}</span>
              </div>
              <p className="text-[13px] text-[#474A42]">{f.icerik} · Son durum: {f.sonrakiAdim} ({tarihTr(f.sonrakiTarih)})</p>
              {!kapali && (
                <PortalFormu islem={portalLeadGuncelle} buton="Güncelle" ikincil className="grid gap-2 sm:grid-cols-[200px_1fr_200px_auto] sm:items-start">
                  <input type="hidden" name="id" value={f.id} />
                  <label className="flex flex-col gap-1 text-xs font-bold">
                    Aşama
                    <select name="asama" defaultValue={f.asama} className={PORTAL_GIRDI}>
                      {(["yeni", "demo", "teklif", "muzakere", "kazanildi", "kaybedildi"] as const).map((a) => <option key={a} value={a}>{ASAMA_BILGI[a].ad}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold">
                    Son durum notu
                    <input name="not" placeholder="Örn. Demo yapıldı, fiyat bekliyor" className={PORTAL_GIRDI} />
                    <AlanHatasi ad="not" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold">
                    Kayıp nedeni <span className="font-normal text-muted">(kaybedildiyse)</span>
                    <select name="neden" defaultValue="" className={PORTAL_GIRDI}>
                      <option value="">—</option>
                      {KAYIP_NEDENLERI.map((n) => <option key={n}>{n}</option>)}
                    </select>
                    <AlanHatasi ad="neden" />
                  </label>
                </PortalFormu>
              )}
            </li>
          );
        })}
        {!leadler.length && <li className="rounded-card border border-line bg-card p-8 text-center text-sm text-muted">Size yönlendirilmiş lead yok.</li>}
      </ul>
    </>
  );
}
