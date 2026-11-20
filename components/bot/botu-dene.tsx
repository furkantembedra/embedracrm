"use client";

// "Botu dene" paneli (Bot › Ayarlar, P2.4): formdaki TASLAK ayarlarla (kaydetmeden) ve seçilen kanalın biçim
// sınırlarıyla örnek konuşma. Gerçek müşteriye gitmez, kayıt açılmaz; her turun maliyeti gösterilir ve günlük
// sınıra sayılır. Yalnızca Yönetici kullanır (sunucu aksiyonu da denetler). Lead kartı yalnızca bu denemede birikir.
import { useState, useTransition } from "react";
import { Bot, RotateCcw, Send, User, Wrench } from "lucide-react";
import Chip from "@/components/ui/chip";
import type { IstemAyarlari } from "./ayar-surumu";
import { botuDene } from "./actions";
import { ARAC_ADLARI, usd } from "./arac-gorunumu";
import type { DenemeMesaji } from "./deneme";

type Satir =
  | { tur: "musteri"; metin: string }
  | { tur: "bot"; parcalar: string[]; araclar: { ad: string; sonuc: string; hata: boolean }[]; devir: boolean; maliyetUsd: number; cache: number }
  | { tur: "hata"; metin: string; maliyetUsd?: number };

export type DenemeKanali = { kanal: string; ad: string; hazir: boolean; sinirNotu: string | null };

export default function BotuDene({ taslak, kanallar, kullanabilir, anahtarVar }: { taslak: IstemAyarlari; kanallar: DenemeKanali[]; kullanabilir: boolean; anahtarVar: boolean }) {
  const ilkHazir = kanallar.find((k) => k.hazir)?.kanal ?? kanallar[0]?.kanal ?? "whatsapp";
  const [kanal, setKanal] = useState(ilkHazir);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [kart, setKart] = useState<unknown>({});
  const [girdi, setGirdi] = useState("");
  const [bekliyor, baslat] = useTransition();
  const toplam = satirlar.reduce((t, s) => t + (s.tur !== "musteri" ? s.maliyetUsd ?? 0 : 0), 0);
  const devredildi = satirlar.some((s) => s.tur === "bot" && s.devir);
  const secili = kanallar.find((k) => k.kanal === kanal);

  const gecmis = (ekle: Satir[]): DenemeMesaji[] =>
    ekle.flatMap((s): DenemeMesaji[] =>
      s.tur === "musteri" ? [{ gonderen: "musteri", metin: s.metin }] : s.tur === "bot" && s.parcalar.length ? [{ gonderen: "bot", metin: s.parcalar.join("\n\n") }] : []);

  const gonder = () => {
    const metin = girdi.trim();
    if (!metin || bekliyor) return;
    const yeni: Satir[] = [...satirlar, { tur: "musteri", metin }];
    setSatirlar(yeni);
    setGirdi("");
    baslat(async () => {
      const r = await botuDene({ ayarlar: taslak, kanal, mesajlar: gecmis(yeni), kart }).catch(() => ({ ok: false as const, hata: "Sunucuya ulaşılamadı." }));
      if (r.ok) {
        setKart(r.kart);
        setSatirlar((x) => [...x, { tur: "bot", parcalar: r.parcalar, araclar: r.araclar, devir: r.devir, maliyetUsd: r.maliyetUsd, cache: r.kullanim.cacheOkuma }]);
      } else {
        setSatirlar((x) => [...x, { tur: "hata", metin: r.hata, maliyetUsd: "maliyetUsd" in r ? r.maliyetUsd : undefined }]);
      }
    });
  };

  const sifirla = () => {
    setSatirlar([]);
    setKart({});
  };

  return (
    <section aria-labelledby="dene-baslik" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="dene-baslik" className="text-base font-bold">Botu dene</h2>
        <Chip ton="info">Taslak ayarlarla · müşteriye gitmez</Chip>
      </div>
      <p className="text-xs text-muted">
        Formdaki kaydedilmemiş ayarlar kullanılır. Araçlar çalışır ama hiçbir şey kaydedilmez (lead kartı yalnızca bu denemede birikir, devir yapılmaz).
        Her tur gerçek Claude çağrısıdır; maliyeti günlük sınıra sayılır.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Kanal</span>
          <select
            value={kanal}
            onChange={(e) => { setKanal(e.target.value); sifirla(); }}
            disabled={bekliyor}
            className="min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-3 text-sm font-semibold"
          >
            {kanallar.map((k) => <option key={k.kanal} value={k.kanal} disabled={!k.hazir}>{k.ad}{k.hazir ? "" : " (adaptör yok)"}</option>)}
          </select>
        </label>
        <button type="button" onClick={sifirla} disabled={bekliyor || !satirlar.length} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
          <RotateCcw size={14} aria-hidden="true" /> Yeniden başlat
        </button>
      </div>
      {secili?.sinirNotu && <p className="text-xs text-muted">Biçim: {secili.sinirNotu}</p>}

      <ol aria-label="Deneme konuşması" aria-live="polite" className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto rounded-control border border-line bg-bg p-3">
        {!satirlar.length && <li className="m-auto text-center text-xs text-muted">Müşteri gibi yazın; botun cevabı burada görünür.</li>}
        {satirlar.map((s, i) => {
          if (s.tur === "musteri") {
            return (
              <li key={i} className="flex items-start gap-2">
                <User size={16} aria-label="Müşteri" className="mt-1 shrink-0 text-muted" />
                <p className="max-w-[85%] whitespace-pre-wrap rounded-card bg-card px-3 py-2 text-sm shadow-sm">{s.metin}</p>
              </li>
            );
          }
          if (s.tur === "hata") {
            return (
              <li key={i} role="alert" className="rounded-control border border-err bg-err-bg px-3 py-2 text-xs font-semibold text-err">
                {s.metin}{s.maliyetUsd ? ` · ${usd(s.maliyetUsd)}` : ""}
              </li>
            );
          }
          return (
            <li key={i} className="flex flex-col items-end gap-1">
              {s.araclar.map((a, j) => (
                <span key={j} className={`flex max-w-[85%] items-start gap-1 text-[11px] ${a.hata ? "text-err" : "text-muted"}`}>
                  <Wrench size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span><b>{ARAC_ADLARI[a.ad] ?? a.ad}</b>: {a.sonuc}</span>
                </span>
              ))}
              {s.parcalar.length
                ? s.parcalar.map((p, j) => (
                  <p key={j} className="max-w-[85%] whitespace-pre-wrap rounded-card bg-ink px-3 py-2 text-sm text-white">{p}</p>
                ))
                : <span className="text-xs italic text-muted">Bot metin yazmadı (gerçek konuşmada ekibe devredilirdi).</span>}
              <span className="flex flex-wrap items-center justify-end gap-1.5 text-[11px] text-muted">
                <Bot size={12} aria-hidden="true" />
                {s.parcalar.length > 1 && <span>{s.parcalar.length} mesaja bölündü ·</span>}
                {s.devir && <Chip ton="warn">Ekibe devrederdi</Chip>}
                <span className="tabular-nums">{usd(s.maliyetUsd)}{s.cache ? ` · önbellekten ${s.cache.toLocaleString("tr-TR")} token` : ""}</span>
              </span>
            </li>
          );
        })}
        {bekliyor && <li className="text-xs text-muted">Bot yazıyor…</li>}
      </ol>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          gonder();
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="sr-only">Müşteri mesajı</span>
          <textarea
            value={girdi}
            onChange={(e) => setGirdi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                gonder();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={!kullanabilir ? "Yalnızca Yönetici deneyebilir" : !anahtarVar ? "ANTHROPIC_API_KEY tanımlı değil" : devredildi ? "Bot devretti; yeniden başlatın ya da devam edin" : "Müşteri mesajı…"}
            disabled={!kullanabilir || !anahtarVar}
            className="w-full resize-y rounded-control border border-line-strong bg-card px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={!kullanabilir || !anahtarVar || bekliyor || !girdi.trim() || !secili?.hazir}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control bg-ink px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} aria-hidden="true" /> Gönder
        </button>
      </form>
      <p className="text-xs tabular-nums text-muted">Bu denemenin maliyeti: <b className="text-ink">{usd(toplam)}</b></p>
    </section>
  );
}
