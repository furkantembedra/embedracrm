"use client";

// Bot › Ayarlar (P2.1 parçası): acil durdurma, günlük maliyet sınırı ve konuşma başına tur sınırı. Yalnızca Yönetici
// değiştirir (sunucu aksiyonu ve RLS de denetler). Kişilik, bilgi bankası, sürümler ve "Botu dene" P2.4'te.
import { useState, useTransition } from "react";
import Chip from "@/components/ui/chip";
import { botAyarlariKaydet } from "./actions";
import { usd } from "./arac-gorunumu";

export type BotAyarlariGorunumu = {
  acilDurdurma: boolean;
  gunlukMaliyetSiniriUsd: number;
  turSiniri: number;
  bugunMaliyetUsd: number;
  anahtarVar: boolean;
  model: string;
  effort: string;
  istemSurumu: string;
};

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-60";

export default function BotAyarlari({ a, duzenleyebilir }: { a: BotAyarlariGorunumu; duzenleyebilir: boolean }) {
  const [acil, setAcil] = useState(a.acilDurdurma);
  const [maliyet, setMaliyet] = useState(String(a.gunlukMaliyetSiniriUsd));
  const [tur, setTur] = useState(String(a.turSiniri));
  const [mesaj, setMesaj] = useState<{ ton: "ok" | "err"; metin: string } | null>(null);
  const [bekliyor, baslat] = useTransition();

  const kaydet = (acilDurdurma: boolean) => {
    setMesaj(null);
    baslat(async () => {
      const r = await botAyarlariKaydet({ acilDurdurma, gunlukMaliyetSiniriUsd: Number(maliyet.replace(",", ".")), turSiniri: Number(tur) })
        .catch(() => ({ hata: "Kaydedilemedi: sunucuya ulaşılamadı." }));
      if (r.hata) {
        setAcil(a.acilDurdurma);
        setMesaj({ ton: "err", metin: r.hata });
      } else setMesaj({ ton: "ok", metin: "Kaydedildi." });
    });
  };

  const sinirDoldu = a.bugunMaliyetUsd >= a.gunlukMaliyetSiniriUsd;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {!duzenleyebilir && <p role="note" className="text-sm text-muted">Salt okunur: bot ayarlarını yalnızca Yönetici değiştirir.</p>}

      <section aria-labelledby="acil-baslik" className={`flex flex-col gap-3 rounded-card border p-5 ${acil ? "border-err bg-err-bg" : "border-line bg-card"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="acil-baslik" className="text-base font-bold">Acil durdurma</h2>
            <span className="text-sm text-muted">Açıkken bot hiçbir kanalda çağrılmaz; bot açık konuşmalara müşteri yazınca konuşma ekibe devredilir.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={acil}
            aria-labelledby="acil-baslik"
            disabled={!duzenleyebilir || bekliyor}
            onClick={() => {
              const yeni = !acil;
              setAcil(yeni);
              kaydet(yeni);
            }}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${acil ? "bg-err" : "bg-line-strong"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${acil ? "translate-x-6" : "translate-x-1"}`} />
            <span className="sr-only">{acil ? "Açık" : "Kapalı"}</span>
          </button>
        </div>
        <span className="text-sm font-bold">{acil ? "Bot durduruldu." : "Bot çalışıyor (kanalın bot modu Otomatik ise)."}</span>
      </section>

      <form
        className="flex flex-col gap-4 rounded-card border border-line bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          kaydet(acil);
        }}
      >
        <h2 className="text-base font-bold">Sınırlar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">Günlük maliyet sınırı (USD)</span>
            <input inputMode="decimal" value={maliyet} onChange={(e) => setMaliyet(e.target.value)} disabled={!duzenleyebilir || bekliyor} className={GIRDI} />
            <span className="text-xs text-muted">İstanbul saatiyle gün başından beri. Aşılınca bot çağrılmaz, konuşmalar ekibe devredilir.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">Konuşma başına tur sınırı</span>
            <input inputMode="numeric" value={tur} onChange={(e) => setTur(e.target.value)} disabled={!duzenleyebilir || bekliyor} className={GIRDI} />
            <span className="text-xs text-muted">Bot son açıldığından beri bu kadar cevap verdiyse konuşmayı ekibe devreder.</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {duzenleyebilir && (
            <button type="submit" disabled={bekliyor} className="inline-flex min-h-11 cursor-pointer items-center rounded-control bg-ink px-4 text-sm font-bold text-white disabled:opacity-50">
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </button>
          )}
          {mesaj && <span role={mesaj.ton === "err" ? "alert" : "status"} className={`text-sm font-semibold ${mesaj.ton === "err" ? "text-err" : "text-ok"}`}>{mesaj.metin}</span>}
        </div>
      </form>

      <section aria-label="Bot durumu" className="flex flex-col gap-2 rounded-card border border-line bg-card p-5 text-sm">
        <h2 className="text-base font-bold">Durum</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="font-bold text-muted">Claude anahtarı</dt>
          <dd>{a.anahtarVar ? <Chip ton="ok">Tanımlı</Chip> : <Chip ton="err">ANTHROPIC_API_KEY yok: bot kapalı</Chip>}</dd>
          <dt className="font-bold text-muted">Bugünkü maliyet</dt>
          <dd className="tabular-nums">{usd(a.bugunMaliyetUsd)} / {usd(a.gunlukMaliyetSiniriUsd)} {sinirDoldu && <Chip ton="err">Sınır doldu</Chip>}</dd>
          <dt className="font-bold text-muted">Model</dt>
          <dd>{a.model} · effort {a.effort} · istem {a.istemSurumu}</dd>
        </dl>
        <p className="text-xs text-muted">Model ve effort components/bot/yapilandirma.ts&apos;te. Kişilik, bilgi bankası, sürümler ve Botu dene paneli P2.4&apos;te.</p>
      </section>
    </div>
  );
}
