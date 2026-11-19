"use client";

// Bot › Gelen kutusu: solda konuşma listesi (kanal sekmeleri + okunmamış sayıları, filtreler, arama), ortada sohbet ve
// cevap kutusu, sağda bağlı fırsat. Veri Server Action'larla okunur; değişiklik sinyali Supabase Realtime'dan gelir
// (./canli.ts). Okundu bilgisi kullanıcı başınadır. Gönderimde pencere sunucuda adaptöre sorulur; buradaki cevap kutusu
// yalnızca kullanıcıya yolu gösterir (./cevap-modu.ts).
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, CheckCheck, Clock, ExternalLink, Mail, MessageCircle, Phone, Search, Send } from "lucide-react";
import Chip from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { tl } from "@/lib/format";
import { ASAMA_BILGI } from "@/components/satis-hatti/sabitler";
import { cevapGonder, gelenKutusuGetir, konusmaGetir, okunduIsaretle, sablonlaGonder, sorumluDegistir } from "./actions";
import { useCanliYenileme } from "./canli";
import { cevapModu, listeyiSuz, type Filtre } from "./cevap-modu";
import { BotRozeti, KanalSimgesi, botDurumu, kisaZaman } from "./kanal-gorunumu";
import KonusmaSimulasyonu, { type SimulasyonKanali } from "./simulasyon";
import type { GelenKutusuSatiri, KanalBilgisi, KonusmaDetayi, SohbetMesaji } from "./queries";

const FILTRELER: { id: Filtre; ad: string }[] = [
  { id: "bot", ad: "Bot konuşuyor" },
  { id: "bekliyor", ad: "Cevap bekliyor" },
  { id: "bana", ad: "Bana atanan" },
  { id: "kapali", ad: "Kapalı pencere" },
];

const BUTON = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function tarihSaat(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ---------------- Liste ---------------- */

function ListeOgesi({ k, secili, onSec }: { k: GelenKutusuSatiri; secili: boolean; onSec: () => void }) {
  const okunmamis = k.okunmamis > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onSec}
        aria-current={secili ? "true" : undefined}
        className={`flex w-full cursor-pointer gap-3 border-b border-line px-3 py-3 text-left transition-colors ${secili ? "bg-lime-bg" : "hover:bg-[#F4F5F0]"}`}
      >
        <KanalSimgesi kanal={k.kanal} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-sm ${okunmamis ? "font-extrabold" : "font-bold"}`}>{k.ad}</span>
            <time dateTime={k.son.zaman} className={`ml-auto shrink-0 text-[11px] ${okunmamis ? "font-bold text-ink" : "font-semibold text-muted"}`} suppressHydrationWarning>
              {kisaZaman(k.son.zaman)}
            </time>
          </span>
          {k.firma && k.firma !== k.ad && <span className="truncate text-xs font-semibold text-[#474A42]">{k.firma}</span>}
          <span className="flex items-center gap-2">
            <span className={`line-clamp-1 flex-1 break-all text-xs ${okunmamis ? "font-semibold text-ink" : "text-muted"}`}>
              {k.son.yon === "giden" && (k.son.gonderen === "bot" ? "Bot: " : "Siz: ")}
              {k.son.metin}
            </span>
            {okunmamis && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#1F8F4E] px-1.5 text-[11px] font-bold text-white" aria-label={`${k.okunmamis} okunmamış`}>
                {k.okunmamis}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <BotRozeti durum={botDurumu(k.botAktif, k.son.yon)} />
            {k.pencere.durum !== "acik" && <Chip ton="err">Pencere kapalı</Chip>}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ---------------- Sohbet ---------------- */

function TeslimIsareti({ m }: { m: SohbetMesaji }) {
  if (m.demo) return <span className="text-[11px] font-semibold text-warn">Demo · gönderilmedi</span>;
  if (!m.teslim) return <Clock size={13} aria-label="Gönderildi, kanal onayı bekleniyor" className="text-muted" />;
  switch (m.teslim.durum) {
    case "gonderildi": return <Check size={14} aria-label="Gönderildi" className="text-muted" />;
    case "iletildi": return <CheckCheck size={14} aria-label="İletildi" className="text-muted" />;
    case "okundu": return <CheckCheck size={14} aria-label="Okundu" className="text-info" />;
    case "basarisiz": return <AlertTriangle size={14} aria-label="Gönderilemedi" className="text-err" />;
  }
}

function Baloncuk({ m }: { m: SohbetMesaji }) {
  const gelen = m.yon === "gelen";
  const kim = gelen ? null : m.gonderen === "bot" ? "Bot" : m.gonderenAd ?? "Temsilci (CRM dışından)";
  const renk = gelen ? "self-start bg-white" : m.gonderen === "bot" ? "self-end bg-lime-bg" : "self-end bg-[#D9FDD3]";
  return (
    <li className={`flex max-w-[85%] flex-col gap-1 rounded-xl px-3 py-2 text-sm shadow-sm ${renk}`}>
      {kim && <span className="text-[11px] font-bold text-[#474A42]">{kim}{m.sablon && " · şablon"}{m.insanEtiketi && " · insan temsilci etiketi"}</span>}
      <span className="whitespace-pre-line break-words">{m.metin}</span>
      <span className="flex items-center justify-end gap-1.5 text-[11px] text-muted">
        <time dateTime={m.zaman} suppressHydrationWarning>{tarihSaat(m.zaman)}</time>
        {!gelen && <TeslimIsareti m={m} />}
      </span>
      {m.teslim?.durum === "basarisiz" && (
        <span role="note" className="rounded-lg bg-err-bg px-2 py-1 text-xs font-semibold text-err">Gönderilemedi: {m.teslim.hata}</span>
      )}
    </li>
  );
}

function Sohbet({ d }: { d: KonusmaDetayi }) {
  const alt = useRef<HTMLDivElement>(null);
  const sonId = d.mesajlar.at(-1)?.id;
  useEffect(() => {
    alt.current?.scrollIntoView({ block: "end" });
  }, [d.id, sonId]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#EFEAE2] p-3" aria-live="polite">
      {d.mesajlar.length ? (
        <ol className="flex flex-col gap-2">
          {d.mesajlar.map((m) => <Baloncuk key={m.id} m={m} />)}
        </ol>
      ) : (
        <p className="p-4 text-center text-sm text-muted">Bu konuşmada henüz mesaj yok.</p>
      )}
      <div ref={alt} />
    </div>
  );
}

/* ---------------- Cevap kutusu ---------------- */

function Uyari({ ton = "warn", children }: { ton?: "warn" | "err" | "info"; children: React.ReactNode }) {
  const r = ton === "err" ? "bg-err-bg text-err" : ton === "info" ? "bg-info-bg text-info" : "bg-warn-bg text-warn";
  return <div role={ton === "err" ? "alert" : "note"} className={`rounded-xl px-3 py-2 text-xs font-semibold ${r}`}>{children}</div>;
}

function CevapKutusu({ d, onGonderildi }: { d: KonusmaDetayi; onGonderildi: (demo: boolean) => void }) {
  const mod = cevapModu(d);
  const [metin, setMetin] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const [sablon, setSablon] = useState({ ad: "", dil: "tr", parametreler: "" });

  const gonder = () => {
    const m = metin.trim();
    if (!m || bekliyor) return;
    setHata(null);
    baslat(async () => {
      try {
        const r = await cevapGonder(d.id, m);
        if (r.ok) {
          setMetin("");
          onGonderildi(r.demo);
        } else {
          setHata(r.gonderilen ? `${r.hata} (Mesajın ilk ${r.gonderilen} parçası gönderildi.)` : r.hata);
          if (r.gonderilen) onGonderildi(false);
        }
      } catch {
        setHata("Mesaj gönderilemedi: sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      }
    });
  };

  const sablonGonder = () => {
    if (!sablon.ad.trim() || bekliyor) return;
    setHata(null);
    baslat(async () => {
      try {
        const r = await sablonlaGonder(d.id, { ad: sablon.ad, dil: sablon.dil, parametreler: sablon.parametreler.split("\n") });
        if (r.ok) {
          setSablon((s) => ({ ...s, parametreler: "" }));
          onGonderildi(r.demo);
        } else setHata(r.hata);
      } catch {
        setHata("Şablon gönderilemedi: sunucuya ulaşılamadı.");
      }
    });
  };

  if (mod.tur === "bagli_degil") {
    return <div className="border-t border-line p-3"><Uyari ton="info">{d.kanalAd} kanalı bağlı değil; bu konuşmaya CRM&apos;den yazılamaz (adaptör Faz 4&apos;te gelir).</Uyari></div>;
  }

  if (mod.tur === "baska_kanal") {
    return (
      <div className="flex flex-col gap-2 border-t border-line p-3">
        <Uyari>
          {d.kanalAd} mesaj penceresi kapandı: müşteri yeniden yazana kadar bu kanaldan mesaj gönderilemez. Müşteriye e-posta ya da telefonla ulaşın.
        </Uyari>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {(d.telefon ?? d.firsat?.telefon) && (
            <a href={`tel:${d.telefon ?? d.firsat?.telefon}`} className="inline-flex items-center gap-1 text-info hover:underline"><Phone size={14} aria-hidden="true" />Ara</a>
          )}
          {d.musteriId && <Link href={`/musteriler/${d.musteriId}`} className="inline-flex items-center gap-1 text-info hover:underline"><Mail size={14} aria-hidden="true" />Müşteri yetkilileri</Link>}
        </div>
      </div>
    );
  }

  if (mod.tur === "sablon") {
    return (
      <form
        className="flex flex-col gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          sablonGonder();
        }}
      >
        <Uyari>
          {d.kanalAd} 24 saat penceresi kapalı: müşterinin son mesajından bu yana 24 saat geçti, serbest metin gönderilemez. Meta&apos;da onaylanmış bir şablon seçin.
        </Uyari>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
          <label className="flex flex-col gap-1 text-xs font-bold">
            Şablon adı
            <input value={sablon.ad} onChange={(e) => setSablon({ ...sablon, ad: e.target.value })} placeholder="ör. takip_mesaji" className="min-h-10 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold">
            Dil
            <input value={sablon.dil} onChange={(e) => setSablon({ ...sablon, dil: e.target.value })} className="min-h-10 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold">
          Parametreler (her satıra bir tane: {"{{1}}"}, {"{{2}}"}…)
          <textarea value={sablon.parametreler} onChange={(e) => setSablon({ ...sablon, parametreler: e.target.value })} rows={2} className="rounded-control border border-line-strong bg-card px-3 py-2 text-sm font-medium outline-none focus:border-ink" />
        </label>
        {hata && <Uyari ton="err">{hata}</Uyari>}
        <button type="submit" disabled={bekliyor || !sablon.ad.trim()} className={`${BUTON} self-end bg-ink text-white hover:bg-ink-soft`}>
          <Send size={16} aria-hidden="true" />{bekliyor ? "Gönderiliyor…" : "Şablonu gönder"}
        </button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 border-t border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        gonder();
      }}
    >
      {mod.tur === "etiketli" && (
        <Uyari>
          Standart 24 saat penceresi kapandı. Mesaj insan temsilci etiketiyle (HUMAN_AGENT) gider{mod.bitis ? `; bu yol ${tarihSaat(mod.bitis)} tarihinde kapanır` : ""}. Bot bu konuşmaya yazamaz.
        </Uyari>
      )}
      {d.botAktif && <p className="text-xs font-semibold text-muted">Siz yazınca bu konuşmada bot susar.</p>}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`cevap-${d.id}`}>Cevap</label>
        <textarea
          id={`cevap-${d.id}`}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              gonder();
            }
          }}
          rows={2}
          placeholder={`${d.kanalAd} üzerinden cevap yazın… (Enter gönderir, Shift+Enter yeni satır)`}
          className="min-h-11 flex-1 resize-y rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink"
        />
        <button type="submit" disabled={bekliyor || !metin.trim()} className={`${BUTON} bg-[#1F8F4E] text-white hover:brightness-95`} aria-label="Gönder">
          <Send size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{bekliyor ? "Gönderiliyor…" : "Gönder"}</span>
        </button>
      </div>
      {hata && <Uyari ton="err">{hata}</Uyari>}
    </form>
  );
}

/* ---------------- Sağ panel: bağlı fırsat ---------------- */

function FirsatPaneli({ d, ekip, onDegisti }: { d: KonusmaDetayi; ekip: { id: string; ad: string }[]; onDegisti: () => void }) {
  const f = d.firsat;
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  return (
    <aside aria-label="Bağlı fırsat" className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-bold tracking-[0.08em] text-muted">BAĞLI FIRSAT</h3>
      {!f ? (
        <p className="text-sm text-muted">Bu konuşma henüz bir fırsata bağlanmadı (işleyici mesajı işleyince bağlanır).</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <b className="text-base leading-snug">{f.firma}</b>
            {f.icerik && <span className="text-xs text-muted">{f.icerik}</span>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
            <dt className="text-xs font-bold text-muted">Aşama</dt>
            <dd><span className="inline-flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ASAMA_BILGI[f.asama].renk }} aria-hidden="true" />{f.asamaAd}</span></dd>
            <dt className="text-xs font-bold text-muted">Değer</dt>
            <dd className="font-bold tabular-nums">{tl(f.tutar)}</dd>
            <dt className="text-xs font-bold text-muted"><label htmlFor={`sorumlu-${f.id}`}>Sorumlu</label></dt>
            <dd>
              <select
                id={`sorumlu-${f.id}`}
                value={f.sorumluId ?? ""}
                disabled={bekliyor}
                onChange={(e) => {
                  const v = e.target.value;
                  setHata(null);
                  baslat(async () => {
                    const r = await sorumluDegistir(f.id, v).catch(() => ({ hata: "Kaydedilemedi." }));
                    if (r.hata) setHata(r.hata);
                    onDegisti();
                  });
                }}
                className="min-h-9 w-full cursor-pointer rounded-lg border border-line-strong bg-card px-2 text-sm font-semibold"
              >
                <option value="">Atanmadı</option>
                {ekip.map((u) => <option key={u.id} value={u.id}>{u.ad}</option>)}
                {f.sorumluId && !ekip.some((u) => u.id === f.sorumluId) && <option value={f.sorumluId}>{f.sorumluAd ?? "Pasif kullanıcı"}</option>}
              </select>
            </dd>
          </dl>
          {hata && <Uyari ton="err">{hata}</Uyari>}
          <Link href={`/satis-hatti#firsat-${f.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-info hover:underline">
            Fırsata git <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </>
      )}
      {d.musteriId && (
        <Link href={`/musteriler/${d.musteriId}`} className="inline-flex items-center gap-1 text-sm font-bold text-info hover:underline">
          Müşteri kaydı <ExternalLink size={14} aria-hidden="true" />
        </Link>
      )}
      <p className="text-xs text-muted">Aşama Satış Hattı&apos;nda değişir. Devral / bota geri ver P1.3&apos;te gelir.</p>
    </aside>
  );
}

/* ---------------- Ana görünüm ---------------- */

export default function GelenKutusu({
  ilkListe,
  ilkDetay,
  kanallar,
  ekip,
  ben,
  simulasyonKanallari,
}: {
  ilkListe: GelenKutusuSatiri[];
  ilkDetay: KonusmaDetayi | null;
  kanallar: KanalBilgisi[];
  ekip: { id: string; ad: string }[];
  /** Oturumdaki kullanıcı ("u6"), "Bana atanan" için */
  ben: string;
  /** Doluysa simülasyon düğmesi görünür (yalnızca geliştirmede ve Yönetici) */
  simulasyonKanallari: SimulasyonKanali[] | null;
}) {
  const [liste, setListe] = useState(ilkListe);
  const [secili, setSecili] = useState<number | null>(ilkDetay?.id ?? null);
  const [detay, setDetay] = useState<KonusmaDetayi | null>(ilkDetay);
  const [sekme, setSekme] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre | null>(null);
  const [arama, setArama] = useState("");
  const [duyuru, setDuyuru] = useState<string | null>(null);
  const [simulasyon, setSimulasyon] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const seciliRef = useRef(secili);
  useEffect(() => {
    seciliRef.current = secili;
  }, [secili]);

  const yenile = useCallback(async () => {
    const id = seciliRef.current;
    try {
      const [l, d] = await Promise.all([gelenKutusuGetir(), id ? konusmaGetir(id) : Promise.resolve(null)]);
      setListe(l);
      if (id && seciliRef.current === id) setDetay(d);
    } catch {
      /* geçici hata: bir sonraki sinyalde tekrar denenir */
    }
  }, []);
  const canli = useCanliYenileme(() => void yenile());

  const sec = useCallback((id: number) => {
    setSecili(id);
    setYukleniyor(true);
    const u = new URL(window.location.href);
    u.searchParams.set("k", String(id));
    window.history.replaceState(null, "", u);
    konusmaGetir(id).then((d) => {
      if (seciliRef.current === id) setDetay(d);
    }).catch(() => setDuyuru("Konuşma açılamadı.")).finally(() => setYukleniyor(false));
  }, []);

  // Okundu: açık konuşmanın son müşteri mesajı, sekme görünürken (kullanıcı başına, sunucuda geri gitmez)
  const okunan = useRef(new Map<number, number>());
  useEffect(() => {
    if (!detay) return;
    const sonGelen = detay.mesajlar.findLast((m) => m.yon === "gelen")?.id;
    if (!sonGelen || (okunan.current.get(detay.id) ?? 0) >= sonGelen) return;
    const isaretle = () => {
      if (document.visibilityState !== "visible") return;
      okunan.current.set(detay.id, sonGelen);
      setListe((l) => l.map((x) => (x.id === detay.id ? { ...x, okunmamis: 0 } : x)));
      okunduIsaretle(detay.id, sonGelen).catch(() => okunan.current.delete(detay.id));
    };
    isaretle();
    document.addEventListener("visibilitychange", isaretle);
    return () => document.removeEventListener("visibilitychange", isaretle);
  }, [detay]);

  useEffect(() => {
    if (!duyuru) return;
    const t = setTimeout(() => setDuyuru(null), 5000);
    return () => clearTimeout(t);
  }, [duyuru]);

  const sayilar = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of liste) m.set(k.kanal, (m.get(k.kanal) ?? 0) + k.okunmamis);
    return m;
  }, [liste]);
  const toplam = useMemo(() => liste.reduce((t, k) => t + k.okunmamis, 0), [liste]);
  const sekmeKanali = kanallar.find((k) => k.kanal === sekme) ?? null;
  const gorunen = useMemo(() => listeyiSuz(liste, { kanal: sekme, filtre, arama, ben }), [liste, sekme, filtre, arama, ben]);

  const simulasyonIslendi = useCallback((konusmaId: number | null, metin: string) => {
    setSimulasyon(false);
    setDuyuru(metin);
    void yenile();
    if (konusmaId) sec(konusmaId);
  }, [yenile, sec]);

  const sekmeSinifi = (aktif: boolean) =>
    `inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-control px-3 text-sm font-bold transition-colors ${aktif ? "bg-ink text-white" : "text-[#474A42] hover:bg-[#F4F5F0]"}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Kanallar" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          <button type="button" role="tab" aria-selected={sekme === null} onClick={() => setSekme(null)} className={sekmeSinifi(sekme === null)}>
            Tümü {toplam > 0 && <span className="rounded-full bg-[#1F8F4E] px-1.5 text-[11px] text-white">{toplam}</span>}
          </button>
          {kanallar.map((k) => (
            <button key={k.kanal} type="button" role="tab" aria-selected={sekme === k.kanal} onClick={() => setSekme(k.kanal)} className={sekmeSinifi(sekme === k.kanal)}>
              {k.ad}
              {!k.bagli ? (
                <span className={`text-[11px] font-semibold ${sekme === k.kanal ? "text-[#C3C6BC]" : "text-muted"}`}>· Kanal bağlı değil</span>
              ) : (sayilar.get(k.kanal) ?? 0) > 0 ? (
                <span className="rounded-full bg-[#1F8F4E] px-1.5 text-[11px] text-white" aria-label={`${sayilar.get(k.kanal)} okunmamış`}>{sayilar.get(k.kanal)}</span>
              ) : null}
            </button>
          ))}
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted" title={canli === "canli" ? "Yeni mesajlar anında görünür" : "Canlı bağlantı yok; 20 sn'de bir yenileniyor"}>
          <span className={`h-2 w-2 rounded-full ${canli === "canli" ? "bg-[#1F8F4E]" : canli === "yedek" ? "bg-warn" : "bg-line-strong"}`} aria-hidden="true" />
          {canli === "canli" ? "Canlı" : canli === "yedek" ? "Yenileniyor (20 sn)" : "Bağlanıyor…"}
        </span>
        {simulasyonKanallari && (
          <button type="button" onClick={() => setSimulasyon(true)} className={`${BUTON} border border-line-strong bg-card hover:bg-[#F4F5F0]`}>
            <MessageCircle size={18} aria-hidden="true" className="text-[#1F8F4E]" />Mesaj simüle et
          </button>
        )}
      </div>

      <div className="grid min-h-[620px] overflow-hidden rounded-card border border-line bg-card lg:h-[calc(100dvh-210px)] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_280px]">
        {/* Liste */}
        <section aria-label="Konuşmalar" className={`flex min-h-0 flex-col border-line lg:border-r ${secili ? "hidden lg:flex" : "flex"}`}>
          <div className="flex flex-col gap-2 border-b border-line p-3">
            <label className="relative flex items-center">
              <span className="sr-only">Ara</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 text-muted" />
              <input type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="İsim, firma, telefon" className="min-h-10 w-full rounded-control border border-line-strong bg-card pl-9 pr-3 text-sm font-medium outline-none focus:border-ink" />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtreler">
              {FILTRELER.map((f) => (
                <button key={f.id} type="button" aria-pressed={filtre === f.id} onClick={() => setFiltre(filtre === f.id ? null : f.id)}
                  className={`min-h-8 cursor-pointer rounded-full border px-2.5 text-xs font-bold transition-colors ${filtre === f.id ? "border-ink bg-ink text-white" : "border-line-strong text-[#474A42] hover:bg-[#F4F5F0]"}`}>
                  {f.ad}
                </button>
              ))}
            </div>
          </div>
          {sekmeKanali && !sekmeKanali.bagli ? (
            <div className="flex flex-col gap-2 p-5 text-sm">
              <b>{sekmeKanali.ad} bağlı değil</b>
              <p className="text-muted">{sekmeKanali.ad} adaptörü Faz 4&apos;te eklenecek. Bağlantı durumu ve kurulum adımları için <Link href="/bot/kanallar" className="font-bold text-info hover:underline">Bot › Kanallar</Link>.</p>
            </div>
          ) : gorunen.length ? (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {gorunen.map((k) => <ListeOgesi key={k.id} k={k} secili={k.id === secili} onSec={() => sec(k.id)} />)}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted">{liste.length ? "Bu filtreye uyan konuşma yok." : "Henüz konuşma yok. Müşteri kanaldan yazınca burada görünür."}</p>
          )}
        </section>

        {/* Sohbet */}
        <section aria-label="Sohbet" className={`flex min-h-[520px] min-w-0 flex-col ${secili ? "flex" : "hidden lg:flex"}`}>
          {detay && detay.id === secili ? (
            <>
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3 py-2.5">
                <button type="button" onClick={() => setSecili(null)} aria-label="Listeye dön" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-control hover:bg-[#F4F5F0] lg:hidden">
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <KanalSimgesi kanal={detay.kanal} />
                <div className="flex min-w-[10rem] flex-1 flex-col">
                  <h2 className="truncate text-sm font-extrabold">{detay.ad}</h2>
                  <span className="truncate text-xs text-muted">{detay.kanalAd} · {detay.kimlik}</span>
                </div>
                <BotRozeti durum={botDurumu(detay.botAktif, detay.mesajlar.at(-1)?.yon)} />
                <Chip ton={detay.pencere.durum === "acik" ? "ok" : detay.pencere.durum === "yalnizca_temsilci" ? "warn" : "err"}>
                  {detay.pencere.durum === "acik" ? `Pencere açık${detay.pencere.bitis ? ` · kapanış ${tarihSaat(detay.pencere.bitis)}` : ""}` : detay.pencere.durum === "yalnizca_temsilci" ? "Yalnızca temsilci" : "Pencere kapalı"}
                </Chip>
              </header>
              <Sohbet d={detay} />
              <CevapKutusu key={detay.id} d={detay} onGonderildi={(demo) => {
                if (demo) setDuyuru("Demo modu: kanal anahtarı tanımlı olmadığı için mesaj kaydedildi ama gönderilmedi.");
                void yenile();
              }} />
              <div className="border-t border-line xl:hidden"><FirsatPaneli d={detay} ekip={ekip} onDegisti={() => void yenile()} /></div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
              {yukleniyor ? "Konuşma açılıyor…" : secili ? "Konuşma bulunamadı." : "Soldan bir konuşma seçin."}
            </div>
          )}
        </section>

        {/* Sağ panel */}
        <div className="hidden min-h-0 overflow-y-auto border-l border-line xl:block">
          {detay && detay.id === secili && <FirsatPaneli d={detay} ekip={ekip} onDegisti={() => void yenile()} />}
        </div>
      </div>

      {simulasyonKanallari && (
        <Modal acik={simulasyon} onKapat={() => setSimulasyon(false)} baslik="Mesaj simüle et" aciklama="Webhook'a gelen mesajla aynı akış: kuyruk + işleyici">
          <KonusmaSimulasyonu kanallar={simulasyonKanallari} onIslendi={simulasyonIslendi} onVazgec={() => setSimulasyon(false)} />
        </Modal>
      )}

      {duyuru && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-40px)] max-w-sm -translate-x-1/2 rounded-card bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_40px_rgba(14,15,12,0.25)]">
          {duyuru}
        </div>
      )}
    </>
  );
}
