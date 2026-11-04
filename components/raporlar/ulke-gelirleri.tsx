// Ülkelere göre gelir: tek ölçü olduğu için tek renk; çubuk uzunluğu en yüksek ülkeye göre
import { kisaTl, tl } from "@/lib/format";
import type { UlkeGeliri } from "./queries";

export default function UlkeGelirleri({ ulkeler, donem }: { ulkeler: UlkeGeliri[]; donem: string }) {
  const enBuyuk = Math.max(1, ...ulkeler.map((u) => u.tutar));
  const toplam = ulkeler.reduce((t, u) => t + u.tutar, 0);
  return (
    <section aria-labelledby="ug-baslik" className="flex w-full min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="ug-baslik" className="text-[17px] font-extrabold">Ülkelere göre gelir</h2>
        <span className="text-xs font-semibold text-muted">{donem} · ilk {ulkeler.length} ülke {kisaTl(toplam)}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {ulkeler.map((u) => (
          <li key={u.kod} title={`${u.ad}: ${tl(u.tutar)}`} className="grid grid-cols-[34px_minmax(0,1fr)_76px] items-center gap-2.5">
            <b className="rounded-md bg-bg py-0.5 text-center text-xs">{u.kod}</b>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] font-semibold">{u.ad}</span>
              <div className="h-2 rounded-full bg-bg" aria-hidden="true">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, (u.tutar / enBuyuk) * 100)}%` }} />
              </div>
            </div>
            <b className="text-right text-[13px] tabular-nums">{kisaTl(u.tutar)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
