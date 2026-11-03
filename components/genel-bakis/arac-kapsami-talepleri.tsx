// En çok istenen yeni araç modelleri (destek taleplerinden)
import Card from "@/components/ui/card";
import Chip, { type ChipTon } from "@/components/ui/chip";

export type KapsamDurumu = "Ar-Ge’de" | "Planlandı" | "İnceleniyor";
export type KapsamTalebi = { model: string; sistem: string; adet: number; durum: KapsamDurumu };

const DEMO: KapsamTalebi[] = [
  { model: "Hyundai Tucson (NX4)", sistem: "Kolon tipi EPS · 2021+", adet: 23, durum: "Ar-Ge’de" },
  { model: "Volkswagen ID.4", sistem: "Kremayer EPS · MEB", adet: 17, durum: "Planlandı" },
  { model: "Toyota C-HR", sistem: "Kolon tipi EPS · 2023+", adet: 14, durum: "İnceleniyor" },
  { model: "Renault Clio V", sistem: "Kolon tipi EPS", adet: 11, durum: "İnceleniyor" },
];

const TON: Record<KapsamDurumu, ChipTon> = {
  "Ar-Ge’de": "info",
  Planlandı: "lime",
  İnceleniyor: "gray",
};

export default function AracKapsamiTalepleri({ veri = DEMO }: { veri?: KapsamTalebi[] }) {
  const sirali = [...veri].sort((a, b) => b.adet - a.adet);

  return (
    <Card title="Araç kapsamı talepleri" description="Destek taleplerinde işaretlenen yeni model istekleri">
      {sirali.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Henüz model talebi yok.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {sirali.map((k) => (
            <li
              key={k.model}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#F6F7F2]"
            >
              <span aria-hidden="true" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#F4F5F0]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v7M4 17l6-3M20 17l-6-3" />
                </svg>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-bold">{k.model}</span>
                <span className="truncate text-xs text-muted">{k.sistem}</span>
              </div>
              <Chip ton={TON[k.durum]}>{k.durum}</Chip>
              <b className="w-[68px] shrink-0 text-right text-sm tabular-nums">{k.adet} talep</b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
