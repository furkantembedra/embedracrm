"use client";

// Başvuru için görüşme tarihi ve kısa gündem notu
import { useActionState, useEffect, useRef } from "react";
import { gorusmeKaydet, type GorusmeFormDurumu } from "./actions";
import type { Basvuru } from "./queries";

const GIRDI = "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

export default function GorusmeFormu({
  basvuru,
  onKaydedildi,
  onVazgec,
}: {
  basvuru: Basvuru;
  onKaydedildi: (id: string, gorusme: NonNullable<Basvuru["gorusme"]>) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<GorusmeFormDurumu, FormData>(gorusmeKaydet, {});
  const bildirildi = useRef<number | null>(null);

  useEffect(() => {
    if (!durum.gorusme || !durum.id || !durum.zaman || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman;
    onKaydedildi(durum.id, durum.gorusme);
  }, [durum, onKaydedildi]);

  return (
    <form action={gonder} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="id" value={basvuru.id} />
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Tarih ve saat *
        <input
          type="datetime-local"
          name="tarih"
          defaultValue={basvuru.gorusme?.tarih}
          autoFocus
          className={GIRDI}
          aria-invalid={!!durum.hata}
          aria-describedby="gorusme-hata"
        />
        {durum.hata && <span id="gorusme-hata" className="text-xs font-semibold text-err">{durum.hata}</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Gündem
        <input name="not" defaultValue={basvuru.gorusme?.not} placeholder="Örn. MOQ ve bölge hakkı" className={GIRDI} />
      </label>
      <p className="text-xs text-muted">Takvim daveti otomatik gönderilmez; {basvuru.yetkili} ile ayrıca paylaşın.</p>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          Vazgeç
        </button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Görüşmeyi kaydet"}
        </button>
      </div>
    </form>
  );
}
