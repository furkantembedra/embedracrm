"use client";

// Talebe not ve dosya ekleme; aynı formdan beklemeye alma, çözme ve yeniden açma
import { useActionState, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { notKaydet, type NotFormDurumu } from "./actions";
import { dosyaSecildi } from "./ortak";
import type { TalepDurumu, TalepNotu } from "./queries";

const IKINCIL_BTN =
  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-3.5 text-sm font-bold transition-colors hover:bg-[#F4F5F0] disabled:opacity-60";

export default function NotFormu({
  talepId,
  durum,
  onKaydedildi,
}: {
  talepId: string;
  durum: TalepDurumu;
  onKaydedildi: (not: TalepNotu, durum?: TalepDurumu) => void;
}) {
  const [sonuc, gonder, bekliyor] = useActionState<NotFormDurumu, FormData>(notKaydet, {});
  const [dosya, setDosya] = useState<string | null>(null);
  const [dosyaHata, setDosyaHata] = useState<string | null>(null);
  const bildirilen = useRef<TalepNotu | null>(null);

  useEffect(() => {
    if (!sonuc.not || sonuc.id !== talepId || bildirilen.current === sonuc.not) return;
    bildirilen.current = sonuc.not;
    onKaydedildi(sonuc.not, sonuc.durum);
    setDosya(null);
  }, [sonuc, talepId, onKaydedildi]);

  const kapali = durum === "cozuldu";

  return (
    <form action={gonder} className="flex flex-col gap-2.5 border-t border-bg px-5 pb-[18px] pt-3.5">
      <input type="hidden" name="talepId" value={talepId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">Not ekle</span>
        <textarea
          name="metin"
          rows={3}
          placeholder="Örn. Müşteri arandı, kurtarma modu adımları anlatıldı."
          aria-invalid={!!sonuc.hata}
          aria-describedby={sonuc.hata ? `not-hata-${talepId}` : undefined}
          className="resize-y rounded-[14px] border border-line-strong bg-card p-3 text-sm outline-none focus:border-ink aria-[invalid=true]:border-err"
        />
      </label>
      {dosyaHata && <span role="alert" className="text-xs font-semibold text-err">{dosyaHata}</span>}
      {sonuc.hata && <span id={`not-hata-${talepId}`} className="text-xs font-semibold text-err">{sonuc.hata}</span>}

      <div className="flex flex-wrap items-center gap-2">
        <label className={IKINCIL_BTN}>
          <Paperclip size={18} aria-hidden="true" />
          <span className="max-w-[160px] truncate">{dosya ?? "Dosya"}</span>
          <input
            type="file"
            name="dosya"
            className="sr-only"
            onChange={(e) => {
              const { ad, hata } = dosyaSecildi(e.target);
              setDosya(ad);
              setDosyaHata(hata);
            }}
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          {kapali && (
            <button type="submit" name="islem" value="yeniden" disabled={bekliyor} className={IKINCIL_BTN}>Yeniden aç</button>
          )}
          {(durum === "yeni" || durum === "beklemede") && (
            <button type="submit" name="islem" value="islemde" disabled={bekliyor} className={IKINCIL_BTN}>İşleme al</button>
          )}
          {(durum === "yeni" || durum === "islemde") && (
            <button type="submit" name="islem" value="beklemede" disabled={bekliyor} className={IKINCIL_BTN}>Beklemeye al</button>
          )}
          <button type="submit" name="islem" value="not" disabled={bekliyor} className={IKINCIL_BTN}>
            {bekliyor ? "Kaydediliyor…" : "Notu kaydet"}
          </button>
          {!kapali && (
            <button
              type="submit"
              name="islem"
              value="cozuldu"
              disabled={bekliyor}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
            >
              Çözüldü
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
