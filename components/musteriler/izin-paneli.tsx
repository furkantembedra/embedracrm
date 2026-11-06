"use client";

// Yetkilinin iletişim izinleri: kanal başına izin, ne zaman ve nereden alındığı, geri çekilme tarihi.
// Yeni verilen izin için kaynak sorulur; kaldırılan izin silinmez, geri çekilme tarihiyle saklanır.
import { useState, useTransition } from "react";
import { izinleriKaydet } from "./actions";
import { IZIN_KANALLARI, IZIN_KANAL_ADI, IZIN_KAYNAKLARI, type IzinKanali } from "./izin";
import { gunYaz } from "./ortak";
import type { Yetkili } from "./queries";

/** Kanal için ulaşılacak bilgi yoksa uyarı: e-posta adresi / telefon numarası */
const eksikBilgi = (y: Yetkili, k: IzinKanali) => (k === "eposta" ? !y.eposta && "e-posta adresi yok" : !y.telefon && "telefon numarası yok");

export default function IzinPaneli({
  musteriId,
  yetkili: y,
  onKaydedildi,
  onVazgec,
}: {
  musteriId: string;
  yetkili: Yetkili;
  onKaydedildi: (yetkililer: Yetkili[]) => void;
  onVazgec: () => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [secim, setSecim] = useState<Record<IzinKanali, boolean>>(
    () => Object.fromEntries(IZIN_KANALLARI.map((k) => [k, !!y.izinler?.[k]?.verildi])) as Record<IzinKanali, boolean>,
  );
  const [kaynak, setKaynak] = useState("");
  const yeniVerilen = IZIN_KANALLARI.some((k) => secim[k] && !y.izinler?.[k]?.verildi);
  const degisti = IZIN_KANALLARI.some((k) => secim[k] !== !!y.izinler?.[k]?.verildi);

  const kaydet = () =>
    baslat(async () => {
      const s = await izinleriKaydet(musteriId, y.id, secim, kaynak);
      if (s.hata) setHata(s.hata);
      else if (s.yetkililer) onKaydedildi(s.yetkililer);
    });

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-[#F8F9F5] p-3">
      <span className="text-xs font-bold">İletişim izinleri</span>
      <ul className="flex flex-col gap-1.5">
        {IZIN_KANALLARI.map((k) => {
          const kayit = y.izinler?.[k];
          const eksik = eksikBilgi(y, k);
          const id = `izin-${y.id}-${k}`;
          return (
            <li key={k} className="flex items-start gap-2.5">
              <input
                id={id}
                type="checkbox"
                checked={secim[k]}
                onChange={(e) => setSecim({ ...secim, [k]: e.target.checked })}
                className="mt-0.5 h-4.5 w-4.5 flex-none cursor-pointer accent-[#0E0F0C]"
              />
              <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-[13px]">
                <b>{IZIN_KANAL_ADI[k]}</b>
                <span className="text-xs text-muted">
                  {kayit?.verildi
                    ? `${gunYaz(kayit.tarih)} · ${kayit.kaynak}`
                    : kayit?.cekilme
                      ? `Geri çekildi ${gunYaz(kayit.cekilme)} (verilmişti: ${gunYaz(kayit.tarih)} · ${kayit.kaynak})`
                      : "İzin yok"}
                  {secim[k] && eksik ? <b className="text-warn"> · {eksik}</b> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {yeniVerilen && (
        <label className="flex flex-col gap-1 text-xs font-bold">
          Yeni izin nereden alındı *
          <select
            value={kaynak}
            onChange={(e) => setKaynak(e.target.value)}
            aria-invalid={!!hata}
            className="min-h-10 w-full rounded-control border border-line-strong bg-card px-3 text-[13px] font-medium outline-none focus:border-ink aria-[invalid=true]:border-err"
          >
            <option value="" disabled>Seçin</option>
            {IZIN_KAYNAKLARI.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      )}
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
      <p className="text-[11px] text-muted">Kaldırılan izin silinmez; geri çekilme tarihiyle saklanır. Değişiklik müşteri geçmişine yazılır.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onVazgec} className="min-h-10 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-[13px] font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button
          type="button"
          onClick={kaydet}
          disabled={bekliyor || !degisti || (yeniVerilen && !kaynak)}
          className="min-h-10 cursor-pointer rounded-control bg-ink px-4 text-[13px] font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bekliyor ? "Kaydediliyor…" : "İzinleri kaydet"}
        </button>
      </div>
    </div>
  );
}
