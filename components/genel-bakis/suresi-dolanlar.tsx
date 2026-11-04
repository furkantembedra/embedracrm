"use client";

// Lisansı 30 gün içinde bitecek cihazlar (cihaz kayıtlarından). "Yenile" ortada lisans penceresini açar.
import { useCallback, useState } from "react";
import Card from "@/components/ui/card";
import Chip, { type ChipTon } from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { basHarfler } from "@/lib/format";
import { useBugun } from "@/lib/use-bugun";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import type { YeniLisans } from "@/components/cihaz-lisans/actions";
import { guncelDurum, kalanYaz, lisansIlerleme, lisansUygula, tarihYaz } from "@/components/cihaz-lisans/ortak";
import LisansFormu from "@/components/cihaz-lisans/lisans-formu";

function ton(gun: number | null): ChipTon {
  if (gun === null) return "gray";
  if (gun <= 10) return "err";
  if (gun <= 20) return "warn";
  return "gray";
}

const AVATAR: Partial<Record<ChipTon, string>> = {
  err: "bg-err-bg text-err",
  warn: "bg-warn-bg text-warn",
  gray: "bg-bg text-[#474A42]",
};

export default function SuresiDolanlar({ cihazlar: ilk }: { cihazlar: Cihaz[] }) {
  const bugun = useBugun();
  const [cihazlar, setCihazlar] = useState(ilk);
  const [seciliSeri, setSeciliSeri] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);

  const liste = cihazlar
    .filter((c) => guncelDurum(c, bugun) === "bitiyor")
    .map((c) => ({ c, kalan: lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun)?.kalan ?? null }))
    .sort((a, b) => (a.kalan ?? 0) - (b.kalan ?? 0) || (a.c.lisansBitis ?? "").localeCompare(b.c.lisansBitis ?? ""));

  const secili = cihazlar.find((c) => c.seriNo === seciliSeri) ?? null;

  const kapat = useCallback(() => setSeciliSeri(null), []);
  const kaydedildi = useCallback((l: YeniLisans) => {
    setCihazlar((l2) => l2.map((c) => lisansUygula(c, l)));
    setSeciliSeri(null);
    setBildirim(`${l.seriNo} için ${l.plan} lisansı ${tarihYaz(l.bitis)} tarihine kadar yenilendi.`);
  }, []);

  return (
    <Card
      title="Süresi dolmak üzere"
      description="Bitiş tarihine göre sıralı · arayıp yenileyin"
      action={{ href: "/cihaz-lisans", label: "Tümü" }}
    >
      {bildirim && (
        <p role="status" className="rounded-control bg-ok-bg px-3 py-2.5 text-[13px] font-semibold text-ok">{bildirim}</p>
      )}
      {liste.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">30 gün içinde bitecek lisans yok.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {liste.map(({ c, kalan }) => {
            const t = ton(kalan);
            return (
              <li key={c.seriNo} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#F6F7F2]">
                <span
                  aria-hidden="true"
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold ${AVATAR[t]}`}
                >
                  {basHarfler(c.musteri)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold">{c.musteri}</span>
                  <span className="truncate text-xs text-muted">{c.plan} · {c.seriNo}</span>
                </div>
                <Chip ton={t}>{kalan === null ? tarihYaz(c.lisansBitis) : kalanYaz(kalan)}</Chip>
                <button
                  type="button"
                  onClick={() => {
                    setBildirim(null);
                    setSeciliSeri(c.seriNo);
                  }}
                  aria-label={`${c.musteri} · ${c.seriNo} lisansını yenile`}
                  className="inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold transition-colors hover:bg-[#F4F5F0]"
                >
                  Yenile
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        acik={secili !== null}
        onKapat={kapat}
        baslik="Lisansı yenile"
        aciklama={secili ? `${secili.musteri} · ${secili.seriNo}` : undefined}
      >
        {secili && (
          <LisansFormu key={secili.seriNo} cihazlar={[secili]} seciliSeri={secili.seriNo} onKaydedildi={kaydedildi} onVazgec={kapat} />
        )}
      </Modal>
    </Card>
  );
}
