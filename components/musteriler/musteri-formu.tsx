"use client";

// Yeni müşteri formu. Müşteriler sayfasında ortada açılan pencerenin içinde,
// /musteriler/yeni adresinde ise tek başına gösterilir.
import { IZIN_KANALLARI, IZIN_KANAL_ADI, IZIN_KAYNAKLARI } from "./izin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { musteriKaydet, type FormDurumu } from "./actions";
import type { Musteri } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const IKINCIL_BTN = "inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]";

function Hata({ mesaj, id }: { mesaj?: string; id: string }) {
  if (!mesaj) return null;
  return <span id={id} className="text-xs font-semibold text-err">{mesaj}</span>;
}

export default function MusteriFormu({
  onKaydedildi,
  onVazgec,
}: {
  onKaydedildi?: (m: Musteri) => void; // verilmezse kayıttan sonra /musteriler'e gider
  onVazgec?: () => void;
}) {
  const router = useRouter();
  const [durum, gonder, bekliyor] = useActionState<FormDurumu, FormData>(musteriKaydet, {});
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<string | null>(null);
  const pencerede = Boolean(onKaydedildi);

  useEffect(() => {
    const m = durum.musteri;
    if (!m || bildirildi.current === m.id) return;
    bildirildi.current = m.id;
    if (onKaydedildi) onKaydedildi(m);
    else router.push("/musteriler");
  }, [durum.musteri, onKaydedildi, router]);

  return (
    <form
      action={gonder}
      noValidate
      className={pencerede ? "flex flex-col gap-5" : "flex max-w-3xl flex-col gap-5 rounded-card border border-line bg-card p-5"}
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-extrabold">Firma</legend>
        <label className={`${ALAN} sm:col-span-2`}>
          Firma adı *
          <input name="ad" autoFocus className={GIRDI} aria-invalid={!!h.ad} aria-describedby="hata-ad" />
          <Hata id="hata-ad" mesaj={h.ad} />
        </label>
        <label className={ALAN}>
          Segment
          <select name="segment" className={GIRDI} defaultValue="servis" aria-invalid={!!h.segment}>
            <option value="servis">Servis & atölye</option>
            <option value="muhendislik">Mühendislik ekibi</option>
            <option value="egitim">Eğitim kurumu</option>
            <option value="bayi">Bayi & distribütör</option>
          </select>
          <Hata id="hata-segment" mesaj={h.segment} />
        </label>
        <label className={ALAN}>
          Plan
          <select name="plan" className={GIRDI} defaultValue="Lead" aria-invalid={!!h.plan}>
            <option>Lead</option>
            <option>Basic</option>
            <option>Pro</option>
            <option>Pro+</option>
          </select>
          <Hata id="hata-plan" mesaj={h.plan} />
        </label>
        <label className={ALAN}>
          Şehir
          <input name="sehir" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Ülke
          <input name="ulke" className={GIRDI} defaultValue="Türkiye" />
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Vergi no
          <input name="vergiNo" className={GIRDI} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-extrabold">İletişim</legend>
        <label className={`${ALAN} sm:col-span-2`}>
          Yetkili kişi
          <input name="yetkili" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Telefon
          <input name="telefon" type="tel" className={GIRDI} aria-invalid={!!h.telefon} aria-describedby="hata-telefon" />
          <Hata id="hata-telefon" mesaj={h.telefon} />
        </label>
        <label className={ALAN}>
          E-posta
          <input name="eposta" type="email" className={GIRDI} aria-invalid={!!h.eposta} aria-describedby="hata-eposta" />
          <Hata id="hata-eposta" mesaj={h.eposta} />
        </label>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-bold">Duyuru ve kampanya izni <span className="font-normal text-muted">(yetkili kişi için, kanal bazında)</span></legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {IZIN_KANALLARI.map((k) => (
              <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" name={`izin_${k}`} className="h-4.5 w-4.5 accent-[#0E0F0C]" />
                {IZIN_KANAL_ADI[k]}
              </label>
            ))}
          </div>
          <label className={ALAN}>
            İzin nereden alındı
            <select name="izinKaynagi" defaultValue="Müşteri formu" className={GIRDI}>
              {IZIN_KAYNAKLARI.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
        </fieldset>
      </fieldset>

      <label className={ALAN}>
        Not
        <textarea name="not" rows={3} className={`${GIRDI} resize-y py-2.5`} />
      </label>

      <div className={`flex justify-end gap-2 ${pencerede ? "sticky bottom-0 -mx-5 bg-card px-5 py-4" : ""}`}>
        {onVazgec ? (
          <button type="button" onClick={onVazgec} className={IKINCIL_BTN}>Vazgeç</button>
        ) : (
          <Link href="/musteriler" className={IKINCIL_BTN}>Vazgeç</Link>
        )}
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Müşteriyi kaydet"}
        </button>
      </div>
    </form>
  );
}
