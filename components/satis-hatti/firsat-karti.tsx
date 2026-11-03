"use client";

// Kanban içindeki tek fırsat kartı. Sürüklenebilir; menüden de aşama değiştirilebilir.
import { ArrowRight } from "lucide-react";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { ASAMALAR, ASAMA_BILGI, type Asama, type Firsat } from "./queries";
import { useBugun } from "@/lib/use-bugun";
import { KAYNAK_TONU, tarihEtiketi } from "./ortak";

export default function FirsatKarti({
  firsat,
  onTasi,
  onSurukleBasla,
}: {
  firsat: Firsat;
  onTasi: (id: string, asama: Asama) => void;
  onSurukleBasla: (id: string) => void;
}) {
  const f = firsat;
  const bugun = useBugun();
  const tarih = tarihEtiketi(f.sonrakiTarih, bugun, f.asama === "kazanildi");

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", f.id);
        e.dataTransfer.effectAllowed = "move";
        onSurukleBasla(f.id);
      }}
      className={`flex cursor-grab flex-col gap-2.5 rounded-2xl border bg-card p-3.5 transition-shadow hover:shadow-[0_6px_18px_rgba(14,15,12,0.08)] active:cursor-grabbing ${
        tarih.gecikti ? "border-[#F5C089]" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <Chip ton={KAYNAK_TONU[f.kaynak]}>{f.kaynak}</Chip>
        <span className={`ml-auto text-xs font-semibold ${tarih.gecikti ? "text-warn" : "text-muted"}`}>{tarih.metin}</span>
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold leading-snug">{f.firma}</h3>
        <span className="text-xs text-muted">{f.konum}</span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-[#F4F5F0] p-2.5">
        <span className="text-xs font-semibold text-[#474A42]">{f.icerik}</span>
        <b className="text-base tabular-nums">{tl(f.tutar)}</b>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{f.sonrakiAdim}</span>
      </div>

      <label className="flex items-center gap-2 border-t border-bg pt-2.5 text-xs font-semibold text-muted">
        Aşama
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
    </article>
  );
}
