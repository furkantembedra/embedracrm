"use client";

// Bot › Kanallar (P2.4): kanal başına bağlantı durumu (gerekli ortam değişkenleri tanımlı mı, kanal adaptörü var mı,
// son webhook), bağlı hesap, bot modu (kapalı / gölge / otomatik) ve "yeni konuşmada bot". Kurulmamış kanal
// "Kurulum gerekli" görünür ve docs/BOT_KURULUM.md'deki bölümün özetini gösterir. Secret değerleri sunucudan hiç
// gelmez (yalnızca tanımlı mı; gizli hesap kimliği maskeli). Yalnızca Yönetici değiştirir; sunucu aksiyonu ve RLS de
// denetler.
import { useState, useTransition } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import Chip from "@/components/ui/chip";
import type { KanalKurulumDurumu } from "@/components/konusma/kanallar/kurulum";
import { kanalBotModuKaydet, yeniKonusmaBotuKaydet } from "./actions";
import { KanalSimgesi } from "./kanal-gorunumu";

export type KanalKarti = {
  kanal: string;
  ad: string;
  yeniKonusmadaBot: boolean;
  botModu: "kapali" | "golge" | "otomatik";
  sonWebhook: string | null;
  kurulum: KanalKurulumDurumu;
};

const MODLAR = [
  { id: "kapali", ad: "Kapalı", aciklama: "Bot bu kanalda hiç çağrılmaz; bot açık konuşmalar gelen mesajda ekibe devredilir." },
  { id: "golge", ad: "Gölge (P2.5)", aciklama: "Bot cevabı müşteriye göndermez, taslak olarak satışçıya bırakır. Gölge mod P2.5'te gelecek; o zamana kadar kapalı gibi davranır." },
  { id: "otomatik", ad: "Otomatik", aciklama: "Bot açık konuşmalarda cevap doğrudan müşteriye gider." },
] as const;

const ZAMAN = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Anahtar({ acik, disabled, onClick, id }: { acik: boolean; disabled: boolean; onClick: () => void; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={acik}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${acik ? "bg-[#1F8F4E]" : "bg-line-strong"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${acik ? "translate-x-6" : "translate-x-1"}`} />
      <span className="sr-only">{acik ? "Açık" : "Kapalı"}</span>
    </button>
  );
}

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
      {mod === "otomatik" && !k.kurulum.hazir && (
        <span className="text-xs font-semibold text-warn">Kanal kurulmadığı için bot şu an bu kanalda cevap veremez (gönderim demo modunda ya da adaptör yok).</span>
      )}
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
    </div>
  );
}

function YeniKonusmaBotu({ k, duzenleyebilir }: { k: KanalKarti; duzenleyebilir: boolean }) {
  const [acik, setAcik] = useState(k.yeniKonusmadaBot);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const id = `yeni-bot-${k.kanal}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex flex-col gap-0.5">
          <span className="text-sm font-bold">Yeni konuşmada bot</span>
          <span className="text-xs text-muted">Bu kanaldan ilk kez yazan müşteriyle konuşmayı bot mu başlatsın? Var olan konuşmalar değişmez.</span>
        </label>
        <Anahtar
          id={id}
          acik={acik}
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
        />
      </div>
      <span className="text-xs font-semibold text-[#474A42]">{acik ? "Açık: yeni konuşma botla başlar (bot modu Otomatik ise bot cevap verir)." : "Kapalı: yeni konuşma ekipte başlar; bot için Gelen kutusu'ndan Bota geri ver."}</span>
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
    </div>
  );
}

function Baglanti({ k }: { k: KanalKarti }) {
  const u = k.kurulum;
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line bg-bg p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">Bağlantı</span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-bold text-muted">Son webhook</dt>
        <dd className="tabular-nums">{k.sonWebhook ? ZAMAN.format(new Date(k.sonWebhook)) : "Hiç gelmedi"}</dd>
        <dt className="font-bold text-muted">{u.hesap.etiket}</dt>
        <dd className="break-all tabular-nums">{u.hesap.kimlik ?? <span className="text-muted">Tanımlı değil</span>}</dd>
        <dt className="font-bold text-muted">Adaptör</dt>
        <dd>{u.adaptorVar ? "Hazır" : <span className="text-muted">Yok ({u.adaptorAdimi}&apos;de gelecek)</span>}</dd>
      </dl>
      <ul aria-label="Ortam değişkenleri" className="flex flex-col gap-1">
        {u.degiskenler.map((d) => (
          <li key={d.ad} className="flex items-start gap-1.5 text-xs">
            {d.tanimli
              ? <CircleCheck size={14} aria-hidden="true" className="mt-px shrink-0 text-ok" />
              : <CircleX size={14} aria-hidden="true" className="mt-px shrink-0 text-err" />}
            <span>
              <code className="font-bold">{d.ad}</code> <span className="text-muted">· {d.aciklama} · {d.tanimli ? "tanımlı" : "eksik"}</span>
            </span>
          </li>
        ))}
      </ul>
      <span className="text-[11px] text-muted">Değerler gösterilmez; yalnızca tanımlı olup olmadıkları.</span>
    </div>
  );
}

function Kart({ k, duzenleyebilir }: { k: KanalKarti; duzenleyebilir: boolean }) {
  const u = k.kurulum;
  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <KanalSimgesi kanal={k.kanal} />
        <b className="text-base">{k.ad}</b>
        <Chip ton={u.hazir ? "ok" : "warn"} className="ml-auto">{u.hazir ? "Bağlı" : "Kurulum gerekli"}</Chip>
      </div>
      <Baglanti k={k} />
      {!u.hazir && (
        <details open className="rounded-control border border-warn bg-warn-bg p-3 text-sm">
          <summary className="cursor-pointer font-bold">Kurulum gerekli · docs/BOT_KURULUM.md {u.belge.bolum}</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-xs text-ink">
            {u.belge.ozet.map((m) => <li key={m}>{m}</li>)}
          </ol>
          {!u.adaptorVar && <p className="mt-2 text-xs font-semibold">Değişkenler tanımlansa da bu kanalın mesajları {u.adaptorAdimi} tamamlanana kadar işlenmez.</p>}
        </details>
      )}
      <BotModuSecimi k={k} duzenleyebilir={duzenleyebilir} />
      <YeniKonusmaBotu k={k} duzenleyebilir={duzenleyebilir} />
    </li>
  );
}

export default function KanalAyarlari({ kanallar, duzenleyebilir }: { kanallar: KanalKarti[]; duzenleyebilir: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {!duzenleyebilir && <p role="note" className="text-sm text-muted">Salt okunur: kanal ayarlarını yalnızca Yönetici değiştirir.</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] items-start gap-3">
        {kanallar.map((k) => <Kart key={k.kanal} k={k} duzenleyebilir={duzenleyebilir} />)}
      </ul>
      <p className="text-xs text-muted">Webhook adresi üç kanal için aynı: /api/meta/webhook. Son webhook, imzası doğrulanan son bildirimin zamanıdır (en çok 30 sn&apos;de bir güncellenir).</p>
    </div>
  );
}
