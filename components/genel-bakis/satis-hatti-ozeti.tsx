// Aşama başına fırsat sayısı ve tutarı
import Card from "@/components/ui/card";
import { kisaTl } from "@/lib/format";

type Ton = "acik" | "orta" | "koyu" | "ink" | "lime";

export type HatAsamasi = { ad: string; adet: number; tutar: number; ton: Ton; kazanildi?: boolean };

const DEMO: HatAsamasi[] = [
  { ad: "Yeni lead", adet: 42, tutar: 3_100_000, ton: "acik" },
  { ad: "Demo planlandı", adet: 18, tutar: 1_900_000, ton: "orta" },
  { ad: "Teklif gönderildi", adet: 11, tutar: 1_400_000, ton: "koyu" },
  { ad: "Müzakere", adet: 6, tutar: 900_000, ton: "ink" },
  { ad: "Kazanıldı (bu ay)", adet: 9, tutar: 1_100_000, ton: "lime", kazanildi: true },
];

const RENK: Record<Ton, string> = {
  acik: "bg-[#E2E4DC] text-ink",
  orta: "bg-[#C9CCC2] text-ink",
  koyu: "bg-[#3A3C36] text-white",
  ink: "bg-ink text-white",
  lime: "bg-lime text-ink",
};

export default function SatisHattiOzeti({ veri = DEMO }: { veri?: HatAsamasi[] }) {
  const enCok = Math.max(1, ...veri.map((a) => a.adet));
  const acik = veri.filter((a) => !a.kazanildi);
  const acikTutar = acik.reduce((t, a) => t + a.tutar, 0);
  const acikAdet = acik.reduce((t, a) => t + a.adet, 0);

  return (
    <Card
      title="Satış hattı"
      description={`Açık fırsatlar ${kisaTl(acikTutar)} · ${acikAdet} fırsat`}
      action={{ href: "/satis-hatti", label: "Hattı aç" }}
    >
      <ul className="flex flex-col gap-3">
        {veri.map((a) => (
          <li key={a.ad} className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_76px] items-center gap-3">
            <span className="truncate text-[13px] font-semibold">{a.ad}</span>
            <div className="h-[30px] overflow-hidden rounded-lg bg-[#F4F5F0]">
              <div
                className={`flex h-full items-center rounded-lg px-2.5 text-xs font-bold tabular-nums ${RENK[a.ton]}`}
                style={{ width: `${Math.max((a.adet / enCok) * 100, 12)}%` }}
              >
                {a.adet}
              </div>
            </div>
            <span className="text-right text-[13px] font-bold tabular-nums">{kisaTl(a.tutar)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
