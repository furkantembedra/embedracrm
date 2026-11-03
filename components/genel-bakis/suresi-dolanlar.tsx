// Lisansı 30 gün içinde bitecek müşteriler
import Link from "next/link";
import Card from "@/components/ui/card";
import Chip, { type ChipTon } from "@/components/ui/chip";
import { basHarfler } from "@/lib/format";

export type BitecekLisans = { musteri: string; plan: string; seriNo: string; gunKaldi: number };

const DEMO: BitecekLisans[] = [
  { musteri: "Akdeniz Direksiyon Servisi", plan: "Pro", seriNo: "EO1-2309-0142", gunKaldi: 4 },
  { musteri: "Bursa ECU Lab", plan: "Pro+", seriNo: "EO1-2310-0218", gunKaldi: 9 },
  { musteri: "Atelier Direction Lyon", plan: "Basic", seriNo: "EO1-2311-0301", gunKaldi: 12 },
  { musteri: "Ege Meslek Yüksekokulu", plan: "Pro · 4 cihaz", seriNo: "EO1-2311-0322", gunKaldi: 17 },
  { musteri: "Nordic Steering AB", plan: "Pro+", seriNo: "EO1-2312-0390", gunKaldi: 26 },
];

function ton(gun: number): ChipTon {
  if (gun <= 10) return "err";
  if (gun <= 20) return "warn";
  return "gray";
}

const AVATAR: Partial<Record<ChipTon, string>> = {
  err: "bg-err-bg text-err",
  warn: "bg-warn-bg text-warn",
  gray: "bg-bg text-[#474A42]",
};

export default function SuresiDolanlar({ veri = DEMO }: { veri?: BitecekLisans[] }) {
  const sirali = [...veri].sort((a, b) => a.gunKaldi - b.gunKaldi);

  return (
    <Card
      title="Süresi dolmak üzere"
      description="Bitiş tarihine göre sıralı · arayıp yenileyin"
      action={{ href: "/cihaz-lisans?filtre=suresi-doluyor", label: "Tümü" }}
    >
      {sirali.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">30 gün içinde bitecek lisans yok.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {sirali.map((l) => {
            const t = ton(l.gunKaldi);
            return (
              <li
                key={l.seriNo}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#F6F7F2]"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold ${AVATAR[t]}`}
                >
                  {basHarfler(l.musteri)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold">{l.musteri}</span>
                  <span className="truncate text-xs text-muted">
                    {l.plan} · {l.seriNo}
                  </span>
                </div>
                <Chip ton={t}>{l.gunKaldi} gün</Chip>
                <Link
                  href={`/cihaz-lisans/${l.seriNo}`}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold transition-colors hover:bg-[#F4F5F0]"
                >
                  Yenile
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
