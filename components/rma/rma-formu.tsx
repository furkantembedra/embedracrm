"use client";

// Yeni RMA formu: seri no yazılınca garanti durumu sorgulanır, garanti dışıysa ücret istenir.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormGonder } from "@/lib/use-form-gonder";
import Chip from "@/components/ui/chip";
import { rmaAc, seriSorgula, type RmaFormDurumu } from "./actions";
import type { GarantiBilgisi } from "./garanti";
import { ARIZA_TIPLERI, ONCELIKLER, type RmaKaydi } from "./queries";
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
        <dt className="text-muted">Garanti bitişi</dt><dd>{b.garantiBitis ? tarihYaz(b.garantiBitis) : "—"}</dd>
        <dt className="text-muted">Lisans</dt><dd>{b.lisans.plan}{b.lisans.bitis ? ` · ${tarihYaz(b.lisans.bitis)}'e kadar` : " · yok"}</dd>
        <dt className="text-muted">Geçmiş RMA</dt><dd>{b.rmalar.length ? b.rmalar.map((r) => r.id).join(", ") : "Yok"}</dd>
      </dl>
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
        <label className={ALAN}>
          Fotoğraflar <span className="font-normal text-muted">(dosya adı / bağlantı, virgülle)</span>
          <input name="fotograflar" placeholder="ekran-catlak.jpg" className={GIRDI} />
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
