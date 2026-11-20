"use client";

// Bot › Ayarlar: günlük maliyet sınırı ve konuşma başına tur sınırı (istem dışı işletme ayarları; sürümlenmez, anında
// kaydedilir) ve botun durumu. Yalnızca Yönetici değiştirir (sunucu aksiyonu ve RLS de denetler). Acil durdurma
// ./acil-durdurma.tsx, sürümlü kişilik / bilgi ayarları ve "Botu dene" ./istem-ayarlari.tsx (P2.4).
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
  const [maliyet, setMaliyet] = useState(String(a.gunlukMaliyetSiniriUsd));
  const [tur, setTur] = useState(String(a.turSiniri));
  const [mesaj, setMesaj] = useState<{ ton: "ok" | "err"; metin: string } | null>(null);
  const [bekliyor, baslat] = useTransition();

  const kaydet = () => {
    setMesaj(null);
    baslat(async () => {
      const r = await botAyarlariKaydet({ gunlukMaliyetSiniriUsd: Number(maliyet.replace(",", ".")), turSiniri: Number(tur) })
        .catch(() => ({ hata: "Kaydedilemedi: sunucuya ulaşılamadı." }));
      if (r.hata) setMesaj({ ton: "err", metin: r.hata });
      else setMesaj({ ton: "ok", metin: "Kaydedildi." });
    });
  };

  const sinirDoldu = a.bugunMaliyetUsd >= a.gunlukMaliyetSiniriUsd;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {!duzenleyebilir && <p role="note" className="text-sm text-muted">Salt okunur: bot ayarlarını yalnızca Yönetici değiştirir.</p>}

      <form
        className="flex flex-col gap-4 rounded-card border border-line bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          kaydet();
        }}
      >
        <h2 className="text-base font-bold">Sınırlar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">Günlük maliyet sınırı (USD)</span>
            <input inputMode="decimal" value={maliyet} onChange={(e) => setMaliyet(e.target.value)} disabled={!duzenleyebilir || bekliyor} className={GIRDI} />
            <span className="text-xs text-muted">İstanbul saatiyle gün başından beri (Botu dene dahil). Aşılınca bot çağrılmaz, konuşmalar ekibe devredilir ve yöneticilere günde bir bildirim gider.</span>
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
        <p className="text-xs text-muted">Model ve effort components/bot/yapilandirma.ts&apos;te. İstem sürümü: kod sürümü / ayar sürümü.</p>
      </section>
    </div>
  );
}
