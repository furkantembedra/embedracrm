// Ülke / bölge durum listesi (başvurular ve aktif bayilerden hesaplanır)
import Chip from "@/components/ui/chip";
import type { AktifBayi, Basvuru } from "./queries";
import { bolgeKapsamasi } from "./ortak";

export default function BolgeKapsamasi({ basvurular, bayiler }: { basvurular: Basvuru[]; bayiler: AktifBayi[] }) {
  const bolgeler = bolgeKapsamasi(basvurular, bayiler);
  const kapsanan = bolgeler.filter((r) => r.durum !== "Bayi aranıyor").length;
  return (
    <section aria-labelledby="rg-baslik" className="flex w-full min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="rg-baslik" className="text-[17px] font-extrabold">Bölge kapsaması</h2>
        <span className="text-xs font-semibold text-muted">{kapsanan} / {bolgeler.length} ülkede bayi veya başvuru var</span>
      </div>
      <ul className="-mr-2 flex max-h-[360px] flex-col gap-2.5 overflow-y-auto pr-2" tabIndex={0} aria-label="Ülkeler">
        {bolgeler.map((r) => (
          <li key={r.kod} className="flex items-center gap-2.5 text-[13px]">
            <b className="w-[34px] rounded-md bg-bg py-0.5 text-center text-xs">{r.kod}</b>
            <span className="flex-1 font-semibold">{r.ad}</span>
            {r.aktif > 0 && r.surecte > 0 && (
              <span className="text-xs font-semibold text-muted" title="Lansmana gelmemiş başvuru">+{r.surecte} süreçte</span>
            )}
            <Chip ton={r.ton}>
              {r.durum}
              {r.aktif > 1 && <span className="tabular-nums"> · {r.aktif}</span>}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
