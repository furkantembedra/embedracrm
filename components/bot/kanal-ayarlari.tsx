"use client";

// Bot › Kanallar: kanal başına bot modu (kapalı / gölge / otomatik, P2.1) ve "yeni konuşmada bot açık" anahtarı (P1.3).
// Yalnızca Yönetici değiştirir; diğer roller salt okunur görür (sunucu aksiyonu ve RLS de denetler). Bağlantı durumu P2.4'te.
import { useState, useTransition } from "react";
import Chip from "@/components/ui/chip";
import { kanalBotModuKaydet, yeniKonusmaBotuKaydet } from "./actions";
import { KanalSimgesi } from "./kanal-gorunumu";

export type KanalKarti = { kanal: string; ad: string; bagli: boolean; yeniKonusmadaBot: boolean; botModu: "kapali" | "golge" | "otomatik" };

const MODLAR = [
  { id: "kapali", ad: "Kapalı", aciklama: "Bot bu kanalda hiç çağrılmaz; bot açık konuşmalar gelen mesajda ekibe devredilir." },
  { id: "golge", ad: "Gölge (P2.5)", aciklama: "Gölge mod P2.5'te gelecek; o zamana kadar kapalı gibi davranır." },
  { id: "otomatik", ad: "Otomatik", aciklama: "Bot açık konuşmalarda cevap doğrudan müşteriye gider." },
] as const;

function BotModuSecimi({ k, duzenleyebilir }: { k: KanalKarti; duzenleyebilir: boolean }) {
  const [mod, setMod] = useState(k.botModu);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const id = `bot-modu-${k.kanal}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">Bot modu</label>
      <select
        id={id}
        value={mod}
        disabled={!duzenleyebilir || bekliyor}
        onChange={(e) => {
          const yeni = e.target.value as KanalKarti["botModu"];
          const eski = mod;
          setMod(yeni);
          setHata(null);
          baslat(async () => {
            const r = await kanalBotModuKaydet(k.kanal, yeni).catch(() => ({ hata: "Kaydedilemedi: sunucuya ulaşılamadı." }));
            if (r.hata) {
              setMod(eski);
              setHata(r.hata);
            }
          });
        }}
        className="min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {MODLAR.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
      </select>
      <span className="text-xs text-muted">{MODLAR.find((m) => m.id === mod)?.aciklama}</span>
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
    </div>
  );
}

function Kart({ k, duzenleyebilir }: { k: KanalKarti; duzenleyebilir: boolean }) {
  const [acik, setAcik] = useState(k.yeniKonusmadaBot);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const id = `yeni-bot-${k.kanal}`;
  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <KanalSimgesi kanal={k.kanal} />
        <b className="text-base">{k.ad}</b>
        <Chip ton={k.bagli ? "ok" : "gray"} className="ml-auto">{k.bagli ? "Adaptör hazır" : "Kanal bağlı değil (Faz 4)"}</Chip>
      </div>
      <BotModuSecimi k={k} duzenleyebilir={duzenleyebilir} />
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex flex-col gap-0.5">
          <span className="text-sm font-bold">Yeni konuşmada bot</span>
          <span className="text-xs text-muted">Bu kanaldan ilk kez yazan müşteriyle konuşmayı bot mu başlatsın? Var olan konuşmalar değişmez.</span>
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={acik}
          disabled={!duzenleyebilir || bekliyor}
          onClick={() => {
            const yeni = !acik;
            setAcik(yeni);
            setHata(null);
            baslat(async () => {
              const r = await yeniKonusmaBotuKaydet(k.kanal, yeni).catch(() => ({ hata: "Kaydedilemedi: sunucuya ulaşılamadı." }));
              if (r.hata) {
                setAcik(!yeni);
                setHata(r.hata);
              }
            });
          }}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${acik ? "bg-[#1F8F4E]" : "bg-line-strong"}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${acik ? "translate-x-6" : "translate-x-1"}`} />
          <span className="sr-only">{acik ? "Açık" : "Kapalı"}</span>
        </button>
      </div>
      <span className="text-xs font-semibold text-[#474A42]">{acik ? "Açık: yeni konuşma botla başlar (bot modu Otomatik ise bot cevap verir)." : "Kapalı: yeni konuşma ekipte başlar; bot için Gelen kutusu'ndan Bota geri ver."}</span>
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
    </li>
  );
}

export default function KanalAyarlari({ kanallar, duzenleyebilir }: { kanallar: KanalKarti[]; duzenleyebilir: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {!duzenleyebilir && <p role="note" className="text-sm text-muted">Salt okunur: kanal ayarlarını yalnızca Yönetici değiştirir.</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        {kanallar.map((k) => <Kart key={k.kanal} k={k} duzenleyebilir={duzenleyebilir} />)}
      </ul>
      <p className="text-xs text-muted">Bağlantı durumu ve son webhook zamanı P2.4&apos;te eklenecek. Kurulum adımları docs/BOT_KURULUM.md&apos;de.</p>
    </div>
  );
}
