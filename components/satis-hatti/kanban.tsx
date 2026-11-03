"use client";

// Aşama sütunları: Yeni lead → Demo → Teklif → Müzakere → Kazanıldı
import { useState } from "react";
import { Plus } from "lucide-react";
import { kisaTl } from "@/lib/format";
import { ASAMALAR, ASAMA_BILGI, type Asama, type Firsat } from "./queries";
import FirsatKarti from "./firsat-karti";

export default function Kanban({
  firsatlar,
  onTasi,
  onEkle,
}: {
  firsatlar: Firsat[];
  onTasi: (id: string, asama: Asama) => void;
  onEkle: (asama: Asama) => void;
}) {
  const [suruklenen, setSuruklenen] = useState<string | null>(null);
  const [hedef, setHedef] = useState<Asama | null>(null);

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="grid min-w-[1340px] grid-cols-5 gap-3.5">
        {ASAMALAR.map((asama) => {
          const bilgi = ASAMA_BILGI[asama];
          const liste = firsatlar.filter((f) => f.asama === asama);
          const toplam = liste.reduce((t, f) => t + f.tutar, 0);
          const ustunde = hedef === asama && suruklenen !== null;

          return (
            <section
              key={asama}
              aria-label={bilgi.ad}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (hedef !== asama) setHedef(asama);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHedef(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onTasi(id, asama);
                setSuruklenen(null);
                setHedef(null);
              }}
              className={`flex min-h-[420px] flex-col gap-2.5 rounded-card p-3 transition-colors ${
                ustunde ? "bg-[#DCE9B0] outline-2 outline-dashed outline-lime-dark" : "bg-[#E4E6DF]"
              }`}
            >
              <header className="flex items-center gap-2 px-1 pt-1">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: bilgi.renk }} />
                <h2 className="text-sm font-extrabold">{bilgi.ad}</h2>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums text-[#474A42]">{liste.length}</span>
                <button
                  type="button"
                  onClick={() => onEkle(asama)}
                  aria-label={`${bilgi.ad} aşamasına fırsat ekle`}
                  className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-[#474A42] transition-colors hover:bg-[#D6D9D0]"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </header>
              <p className="px-1 text-xs font-semibold tabular-nums text-[#474A42]">{kisaTl(toplam)}</p>

              {liste.map((f) => (
                <FirsatKarti key={f.id} firsat={f} onTasi={onTasi} onSurukleBasla={setSuruklenen} />
              ))}

              {liste.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#C9CCC2] p-4 text-center text-xs text-muted">
                  Kartı buraya sürükleyin
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
