"use client";

import { useState, useTransition } from "react";
import { portalYenilemeTalebi } from "./actions";

export default function YenilemeButonu({ seriNo, gonderildi }: { seriNo: string; gonderildi: boolean }) {
  const [durum, setDurum] = useState<{ tamam?: boolean; hata?: string }>(gonderildi ? { tamam: true } : {});
  const [bekliyor, baslat] = useTransition();
  if (durum.tamam) return <span className="text-xs font-bold text-[#3A4D00]">Talep gönderildi ✓</span>;
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" disabled={bekliyor} onClick={() => baslat(async () => {
        const s = await portalYenilemeTalebi(seriNo);
        setDurum(s.hata ? { hata: s.hata } : { tamam: true });
      })} className="min-h-9 cursor-pointer rounded-control bg-ink px-3 text-xs font-bold text-white hover:bg-ink-soft disabled:opacity-60">
        Yenileme talebi
      </button>
      {durum.hata && <span role="alert" className="text-xs text-err">{durum.hata}</span>}
    </span>
  );
}
