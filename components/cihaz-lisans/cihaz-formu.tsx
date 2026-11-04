"use client";

// Yeni cihaz kaydı formu. Cihaz & Lisans sayfasında ortada açılan pencerenin içinde,
// /cihaz-lisans/yeni adresinde ise tek başına gösterilir.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { cihazKaydet, type CihazFormDurumu } from "./actions";
import type { Cihaz } from "./queries";
import { CIHAZ_MODELLERI, URUN_BILGI } from "@/lib/urunler";
import { tl } from "@/lib/format";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const IKINCIL_BTN = "inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

function Hata({ mesaj, id }: { mesaj?: string; id: string }) {
  if (!mesaj) return null;
  return <span id={id} className="text-xs font-semibold text-err">{mesaj}</span>;
}

export type MusteriSecenegi = { id: string; ad: string; ulke: string };

export default function CihazFormu({
  musteriler,
  mevcutSeriler = [],
  onKaydedildi,
  onVazgec,
}: {
  musteriler: MusteriSecenegi[];
  mevcutSeriler?: string[]; // Supabase bağlanınca benzersizlik veritabanında kontrol edilir

  onKaydedildi?: (c: Cihaz) => void; // verilmezse kayıttan sonra /cihaz-lisans'a gider
  onVazgec?: () => void;
}) {
  const router = useRouter();
  const [durum, gonder, bekliyor] = useActionState<CihazFormDurumu, FormData>(cihazKaydet, {});
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<string | null>(null);
  const pencerede = Boolean(onKaydedildi);

  useEffect(() => {
    const c = durum.cihaz;
    if (!c || bildirildi.current === c.seriNo) return;
    bildirildi.current = c.seriNo;
    if (onKaydedildi) onKaydedildi(c);
    else router.push("/cihaz-lisans");
  }, [durum.cihaz, onKaydedildi, router]);

  return (
    <form
      action={gonder}
      noValidate
      className={pencerede ? "flex flex-col gap-5" : "flex max-w-3xl flex-col gap-5 rounded-card border border-line bg-card p-5"}
    >
      <input type="hidden" name="mevcut" value={mevcutSeriler.join(",")} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-extrabold">Cihaz</legend>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-bold">Model *</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CIHAZ_MODELLERI.map((m) => (
              <label
                key={m}
                className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-control border border-line-strong p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-[#F4F5F0]"
              >
                <input type="radio" name="model" value={m} defaultChecked={m === "ONE"} className="mt-0.5 accent-[#0E0F0C]" />
                <span className="flex flex-col gap-0.5">
                  <b>{URUN_BILGI[m].ad}</b>
                  <span className="text-xs text-muted">{URUN_BILGI[m].ekran} · {tl(URUN_BILGI[m].fiyat)} + KDV</span>
                </span>
              </label>
            ))}
          </div>
          <Hata id="hata-model" mesaj={h.model} />
        </fieldset>
        <label className={ALAN}>
          Seri no *
          <input
            name="seriNo"
            autoFocus
            placeholder="EO1-2411-0001"
            className={`${GIRDI} font-mono uppercase`}
            aria-invalid={!!h.seriNo}
            aria-describedby="hata-seriNo"
          />
          <Hata id="hata-seriNo" mesaj={h.seriNo} />
        </label>
        <label className={ALAN}>
          Firmware *
          <input name="firmware" defaultValue="v2.4.1" className={`${GIRDI} font-mono`} aria-invalid={!!h.firmware} aria-describedby="hata-firmware" />
          <Hata id="hata-firmware" mesaj={h.firmware} />
        </label>
        <label className={ALAN}>
          Müşteri *
          <select name="musteri" defaultValue="" className={GIRDI} aria-invalid={!!h.musteri} aria-describedby="hata-musteri">
            <option value="" disabled>Seçin</option>
            {musteriler.map((m) => (
              <option key={m.id} value={`${m.id}|${m.ad}|${m.ulke}`}>{m.ad}</option>
            ))}
          </select>
          <Hata id="hata-musteri" mesaj={h.musteri} />
        </label>
        <label className={ALAN}>
          Planlanan lisans
          <select name="plan" defaultValue="Pro" className={GIRDI} aria-invalid={!!h.plan}>
            <option>Basic</option>
            <option>Pro</option>
            <option>Pro+</option>
          </select>
          <Hata id="hata-plan" mesaj={h.plan} />
        </label>
      </fieldset>
      <p className="text-xs text-muted">Cihaz lisanssız kaydedilir; lisansı listeden “Lisans tanımla” ile verebilirsiniz.</p>

      <div className={`flex justify-end gap-2 ${pencerede ? "sticky bottom-0 -mx-5 bg-card px-5 py-4" : ""}`}>
        {onVazgec ? (
          <button type="button" onClick={onVazgec} className={IKINCIL_BTN}>Vazgeç</button>
        ) : (
          <Link href="/cihaz-lisans" className={IKINCIL_BTN}>Vazgeç</Link>
        )}
        <button
          type="submit"
          disabled={bekliyor}
          className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          {bekliyor ? "Kaydediliyor…" : "Cihazı kaydet"}
        </button>
      </div>
    </form>
  );
}
