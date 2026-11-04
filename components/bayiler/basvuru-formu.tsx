"use client";

// Yeni bayi başvurusu formu. Bayi sayfasında ortada açılan pencerede,
// /bayiler/yeni adresinde ise tek başına gösterilir.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { basvuruKaydet, type BasvuruFormDurumu } from "./actions";
import { ULKELER, type Basvuru } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const IKINCIL_BTN = "inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]";

function Hata({ mesaj, id }: { mesaj?: string; id: string }) {
  if (!mesaj) return null;
  return <span id={id} className="text-xs font-semibold text-err">{mesaj}</span>;
}

const ULKE_LISTESI = Object.entries(ULKELER).sort((a, b) => a[1].localeCompare(b[1], "tr"));

export default function BasvuruFormu({
  onKaydedildi,
  onVazgec,
}: {
  onKaydedildi?: (b: Basvuru) => void; // verilmezse kayıttan sonra başvurunun sayfasına gider
  onVazgec?: () => void;
}) {
  const router = useRouter();
  const [durum, gonder, bekliyor] = useActionState<BasvuruFormDurumu, FormData>(basvuruKaydet, {});
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<string | null>(null);
  const pencerede = Boolean(onKaydedildi);

  useEffect(() => {
    const b = durum.basvuru;
    if (!b || bildirildi.current === b.id) return;
    bildirildi.current = b.id;
    if (onKaydedildi) onKaydedildi(b);
    else router.push(`/bayiler/${b.id}`);
  }, [durum.basvuru, onKaydedildi, router]);

  const alan = (ad: string, etiket: string, ekstra: React.InputHTMLAttributes<HTMLInputElement> = {}, genis = false) => (
    <label className={`${ALAN} ${genis ? "sm:col-span-2" : ""}`}>
      {etiket}
      <input name={ad} className={GIRDI} aria-invalid={!!h[ad]} aria-describedby={`hata-${ad}`} {...ekstra} />
      <Hata id={`hata-${ad}`} mesaj={h[ad]} />
    </label>
  );

  return (
    <form
      action={gonder}
      noValidate
      className={pencerede ? "flex flex-col gap-5" : "flex max-w-3xl flex-col gap-5 rounded-card border border-line bg-card p-5"}
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-extrabold">Şirket</legend>
        {alan("sirket", "Şirket adı *", { autoFocus: true }, true)}
        <label className={ALAN}>
          Ülke *
          <select name="ulkeKodu" defaultValue="" className={GIRDI} aria-invalid={!!h.ulkeKodu} aria-describedby="hata-ulkeKodu">
            <option value="" disabled>Seçin…</option>
            {ULKE_LISTESI.map(([kod, ad]) => <option key={kod} value={kod}>{ad} ({kod})</option>)}
          </select>
          <Hata id="hata-ulkeKodu" mesaj={h.ulkeKodu} />
        </label>
        {alan("vergiNo", "Vergi no *")}
        {alan("bolge", "Talep edilen bölge", { placeholder: "Örn. Valencia + Murcia (boşsa tüm ülke)" })}
        {alan("ilkSiparis", "İlk sipariş (cihaz)", { type: "number", min: 0, inputMode: "numeric", placeholder: "Örn. 10" })}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-extrabold">Yetkili</legend>
        {alan("yetkili", "Ad soyad *", {}, true)}
        {alan("eposta", "E-posta *", { type: "email" })}
        {alan("telefon", "Telefon *", { type: "tel" })}
      </fieldset>

      <p className="text-xs text-muted">Başvuru “Başvuru” aşamasında açılır; uygunluk puanı değerlendirmede verilir.</p>

      <div className={`flex justify-end gap-2 ${pencerede ? "sticky bottom-0 -mx-5 -mb-5 border-t border-line bg-card px-5 py-4" : ""}`}>
        {onVazgec ? (
          <button type="button" onClick={onVazgec} className={IKINCIL_BTN}>Vazgeç</button>
        ) : (
          <Link href="/bayiler" className={IKINCIL_BTN}>Vazgeç</Link>
        )}
        <button
          type="submit"
          disabled={bekliyor}
          className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          {bekliyor ? "Kaydediliyor…" : "Başvuruyu kaydet"}
        </button>
      </div>
    </form>
  );
}
