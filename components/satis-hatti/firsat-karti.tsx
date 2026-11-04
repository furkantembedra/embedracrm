"use client";

// Kanban içindeki tek fırsat kartı. Sürüklenebilir; menüden de aşama değiştirilebilir.
import { ArrowRight } from "lucide-react";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { ASAMALAR, ASAMA_BILGI, KAPALI_ASAMALAR, type Asama, type Firsat } from "./queries";
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
