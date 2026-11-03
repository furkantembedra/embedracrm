// Son destek talepleri tablosu
import Link from "next/link";
import Card from "@/components/ui/card";
import Chip, { type ChipTon } from "@/components/ui/chip";

export type Oncelik = "Yüksek" | "Orta" | "Düşük";
export type SonTalep = { no: number; konu: string; musteri: string; oncelik: Oncelik; acilis: string };

const DEMO: SonTalep[] = [
  { no: 4821, konu: "Flash sonrası ECU yanıt vermiyor", musteri: "Volant Lenkung Service", oncelik: "Yüksek", acilis: "Bugün 09:02" },
  { no: 4819, konu: "Lisans aktivasyon kodu geçersiz", musteri: "Polska EPS Serwis", oncelik: "Yüksek", acilis: "Bugün 10:15" },
  { no: 4817, konu: "K-Line bağlantı hatası · Fiat Doblo", musteri: "Kaya Oto Elektronik", oncelik: "Orta", acilis: "Bugün 08:40" },
  { no: 4810, konu: "Yeni model talebi · Hyundai Tucson", musteri: "Başkent Rot & Direksiyon", oncelik: "Düşük", acilis: "31 Eki" },
];

const TON: Record<Oncelik, ChipTon> = { Yüksek: "err", Orta: "warn", Düşük: "gray" };

const TH = "border-b border-line px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-b border-bg px-2 py-3";

export default function SonTalepler({ veri = DEMO }: { veri?: SonTalep[] }) {
  return (
    <Card title="Son destek talepleri" action={{ href: "/destek", label: "Destek talepleri" }}>
      {veri.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Açık destek talebi yok.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className={TH}>No</th>
                <th scope="col" className={TH}>Konu</th>
                <th scope="col" className={TH}>Müşteri</th>
                <th scope="col" className={TH}>Öncelik</th>
                <th scope="col" className={`${TH} text-right`}>Açılış</th>
              </tr>
            </thead>
            <tbody>
              {veri.map((t) => (
                <tr key={t.no} className="transition-colors hover:bg-[#F6F7F2]">
                  <td className={`${TD} font-bold tabular-nums text-muted`}>#{t.no}</td>
                  <td className={TD}>
                    <Link href={`/destek/${t.no}`} className="font-semibold text-ink hover:underline">
                      {t.konu}
                    </Link>
                  </td>
                  <td className={`${TD} text-[#474A42]`}>{t.musteri}</td>
                  <td className={TD}>
                    <Chip ton={TON[t.oncelik]}>{t.oncelik}</Chip>
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right text-[#474A42]`}>{t.acilis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
