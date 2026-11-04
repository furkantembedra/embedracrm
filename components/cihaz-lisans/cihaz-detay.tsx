"use client";

// Tek cihazın bilgileri, lisans geçmişi ve lisans yenileme formu
import Link from "next/link";
import { useCallback, useState } from "react";
import { Cpu } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import type { YeniLisans } from "./actions";
import { DURUM_ADI, type Cihaz } from "./queries";
import { DURUM_TONU, PLAN_TONU, eskiFirmware, guncelDurum, kalanYaz, lisansIlerleme, lisansUygula, tarihYaz } from "./ortak";
import LisansFormu from "./lisans-formu";

export default function CihazDetay({ cihaz: ilk }: { cihaz: Cihaz }) {
  const bugun = useBugun();
  const [c, setC] = useState(ilk);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const durum = guncelDurum(c, bugun);
  const ilerleme = lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun);

  const kaydedildi = useCallback((l: YeniLisans) => {
    setC((onceki) => lisansUygula(onceki, l));
    setBildirim(`${l.plan} lisansı ${tarihYaz(l.bitis)} tarihine kadar tanımlandı.`);
  }, []);

  const bilgiler: [string, React.ReactNode][] = [
    ["Müşteri", c.musteriId ? <Link href={`/musteriler/${c.musteriId}`} className="hover:underline">{c.musteri}</Link> : c.musteri],
    ["Ülke", c.ulke],
    ["Firmware", <span key="fw" className="inline-flex items-center gap-2 font-mono text-xs">{c.firmware}{eskiFirmware(c.firmware) && <Chip ton="warn" className="h-5 px-2 text-[11px]">Eski</Chip>}</span>],
    ["Aktivasyon", tarihYaz(c.lisansBaslangic)],
    ["Lisans bitişi", tarihYaz(c.lisansBitis)],
    ["Kalan", ilerleme ? kalanYaz(ilerleme.kalan) : "—"],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <section aria-label="Cihaz bilgileri" className="flex flex-col gap-5 rounded-card border border-line bg-card p-5">
        <div className="flex items-start gap-3.5">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-lime">
            <Cpu size={26} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-mono text-[17px] font-bold">{c.seriNo}</h2>
            <span className="text-[13px] text-muted">EmbedraONE</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Chip ton={PLAN_TONU[c.plan]}>{c.plan}</Chip>
              <Chip ton={DURUM_TONU[durum]}>{DURUM_ADI[durum]}</Chip>
            </div>
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
          {bilgiler.map(([etiket, deger]) => (
            <div key={etiket} className="flex justify-between gap-3">
              <dt className="text-muted">{etiket}</dt>
              <dd className="min-w-0 truncate text-right font-semibold">{deger}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-extrabold">Lisans geçmişi</h3>
          {c.gecmis.length === 0 ? (
            <p className="text-[13px] text-muted">Henüz lisans tanımlanmadı.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {c.gecmis.map((l, i) => (
                <li key={`${l.baslangic}-${i}`} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5 text-[13px]">
                  <Chip ton={PLAN_TONU[l.plan]}>{l.plan}</Chip>
                  <span className="tabular-nums">{tarihYaz(l.baslangic)} – {tarihYaz(l.bitis)}</span>
                  {i === 0 && c.lisansBitis === l.bitis && <span className="ml-auto text-xs font-bold text-ok">Geçerli</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      {bildirim && (
        <p role="status" className="rounded-control bg-ok-bg px-4 py-3 text-[13px] font-semibold text-ok">{bildirim}</p>
      )}

      <LisansFormu key={c.lisansBitis ?? "yok"} cihazlar={[c]} seciliSeri={c.seriNo} onKaydedildi={kaydedildi} />
    </div>
  );
}
