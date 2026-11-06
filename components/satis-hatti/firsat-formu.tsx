"use client";

// Fırsat formu (ortada açılan pencerede): yeni fırsat ya da mevcut fırsatı düzenleme.
// Ürün; cihaz modeli, adet ve lisans planı seçilerek girilir.
import { useActionState, useEffect, useRef, useState } from "react";
import { CIHAZ_MODELLERI, URUN_BILGI, VARSAYILAN_FIYAT, type CihazModeli, type FiyatListesi } from "@/lib/urunler";
import { tl } from "@/lib/format";
import { LISANS_SECENEKLERI, gerekenLisans, icerikCoz, icerikYaz, urunTutari, type LisansSecenegi, type UrunSecimi } from "./urun-secimi";
import { useFormGonder } from "@/lib/use-form-gonder";
import { firsatKaydet, type AsamaSonucu, type FirsatFormDurumu } from "./actions";
import { ASAMALAR, ASAMA_BILGI, KAYNAKLAR, type Asama, type Firsat } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

function Hata({ id, mesaj }: { id: string; mesaj?: string }) {
  return mesaj ? <span id={id} className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

export default function FirsatFormu({
  baslangicAsamasi = "yeni",
  firsat,
  kampanyalar = [],
  fiyatListesi = VARSAYILAN_FIYAT,
  onKaydedildi,
  onVazgec,
}: {
  baslangicAsamasi?: Asama;
  firsat?: Firsat; // verilirse düzenleme
  kampanyalar?: { id: string; ad: string; durum: string }[]; // lead'in geldiği pazarlama kampanyası (isteğe bağlı)
  fiyatListesi?: FiyatListesi; // Operasyon › Ayarlar'daki güncel fiyatlar
  onKaydedildi: (f: Firsat, musteri?: AsamaSonucu["musteri"]) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<FirsatFormDurumu, FormData>(firsatKaydet, {});
  const gonderKorunarak = useFormGonder(gonder); // hata olunca girilenler silinmesin
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ilkUrun = firsat ? icerikCoz(firsat.icerik) : { model: "ONE" as CihazModeli, adet: 1, lisans: "Pro" as LisansSecenegi, lisansAdet: 1 };
  const [model, setModel] = useState<CihazModeli | null>(ilkUrun.model);
  const [adet, setAdet] = useState(ilkUrun.adet);
  const [lisans, setLisans] = useState<LisansSecenegi | null>(ilkUrun.lisans);
  const [lisansAdet, setLisansAdet] = useState(ilkUrun.lisansAdet);
  // Özel paketli kayıt düzenlenirken lisans ücreti kayıtlı tutardan geri bulunur
  const [ozelFiyat, setOzelFiyat] = useState(() => {
    if (!firsat || !ilkUrun.lisans || fiyatListesi.lisans[ilkUrun.lisans].fiyat !== null) return "";
    const f = (firsat.tutar - urunTutari(ilkUrun, 0, fiyatListesi).cihaz) / ilkUrun.lisansAdet;
    return f > 0 ? String(Math.round(f)) : "";
  });
  const ozelSayi = Number(ozelFiyat.replace(/\./g, "")) || 0;
  const secim = { model, adet, lisans, lisansAdet };
  const onizleme = icerikYaz(secim);
  const liste = urunTutari(secim, ozelSayi, fiyatListesi);
  const kapsam = lisans ? fiyatListesi.lisans[lisans].cihaz : null;
  const eksikKapsam = !!model && !!kapsam && kapsam * lisansAdet < adet;
  const sec = (d: Partial<UrunSecimi>) => {
    const y = { ...secim, ...d };
    // Cihaz adedi ya da paket değişince lisans adedi kapsayacak kadar önerilir (elle değiştirilebilir)
    if (d.lisansAdet === undefined) y.lisansAdet = gerekenLisans(y.adet, y.lisans, !!y.model, fiyatListesi);
    setModel(y.model);
    setAdet(y.adet);
    setLisans(y.lisans);
    setLisansAdet(y.lisansAdet);
  };

  // Hata dönünce imleci ilk eksik alana götür
  useEffect(() => {
    if (!durum.hatalar) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [durum.hatalar]);

  useEffect(() => {
    // Düzenlemede id aynı kalır; her kayıt ayrı nesne olduğundan nesneyle karşılaştırılır
    if (durum.firsat && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onKaydedildi(durum.firsat, durum.musteri);
    }
  }, [durum.firsat, durum.zaman, durum.musteri, onKaydedildi]);

  return (
    <form ref={formRef} onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-5">
      {firsat && <input type="hidden" name="id" value={firsat.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${ALAN} sm:col-span-2`}>
          Firma *
          <input name="firma" defaultValue={firsat?.firma} autoFocus className={GIRDI} aria-invalid={!!h.firma} aria-describedby="hata-firma" />
          <Hata id="hata-firma" mesaj={h.firma} />
        </label>
        <label className={ALAN}>
          Konum *
          <input name="konum" defaultValue={firsat?.konum} placeholder="Şehir, ülke" className={GIRDI} aria-invalid={!!h.konum} aria-describedby="hata-konum" />
          <Hata id="hata-konum" mesaj={h.konum} />
        </label>
        <label className={ALAN}>
          Kaynak *
          <select name="kaynak" defaultValue={firsat?.kaynak ?? ""} className={GIRDI} aria-invalid={!!h.kaynak} aria-describedby="hata-kaynak">
            <option value="" disabled>Seçin…</option>
            {KAYNAKLAR.map((k) => <option key={k}>{k}</option>)}
          </select>
          <Hata id="hata-kaynak" mesaj={h.kaynak} />
        </label>
        {kampanyalar.length > 0 && (
          <label className={`${ALAN} sm:col-span-2`}>
            <span>Kampanya <span className="font-normal text-muted">(lead bir kampanyadan geldiyse)</span></span>
            <select name="kampanyaId" defaultValue={firsat?.kampanyaId ?? ""} className={GIRDI}>
              <option value="">Kampanya yok</option>
              {kampanyalar.map((k) => <option key={k.id} value={k.id}>{k.ad}{k.durum === "Aktif" ? "" : ` · ${k.durum.toLocaleLowerCase("tr-TR")}`}</option>)}
            </select>
          </label>
        )}
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2" aria-describedby="hata-icerik">
          <legend className="mb-1.5 text-[13px] font-bold">Ürün *</legend>
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
              Cihaz
              <select name="model" value={model ?? ""} onChange={(e) => sec({ model: (e.target.value || null) as CihazModeli | null })} className={GIRDI} aria-invalid={!!h.icerik}>
                <option value="">Cihaz yok</option>
                {CIHAZ_MODELLERI.map((m) => <option key={m} value={m}>{URUN_BILGI[m].ad} · {tl(fiyatListesi.cihaz[m])}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
              Cihaz adedi
              <input
                type="number" name="adet" min={1} max={999} inputMode="numeric"
                value={adet || ""}
                onChange={(e) => sec({ adet: Math.min(999, Math.max(0, parseInt(e.target.value) || 0)) })}
                onBlur={() => adet < 1 && sec({ adet: 1 })}
                disabled={!model}
                className={`${GIRDI} tabular-nums disabled:opacity-50`}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
              Lisans
              <select name="lisans" value={lisans ?? ""} onChange={(e) => sec({ lisans: (e.target.value || null) as LisansSecenegi | null })} className={GIRDI} aria-invalid={!!h.icerik}>
                <option value="">Lisans yok</option>
                {LISANS_SECENEKLERI.map((p) => {
                  const k = fiyatListesi.lisans[p];
                  return (
                    <option key={p} value={p}>
                      {p} · {k.cihaz ? `${k.cihaz} cihaz` : "özel"} · {k.fiyat ? `${tl(k.fiyat)}/yıl` : "özel fiyat"}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
              Lisans adedi
              <input
                type="number" name="lisansAdet" min={1} max={999} inputMode="numeric"
                value={lisansAdet || ""}
                onChange={(e) => sec({ lisansAdet: Math.min(999, Math.max(0, parseInt(e.target.value) || 0)) })}
                onBlur={() => lisansAdet < 1 && sec({ lisansAdet: 1 })}
                disabled={!lisans}
                className={`${GIRDI} tabular-nums disabled:opacity-50`}
              />
            </label>
          </div>
          {liste.ozel && (
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
              {lisans} lisans ücreti (yıllık, 1 lisans) *
              <input
                value={ozelFiyat}
                onChange={(e) => {
                  setOzelFiyat(e.target.value);
                }}
                inputMode="numeric"
                placeholder="Ör. 150000"
                className={GIRDI}
              />
            </label>
          )}
          {eksikKapsam && (
            <span className="text-xs font-semibold text-warn">
              {lisansAdet}× {lisans} {kapsam! * lisansAdet} cihazı kapsar; {adet} cihaz için {gerekenLisans(adet, lisans, true, fiyatListesi)} lisans gerekir.
            </span>
          )}
          <Hata id="hata-icerik" mesaj={h.icerik} />
        </fieldset>
        {/* Tutar seçimden hesaplanır, elle girilmez. Cihaza KDV eklenir, lisans KDV'siz. */}
        <div className={ALAN}>
          <span>Tutar</span>
          <div className="flex flex-col gap-1 rounded-control bg-[#F4F5F0] px-3 py-2.5 text-xs" aria-live="polite">
            <span className="truncate font-semibold text-[#474A42]">{onizleme || "Ürün seçin"}</span>
            {liste.cihaz > 0 && (
              <span className="flex justify-between gap-2 text-muted">
                Cihaz <span className="tabular-nums"><b className="text-ink">{tl(liste.cihaz)}</b> + KDV %{fiyatListesi.kdv * 100}</span>
              </span>
            )}
            {lisans && (
              <span className="flex justify-between gap-2 text-muted">
                Lisans <span className="tabular-nums">{liste.ozel && !ozelSayi ? <b className="text-warn">ücret girin</b> : <><b className="text-ink">{tl(liste.lisans)}</b> · KDV yok</>}</span>
              </span>
            )}
            <span className="mt-0.5 flex items-baseline justify-between gap-2 border-t border-line pt-1.5">
              <span className="font-semibold text-muted">Toplam (KDV dahil)</span>
              <b className="text-base tabular-nums">{tl(Math.round(liste.cihaz * (1 + fiyatListesi.kdv) + liste.lisans))}</b>
            </span>
          </div>
          {/* Kayıtta KDV hariç tutar tutulur (cihaz + lisans) */}
          <input type="hidden" name="tutar" value={liste.tutar} />
          <Hata id="hata-tutar" mesaj={h.tutar} />
        </div>
        {firsat ? (
          <input type="hidden" name="asama" value={firsat.asama} />
        ) : (
        <label className={ALAN}>
          Aşama *
          <select name="asama" defaultValue={baslangicAsamasi} className={GIRDI} aria-invalid={!!h.asama}>
            {ASAMALAR.filter((a) => a !== "kaybedildi").map((a) => <option key={a} value={a}>{ASAMA_BILGI[a].ad}</option>)}
          </select>
          <Hata id="hata-asama" mesaj={h.asama} />
        </label>
        )}
        <label className={ALAN}>
          Sonraki adım *
          <input name="sonrakiAdim" defaultValue={firsat?.sonrakiAdim} placeholder="Örn. Demo planla" className={GIRDI} aria-invalid={!!h.sonrakiAdim} aria-describedby="hata-sonraki" />
          <Hata id="hata-sonraki" mesaj={h.sonrakiAdim} />
        </label>
        <label className={ALAN}>
          Sonraki adım tarihi *
          <input name="sonrakiTarih" type="date" defaultValue={firsat?.sonrakiTarih} className={GIRDI} aria-invalid={!!h.sonrakiTarih} aria-describedby="hata-tarih" />
          <Hata id="hata-tarih" mesaj={h.sonrakiTarih} />
        </label>
      </div>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          Vazgeç
        </button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : firsat ? "Değişiklikleri kaydet" : "Fırsatı kaydet"}
        </button>
      </div>
    </form>
  );
}
