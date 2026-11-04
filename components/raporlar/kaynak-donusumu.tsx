// Lead kaynağına göre dönüşüm: oran büyükten küçüğe, çubuk en yüksek orana göre
import type { KaynakDonusumu as Kaynak } from "./queries";

export default function KaynakDonusumu({ kaynaklar }: { kaynaklar: Kaynak[] }) {
  const satirlar = kaynaklar
    .map((k) => ({ ...k, oran: k.lead ? Math.round((k.musteri / k.lead) * 100) : 0 }))
    .sort((a, b) => b.oran - a.oran);
  const enBuyuk = Math.max(1, ...satirlar.map((s) => s.oran));

  return (
    <section aria-labelledby="kd-baslik" className="flex w-full min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="kd-baslik" className="text-[17px] font-extrabold">Lead kaynağına göre dönüşüm</h2>
        <span className="text-xs font-semibold text-muted">Lead kaydındaki “kaynak” alanına göre</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {satirlar.map((s) => (
          <li key={s.ad} className="flex flex-col gap-1 rounded-[14px] border border-line p-3">
            <div className="flex justify-between gap-2 text-[13px]">
              <b>{s.ad}</b>
              <b className="tabular-nums">%{s.oran}</b>
            </div>
            <div className="h-1.5 rounded-full bg-bg" aria-hidden="true">
              <div className="h-full rounded-full bg-ink" style={{ width: `${(s.oran / enBuyuk) * 100}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted">{s.lead} lead · {s.musteri} müşteri</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
