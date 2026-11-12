"use client";

// Otomasyon kuralı formu: "Şu olursa" (tetikleyici + gün eşiği) → "Şunu yap" (hatırlatma açın ve/veya müşteriye e-posta).
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormGonder } from "@/lib/use-form-gonder";
import { kuralFormuKaydet, type KuralFormDurumu, type OtomasyonVerisi } from "./actions";
import { CIHAZ_MODELLERI } from "@/lib/urunler";
import { EPOSTA_TUR_LIMITI, FILTRE_ADI, FILTRE_ALANLARI, KURAL_ADI_MAX, TETIKLEYICILER, TETIKLEYICI_SIRASI } from "./ortak";
import type { Kural, TetikleyiciId } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const HATA = "text-xs font-semibold text-err";

export default function KuralFormu({
  kural,
  ekip,
  epostaSaglayici,
  onKaydedildi,
  onVazgec,
}: {
  kural?: Kural;
  ekip: OtomasyonVerisi["ekip"];
  epostaSaglayici: string | null;
  onKaydedildi: (k: Kural) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<KuralFormDurumu, FormData>(kuralFormuKaydet, {});
  const gonderKorunarak = useFormGonder(gonder);
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<number | null>(null);
  const [tetikleyici, setTetikleyici] = useState<TetikleyiciId>(kural?.tetikleyici ?? "lisans-bitiyor");
  const [hatirlatmaAcik, setHatirlatmaAcik] = useState(kural ? !!kural.hatirlatma : true);
  const [epostaAcik, setEpostaAcik] = useState(!!kural?.eposta);
  const [gun, setGun] = useState(kural?.gun || TETIKLEYICILER[kural?.tetikleyici ?? "lisans-bitiyor"].esik?.varsayilan || 0);
  const tanim = TETIKLEYICILER[tetikleyici];
  const epostaMumkun = tanim.musteriBagli;

  useEffect(() => {
    if (durum.kural && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onKaydedildi(durum.kural);
    }
  }, [durum.kural, durum.zaman, onKaydedildi]);

  return (
    <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-5">
      {kural && <input type="hidden" name="id" value={kural.id} />}
      <label className={ALAN}>
        Kural adı *
        <input name="ad" autoFocus defaultValue={kural?.ad} maxLength={KURAL_ADI_MAX} placeholder="Örn. Lisans bitmeden satışa görev aç" className={GIRDI} aria-invalid={!!h.ad} />
        {h.ad && <span className={HATA}>{h.ad}</span>}
      </label>

      <fieldset className="flex flex-col gap-3 rounded-card border border-line p-4">
        <legend className="px-1 text-[13px] font-extrabold">1 · Şu olursa</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={ALAN}>
            Olay *
            <select name="tetikleyici" value={tetikleyici} onChange={(e) => { const t = e.target.value as TetikleyiciId; setTetikleyici(t); setGun(TETIKLEYICILER[t].esik?.varsayilan ?? 0); }} className={GIRDI}>
              {TETIKLEYICI_SIRASI.map((t) => <option key={t} value={t}>{TETIKLEYICILER[t].ad}</option>)}
            </select>
          </label>
          {tanim.esik && (
            <label className={ALAN}>
              {tanim.esik.etiket} *
              <input name="gun" type="number" min={1} max={365} step={1} value={gun} onChange={(e) => setGun(Number(e.target.value))} className={GIRDI} aria-invalid={!!h.gun} />
              {h.gun && <span className={HATA}>{h.gun}</span>}
            </label>
          )}
        </div>
        <p className="text-xs text-muted">{tanim.aciklama(gun)}</p>
        {FILTRE_ALANLARI[tetikleyici].length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            <p className="text-[13px] font-bold">Yalnızca şunlar için <span className="font-medium text-muted">(boş bırakırsanız hepsi)</span></p>
            <div className="grid gap-4 sm:grid-cols-3" key={tetikleyici}>
              {FILTRE_ALANLARI[tetikleyici].includes("ulke") && (
                <label className={ALAN}>
                  {FILTRE_ADI.ulke}
                  <input name="filtre_ulke" defaultValue={kural?.filtre?.ulke ?? ""} maxLength={60} placeholder="Örn. Almanya" className={GIRDI} />
                </label>
              )}
              {FILTRE_ALANLARI[tetikleyici].includes("plan") && (
                <label className={ALAN}>
                  {FILTRE_ADI.plan}
                  <select name="filtre_plan" defaultValue={kural?.filtre?.plan ?? ""} className={GIRDI}>
                    <option value="">Hepsi</option>
                    {["Basic", "Pro", "Pro+"].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              )}
              {FILTRE_ALANLARI[tetikleyici].includes("model") && (
                <label className={ALAN}>
                  {FILTRE_ADI.model}
                  <select name="filtre_model" defaultValue={kural?.filtre?.model ?? ""} className={GIRDI}>
                    <option value="">Hepsi</option>
                    {CIHAZ_MODELLERI.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              )}
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-card border border-line p-4">
        <legend className="px-1 text-[13px] font-extrabold">2 · Şunu yap</legend>
        {h.eylem && <p role="alert" className={HATA}>{h.eylem}</p>}

        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="hatirlatmaAcik" checked={hatirlatmaAcik} onChange={(e) => setHatirlatmaAcik(e.target.checked)} className="h-4 w-4 accent-ink" />
            Ekipten birine hatırlatma / görev aç
          </label>
          {hatirlatmaAcik && (
            <div className="grid gap-4 pl-6 sm:grid-cols-2">
              <label className={ALAN}>
                Sorumlu *
                <select name="sorumluId" defaultValue={kural?.hatirlatma?.sorumluId ?? ekip[0]?.id} className={GIRDI} aria-invalid={!!h.sorumluId}>
                  {ekip.map((u) => <option key={u.id} value={u.id}>{u.ad} · {u.rol}</option>)}
                </select>
                {h.sorumluId && <span className={HATA}>{h.sorumluId}</span>}
              </label>
              <label className={ALAN}>
                Önem
                <select name="onem" defaultValue={kural?.hatirlatma?.onem ?? "normal"} className={GIRDI}>
                  <option value="normal">Normal</option>
                  <option value="yuksek">Yüksek</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {epostaMumkun && (
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="epostaAcik" checked={epostaAcik} onChange={(e) => setEpostaAcik(e.target.checked)} className="h-4 w-4 accent-ink" />
              Müşteriye e-posta gönder
            </label>
            {epostaAcik && (
              <div className="flex flex-col gap-4 pl-6">
                <p className="rounded-control bg-warn-bg px-3 py-2 text-xs font-semibold text-warn">
                  Yalnızca e-posta izni olan ve abonelikten çıkmamış yetkiliye gider; kayıt bir müşteriye bağlı değilse atlanır.
                  Tek turda {EPOSTA_TUR_LIMITI} adetten fazla e-posta çıkarsa kural durur ve onayınızı bekler.
                  {!epostaSaglayici && " E-posta sağlayıcısı bağlı olmadığı için şu an DEMO modundasınız: gerçekte e-posta gönderilmez."}
                </p>
                <label className={ALAN}>
                  Konu *
                  <input name="konu" defaultValue={kural?.eposta?.konu ?? "{firma} · bilgilendirme"} maxLength={150} className={GIRDI} aria-invalid={!!h.konu} />
                  {h.konu && <span className={HATA}>{h.konu}</span>}
                </label>
                <label className={ALAN}>
                  Metin *
                  <textarea name="govde" rows={5} maxLength={2000} defaultValue={kural?.eposta?.metin ?? "Merhaba,\n\n{detay}\n\nEmbedra Ekibi"} className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err" aria-invalid={!!h.govde} />
                  <span className="text-xs font-medium text-muted">Kullanılabilir alanlar: <code>{"{firma}"}</code> <code>{"{detay}"}</code></span>
                  {h.govde && <span className={HATA}>{h.govde}</span>}
                </label>
              </div>
            )}
          </div>
        )}
      </fieldset>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : kural ? "Kaydet" : "Kuralı oluştur"}
        </button>
      </div>
    </form>
  );
}
