"use client";

// Manuel sipariş formu (pencerede ya da /siparisler/yeni sayfasında). Ürünler seçilerek girilir,
// tutar seçimden hesaplanır: cihaz ve aksesuara KDV eklenir, lisans KDV'siz.
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tl } from "@/lib/format";
import { useFormGonder } from "@/lib/use-form-gonder";
import { CIHAZ_MODELLERI, URUN_BILGI, VARSAYILAN_FIYAT, type CihazModeli, type FiyatListesi } from "@/lib/urunler";
import { LISANS_SECENEKLERI, gerekenLisans, urunTutari, type LisansSecenegi } from "@/components/satis-hatti/urun-secimi";
import { siparisKaydet, type SiparisFormDurumu } from "./actions";
import { ODEME_YONTEMLERI, type OdemeYontemi, type Siparis, type StokKalemi } from "./queries";

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink disabled:opacity-50 aria-[invalid=true]:border-err";
const ALAN = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold";
const KUCUK = "flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted";

export type FormMusterisi = { id: string; ad: string; sehir: string; ulke: string; cihazlar: { seriNo: string; model: CihazModeli }[] };

function Hata({ mesaj }: { mesaj?: string }) {
  return mesaj ? <span role="alert" className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

const adetAl = (v: string) => Math.min(999, Math.max(0, parseInt(v, 10) || 0));

export default function SiparisFormu({
  musteriler,
  stok,
  fiyatListesi = VARSAYILAN_FIYAT,
  onKaydedildi,
  onVazgec,
}: {
  musteriler: FormMusterisi[];
  stok: StokKalemi[];
  fiyatListesi?: FiyatListesi; // Operasyon › Ayarlar'daki güncel fiyatlar
  onKaydedildi?: (s: Siparis) => void; // yoksa (ayrı sayfada) siparişin adresine gidilir
  onVazgec?: () => void;
}) {
  const router = useRouter();
  const [durum, gonder, bekliyor] = useActionState<SiparisFormDurumu, FormData>(siparisKaydet, {});
  const gonderKorunarak = useFormGonder(gonder);
  const h = durum.hatalar ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const bildirildi = useRef<number | null>(null);

  const [musteriId, setMusteriId] = useState("");
  const musteri = musteriler.find((m) => m.id === musteriId) ?? null;
  const [adres, setAdres] = useState("");
  const [model, setModel] = useState<CihazModeli | null>("ONE");
  const [adet, setAdet] = useState(1);
  const [lisans, setLisans] = useState<LisansSecenegi | null>("Pro");
  const [lisansAdet, setLisansAdet] = useState(1);
  const [ozelFiyat, setOzelFiyat] = useState("");
  const [aksesuar, setAksesuar] = useState<Record<string, number>>({});
  const [odeme, setOdeme] = useState<OdemeYontemi>("Havale/EFT");
  const [odendi, setOdendi] = useState(false);

  const aksesuarlar = stok.filter((k) => k.fiyat !== null);
  const ozel = lisans ? fiyatListesi.lisans[lisans].fiyat === null : false;
  const fiyat = urunTutari({ model, adet, lisans, lisansAdet }, Number(ozelFiyat.replace(/\./g, "")) || 0, fiyatListesi);
  const aksesuarTutari = aksesuarlar.reduce((t, k) => t + (aksesuar[k.kod] ?? 0) * (k.fiyat ?? 0), 0);
  const kdvli = fiyat.cihaz + aksesuarTutari;
  const toplam = fiyat.tutar + aksesuarTutari;
  const kapsam = lisans ? fiyatListesi.lisans[lisans].cihaz : null;

  // Cihaz adedi ya da paket değişince lisans adedi kapsayacak kadar önerilir
  const urunSec = (d: { model?: CihazModeli | null; adet?: number; lisans?: LisansSecenegi | null }) => {
    const y = { model, adet, lisans, ...d };
    setModel(y.model);
    setAdet(y.adet);
    setLisans(y.lisans);
    setLisansAdet(gerekenLisans(y.adet, y.lisans, !!y.model, fiyatListesi));
  };

  useEffect(() => {
    if (!durum.hatalar) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [durum.hatalar]);

  useEffect(() => {
    if (!durum.siparis || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman ?? null;
    if (onKaydedildi) onKaydedildi(durum.siparis);
    else router.push(`/siparisler/${durum.siparis.id}`);
  }, [durum.siparis, durum.zaman, onKaydedildi, router]);

  return (
    <form ref={formRef} onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ALAN}>
          Müşteri *
          <select
            name="musteriId"
            value={musteriId}
            onChange={(e) => {
              const m = musteriler.find((x) => x.id === e.target.value);
              setMusteriId(e.target.value);
              if (m && !adres) setAdres(`${m.sehir}, ${m.ulke}`);
            }}
            className={GIRDI}
            aria-invalid={!!h.musteriId}
          >
            <option value="" disabled>Seçin</option>
            <option value="yeni">+ Yeni müşteri</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
          <Hata mesaj={h.musteriId} />
        </label>
        {musteriId === "yeni" ? (
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
            <label className={ALAN}>
              Adı *
              <input name="yeniMusteri" autoFocus className={GIRDI} aria-invalid={!!h.yeniMusteri} />
              <Hata mesaj={h.yeniMusteri} />
            </label>
            <label className={ALAN}>
              Ülke
              <input name="ulke" defaultValue="Türkiye" className={GIRDI} />
            </label>
          </div>
        ) : (
          <label className={ALAN}>
            Ödeme yöntemi *
            <select name="odeme" value={odeme} onChange={(e) => { setOdeme(e.target.value as OdemeYontemi); setOdendi(e.target.value === "Kart"); }} className={GIRDI} aria-invalid={!!h.odeme}>
              {ODEME_YONTEMLERI.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Hata mesaj={h.odeme} />
          </label>
        )}
        <label className={`${ALAN} sm:col-span-2`}>
          Teslimat adresi {model || Object.values(aksesuar).some(Boolean) ? "*" : <span className="font-normal text-muted">(yalnızca lisansta gerekmez)</span>}
          <input name="adres" value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="Mahalle, ilçe, il" className={GIRDI} aria-invalid={!!h.adres} />
          <Hata mesaj={h.adres} />
        </label>
        {musteriId === "yeni" && (
          <label className={ALAN}>
            Ödeme yöntemi *
            <select name="odeme" value={odeme} onChange={(e) => { setOdeme(e.target.value as OdemeYontemi); setOdendi(e.target.value === "Kart"); }} className={GIRDI} aria-invalid={!!h.odeme}>
              {ODEME_YONTEMLERI.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Hata mesaj={h.odeme} />
          </label>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-bold">Ürünler *</legend>
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2">
          <label className={KUCUK}>
            Cihaz
            <select name="model" value={model ?? ""} onChange={(e) => urunSec({ model: (e.target.value || null) as CihazModeli | null })} className={GIRDI}>
              <option value="">Cihaz yok</option>
              {CIHAZ_MODELLERI.map((m) => <option key={m} value={m}>{URUN_BILGI[m].ad} · {tl(fiyatListesi.cihaz[m])}</option>)}
            </select>
          </label>
          <label className={KUCUK}>
            Cihaz adedi
            <input type="number" name="adet" min={1} max={999} inputMode="numeric" value={adet || ""} disabled={!model}
              onChange={(e) => urunSec({ adet: adetAl(e.target.value) })} onBlur={() => adet < 1 && urunSec({ adet: 1 })} className={`${GIRDI} tabular-nums`} />
          </label>
          <label className={KUCUK}>
            Lisans
            <select name="lisans" value={lisans ?? ""} onChange={(e) => urunSec({ lisans: (e.target.value || null) as LisansSecenegi | null })} className={GIRDI}>
              <option value="">Lisans yok</option>
              {LISANS_SECENEKLERI.map((p) => {
                const k = fiyatListesi.lisans[p];
                return <option key={p} value={p}>{p} · {k.cihaz ? `${k.cihaz} cihaz` : "özel"} · {k.fiyat ? `${tl(k.fiyat)}/yıl` : "özel fiyat"}</option>;
              })}
            </select>
          </label>
          <label className={KUCUK}>
            Lisans adedi
            <input type="number" name="lisansAdet" min={1} max={999} inputMode="numeric" value={lisansAdet || ""} disabled={!lisans}
              onChange={(e) => setLisansAdet(adetAl(e.target.value))} onBlur={() => lisansAdet < 1 && setLisansAdet(1)} className={`${GIRDI} tabular-nums`} />
          </label>
        </div>
        {ozel && (
          <label className={KUCUK}>
            {lisans} lisans ücreti (yıllık, 1 lisans) *
            <input name="ozelFiyat" value={ozelFiyat} onChange={(e) => setOzelFiyat(e.target.value)} inputMode="numeric" placeholder="Ör. 150000" className={GIRDI} aria-invalid={!!h.ozelFiyat} />
            <Hata mesaj={h.ozelFiyat} />
          </label>
        )}
        {model && kapsam && kapsam * lisansAdet < adet && (
          <span className="text-xs font-semibold text-warn">{lisansAdet}× {lisans} {kapsam * lisansAdet} cihazı kapsar; {adet} cihaz için {gerekenLisans(adet, lisans, true, fiyatListesi)} lisans gerekir.</span>
        )}
        {!model && lisans && musteri && musteri.cihazlar.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-semibold text-muted">Lisansın uygulanacağı cihazlar</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {musteri.cihazlar.map((c) => (
                <label key={c.seriNo} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-2.5 font-mono text-xs">
                  <input type="checkbox" name="lisansSeri" value={c.seriNo} className="h-4 w-4 accent-[#0E0F0C]" />
                  {c.seriNo}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <details className="rounded-control border border-line px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-bold">
            Aksesuar / yedek kablo{aksesuarTutari ? ` · ${tl(aksesuarTutari)}` : ""}
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {aksesuarlar.map((k) => (
              <label key={k.kod} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2 text-[13px]">
                <span className="min-w-0">
                  <b className="font-semibold">{k.ad}</b> <span className="text-xs text-muted">{tl(k.fiyat ?? 0)} · stok {k.adet}</span>
                </span>
                <input
                  type="number" name={`aks_${k.kod}`} min={0} max={999} inputMode="numeric" placeholder="0"
                  value={aksesuar[k.kod] || ""} onChange={(e) => setAksesuar((a) => ({ ...a, [k.kod]: adetAl(e.target.value) }))}
                  className={`${GIRDI} min-h-9 tabular-nums`} aria-label={`${k.ad} adedi`}
                />
              </label>
            ))}
          </div>
        </details>
        <Hata mesaj={h.urun} />
      </fieldset>

      <div className="flex flex-col gap-1 rounded-control bg-[#F4F5F0] px-3 py-2.5 text-xs" aria-live="polite">
        {fiyat.cihaz + aksesuarTutari > 0 && (
          <span className="flex justify-between gap-2 text-muted">Cihaz ve aksesuar <span className="tabular-nums"><b className="text-ink">{tl(kdvli)}</b> + KDV %{fiyatListesi.kdv * 100}</span></span>
        )}
        {lisans && (
          <span className="flex justify-between gap-2 text-muted">
            Lisans <span className="tabular-nums">{ozel && !fiyat.lisans ? <b className="text-warn">ücret girin</b> : <><b className="text-ink">{tl(fiyat.lisans)}</b> · KDV yok</>}</span>
          </span>
        )}
        <span className="mt-0.5 flex items-baseline justify-between gap-2 border-t border-line pt-1.5">
          <span className="font-semibold text-muted">Toplam (KDV dahil)</span>
          <b className="text-base tabular-nums">{tl(Math.round(kdvli * (1 + fiyatListesi.kdv) + fiyat.lisans))}</b>
        </span>
        <span className="text-muted">Siparişe KDV hariç {tl(toplam)} olarak kaydedilir.</span>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[13px] font-semibold">
          <input type="checkbox" name="odendi" checked={odendi} onChange={(e) => setOdendi(e.target.checked)} className="h-4.5 w-4.5 accent-[#0E0F0C]" />
          Ödeme alındı (sipariş doğrudan hazırlığa geçer)
        </label>
        <label className={ALAN}>
          Not <span className="font-normal text-muted">(isteğe bağlı)</span>
          <input name="not" maxLength={300} placeholder="Ör. Teslimat cuma öğleden sonra" className={GIRDI} />
        </label>
      </div>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        {onVazgec && (
          <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        )}
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Siparişi oluştur"}
        </button>
      </div>
    </form>
  );
}
