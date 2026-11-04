"use client";

// Lisans tanımlama / yenileme formu. Liste sayfasında ortada açılan pencerede,
// cihaz detayında ise sayfanın içinde gösterilir.
import { useActionState, useEffect, useRef, useState } from "react";
import { useBugun } from "@/lib/use-bugun";
import { lisansTanimla, type LisansFormDurumu, type YeniLisans } from "./actions";
import type { Cihaz } from "./queries";
import { ayEkle, tarihYaz } from "./ortak";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

function Hata({ mesaj, id }: { mesaj?: string; id: string }) {
  if (!mesaj) return null;
  return <span id={id} className="text-xs font-semibold text-err">{mesaj}</span>;
}

const isoGun = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Süresi devam eden lisans bitişinden, bitmişse bugünden başlar. */
function varsayilanBaslangic(c: Cihaz | undefined, bugun: number | null) {
  if (bugun === null) return "";
  const bugunIso = isoGun(bugun);
  if (c?.lisansBitis && c.lisansBitis > bugunIso) return c.lisansBitis;
  return bugunIso;
}

export default function LisansFormu({
  cihazlar,
  seciliSeri,
  onKaydedildi,
  onVazgec,
}: {
  cihazlar: Cihaz[];
  seciliSeri?: string;
  onKaydedildi: (l: YeniLisans) => void;
  onVazgec?: () => void;
}) {
  const bugun = useBugun();
  const [durum, gonder, bekliyor] = useActionState<LisansFormDurumu, FormData>(lisansTanimla, {});
  const [seri, setSeri] = useState(seciliSeri ?? cihazlar[0]?.seriNo ?? "");
  const [baslangic, setBaslangic] = useState<string | null>(null);
  const [sure, setSure] = useState(12);
  const bildirildi = useRef<number | null>(null);
  const h = durum.hatalar ?? {};
  const cihaz = cihazlar.find((c) => c.seriNo === seri);
  const tekCihaz = cihazlar.length === 1;
  const pencerede = Boolean(onVazgec);
  const bas = baslangic ?? varsayilanBaslangic(cihaz, bugun);

  useEffect(() => {
    if (!durum.lisans || !durum.zaman || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman;
    onKaydedildi(durum.lisans);
  }, [durum, onKaydedildi]);

  return (
    <form
      action={gonder}
      noValidate
      className={pencerede ? "flex flex-col gap-5" : "flex flex-col gap-4 rounded-card border border-line bg-card p-5"}
    >
      {!pencerede && <h2 className="text-[17px] font-extrabold">Lisans tanımla / yenile</h2>}

      <div className="grid gap-4 sm:grid-cols-2">
        {tekCihaz ? (
          <input type="hidden" name="seriNo" value={seri} />
        ) : (
          <label className={`${ALAN} sm:col-span-2`}>
            Cihaz *
            <select
              name="seriNo"
              value={seri}
              onChange={(e) => {
                setSeri(e.target.value);
                setBaslangic(null);
              }}
              className={GIRDI}
              aria-invalid={!!h.seriNo}
              aria-describedby="hata-seriNo"
            >
              {cihazlar.map((c) => (
                <option key={c.seriNo} value={c.seriNo}>{c.seriNo} · {c.musteri}</option>
              ))}
            </select>
            <Hata id="hata-seriNo" mesaj={h.seriNo} />
          </label>
        )}

        <label className={ALAN}>
          Plan *
          <select key={seri} name="plan" defaultValue={cihaz?.plan ?? "Pro"} className={GIRDI} aria-invalid={!!h.plan}>
            <option>Basic</option>
            <option>Pro</option>
            <option>Pro+</option>
          </select>
          <Hata id="hata-plan" mesaj={h.plan} />
        </label>

        <label className={ALAN}>
          Süre *
          <select name="sure" value={sure} onChange={(e) => setSure(Number(e.target.value))} className={GIRDI} aria-invalid={!!h.sure}>
            <option value={12}>12 ay</option>
            <option value={24}>24 ay</option>
            <option value={36}>36 ay</option>
          </select>
          <Hata id="hata-sure" mesaj={h.sure} />
        </label>

        <label className={ALAN}>
          Başlangıç *
          <input
            type="date"
            name="baslangic"
            value={bas}
            onChange={(e) => setBaslangic(e.target.value)}
            className={GIRDI}
            aria-invalid={!!h.baslangic}
            aria-describedby="hata-baslangic"
          />
          <Hata id="hata-baslangic" mesaj={h.baslangic} />
        </label>

        <div className="flex flex-col gap-1.5 text-[13px]">
          <span className="font-bold">Bitiş</span>
          <span className="flex min-h-11 items-center rounded-control bg-[#F4F5F0] px-3 font-semibold tabular-nums">
            {bas ? tarihYaz(ayEkle(bas, sure)) : "—"}
          </span>
        </div>
      </div>

      {cihaz?.lisansBitis && (
        <p className="text-xs text-muted">
          Mevcut lisans: {cihaz.plan} · {tarihYaz(cihaz.lisansBitis)} tarihinde bitiyor
        </p>
      )}

      <div className={`flex justify-end gap-2 ${pencerede ? "sticky bottom-0 -mx-5 -mb-5 border-t border-line bg-card px-5 py-4" : ""}`}>
        {onVazgec && (
          <button
            type="button"
            onClick={onVazgec}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]"
          >
            Vazgeç
          </button>
        )}
        <button
          type="submit"
          disabled={bekliyor || !cihaz}
          className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          {bekliyor ? "Kaydediliyor…" : "Lisansı kaydet"}
        </button>
      </div>
    </form>
  );
}
