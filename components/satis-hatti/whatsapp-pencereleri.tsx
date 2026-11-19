"use client";

// Satış hattı mesaj pencereleri: mesaj geçmişi ve demo "Mesaj simüle et" formu (kanal seçilebilir; P1.2'de Gelen kutusu'na taşınır)
import { useActionState, useEffect, useRef, useState } from "react";
import { telefonGoster } from "@/components/whatsapp/telefon";
import { useFormGonder } from "@/lib/use-form-gonder";
import { konusmaSimuleEt, type SimulasyonDurumu } from "./actions";
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

export type SimulasyonKanali = { kanal: string; hazir: boolean; ad: string; kimlikAlani: { etiket: string; ornek: string } | null };

export function KonusmaSimulasyonu({ kanallar, onIslendi, onVazgec }: {
  kanallar: SimulasyonKanali[];
  onIslendi: (f: Firsat | null, duyuru: string) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<SimulasyonDurumu, FormData>(konusmaSimuleEt, {});
  const gonderKorunarak = useFormGonder(gonder);
  const h = durum.hatalar ?? {};
  const [kanal, setKanal] = useState(() => kanallar.find((k) => k.hazir)?.kanal ?? "");
  const secili = kanallar.find((k) => k.kanal === kanal);
  const bildirildi = useRef<number | null>(null);
  useEffect(() => {
    if (durum.duyuru && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onIslendi(durum.firsat ?? null, durum.duyuru);
    }
  }, [durum.firsat, durum.zaman, durum.duyuru, onIslendi]);

  return (
    <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-4">
      <p className="rounded-xl bg-info-bg px-3 py-2 text-xs font-semibold text-info">
        Demo: Meta&apos;nın webhook&apos;u bu bilgilerle gelmiş gibi kuyruğa yazılır ve işlenir. Kişi açık bir fırsatta kayıtlıysa mesaj ona eklenir, değilse yeni lead açılır.
      </p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-bold">Kanal</legend>
        <div className="flex flex-wrap gap-2">
          {kanallar.map((k) => (
            <label key={k.kanal} className={`inline-flex min-h-11 items-center gap-2 rounded-control border px-3 text-sm font-bold ${k.hazir ? "cursor-pointer border-line-strong has-[:checked]:border-ink has-[:checked]:bg-[#F4F5F0]" : "cursor-not-allowed border-line text-muted"}`}>
              <input type="radio" name="kanal" value={k.kanal} checked={kanal === k.kanal} disabled={!k.hazir} onChange={() => setKanal(k.kanal)} className="accent-ink" />
              {k.ad}
              {!k.hazir && <span className="text-xs font-semibold">· Faz 4</span>}
            </label>
          ))}
        </div>
        {h.kanal && <span className="text-xs font-semibold text-err">{h.kanal}</span>}
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-bold">Gönderen</legend>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-sm font-bold has-[:checked]:border-ink has-[:checked]:bg-[#F4F5F0]">
            <input type="radio" name="gonderen" value="musteri" defaultChecked className="accent-ink" /> Müşteri
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-sm font-bold has-[:checked]:border-ink has-[:checked]:bg-[#F4F5F0]">
            <input type="radio" name="gonderen" value="isletme" className="accent-ink" /> İşletme, CRM dışından (echo)
          </label>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ALAN}>
          Profil adı
          <input name="ad" placeholder="Örn. Hakan Usta" className={GIRDI} />
        </label>
        <label className={ALAN}>
          {secili?.kimlikAlani?.etiket ?? "Kimlik"} *
          <input key={kanal} name="kimlik" inputMode="tel" defaultValue={secili?.kimlikAlani?.ornek ?? ""} className={GIRDI} aria-invalid={!!h.kimlik} />
          {h.kimlik && <span className="text-xs font-semibold text-err">{h.kimlik}</span>}
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Mesaj *
          <textarea name="mesaj" rows={3} defaultValue="Merhaba, ONE cihazı için fiyat bilgisi alabilir miyim?" className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" aria-invalid={!!h.mesaj} />
          {h.mesaj && <span className="text-xs font-semibold text-err">{h.mesaj}</span>}
        </label>
      </div>
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor || !secili?.hazir} className="min-h-11 cursor-pointer rounded-control bg-[#1F8F4E] px-5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60">
          {bekliyor ? "İşleniyor…" : "Mesajı gönder"}
        </button>
      </div>
    </form>
  );
}
