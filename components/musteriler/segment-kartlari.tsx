// Segment filtre kartları: tümü, servis, mühendislik, eğitim, bayi
import { sayi } from "@/lib/format";
import type { Segment } from "./queries";

export type SegmentSecimi = Segment | "tumu";

const KARTLAR: { id: SegmentSecimi; ad: string }[] = [
  { id: "tumu", ad: "Tüm hesaplar" },
  { id: "servis", ad: "Servis & atölye" },
  { id: "muhendislik", ad: "Mühendislik ekibi" },
  { id: "egitim", ad: "Eğitim kurumu" },
  { id: "bayi", ad: "Bayi & distribütör" },
];

export default function SegmentKartlari({
  secili,
  sayilar,
  onSec,
}: {
  secili: SegmentSecimi;
  sayilar: Record<SegmentSecimi, number>;
  onSec: (s: SegmentSecimi) => void;
}) {
  return (
    <div role="group" aria-label="Segment filtresi" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {KARTLAR.map((k) => {
        const aktif = k.id === secili;
        return (
          <button
            key={k.id}
            type="button"
            aria-pressed={aktif}
            onClick={() => onSec(k.id)}
            className={`flex cursor-pointer flex-col gap-2 rounded-[18px] border p-4 text-left transition-colors ${
              aktif ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-[#F6F7F2]"
            }`}
          >
            <span className={`text-xs font-semibold ${aktif ? "text-[#C3C6BC]" : "text-muted"}`}>{k.ad}</span>
            <span className="text-2xl font-extrabold tabular-nums">{sayi(sayilar[k.id])}</span>
          </button>
        );
      })}
    </div>
  );
}
