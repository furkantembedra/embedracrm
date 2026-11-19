"use client";

// Bot › Kanallar: kanal başına "yeni konuşmada bot açık" anahtarı (P1.3). Yalnızca Yönetici değiştirir; diğer roller
// salt okunur görür (sunucu aksiyonu ve RLS de denetler). Bağlantı durumu, bot modu (kapalı / gölge / otomatik) P2.4'te.
import { useState, useTransition } from "react";
import Chip from "@/components/ui/chip";
import { yeniKonusmaBotuKaydet } from "./actions";
import { KanalSimgesi } from "./kanal-gorunumu";

export type KanalKarti = { kanal: string; ad: string; bagli: boolean; yeniKonusmadaBot: boolean };

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
      <span className="text-xs font-semibold text-[#474A42]">{acik ? "Açık: yeni konuşmada bot cevap verir (bot katmanı P2.1'de)." : "Kapalı: yeni konuşma ekipte başlar; bot için Gelen kutusu'ndan Bota geri ver."}</span>
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
      <p className="text-xs text-muted">Bağlantı durumu, son webhook zamanı ve bot modu (kapalı / gölge / otomatik) P2.4&apos;te eklenecek. Kurulum adımları docs/BOT_KURULUM.md&apos;de.</p>
    </div>
  );
}
