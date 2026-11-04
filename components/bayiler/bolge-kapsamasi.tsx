// Ülke / bölge durum listesi (başvurular ve aktif bayilerden hesaplanır)
import Chip from "@/components/ui/chip";
import type { AktifBayi, Basvuru } from "./queries";
import { bolgeKapsamasi } from "./ortak";

export default function BolgeKapsamasi({ basvurular, bayiler }: { basvurular: Basvuru[]; bayiler: AktifBayi[] }) {
  const bolgeler = bolgeKapsamasi(basvurular, bayiler);
  return (
    <section aria-labelledby="rg-baslik" className="flex w-full min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="rg-baslik" className="text-[17px] font-extrabold">Bölge kapsaması</h2>
        <span className="text-xs font-semibold text-muted">Avrupa genişleme planı</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {bolgeler.map((r) => (
          <li key={r.kod} className="flex items-center gap-2.5 text-[13px]">
            <b className="w-[34px] rounded-md bg-bg py-0.5 text-center text-xs">{r.kod}</b>
            <span className="flex-1 font-semibold">{r.ad}</span>
            <Chip ton={r.ton}>{r.durum}</Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
