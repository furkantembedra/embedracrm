// Servisteki cihazlar
import Chip from "@/components/ui/chip";
import type { RmaKaydi } from "./queries";
import { RMA_TONU } from "./ortak";

export default function ServisKuyrugu({ kayitlar, acik }: { kayitlar: RmaKaydi[]; acik: number }) {
  return (
    <section aria-labelledby="rma-baslik" className="flex w-full min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex items-center gap-3">
        <h2 id="rma-baslik" className="text-[17px] font-extrabold leading-tight">Servis / RMA kuyruğu</h2>
        <Chip className="ml-auto">{acik} açık</Chip>
      </div>
      {kayitlar.length === 0 ? (
        <p className="text-[13px] text-muted">Serviste cihaz yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {kayitlar.map((r) => (
            <li key={r.seriNo} className="flex items-center gap-3 rounded-[14px] border border-line p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono text-xs font-semibold">{r.seriNo}</span>
                <span className="text-xs text-muted">{r.sorun}</span>
              </div>
              <Chip ton={RMA_TONU[r.adim]}>{r.adim}</Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
