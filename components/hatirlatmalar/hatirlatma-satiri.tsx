"use client";

// Tek hatırlatma satırı: tamamla onay kutusu, zaman, bağlı kayıt ve erteleme menüsü
import Link from "next/link";
import { Zap } from "lucide-react";
import Chip from "@/components/ui/chip";
import { KAYIT_ADI, zamanEtiketi } from "./ortak";
import type { Hatirlatma } from "./queries";

export default function HatirlatmaSatiri({
  h,
  simdi,
  sorumlu,
  onTamamla,
  onErtele,
  onGit,
  sade = false,
  yeni = false,
}: {
  h: Hatirlatma;
  simdi: string;
  sorumlu?: string;
  onTamamla: (tamam: boolean) => void;
  onErtele: (sure: "1s" | "yarin" | "hafta") => void;
  onGit?: () => void; // bağlantıya tıklanınca (ör. zil penceresini kapat)
  sade?: boolean;
  yeni?: boolean; // okunmamış bildirim
}) {
  const z = zamanEtiketi(h.zaman, simdi);
  const tamam = h.durum === "tamam";
  return (
    <li className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${tamam ? "border-line bg-[#FAFBF7] opacity-70" : h.onem === "yuksek" && z.gecikti ? "border-[#F5C089] bg-card" : "border-line bg-card"}`}>
      <input
        type="checkbox"
        checked={tamam}
        onChange={(e) => onTamamla(e.target.checked)}
        aria-label={`${h.baslik} ${tamam ? "tamamlandı, geri al" : "tamamlandı olarak işaretle"}`}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-ink"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {yeni && <span className="h-2 w-2 shrink-0 rounded-full bg-blue"><span className="sr-only">Yeni</span></span>}
          <b className={`min-w-0 break-words text-sm ${tamam ? "line-through" : ""}`}>{h.baslik}</b>
          {h.otomatik && (
            <span title="Kurala göre otomatik oluşturuldu" className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted">
              <Zap size={12} aria-hidden="true" /> Otomatik
            </span>
          )}
        </div>
        {!sade && h.aciklama && <p className="break-words text-xs text-muted">{h.aciklama}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`font-bold ${!tamam && z.gecikti ? "text-warn" : "text-[#474A42]"}`}>{z.metin}</span>
          {h.kayit && (
            <Link href={h.kayit.href} onClick={onGit} className="min-w-0 truncate font-bold text-info hover:underline">
              {KAYIT_ADI[h.kayit.tur]}: {h.kayit.ad}
            </Link>
          )}
          {sorumlu && <Chip ton="gray">{sorumlu}</Chip>}
        </div>
      </div>
      {!tamam && (
        <label className="shrink-0">
          <span className="sr-only">{h.baslik} ertele</span>
          <select
            value=""
            onChange={(e) => e.target.value && onErtele(e.target.value as "1s" | "yarin" | "hafta")}
            className="min-h-9 cursor-pointer rounded-lg border border-line-strong bg-card px-2 text-xs font-bold"
          >
            <option value="">Ertele</option>
            <option value="1s">1 saat</option>
            <option value="yarin">Yarın 09:00</option>
            <option value="hafta">Gelecek hafta</option>
          </select>
        </label>
      )}
    </li>
  );
}
