"use client";

// Kanban içindeki tek fırsat kartı. Sürüklenebilir; menüden de aşama değiştirilebilir.
import { Bell, ChevronDown, ChevronUp, FileText, MessageCircle, Pencil } from "lucide-react";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { ASAMALAR, ASAMA_BILGI, KAPALI_ASAMALAR, type Asama, type Firsat } from "./queries";
import { useBugun } from "@/lib/use-bugun";
import { KAYNAK_TONU, tarihEtiketi } from "./ortak";

export type KartEylemi = "mesajlar" | "teklif" | "hatirlatma";

const KUCUK = "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#474A42] transition-colors hover:bg-bg";

export default function FirsatKarti({
  firsat,
  onTasi,
  onDuzenle,
  onSurukleBasla,
  onSurukleBitti,
  onYukari,
  onAsagi,
  onEylem,
}: {
  firsat: Firsat;
  onTasi: (id: string, asama: Asama) => void;
  onDuzenle: () => void;
  onSurukleBasla: (id: string) => void;
  onSurukleBitti?: () => void;
  onYukari?: () => void; // sütunda bir yukarı (ilk kartta verilmez)
  onAsagi?: () => void; // sütunda bir aşağı (son kartta verilmez)
  onEylem?: (e: KartEylemi) => void;
}) {
  const f = firsat;
  const bugun = useBugun();
  const kaybedildi = f.asama === "kaybedildi";
  const tarih = tarihEtiketi(f.sonrakiTarih, bugun, KAPALI_ASAMALAR.includes(f.asama));

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", f.id);
        e.dataTransfer.effectAllowed = "move";
        onSurukleBasla(f.id);
      }}
      onDragEnd={onSurukleBitti}
      className={`flex cursor-grab flex-col gap-2.5 rounded-2xl border bg-card p-3.5 transition-shadow hover:shadow-[0_6px_18px_rgba(14,15,12,0.08)] active:cursor-grabbing ${
        tarih.gecikti ? "border-[#F5C089]" : "border-line"
      } ${kaybedildi ? "opacity-75" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Chip ton={KAYNAK_TONU[f.kaynak]}>{f.kaynak}</Chip>
        {!kaybedildi && (
          <span className={`ml-auto text-xs font-semibold ${tarih.gecikti ? "text-warn" : "text-muted"}`}>{tarih.metin}</span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold leading-snug">{f.firma}</h3>
        <span className="text-xs text-muted">{f.konum}</span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-[#F4F5F0] p-2.5">
        <span className="text-xs font-semibold text-[#474A42]">{f.icerik}</span>
        <b className={`text-base tabular-nums ${kaybedildi ? "text-muted line-through" : ""}`}>{tl(f.tutar)}</b>
      </div>

      {kaybedildi && f.kayipNedeni && (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-err-bg px-2.5 py-2 text-xs text-err">
          <b>Neden: {f.kayipNedeni}</b>
          {f.kayipAciklama && <span className="break-words text-[#7A2020]">{f.kayipAciklama}</span>}
        </div>
      )}

      {onEylem && (
        <div className="-mx-1 flex flex-wrap items-center gap-0.5">
          {!!f.mesajlar?.length && (
            <button type="button" onClick={() => onEylem("mesajlar")} className={`${KUCUK} text-ok`} aria-label={`${f.firma} WhatsApp mesajları (${f.mesajlar.length})`}>
              <MessageCircle size={14} aria-hidden="true" />
              {f.mesajlar.length} mesaj
            </button>
          )}
          {!KAPALI_ASAMALAR.includes(f.asama) && (
            <button type="button" onClick={() => onEylem("teklif")} className={KUCUK} aria-label={`${f.firma} için teklif oluştur`}>
              <FileText size={14} aria-hidden="true" />
              Teklif
            </button>
          )}
          <button type="button" onClick={() => onEylem("hatirlatma")} className={KUCUK} aria-label={`${f.firma} için hatırlatma ekle`}>
            <Bell size={14} aria-hidden="true" />
            Hatırlat
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-bg pt-2.5">
      <label className="flex min-w-0 flex-1 items-center text-xs font-semibold text-muted">
        <span className="sr-only">Aşama</span>
        <select
          value={f.asama}
          onChange={(e) => onTasi(f.id, e.target.value as Asama)}
          className="min-h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-line-strong bg-card px-2 text-xs font-bold text-ink"
        >
          {ASAMALAR.map((a) => (
            <option key={a} value={a}>{ASAMA_BILGI[a].ad}</option>
          ))}
        </select>
      </label>
      <div className="flex shrink-0 gap-0.5">
        <button
          type="button"
          onClick={onDuzenle}
          aria-label={`${f.firma} fırsatını düzenle`}
          title="Düzenle"
          className="flex h-9 w-8 cursor-pointer items-center justify-center rounded-lg text-[#474A42] transition-colors hover:bg-bg"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onYukari}
          disabled={!onYukari}
          aria-label={`${f.firma} kartını yukarı taşı`}
          title="Yukarı taşı"
          className="flex h-9 w-8 cursor-pointer items-center justify-center rounded-lg text-[#474A42] transition-colors hover:bg-bg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onAsagi}
          disabled={!onAsagi}
          aria-label={`${f.firma} kartını aşağı taşı`}
          title="Aşağı taşı"
          className="flex h-9 w-8 cursor-pointer items-center justify-center rounded-lg text-[#474A42] transition-colors hover:bg-bg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      </div>
    </article>
  );
}
