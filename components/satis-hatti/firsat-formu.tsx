"use client";

// Yeni fırsat formu (sağdan açılan panelin içinde gösterilir)
import { useActionState, useEffect, useRef } from "react";
import { firsatKaydet, type AsamaSonucu, type FirsatFormDurumu } from "./actions";
import { ASAMALAR, ASAMA_BILGI, KAYNAKLAR, type Asama, type Firsat } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

function Hata({ id, mesaj }: { id: string; mesaj?: string }) {
  return mesaj ? <span id={id} className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

export default function FirsatFormu({
  baslangicAsamasi = "yeni",
  onKaydedildi,
  onVazgec,
}: {
  baslangicAsamasi?: Asama;
  onKaydedildi: (f: Firsat, musteri?: AsamaSonucu["musteri"]) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<FirsatFormDurumu, FormData>(firsatKaydet, {});
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<string | null>(null);

  useEffect(() => {
    if (durum.firsat && bildirildi.current !== durum.firsat.id) {
      bildirildi.current = durum.firsat.id;
      onKaydedildi(durum.firsat, durum.musteri);
    }
  }, [durum.firsat, durum.musteri, onKaydedildi]);

  return (
    <form action={gonder} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${ALAN} sm:col-span-2`}>
          Firma *
          <input name="firma" autoFocus className={GIRDI} aria-invalid={!!h.firma} aria-describedby="hata-firma" />
          <Hata id="hata-firma" mesaj={h.firma} />
        </label>
        <label className={ALAN}>
          Konum
          <input name="konum" placeholder="Şehir, ülke" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Kaynak *
          <select name="kaynak" defaultValue="" className={GIRDI} aria-invalid={!!h.kaynak} aria-describedby="hata-kaynak">
            <option value="" disabled>Seçin…</option>
            {KAYNAKLAR.map((k) => <option key={k}>{k}</option>)}
          </select>
          <Hata id="hata-kaynak" mesaj={h.kaynak} />
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          İçerik
          <input name="icerik" placeholder="Örn. 2× ONE + Pro+ lisans" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Tutar (TL) *
          <input name="tutar" inputMode="numeric" className={GIRDI} aria-invalid={!!h.tutar} aria-describedby="hata-tutar" />
          <Hata id="hata-tutar" mesaj={h.tutar} />
        </label>
        <label className={ALAN}>
          Aşama *
          <select name="asama" defaultValue={baslangicAsamasi} className={GIRDI} aria-invalid={!!h.asama}>
            {ASAMALAR.map((a) => <option key={a} value={a}>{ASAMA_BILGI[a].ad}</option>)}
          </select>
          <Hata id="hata-asama" mesaj={h.asama} />
        </label>
        <label className={ALAN}>
          Sonraki adım
          <input name="sonrakiAdim" placeholder="Örn. Demo planla" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Sonraki adım tarihi *
          <input name="sonrakiTarih" type="date" className={GIRDI} aria-invalid={!!h.sonrakiTarih} aria-describedby="hata-tarih" />
          <Hata id="hata-tarih" mesaj={h.sonrakiTarih} />
        </label>
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-line bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          Vazgeç
        </button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Fırsatı kaydet"}
        </button>
      </div>
    </form>
  );
}
