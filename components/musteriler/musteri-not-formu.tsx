"use client";

// Müşteriye not ekleme. Kaydedilen not zaman çizelgesinin en üstüne düşer.
// onEklendi verilirse ekran onunla güncellenir; verilmezse sayfa sunucudan yenilenir.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { notEkle, type NotFormDurumu } from "./actions";
import type { Olay } from "./queries";

export default function MusteriNotFormu({
  musteriId,
  onEklendi,
}: {
  musteriId: string;
  onEklendi?: (musteriId: string, olay: Olay) => void;
}) {
  const router = useRouter();
  const [durum, gonder, bekliyor] = useActionState<NotFormDurumu, FormData>(notEkle, {});
  const bildirildi = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hataId = `not-hata-${musteriId}`;
  const [dolu, setDolu] = useState(false);

  useEffect(() => {
    if (!durum.olay || !durum.zaman || durum.id !== musteriId || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman;
    formRef.current?.reset();
    setDolu(false);
    if (onEklendi) onEklendi(musteriId, durum.olay);
    else router.refresh();
  }, [durum, musteriId, onEklendi, router]);

  return (
    <form ref={formRef} action={gonder} className="flex flex-col gap-2">
      <input type="hidden" name="musteriId" value={musteriId} />
      <label htmlFor={`not-${musteriId}`} className="text-sm font-extrabold">Not ekle</label>
      <textarea
        id={`not-${musteriId}`}
        name="not"
        rows={3}
        onChange={(e) => setDolu(e.target.value.trim().length > 0)}
        placeholder="Görüşme notu, teklif detayı, hatırlatma…"
        aria-invalid={!!durum.hata}
        aria-describedby={durum.hata ? hataId : undefined}
        className="resize-y rounded-control border border-line-strong bg-card p-3 text-[13px] outline-none focus:border-ink aria-[invalid=true]:border-err"
      />
      {durum.hata && <span id={hataId} className="text-xs font-semibold text-err">{durum.hata}</span>}
      {durum.olay && !durum.hata && durum.id === musteriId && (
        <span role="status" className="text-xs font-semibold text-ok">Not zaman çizelgesine eklendi.</span>
      )}
      <button
        type="submit"
        disabled={bekliyor || !dolu}
        className="min-h-11 cursor-pointer rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {bekliyor ? "Ekleniyor…" : "Notu ekle"}
      </button>
    </form>
  );
}
