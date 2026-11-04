// Plan başına lisans sayısı
import Card from "@/components/ui/card";
import Chip from "@/components/ui/chip";
import { sayi } from "@/lib/format";
import { PLAN_ACIKLAMASI, type LisansPlani } from "./queries";
import { PLAN_TONU } from "./ortak";

export default function LisansPlanlari({ planlar }: { planlar: Record<LisansPlani, number> }) {
  return (
    <Card title="Lisans planları">
      <ul className="flex flex-col gap-2">
        {(Object.keys(PLAN_ACIKLAMASI) as LisansPlani[]).map((p) => (
          <li key={p} className="flex flex-col gap-1 rounded-[14px] bg-[#F4F5F0] p-3">
            <div className="flex items-center gap-2">
              <Chip ton={PLAN_TONU[p]}>{p}</Chip>
              <b className="ml-auto tabular-nums">{sayi(planlar[p])}</b>
            </div>
            <span className="text-xs text-[#474A42]">{PLAN_ACIKLAMASI[p]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
