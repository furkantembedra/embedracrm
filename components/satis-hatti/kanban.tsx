"use client";

// Aşama sütunları: Yeni lead → Demo → Teklif → Müzakere → Kazanıldı / Kaybedildi
import { useState } from "react";
import { Plus } from "lucide-react";
import { kisaTl } from "@/lib/format";
import { ASAMALAR, ASAMA_BILGI, type Asama, type Firsat } from "./queries";
import FirsatKarti, { type KartEylemi } from "./firsat-karti";
import type { BirakmaKonumu } from "./ortak";

export default function Kanban({
  firsatlar,
  onTasi,
  onSirala,
  onEkle,
  onDuzenle,
  onEylem,
}: {
  firsatlar: Firsat[];
  onTasi: (id: string, asama: Asama, konum?: BirakmaKonumu) => void;
  onSirala: (id: string, yon: -1 | 1) => void;
  onEkle: (asama: Asama) => void;
  onDuzenle: (id: string) => void;
  onEylem: (id: string, eylem: KartEylemi) => void;
}) {
  const [suruklenen, setSuruklenen] = useState<string | null>(null);
  const [hedef, setHedef] = useState<Asama | null>(null);
  const [konum, setKonum] = useState<BirakmaKonumu | null>(null); // çizginin gösterileceği yer

  const bitir = () => {
    setSuruklenen(null);
    setHedef(null);
    setKonum(null);
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="grid min-w-[1600px] grid-cols-6 gap-3.5">
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
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setHedef(null);
                  setKonum(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                // Çizgi bu sütundaki bir kartın yanındaysa oraya, değilse sütunun sonuna
                const yer = konum && liste.some((f) => f.id === konum.hedefId) ? konum : undefined;
                if (id) onTasi(id, asama, yer);
                bitir();
              }}
              className={`flex min-h-[420px] flex-col gap-2.5 rounded-card p-3 transition-colors ${
                ustunde ? "bg-[#DCE9B0] outline-2 outline-dashed outline-lime-dark" : "bg-[#E4E6DF]"
              }`}
            >
              <header className="flex items-center gap-2 px-1 pt-1">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: bilgi.renk }} />
                <h2 className="text-sm font-extrabold">{bilgi.ad}</h2>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums text-[#474A42]">{liste.length}</span>
                {asama !== "kaybedildi" && <button
                  type="button"
                  onClick={() => onEkle(asama)}
                  aria-label={`${bilgi.ad} aşamasına fırsat ekle`}
                  className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-[#474A42] transition-colors hover:bg-[#D6D9D0]"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>}
              </header>
              <p className="px-1 text-xs font-semibold tabular-nums text-[#474A42]">{kisaTl(toplam)}</p>

              {liste.map((f, i) => {
                const cizgiUstte = konum?.hedefId === f.id && konum.once && suruklenen !== f.id;
                const cizgiAltta = konum?.hedefId === f.id && !konum.once && suruklenen !== f.id;
                return (
                  <div
                    key={f.id}
                    className={`relative ${suruklenen === f.id ? "opacity-40" : ""}`}
                    onDragOver={(e) => {
                      if (suruklenen === null) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      const once = e.clientY < r.top + r.height / 2;
                      if (konum?.hedefId !== f.id || konum.once !== once) setKonum({ hedefId: f.id, once });
                    }}
                  >
                    {cizgiUstte && <span aria-hidden="true" className="absolute -top-[7px] left-1 right-1 h-[3px] rounded-full bg-ink" />}
                    <FirsatKarti
                      firsat={f}
                      onTasi={onTasi}
                      onDuzenle={() => onDuzenle(f.id)}
                      onEylem={(e) => onEylem(f.id, e)}
                      onSurukleBasla={setSuruklenen}
                      onSurukleBitti={bitir}
                      onYukari={i > 0 ? () => onSirala(f.id, -1) : undefined}
                      onAsagi={i < liste.length - 1 ? () => onSirala(f.id, 1) : undefined}
                    />
                    {cizgiAltta && <span aria-hidden="true" className="absolute -bottom-[7px] left-1 right-1 h-[3px] rounded-full bg-ink" />}
                  </div>
                );
              })}

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
