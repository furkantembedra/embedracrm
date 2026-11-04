// 30 gün / Çeyrek / Yıl seçici
import { DONEMLER, DONEM_BILGI, type Donem } from "./queries";

export default function DonemSecici({ secili, onSec }: { secili: Donem; onSec: (d: Donem) => void }) {
  return (
    <div role="group" aria-label="Tarih aralığı" className="flex gap-1 rounded-[14px] bg-[#E2E4DC] p-1">
      {DONEMLER.map((d) => {
        const aktif = d === secili;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={aktif}
            onClick={() => onSec(d)}
            className={`min-h-9 cursor-pointer rounded-[10px] px-3.5 text-[13px] font-bold transition-colors ${
              aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
            }`}
          >
            {DONEM_BILGI[d].kisa}
          </button>
        );
      })}
    </div>
  );
}
