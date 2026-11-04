"use client";

// Excel (CSV) / PDF indirilebilen hazır raporlar; kategori filtresiyle
import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import Chip from "@/components/ui/chip";
import { csvIndir, pdfYazdir } from "@/lib/disa-aktar";
import { HAZIR_RAPORLAR, KATEGORI_BILGI, raporAltBasligi, type RaporKaynaklari, type RaporKategorisi } from "./hazir-rapor-tanimlari";

const KATEGORILER: (RaporKategorisi | "tumu")[] = ["tumu", "satis", "lisans", "destek", "bayi"];
const BTN =
  "inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold transition-colors hover:bg-[#F4F5F0]";

export default function HazirRaporlar({ kaynaklar }: { kaynaklar: RaporKaynaklari }) {
  const [kategori, setKategori] = useState<RaporKategorisi | "tumu">("tumu");
  const [uyari, setUyari] = useState<string | null>(null);
  const liste = HAZIR_RAPORLAR.filter((r) => kategori === "tumu" || r.kategori === kategori);

  return (
    <section aria-labelledby="hr-baslik" className="flex w-full flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="hr-baslik" className="text-[17px] font-extrabold">Hazır raporlar</h2>
        <div role="group" aria-label="Rapor kategorisi" className="ml-auto flex flex-wrap gap-1.5">
          {KATEGORILER.map((k) => {
            const aktif = k === kategori;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={aktif}
                onClick={() => setKategori(k)}
                className={`min-h-9 cursor-pointer rounded-[10px] border px-3 text-[13px] font-bold transition-colors ${
                  aktif ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:bg-[#F4F5F0]"
                }`}
              >
                {k === "tumu" ? "Tümü" : KATEGORI_BILGI[k].ad}
              </button>
            );
          })}
        </div>
      </div>

      {uyari && <p role="alert" className="rounded-control bg-warn-bg px-3 py-2.5 text-[13px] font-semibold text-warn">{uyari}</p>}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
        {liste.map((r) => {
          const satirSayisi = Math.max(0, r.tablo(kaynaklar).length - 1);
          const alt = raporAltBasligi(r, kaynaklar.donem);
          return (
            <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-line p-3.5">
              <div className="flex items-center gap-2">
                <Chip ton={KATEGORI_BILGI[r.kategori].ton}>{KATEGORI_BILGI[r.kategori].ad}</Chip>
                <span className="ml-auto text-xs tabular-nums text-muted">{satirSayisi} satır</span>
              </div>
              <b className="text-sm leading-snug">{r.baslik}</b>
              <span className="flex-1 text-xs leading-normal text-muted">{r.aciklama} · {alt}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUyari(null);
                    csvIndir(r.tablo(kaynaklar), `${r.id}-${new Date().toISOString().slice(0, 10)}.csv`); // tarih tıklama anında
                  }}
                  className={BTN}
                  aria-label={`${r.baslik} raporunu Excel olarak indir`}
                >
                  <FileSpreadsheet size={16} aria-hidden="true" />Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ok = pdfYazdir(r.baslik, alt, r.tablo(kaynaklar));
                    setUyari(ok ? null : "Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.");
                  }}
                  className={BTN}
                  aria-label={`${r.baslik} raporunu PDF olarak yazdır`}
                >
                  <FileText size={16} aria-hidden="true" />PDF
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
