// Firmware sürümlerine göre dağılım
import Card from "@/components/ui/card";
import { sayi } from "@/lib/format";
import type { CihazOzeti } from "./queries";

export default function FirmwareDagilimi({
  firmware,
  onEskileriListele,
}: {
  firmware: CihazOzeti["firmware"];
  onEskileriListele?: () => void;
}) {
  const toplam = firmware.reduce((t, f) => t + f.adet, 0);
  return (
    <Card title="Firmware dağılımı" description="Cihaz kayıtlarına girilen sürüm bilgisi">
      <ul className="flex flex-col gap-3.5">
        {firmware.map((f) => {
          const yuzde = toplam ? Math.round((f.adet / toplam) * 100) : 0;
          return (
            <li key={f.surum} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="font-mono text-xs font-semibold">{f.surum}</span>
                <span className="font-bold tabular-nums">{sayi(f.adet)} · %{yuzde}</span>
              </div>
              <div className="h-2 rounded-full bg-bg" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${yuzde}%`, background: f.renk }} />
              </div>
            </li>
          );
        })}
      </ul>
      {onEskileriListele && (
        <button
          type="button"
          onClick={onEskileriListele}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]"
        >
          Eski sürümdeki cihazları listele
        </button>
      )}
    </Card>
  );
}
