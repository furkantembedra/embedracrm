// Lead kaynağı dağılımı (yatay çubuklar)
import Card from "@/components/ui/card";
import { sayi } from "@/lib/format";

export type LeadKaynaklariVerisi = {
  donem: string;
  toplam: number;
  kaynaklar: { ad: string; yuzde: number }[];
};

const DEMO: LeadKaynaklariVerisi = {
  donem: "Ekim",
  toplam: 214,
  kaynaklar: [
    { ad: "Web sitesi", yuzde: 38 },
    { ad: "WhatsApp", yuzde: 24 },
    { ad: "Instagram", yuzde: 17 },
    { ad: "Bayi yönlendirmesi", yuzde: 13 },
    { ad: "Fuar & etkinlik", yuzde: 8 },
  ],
};

const RENKLER = ["bg-ink", "bg-[#3A3C36]", "bg-blue", "bg-lime-dark", "bg-[#C9CCC2]"];

export default function LeadKaynaklari({ veri = DEMO }: { veri?: LeadKaynaklariVerisi }) {
  return (
    <Card title="Lead kaynakları" description={`${veri.donem} · ${sayi(veri.toplam)} yeni lead`}>
      <ul className="flex flex-col gap-3.5">
        {veri.kaynaklar.map((k, i) => (
          <li key={k.ad} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="font-semibold">{k.ad}</span>
              <b className="tabular-nums">%{k.yuzde}</b>
            </div>
            <div
              role="progressbar"
              aria-label={k.ad}
              aria-valuenow={k.yuzde}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 rounded-full bg-bg"
            >
              <div
                className={`h-full rounded-full ${RENKLER[i % RENKLER.length]}`}
                style={{ width: `${Math.min(k.yuzde, 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
