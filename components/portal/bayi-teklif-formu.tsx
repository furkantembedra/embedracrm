"use client";

// Bayinin müşterisine teklif formu — CRM teklif formunun (components/teklifler/teklif-formu) aynısı:
// lead'in ilgilendiği ürünlerle dolu gelir; kalemler, iskonto, KDV/VAT, şartlar düzenlenir.
// "Taslak kaydet" ya da "Kaydet ve gönder". Revizyonda önceki sürümün kalemleri gelir. Fiyatlar bayinin satış fiyatı.
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CIHAZ_MODELLERI, URUN_BILGI, type CihazModeli } from "@/lib/urunler";
import { teklifToplami } from "@/components/teklifler/ortak";
import type { TeklifKalemi } from "@/components/teklifler/queries";
import { useBugun } from "@/lib/use-bugun";
import { portalTeklifKaydet, type BayiTeklifDurumu } from "./lead-actions";
import type { BayiLead, BayiTeklif } from "./lead-ortak";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const PAKETLER = ["Basic", "Pro", "Pro+"] as const;

type Satir = TeklifKalemi & { anahtar: string };

function ilkKalemler(l: BayiLead, fiyat: Record<string, number>): TeklifKalemi[] {
  const k: TeklifKalemi[] = [{ tur: "cihaz", model: l.ilgi.model, adet: l.ilgi.adet, birimFiyat: fiyat[l.ilgi.model] ?? 0 }];
  if (l.ilgi.plan) k.push({ tur: "lisans", paket: l.ilgi.plan, adet: l.ilgi.adet, birimFiyat: fiyat[l.ilgi.plan] ?? 0 });
  return k;
}
const tarihEkle = (gunBasi: number, gun: number) => new Date(gunBasi + gun * 86_400_000 + 12 * 3_600_000).toISOString().slice(0, 10);

export default function BayiTeklifFormu({ lead, onceki, fiyat, paraBirimi, varsayilanKdv, onKaydedildi, onVazgec }: {
  lead: BayiLead;
  onceki?: BayiTeklif; // revizyon
  fiyat: Record<string, number>; // önerilen satış fiyatları (bayinin para biriminde)
  paraBirimi: "EUR" | "TRY";
  varsayilanKdv: number; // 0.21
  onKaydedildi: (t: BayiTeklif) => void;
  onVazgec: () => void;
}) {
  const para = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: paraBirimi, maximumFractionDigits: 0 }).format(n);
  const bugun = useBugun();
  const [durum, gonder, bekliyor] = useActionState<BayiTeklifDurumu, FormData>(portalTeklifKaydet, {});
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<number | null>(null);
  const sira = useRef(0);
  const satirla = (k: TeklifKalemi): Satir => ({ ...k, anahtar: String(sira.current++) });
  const [satirlar, setSatirlar] = useState<Satir[]>(() => (onceki?.kalemler ?? ilkKalemler(lead, fiyat)).map((k, i) => ({ ...k, anahtar: `i${i}` })));
  const [iskonto, setIskonto] = useState(String(onceki?.iskonto ?? 0));
  const [kdv, setKdv] = useState(String(Math.round((onceki?.kdv ?? varsayilanKdv) * 100)));
  const toplam = teklifToplami({ kalemler: satirlar, iskonto: Number(iskonto.replace(",", ".")) || 0, kdv: (Number(kdv.replace(",", ".")) || 0) / 100 });

  useEffect(() => {
    if (durum.teklif && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onKaydedildi(durum.teklif);
    }
  }, [durum.teklif, durum.zaman, onKaydedildi]);

  const guncelle = (anahtar: string, d: Partial<TeklifKalemi>) => setSatirlar((l) => l.map((s) => (s.anahtar === anahtar ? ({ ...s, ...d } as Satir) : s)));
  const turDegistir = (s: Satir, deger: string) => {
    const [tur, ad] = deger.split(":");
    const yeni: TeklifKalemi =
      tur === "cihaz" ? { tur: "cihaz", model: ad as CihazModeli, adet: s.adet, birimFiyat: fiyat[ad] ?? 0 }
      : tur === "lisans" ? { tur: "lisans", paket: ad, adet: s.adet, birimFiyat: fiyat[ad] ?? 0 }
      : { tur: "ozel", aciklama: "", adet: s.adet, birimFiyat: 0, kdvli: true };
    setSatirlar((l) => l.map((x) => (x.anahtar === s.anahtar ? { ...yeni, anahtar: s.anahtar } : x)));
  };
  const deger = (s: Satir) => (s.tur === "cihaz" ? `cihaz:${s.model}` : s.tur === "lisans" ? `lisans:${s.paket}` : "ozel:");
  const varsayilanGecerlilik = onceki ? undefined : bugun !== null ? tarihEkle(bugun, 15) : undefined;

  return (
    <form noValidate className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const veri = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => gonder(veri));
      }}>
      <input type="hidden" name="leadId" value={lead.id} />
      {onceki && <input type="hidden" name="oncekiId" value={onceki.id} />}
      <input type="hidden" name="kalemler" value={JSON.stringify(satirlar, (anahtar, d) => (anahtar === "anahtar" ? undefined : d))} />
      {h.genel && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-sm font-semibold text-err">{h.genel}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-bold">Kalemler * <span className="font-normal text-muted">(sizin satış fiyatınız, KDV hariç, {paraBirimi})</span></legend>
        {satirlar.map((s, i) => (
          <div key={s.anahtar} className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,120px)_40px] items-start gap-2 rounded-xl bg-[#F4F5F0] p-2 max-sm:grid-cols-[minmax(0,1fr)_72px_40px]">
            <div className="flex min-w-0 flex-col gap-1.5 max-sm:col-span-3">
              <select aria-label={`${i + 1}. kalem ürünü`} value={deger(s)} onChange={(e) => turDegistir(s, e.target.value)} className={GIRDI}>
                <optgroup label="Cihaz">
                  {CIHAZ_MODELLERI.map((m) => <option key={m} value={`cihaz:${m}`}>{URUN_BILGI[m].ad} cihaz</option>)}
                </optgroup>
                <optgroup label="Lisans (12 ay)">
                  {PAKETLER.map((p) => <option key={p} value={`lisans:${p}`}>{p} lisans</option>)}
                </optgroup>
                <option value="ozel:">Özel kalem…</option>
              </select>
              {s.tur === "ozel" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label={`${i + 1}. kalem açıklaması`} value={s.aciklama} onChange={(e) => guncelle(s.anahtar, { aciklama: e.target.value })} placeholder="Açıklama (ör. Kurulum eğitimi)" className={`${GIRDI} flex-1`} />
                  <label className="flex items-center gap-1.5 text-xs font-semibold">
                    <input type="checkbox" checked={s.kdvli} onChange={(e) => guncelle(s.anahtar, { kdvli: e.target.checked })} className="accent-ink" />
                    KDV&apos;li
                  </label>
                </div>
              )}
            </div>
            <input aria-label={`${i + 1}. kalem adedi`} type="number" min={1} inputMode="numeric" value={s.adet} onChange={(e) => guncelle(s.anahtar, { adet: Math.max(1, Number(e.target.value) || 1) })} className={GIRDI} />
            <input aria-label={`${i + 1}. kalem birim fiyatı (${paraBirimi}, KDV hariç)`} type="number" step={10} inputMode="numeric" value={s.birimFiyat} onChange={(e) => guncelle(s.anahtar, { birimFiyat: Number(e.target.value) || 0 })} className={`${GIRDI} max-sm:col-start-2 max-sm:row-start-2`} />
            <button type="button" onClick={() => setSatirlar((l) => l.filter((x) => x.anahtar !== s.anahtar))} aria-label={`${i + 1}. kalemi sil`} className="flex h-11 w-10 cursor-pointer items-center justify-center rounded-control text-[#474A42] hover:bg-card max-sm:col-start-3 max-sm:row-start-2">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setSatirlar((l) => [...l, satirla({ tur: "cihaz", model: "ONE", adet: 1, birimFiyat: fiyat.ONE ?? 0 })])} className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-1.5 rounded-control px-2 text-[13px] font-bold text-info hover:bg-info-bg">
          <Plus size={16} aria-hidden="true" /> Kalem ekle
        </button>
        {h.kalemler && <span className="text-xs font-semibold text-err">{h.kalemler}</span>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ALAN}>
          İskonto (%)
          <input name="iskonto" type="number" min={0} max={50} step={0.5} value={iskonto} onChange={(e) => setIskonto(e.target.value)} className={GIRDI} aria-invalid={!!h.iskonto} />
          {h.iskonto && <span className="text-xs font-semibold text-err">{h.iskonto}</span>}
        </label>
        <label className={ALAN}>
          KDV / VAT (%) <span className="sr-only">cihaz ve KDV&apos;li kalemlere</span>
          <input name="kdv" type="number" min={0} max={30} step={1} value={kdv} onChange={(e) => setKdv(e.target.value)} className={GIRDI} aria-invalid={!!h.kdv} />
          {h.kdv && <span className="text-xs font-semibold text-err">{h.kdv}</span>}
        </label>
        <label className={ALAN}>
          Geçerlilik tarihi *
          <input name="gecerlilik" type="date" defaultValue={onceki?.gecerlilik ?? varsayilanGecerlilik} key={varsayilanGecerlilik} className={GIRDI} aria-invalid={!!h.gecerlilik} />
          {h.gecerlilik && <span className="text-xs font-semibold text-err">{h.gecerlilik}</span>}
        </label>
        <label className={ALAN}>
          Ödeme şartları *
          <input name="odemeSartlari" defaultValue={onceki?.odemeSartlari ?? "%100 peşin · Banka havalesi"} className={GIRDI} aria-invalid={!!h.odemeSartlari} />
          {h.odemeSartlari && <span className="text-xs font-semibold text-err">{h.odemeSartlari}</span>}
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Teslim şartları *
          <input name="teslimSartlari" defaultValue={onceki?.teslimSartlari ?? "Siparişten itibaren 3 iş günü · Kurulum dahil"} className={GIRDI} aria-invalid={!!h.teslimSartlari} />
          {h.teslimSartlari && <span className="text-xs font-semibold text-err">{h.teslimSartlari}</span>}
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Not <span className="sr-only">(isteğe bağlı)</span>
          <textarea name="not" rows={2} maxLength={500} defaultValue={onceki?.not} placeholder="Müşteriye görünen ek açıklama" className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
        </label>
      </div>

      <dl className="flex flex-col gap-1 rounded-xl bg-[#F4F5F0] p-3 text-[13px]">
        <div className="flex justify-between gap-2"><dt className="text-muted">Ara toplam</dt><dd className="tabular-nums">{para(toplam.ara)}</dd></div>
        {toplam.iskonto > 0 && <div className="flex justify-between gap-2"><dt className="text-muted">İskonto</dt><dd className="tabular-nums">−{para(toplam.iskonto)}</dd></div>}
        <div className="flex justify-between gap-2"><dt className="text-muted">KDV / VAT (%{kdv || 0}, cihaz)</dt><dd className="tabular-nums">{para(toplam.kdv)}</dd></div>
        <div className="flex justify-between gap-2 border-t border-line pt-1.5"><dt className="font-bold">Genel toplam</dt><dd className="text-base font-extrabold tabular-nums">{para(toplam.toplam)}</dd></div>
      </dl>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" name="islem" value="taslak" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control border border-ink px-4 text-sm font-bold hover:bg-[#F4F5F0] disabled:opacity-60">Taslak kaydet</button>
        <button type="submit" name="islem" value="gonder" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : onceki ? "Revizyonu gönder" : "Kaydet ve gönder"}
        </button>
      </div>
    </form>
  );
}
