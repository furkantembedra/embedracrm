"use client";

// Satış hattı WhatsApp pencereleri: mesaj geçmişi ve demo "WhatsApp mesajı simüle et" formu
import { useActionState, useEffect, useRef } from "react";
import { telefonGoster } from "@/components/whatsapp/telefon";
import { useFormGonder } from "@/lib/use-form-gonder";
import { whatsappSimuleEt, type SimulasyonDurumu } from "./actions";
import type { Firsat } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

export function MesajGecmisi({ firsat }: { firsat: Firsat }) {
  const mesajlar = firsat.mesajlar ?? [];
  return (
    <div className="flex flex-col gap-3 pb-5">
      {firsat.telefon && (
        <a href={`https://wa.me/${firsat.telefon.slice(1)}`} target="_blank" rel="noreferrer" className="self-start text-[13px] font-bold text-info hover:underline">
          {telefonGoster(firsat.telefon)} · WhatsApp&apos;ta aç ↗
        </a>
      )}
      <ol className="flex flex-col gap-2 rounded-xl bg-[#EFEAE2] p-3">
        {mesajlar.map((m) => (
          <li key={m.id} className={`flex max-w-[85%] flex-col gap-1 rounded-xl px-3 py-2 text-sm shadow-sm ${m.yon === "gelen" ? "self-start bg-white" : "self-end bg-[#D9FDD3]"}`}>
            <span className="whitespace-pre-line break-words">{m.metin}</span>
            <time dateTime={m.zaman} className="self-end text-[11px] text-muted">
              {new Date(m.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </time>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">Yanıtlar şimdilik WhatsApp uygulamasından verilir; Cloud API bağlanınca buradan gönderilebilir.</p>
    </div>
  );
}

export function WhatsappSimulasyonu({ onIslendi, onVazgec }: { onIslendi: (f: Firsat, yeni: boolean) => void; onVazgec: () => void }) {
  const [durum, gonder, bekliyor] = useActionState<SimulasyonDurumu, FormData>(whatsappSimuleEt, {});
  const gonderKorunarak = useFormGonder(gonder);
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<number | null>(null);
  useEffect(() => {
    if (durum.firsat && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onIslendi(durum.firsat, !!durum.yeni);
    }
  }, [durum.firsat, durum.zaman, durum.yeni, onIslendi]);

  return (
    <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-4">
      <p className="rounded-xl bg-info-bg px-3 py-2 text-xs font-semibold text-info">
        Demo: Meta&apos;nın webhook&apos;u bu bilgilerle gelmiş gibi işlenir. Numara açık bir fırsatta kayıtlıysa mesaj ona eklenir, değilse yeni lead açılır.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ALAN}>
          WhatsApp profil adı
          <input name="ad" placeholder="Örn. Hakan Usta" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Telefon *
          <input name="telefon" type="tel" inputMode="tel" defaultValue="+90 532 111 22 33" className={GIRDI} aria-invalid={!!h.telefon} />
          {h.telefon && <span className="text-xs font-semibold text-err">{h.telefon}</span>}
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Mesaj *
          <textarea name="mesaj" rows={3} defaultValue="Merhaba, ONE cihazı için fiyat bilgisi alabilir miyim?" className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" aria-invalid={!!h.mesaj} />
          {h.mesaj && <span className="text-xs font-semibold text-err">{h.mesaj}</span>}
        </label>
      </div>
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-[#1F8F4E] px-5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60">
          {bekliyor ? "İşleniyor…" : "Mesajı gönder"}
        </button>
      </div>
    </form>
  );
}
