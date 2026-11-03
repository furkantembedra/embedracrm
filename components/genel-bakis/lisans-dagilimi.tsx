// Basic / Pro / Pro+ halka grafiği
import Card from "@/components/ui/card";
import { sayi } from "@/lib/format";

export type LisansDagilimiVerisi = { basic: number; pro: number; proPlus: number };

const DEMO: LisansDagilimiVerisi = { basic: 473, pro: 586, proPlus: 187 };

const PLANLAR = [
  { anahtar: "basic", ad: "Basic", aciklama: "Temel direksiyon testleri", renk: "#C9CCC2" },
  { anahtar: "pro", ad: "Pro", aciklama: "Teşhis, flash, canlı veri", renk: "#0E0F0C" },
  { anahtar: "proPlus", ad: "Pro+", aciklama: "Pro + 2 cihaz", renk: "#2F4BFF" },
] as const;

const R = 54;
const CEVRE = 2 * Math.PI * R;
const BOSLUK = 2; // dilimler arası boşluk

export default function LisansDagilimi({ veri = DEMO }: { veri?: LisansDagilimiVerisi }) {
  const toplam = veri.basic + veri.pro + veri.proPlus;
  const proUstu = toplam ? Math.round(((veri.pro + veri.proPlus) / toplam) * 100) : 0;

  let baslangic = 0;
  const dilimler = PLANLAR.map((p) => {
    const uzunluk = toplam ? (veri[p.anahtar] / toplam) * CEVRE : 0;
    const dilim = { ...p, adet: veri[p.anahtar], baslangic, uzunluk: Math.max(uzunluk - BOSLUK, 0) };
    baslangic += uzunluk;
    return dilim;
  });

  return (
    <Card title="Lisans planı dağılımı" description={`${sayi(toplam)} aktif lisans`}>
      <div className="relative mx-auto h-[170px] w-[170px]">
        <svg
          viewBox="0 0 140 140"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={dilimler.map((d) => `${d.ad} ${d.adet}`).join(", ")}
        >
          {dilimler.map((d) => (
            <circle
              key={d.anahtar}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={d.renk}
              strokeWidth="16"
              strokeDasharray={`${d.uzunluk} ${CEVRE}`}
              strokeDashoffset={-d.baslangic}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-extrabold tabular-nums">%{proUstu}</span>
          <span className="text-[11px] font-semibold text-muted">Pro ve üstü</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        {dilimler.map((d) => (
          <li key={d.anahtar} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.renk }} />
            <span className="font-bold">{d.ad}</span>
            <span className="min-w-0 truncate text-muted">{d.aciklama}</span>
            <b className="ml-auto tabular-nums">{sayi(d.adet)}</b>
          </li>
        ))}
      </ul>

      <p className="rounded-[14px] bg-[#F4F5F0] px-3.5 py-3 text-xs leading-relaxed text-[#474A42]">
        <b className="text-ink">Yükseltme potansiyeli:</b> Basic plandaki {sayi(veri.basic)} müşteri, Pro ile
        flash ve canlı veriye erişebilir.
      </p>
    </Card>
  );
}
