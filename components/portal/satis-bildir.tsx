"use client";

// Bayi portalı "Satış bildir" — CRM bayi detayındaki satış formunun portal karşılığı.
// Her sayfadan açılan pencere: satış tarihi, model, stoktan seri seçimi, müşteri seçimi (kayıtlı / lead / yeni),
// isteğe bağlı 12 aylık lisans. Kaydı portalTopluSatis yapar (seriler sunucuda bayinin stoğuyla doğrulanır).
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import Modal from "@/components/ui/modal";
import { portalTopluSatis, type PortalFormDurumu } from "./actions";
import type { MusteriSecenegi, SatisFormVerisi } from "./satis-ortak";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink";

/** Kayıtlı müşteri / lead seçimi ya da yeni müşteri adı. Formda "musteri" alanı olarak gider. */
export function MusteriSecici({ musteriler, hata }: { musteriler: MusteriSecenegi[]; hata?: string }) {
  const [secim, setSecim] = useState("");
  const [yeni, setYeni] = useState("");
  const deger = secim === "__yeni" ? yeni : secim;
  return (
    <div className="flex flex-col gap-1.5">
      <label className={ALAN}>
        Müşteri *
        <select value={secim} onChange={(e) => setSecim(e.target.value)} className={GIRDI}>
          <option value="" disabled>Seçin…</option>
          {musteriler.length > 0 && (
            <optgroup label="Müşterileriniz ve lead'leriniz">
              {musteriler.map((m) => <option key={m.ad} value={m.ad}>{m.ad} · {m.etiket}</option>)}
            </optgroup>
          )}
          <option value="__yeni">+ Yeni müşteri…</option>
        </select>
      </label>
      {secim === "__yeni" && (
        <input value={yeni} onChange={(e) => setYeni(e.target.value)} maxLength={120} placeholder="Müşteri (firma) adı" aria-label="Yeni müşteri adı" autoFocus className={GIRDI} />
      )}
      <input type="hidden" name="musteri" value={deger} />
      {hata && <span className="text-xs font-semibold text-err">{hata}</span>}
    </div>
  );
}

/** Satışta lisans: bayinin lisans havuzundan (hemen başlar) ya da Embedra'ya sipariş (ödeme sonrası işlenir). Formda "lisans" alanı. */
export function LisansSecici({ havuz, deger, onDegis, etiket = "Lisans" }: { havuz: Record<string, number>; deger?: string; onDegis?: (v: string) => void; etiket?: string }) {
  const ilk = ["Pro", "Pro+", "Basic"].find((p) => (havuz[p] ?? 0) > 0);
  const [ic, setIc] = useState(ilk ? `havuz:${ilk}` : "");
  const v = deger ?? ic;
  const degis = (x: string) => { if (onDegis) onDegis(x); else setIc(x); };
  const [mod, paket] = v.split(":");
  return (
    <label className={ALAN}>
      {etiket}
      <select name="lisans" value={v} onChange={(e) => degis(e.target.value)} className={GIRDI}>
        <option value="">Şimdilik yok</option>
        <optgroup label="Lisans havuzunuzdan · hemen başlar">
          {["Basic", "Pro", "Pro+"].map((p) => <option key={p} value={`havuz:${p}`} disabled={!havuz[p]}>{p} · {havuz[p] ?? 0} adet kaldı</option>)}
        </optgroup>
        <optgroup label="Embedra'dan sipariş et · ödeme sonrası başlar">
          {["Basic", "Pro", "Pro+"].map((p) => <option key={p} value={`siparis:${p}`}>{p} · 12 ay sipariş et</option>)}
        </optgroup>
      </select>
      <span className="text-xs font-normal text-muted">
        {mod === "havuz" ? `Havuzunuzdaki ${paket} lisansı satış tarihinden itibaren 12 ay başlar.`
          : mod === "siparis" ? `${paket} lisans siparişi açılır; Embedra ödemeyi onaylayınca cihaza otomatik işlenir.`
          : "Cihaz lisanssız satılır; sonra Lisanslar sayfasından ekleyebilirsiniz."}
      </span>
    </label>
  );
}

function SatisFormu({ veri, kapat }: { veri: SatisFormVerisi; kapat: (mesaj?: string) => void }) {
  const [durum, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(portalTopluSatis, {});
  const router = useRouter();
  const son = useRef<number | undefined>(undefined);
  const bos = veri.seriBilinmeyen; // seri numarası kayıtsız stok (model başına)
  const toplam = (m: string) => veri.stok.filter((s) => s.model === m).length + (bos[m] ?? 0);
  const modeller = (["ONE", "ONE Lite"] as const).filter((m) => toplam(m) > 0);
  const [yeniSeri, setYeniSeri] = useState("");
  const yeniAdet = new Set(yeniSeri.toUpperCase().split(/[\s,;]+/).filter(Boolean)).size;
  const [model, setModel] = useState(modeller[0] ?? "ONE");
  const [secili, setSecili] = useState<string[]>([]);
  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) { son.current = durum.zaman; router.refresh(); kapat(durum.tamam); }
  }, [durum, router, kapat]);
  const liste = veri.stok.filter((s) => s.model === model);

  if (!modeller.length) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p className="rounded-control bg-[#F4F5F0] p-4">Stoğunuzda seri numarası kayıtlı cihaz yok. Satış bildirmek için önce Sipariş ver&apos;den cihaz alın; cihazlar size sevk edilince burada görünür.</p>
        <p className="text-xs text-muted">Stoğunuzdaki bir cihazın seri numarası listede yoksa Embedra temsilcinize bildirin.</p>
        <div className="flex justify-end"><button type="button" onClick={() => kapat()} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Kapat</button></div>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); startTransition(() => gonder(f)); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ALAN}>
          Satış tarihi *
          <input name="tarih" type="date" defaultValue={veri.bugun} max={veri.bugun} className={GIRDI} />
          {durum.hatalar?.tarih && <span className="text-xs font-semibold text-err">{durum.hatalar.tarih}</span>}
        </label>
        <div className={ALAN}>
          Model
          <div role="group" aria-label="Model" className="flex gap-1 rounded-control bg-bg p-1">
            {(["ONE", "ONE Lite"] as const).map((m) => {
              const n = toplam(m);
              return (
                <button key={m} type="button" aria-pressed={model === m} disabled={!n} onClick={() => { setModel(m); setSecili([]); setYeniSeri(""); }}
                  className={`min-h-9 flex-1 cursor-pointer rounded-[8px] text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${model === m ? "bg-card shadow-sm" : "text-[#474A42]"}`}>
                  {m === "ONE Lite" ? "ONE LITE" : "ONE"} <span className="font-normal text-muted">({n})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 flex w-full items-center text-[13px] font-bold">
          Stoktan satılan cihazlar
          <button type="button" onClick={() => setSecili(secili.length === liste.length ? [] : liste.map((s) => s.seriNo))} className="ml-auto cursor-pointer text-xs font-bold text-info hover:underline">
            {secili.length === liste.length ? "Seçimi kaldır" : "Tümünü seç"}
          </button>
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {liste.map((s) => (
            <label key={s.seriNo} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-2.5 font-mono text-xs has-checked:border-ink has-checked:bg-lime-bg">
              <input type="checkbox" name="seri" value={s.seriNo} checked={secili.includes(s.seriNo)} onChange={() => setSecili((x) => (x.includes(s.seriNo) ? x.filter((y) => y !== s.seriNo) : [...x, s.seriNo]))} className="h-4 w-4 accent-[#0E0F0C]" />
              {s.seriNo}
            </label>
          ))}
        </div>
        {(bos[model] ?? 0) > 0 ? (
          <label className="flex flex-col gap-1.5 rounded-control bg-[#F4F5F0] p-3 text-[13px] font-bold">
            Seri numarası listede olmayan cihazlar
            <span className="text-xs font-normal text-muted">Stoğunuzda seri numarası kayıtlı olmadan sevk edilmiş {bos[model]} adet {model === "ONE Lite" ? "ONE LITE" : "ONE"} var. Sattığınız cihazların seri numaralarını (kutu etiketindeki EO1-YYAA-NNNN) yazın; her satıra bir tane.</span>
            <textarea name="yeniSeri" value={yeniSeri} onChange={(e) => setYeniSeri(e.target.value)} rows={2} placeholder="EO1-2610-0801" className={`${GIRDI} py-2 font-mono`} />
            {yeniAdet > (bos[model] ?? 0) && <span className="text-xs text-err">En fazla {bos[model]} seri numarası girebilirsiniz.</span>}
          </label>
        ) : (
          <span className="text-xs text-muted">Stoğunuzdaki bir cihazın seri numarası listede yoksa Embedra temsilcinize bildirin.</span>
        )}
        <input type="hidden" name="model" value={model} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <MusteriSecici musteriler={veri.musteriler} hata={durum.hatalar?.musteri} />
        <LisansSecici havuz={veri.havuz} etiket="Lisans (12 ay)" />
      </div>

      {durum.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata}</p>}
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={() => kapat()} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor || (!secili.length && !yeniAdet) || yeniAdet > (bos[model] ?? 0)} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50">
          {bekliyor ? "Kaydediliyor…" : `Satışı kaydet${secili.length + yeniAdet ? ` (${secili.length + yeniAdet})` : ""}`}
        </button>
      </div>
    </form>
  );
}

/** Sayfa başlıklarında kullanılan düğme + pencere */
export default function SatisBildirDugmesi({ veri, ikincil = false }: { veri: SatisFormVerisi; ikincil?: boolean }) {
  const [acik, setAcik] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  useEffect(() => {
    if (!mesaj) return;
    const t = setTimeout(() => setMesaj(null), 5000);
    return () => clearTimeout(t);
  }, [mesaj]);
  return (
    <>
      <button type="button" onClick={() => setAcik(true)}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-4 text-sm font-bold transition-colors ${ikincil ? "border border-line-strong bg-card hover:bg-[#F4F5F0]" : "bg-ink text-white hover:bg-ink-soft"}`}>
        <ShoppingCart size={18} aria-hidden="true" /> Satış bildir
      </button>
      <Modal acik={acik} onKapat={() => setAcik(false)} baslik="Satış bildir" aciklama="Stoğunuzdan müşterinize sattığınız cihazlar · lisans ve garanti müşteri adına başlar">
        {acik && <SatisFormu veri={veri} kapat={(m) => { setAcik(false); if (m) setMesaj(m); }} />}
      </Modal>
      {mesaj && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-40px)] max-w-sm -translate-x-1/2 rounded-card bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_40px_rgba(14,15,12,0.25)]">
          {mesaj}
        </div>
      )}
    </>
  );
}
