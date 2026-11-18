"use client";

// Yeni RMA formu: seri no yazılınca garanti durumu sorgulanır, garanti dışıysa ücret istenir.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormGonder } from "@/lib/use-form-gonder";
import Chip from "@/components/ui/chip";
import { garantiUzat, garantiUzatmaKaldir, rmaAc, seriSorgula, type GarantiUzatSonucu, type RmaFormDurumu } from "./actions";
import type { GarantiBilgisi } from "./garanti";
import { type RmaKaydi } from "./queries";
import { ARIZA_TIPLERI, ONCELIKLER, UZATMA_AYLARI } from "./sabitler";
import { tarihYaz } from "./ortak";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

export function GarantiKarti({ b }: { b: GarantiBilgisi }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 text-[13px] ${b.garantide ? "border-lime bg-lime-bg/50" : "border-[#F5C089] bg-warn-bg/50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm">{b.seriNo} · {b.model}</b>
        <Chip ton={b.garantide ? "lime" : "warn"}>{b.garantide ? "Garantide" : "Garanti dışı"}</Chip>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted">Sahibi</dt><dd className="font-semibold">{b.sahip.ad}{b.bayi && b.sahip.tur === "musteri" ? ` · bayi: ${b.bayi}` : ""}</dd>
        <dt className="text-muted">Satış</dt><dd>{b.satisTarihi ? `${tarihYaz(b.satisTarihi)} (${b.satisKaynagi})` : "Bilinmiyor"}</dd>
        <dt className="text-muted">Garanti bitişi</dt>
        <dd>{b.garantiBitis ? tarihYaz(b.garantiBitis) : "—"}{b.uzatmalar.length > 0 && <span className="text-xs text-muted"> · standart {b.standartBitis ? tarihYaz(b.standartBitis) : "—"} + {b.uzatmalar.reduce((t, u) => t + u.ay, 0)} ay uzatma</span>}</dd>
        <dt className="text-muted">Lisans</dt><dd>{b.lisans.plan}{b.lisans.bitis ? ` · ${tarihYaz(b.lisans.bitis)}'e kadar` : " · yok"}</dd>
        <dt className="text-muted">Geçmiş RMA</dt><dd>{b.rmalar.length ? b.rmalar.map((r) => r.id).join(", ") : "Yok"}</dd>
      </dl>
    </div>
  );
}

/** Cihaza ek garanti tanır / kaldırır. İçinde <form> yoktur (garanti sorgu formunun içinde de kullanılır). */
export function GarantiUzatma({ b, onSonuc }: { b: GarantiBilgisi; onSonuc: (s: GarantiUzatSonucu) => void }) {
  const [acik, setAcik] = useState(false);
  const [ay, setAy] = useState<number>(12);
  const [not, setNot] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const calistir = (is: () => Promise<GarantiUzatSonucu>, sonra?: () => void) =>
    baslat(async () => {
      const s = await is();
      if (s.hata) return setHata(s.hata);
      setHata(null);
      sonra?.();
      onSonuc(s);
    });
  const girdi = "min-h-10 min-w-0 rounded-control border border-line-strong bg-card px-3 text-[13px] font-medium outline-none focus:border-ink";
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      {b.uzatmalar.length > 0 && (
        <ul className="flex flex-col gap-1">
          {b.uzatmalar.map((u) => (
            <li key={u.id} className="flex items-center gap-2 text-xs">
              <Chip ton="lime">+{u.ay} ay</Chip>
              <span className="min-w-0 flex-1 truncate text-muted">{tarihYaz(u.tarih)}{u.not ? ` · ${u.not}` : ""}</span>
              <button type="button" disabled={bekliyor} aria-label={`+${u.ay} ay uzatmayı kaldır`} onClick={() => calistir(() => garantiUzatmaKaldir(b.seriNo, u.id))} className="cursor-pointer font-bold text-err hover:underline disabled:opacity-50">Kaldır</button>
            </li>
          ))}
        </ul>
      )}
      {acik ? (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Uzatma süresi" value={ay} onChange={(e) => setAy(Number(e.target.value))} className={girdi}>
            {UZATMA_AYLARI.map((a) => <option key={a} value={a}>+{a} ay</option>)}
          </select>
          <input aria-label="Uzatma notu" value={not} maxLength={200} onChange={(e) => setNot(e.target.value)} placeholder="Neden? (paket satışı, jest…)" className={`${girdi} flex-[1_1_160px]`} />
          <button type="button" disabled={bekliyor} onClick={() => calistir(() => garantiUzat(b.seriNo, ay, not), () => { setAcik(false); setNot(""); })} className="min-h-10 cursor-pointer rounded-control bg-ink px-4 text-[13px] font-bold text-white hover:bg-ink-soft disabled:opacity-50">Uzat</button>
          <button type="button" onClick={() => { setAcik(false); setHata(null); }} className="min-h-10 cursor-pointer px-2 text-[13px] font-bold text-muted hover:underline">Vazgeç</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAcik(true)} className="w-fit cursor-pointer font-bold text-info hover:underline">Garantiyi uzat →</button>
      )}
      {hata && <p role="alert" className="text-xs font-semibold text-err">{hata}</p>}
    </div>
  );
}

export default function RmaFormu({
  talepler = [],
  baslangicSeri = "",
  onKaydedildi,
  onVazgec,
}: {
  talepler?: { id: string; baslik: string; seriNo: string | null; musteri: string }[];
  baslangicSeri?: string;
  onKaydedildi: (r: RmaKaydi) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<RmaFormDurumu, FormData>(rmaAc, {});
  const gonderKorunarak = useFormGonder(gonder);
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<number | null>(null);
  const [seri, setSeri] = useState(baslangicSeri);
  const [bilgi, setBilgi] = useState<GarantiBilgisi | null>(null);
  const [sorguHata, setSorguHata] = useState<string | null>(null);
  const [sorgulaniyor, baslat] = useTransition();

  useEffect(() => {
    if (durum.rma && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onKaydedildi(durum.rma);
    }
  }, [durum.rma, durum.zaman, onKaydedildi]);

  function sorgula(deger = seri) {
    if (!deger.trim()) return;
    baslat(async () => {
      const s = await seriSorgula(deger);
      if ("hata" in s) {
        setBilgi(null);
        setSorguHata(s.hata);
      } else {
        setBilgi(s);
        setSorguHata(null);
      }
    });
  }

  const ilgili = talepler.filter((t) => !bilgi || t.seriNo === bilgi.seriNo || t.musteri === bilgi.sahip.ad);

  return (
    <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className={ALAN}>
          Seri no *
          <div className="flex gap-2">
            <input
              name="seriNo" value={seri} autoFocus placeholder="EO1-2402-0612"
              onChange={(e) => setSeri(e.target.value.toUpperCase())}
              onBlur={() => sorgula()}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sorgula(); } }}
              className={`${GIRDI} flex-1 font-mono`} aria-invalid={!!h.seriNo || !!sorguHata}
            />
            <button type="button" onClick={() => sorgula()} disabled={sorgulaniyor} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">
              {sorgulaniyor ? "…" : "Sorgula"}
            </button>
          </div>
        </label>
        {(h.seriNo || sorguHata) && <span className="text-xs font-semibold text-err">{h.seriNo ?? sorguHata}</span>}
        {bilgi && <GarantiKarti b={bilgi} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ALAN}>
          Arıza tipi *
          <select name="arizaTipi" defaultValue="" className={GIRDI} aria-invalid={!!h.arizaTipi}>
            <option value="" disabled>Seçin…</option>
            {ARIZA_TIPLERI.map((a) => <option key={a}>{a}</option>)}
          </select>
          {h.arizaTipi && <span className="text-xs font-semibold text-err">{h.arizaTipi}</span>}
        </label>
        <label className={ALAN}>
          Öncelik
          <select name="oncelik" defaultValue="Normal" className={GIRDI}>
            {ONCELIKLER.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className={ALAN}>
          Destek talebi
          <select name="destekTalebiId" defaultValue="" className={GIRDI}>
            <option value="">Bağlı talep yok</option>
            {ilgili.map((t) => <option key={t.id} value={t.id}>#{t.id} · {t.baslik}</option>)}
          </select>
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Arıza açıklaması *
          <textarea name="ariza" rows={3} maxLength={1000} placeholder="Müşterinin tarif ettiği sorun, ne zaman başladığı…" className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err" aria-invalid={!!h.ariza} />
          {h.ariza && <span className="text-xs font-semibold text-err">{h.ariza}</span>}
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Fotoğraf / belge <span className="font-normal text-muted">(JPG, PNG, WEBP, GIF veya PDF · dosya başına en çok 1,5 MB)</span>
          <input name="dosyalar" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" aria-invalid={!!h.dosyalar}
            className="min-h-11 rounded-control border border-dashed border-line-strong bg-card px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[13px] file:font-bold file:text-white" />
          {h.dosyalar && <span className="text-xs font-semibold text-err">{h.dosyalar}</span>}
        </label>
        {bilgi && !bilgi.garantide && (
          <label className={ALAN}>
            Servis ücreti (TL, KDV hariç)
            <input name="ucret" type="number" min={0} step={100} inputMode="numeric" className={GIRDI} aria-invalid={!!h.ucret} />
          </label>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Açılıyor…" : "RMA aç"}
        </button>
      </div>
    </form>
  );
}
