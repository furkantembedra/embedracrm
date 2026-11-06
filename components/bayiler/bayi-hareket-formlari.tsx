"use client";

// Bayi detayındaki üç işlem formu: bayiye cihaz sevki, bayinin bildirdiği satış, bayinin sattığı lisans.
import { useActionState, useEffect, useRef, useState } from "react";
import { CIHAZ_MODELLERI, URUN_BILGI, type CihazModeli } from "@/lib/urunler";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import { cihazSevkEt, lisansSat, satisBildir, type HareketDurumu } from "./hareket-actions";

const GIRDI =
  "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const ALAN = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold";
const BIRINCIL = "min-h-11 cursor-pointer rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60";
const IKINCIL = "min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0]";

function Hata({ mesaj }: { mesaj?: string }) {
  return mesaj ? <span role="alert" className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

/** Sonuç geldiğinde bir kez bildirir */
function useSonuc(durum: HareketDurumu, onKaydedildi: (d: HareketDurumu) => void) {
  const bildirildi = useRef<number | null>(null);
  useEffect(() => {
    if (!durum.hareket || !durum.zaman || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman;
    onKaydedildi(durum);
  }, [durum, onKaydedildi]);
}

function Altlik({ bekliyor, etiket, onVazgec }: { bekliyor: boolean; etiket: string; onVazgec: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onVazgec} className={IKINCIL}>Vazgeç</button>
      <button type="submit" disabled={bekliyor} className={BIRINCIL}>{bekliyor ? "Kaydediliyor…" : etiket}</button>
    </div>
  );
}

function ModelSecimi({ deger, onDegis, hata }: { deger: CihazModeli; onDegis: (m: CihazModeli) => void; hata?: string }) {
  return (
    <div className={ALAN}>
      <span>Model *</span>
      <div role="group" aria-label="Model" className="flex gap-1 rounded-control bg-bg p-1">
        {CIHAZ_MODELLERI.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={deger === m}
            onClick={() => onDegis(m)}
            className={`min-h-9 flex-1 cursor-pointer rounded-[9px] text-[13px] font-bold ${deger === m ? "bg-card shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42]"}`}
          >
            {URUN_BILGI[m].ad}
          </button>
        ))}
      </div>
      <input type="hidden" name="model" value={deger} />
      <Hata mesaj={hata} />
    </div>
  );
}

/* ---------- Cihaz sevk et ---------- */

export function SevkFormu({ bayiId, bugun, onKaydedildi, onVazgec }: { bayiId: string; bugun: string; onKaydedildi: (d: HareketDurumu) => void; onVazgec: () => void }) {
  const [durum, gonder, bekliyor] = useActionState<HareketDurumu, FormData>(cihazSevkEt, {});
  const [model, setModel] = useState<CihazModeli>("ONE");
  useSonuc(durum, onKaydedildi);
  const h = durum.hatalar ?? {};
  return (
    <form action={gonder} className="flex flex-col gap-3">
      <input type="hidden" name="bayiId" value={bayiId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ModelSecimi deger={model} onDegis={setModel} hata={h.model} />
        <label className={ALAN}>
          Sevk tarihi *
          <input type="date" name="tarih" defaultValue={bugun} className={GIRDI} aria-invalid={!!h.tarih} />
          <Hata mesaj={h.tarih} />
        </label>
      </div>
      <label className={ALAN}>
        Seri numaraları
        <textarea name="seriler" rows={3} placeholder={"Her satıra bir seri no\nEO1-2611-0001\nEO1-2611-0002"} className={`${GIRDI} py-2 font-mono text-[13px]`} aria-invalid={!!h.seriler} />
        <span className="text-xs font-normal text-muted">Seri no girilirse cihazlar Cihaz & Lisans&apos;a bayi stoğu olarak eklenir. Bilinmiyorsa adet yazın.</span>
        <Hata mesaj={h.seriler} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Adet (seri no yoksa)
          <input type="number" name="adet" min={1} max={500} inputMode="numeric" className={GIRDI} aria-invalid={!!h.adet} />
          <Hata mesaj={h.adet} />
        </label>
        <label className={ALAN}>
          Not
          <input name="not" placeholder="Ör. irsaliye no" className={GIRDI} />
        </label>
      </div>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Sevkiyatı kaydet" onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- Satış bildir ---------- */

export function SatisFormu({
  bayiId,
  bugun,
  stokSerileri,
  stok,
  musteriler,
  onKaydedildi,
  onVazgec,
}: {
  bayiId: string;
  bugun: string;
  stokSerileri: { model: CihazModeli; seriNo: string }[];
  stok: Record<CihazModeli, number>;
  musteriler: { id: string; ad: string }[];
  onKaydedildi: (d: HareketDurumu) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<HareketDurumu, FormData>(satisBildir, {});
  const [model, setModel] = useState<CihazModeli>(stok.ONE > 0 || stok["ONE Lite"] === 0 ? "ONE" : "ONE Lite");
  const [musteri, setMusteri] = useState("");
  useSonuc(durum, onKaydedildi);
  const h = durum.hatalar ?? {};
  const seriler = stokSerileri.filter((s) => s.model === model);
  return (
    <form action={gonder} className="flex flex-col gap-3">
      <input type="hidden" name="bayiId" value={bayiId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ModelSecimi deger={model} onDegis={setModel} hata={h.model} />
        <label className={ALAN}>
          Satış tarihi *
          <input type="date" name="tarih" defaultValue={bugun} className={GIRDI} aria-invalid={!!h.tarih} />
          <Hata mesaj={h.tarih} />
        </label>
      </div>
      <p className="text-xs text-muted">Bayinin stoğunda {stok[model]} adet {URUN_BILGI[model].ad} var.</p>

      {seriler.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13px] font-bold">Stoktan seçin</legend>
          <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto">
            {seriler.map((s) => (
              <label key={s.seriNo} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-2.5 font-mono text-xs">
                <input type="checkbox" name="stokSeri" value={s.seriNo} className="h-4 w-4 accent-[#0E0F0C]" />
                {s.seriNo}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className={ALAN}>
        {seriler.length ? "veya seri no yazın" : "Satılan cihazların seri numaraları *"}
        <textarea name="seriler" rows={3} placeholder={"Her satıra bir seri no\nEO1-2611-0001\nEO1-2611-0002"} className={`${GIRDI} py-2 font-mono text-[13px]`} aria-invalid={!!h.seriler} />
        <span className="text-xs font-normal text-muted">Her satıra bir seri numarası yazın.</span>
        <Hata mesaj={h.seriler} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Müşteri *
          <select name="musteri" value={musteri} onChange={(e) => setMusteri(e.target.value)} className={GIRDI} aria-invalid={!!h.musteri}>
            <option value="" disabled>Seçin</option>
            <option value="yeni">+ Yeni müşteri</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
          <Hata mesaj={h.musteri} />
        </label>
        {musteri === "yeni" && (
          <label className={ALAN}>
            Yeni müşterinin adı *
            <input name="yeniMusteri" autoFocus className={GIRDI} aria-invalid={!!h.yeniMusteri} />
            <Hata mesaj={h.yeniMusteri} />
          </label>
        )}
      </div>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Satışı kaydet" onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- Lisans sat ---------- */

export function LisansSatisFormu({ bayiId, bugun, cihazlar, onKaydedildi, onVazgec }: { bayiId: string; bugun: string; cihazlar: Cihaz[]; onKaydedildi: (d: HareketDurumu) => void; onVazgec: () => void }) {
  const [durum, gonder, bekliyor] = useActionState<HareketDurumu, FormData>(lisansSat, {});
  useSonuc(durum, onKaydedildi);
  const h = durum.hatalar ?? {};
  const satilmis = cihazlar.filter((c) => c.musteriId);
  if (!satilmis.length) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-control bg-[#F4F5F0] px-3 py-3 text-[13px] text-[#474A42]">
          Lisans satmak için önce bu bayinin müşterisine sattığı cihazı <b>Satış bildir</b> ile kaydedin.
        </p>
        <div className="flex justify-end"><button type="button" onClick={onVazgec} className={IKINCIL}>Kapat</button></div>
      </div>
    );
  }
  return (
    <form action={gonder} className="flex flex-col gap-3">
      <input type="hidden" name="bayiId" value={bayiId} />
      <label className={ALAN}>
        Cihaz *
        <select name="seriNo" defaultValue="" className={GIRDI} aria-invalid={!!h.seriNo}>
          <option value="" disabled>Seçin</option>
          {satilmis.map((c) => (
            <option key={c.seriNo} value={c.seriNo}>
              {c.seriNo} · {c.musteri}{c.lisansBitis ? ` · ${c.plan} (${c.lisansBitis.split("-").reverse().join(".")})` : " · lisanssız"}
            </option>
          ))}
        </select>
        <Hata mesaj={h.seriNo} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ALAN}>
          Plan *
          <select name="plan" defaultValue="Pro" className={GIRDI}>
            {["Basic", "Pro", "Pro+"].map((p) => <option key={p}>{p}</option>)}
          </select>
          <Hata mesaj={h.plan} />
        </label>
        <label className={ALAN}>
          Süre *
          <select name="sure" defaultValue="12" className={GIRDI}>
            <option value="12">12 ay</option>
            <option value="24">24 ay</option>
            <option value="36">36 ay</option>
          </select>
          <Hata mesaj={h.sure} />
        </label>
        <label className={ALAN}>
          Başlangıç *
          <input type="date" name="baslangic" defaultValue={bugun} className={GIRDI} />
          <Hata mesaj={h.baslangic} />
        </label>
      </div>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Lisansı kaydet" onVazgec={onVazgec} />
    </form>
  );
}
