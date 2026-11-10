"use client";

// "Hatırlatma ekle" formu. Fırsat, müşteri, bayi… detayından açılınca kayıt bağlantısı otomatik eklenir.
import { useActionState, useEffect, useRef, useState } from "react";
import { useBugun } from "@/lib/use-bugun";
import { useFormGonder } from "@/lib/use-form-gonder";
import { hatirlatmaEkle, hatirlatmalariGetir, type HatirlatmaFormDurumu, type HatirlatmaVerisi } from "./actions";
import type { Hatirlatma, KayitTuru } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";

export type KayitBaglantisi = { tur: KayitTuru; id: string; ad: string; href: string };

export default function HatirlatmaFormu({
  kayit,
  varsayilanBaslik = "",
  onKaydedildi,
  onVazgec,
}: {
  kayit?: KayitBaglantisi;
  varsayilanBaslik?: string;
  onKaydedildi: (h: Hatirlatma) => void;
  onVazgec: () => void;
}) {
  const bugun = useBugun();
  const [durum, gonder, bekliyor] = useActionState<HatirlatmaFormDurumu, FormData>(hatirlatmaEkle, {});
  const gonderKorunarak = useFormGonder(gonder);
  const h = durum.hatalar ?? {};
  const bildirildi = useRef<number | null>(null);
  const [veri, setVeri] = useState<Pick<HatirlatmaVerisi, "ekip" | "aktif"> | null>(null);

  useEffect(() => {
    let iptal = false;
    hatirlatmalariGetir().then((v) => !iptal && setVeri({ ekip: v.ekip, aktif: v.aktif }));
    return () => void (iptal = true);
  }, []);

  useEffect(() => {
    if (durum.hatirlatma && bildirildi.current !== durum.zaman) {
      bildirildi.current = durum.zaman ?? null;
      onKaydedildi(durum.hatirlatma);
    }
  }, [durum.hatirlatma, durum.zaman, onKaydedildi]);

  const yarin = bugun === null ? undefined : new Date(bugun + 36 * 3_600_000).toISOString().slice(0, 10);

  return (
    <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-5">
      {kayit && (
        <>
          <input type="hidden" name="kayitTuru" value={kayit.tur} />
          <input type="hidden" name="kayitId" value={kayit.id} />
          <input type="hidden" name="kayitAd" value={kayit.ad} />
          <input type="hidden" name="kayitHref" value={kayit.href} />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${ALAN} sm:col-span-2`}>
          Ne hatırlatılsın? *
          <input name="baslik" autoFocus defaultValue={varsayilanBaslik} placeholder="Örn. Demo sonrası geri dönüş al" className={GIRDI} aria-invalid={!!h.baslik} />
          {h.baslik && <span className="text-xs font-semibold text-err">{h.baslik}</span>}
        </label>
        <label className={ALAN}>
          Tarih *
          <input name="tarih" type="date" defaultValue={yarin} key={yarin} className={GIRDI} aria-invalid={!!h.tarih} />
          {h.tarih && <span className="text-xs font-semibold text-err">{h.tarih}</span>}
        </label>
        <label className={ALAN}>
          Saat *
          <input name="saat" type="time" defaultValue="09:00" className={GIRDI} aria-invalid={!!h.saat} />
        </label>
        <label className={ALAN}>
          Sorumlu *
          <select name="sorumluId" key={veri?.aktif.id} defaultValue={veri?.aktif.id ?? ""} className={GIRDI} aria-invalid={!!h.sorumluId} disabled={!veri}>
            {!veri && <option value="">Yükleniyor…</option>}
            {veri?.ekip.map((k) => <option key={k.id} value={k.id}>{k.ad} · {k.rol}</option>)}
          </select>
          {h.sorumluId && <span className="text-xs font-semibold text-err">{h.sorumluId}</span>}
        </label>
        <label className={ALAN}>
          Önem
          <select name="onem" defaultValue="normal" className={GIRDI}>
            <option value="normal">Normal</option>
            <option value="yuksek">Yüksek</option>
          </select>
        </label>
        <label className={`${ALAN} sm:col-span-2`}>
          Not
          <textarea name="aciklama" rows={2} maxLength={500} className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
        </label>
        {kayit && <p className="text-xs text-muted sm:col-span-2">Bağlı kayıt: <b className="text-ink">{kayit.ad}</b></p>}
      </div>
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor || !veri} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Hatırlatma ekle"}
        </button>
      </div>
    </form>
  );
}
