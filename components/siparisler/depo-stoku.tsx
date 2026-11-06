// Depodaki cihaz ve kablo stoku. Kritik seviyenin altındakiler kırmızı; hazırlanan siparişlerin ihtiyacı ayrıca gösterilir.
import { Plus } from "lucide-react";
import type { Siparis, StokKalemi } from "./queries";
import { CIHAZ_STOK_KODU, KUTU_ICERIGI } from "./queries";

/** Ödeme bekleyen + hazırlanan siparişlerin henüz stoktan düşmemiş ihtiyacı */
function bekleyenIhtiyac(siparisler: Siparis[]) {
  const ihtiyac = new Map<string, number>();
  const ekle = (kod: string, n: number) => ihtiyac.set(kod, (ihtiyac.get(kod) ?? 0) + n);
  for (const s of siparisler) {
    if (s.durum !== "odeme" && s.durum !== "hazirlaniyor") continue;
    for (const k of s.kalemler) {
      if (k.tur === "cihaz") {
        ekle(CIHAZ_STOK_KODU[k.model], k.adet);
        for (const kod of KUTU_ICERIGI) ekle(kod, k.adet);
      }
      if (k.tur === "aksesuar") ekle(k.stokKodu, k.adet);
    }
  }
  return ihtiyac;
}

export default function DepoStoku({ stok, siparisler, onGiris }: { stok: StokKalemi[]; siparisler: Siparis[]; onGiris: () => void }) {
  const ihtiyac = bekleyenIhtiyac(siparisler);
  return (
    <section aria-labelledby="st-baslik" className="flex w-full min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="st-baslik" className="text-[17px] font-extrabold">Depo stoku</h2>
          <span className="text-xs font-semibold text-muted">Buca / İzmir · bekleyen siparişlerin ihtiyacı parantezde</span>
        </div>
        <button type="button" onClick={onGiris} className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold hover:bg-[#F4F5F0]">
          <Plus size={16} aria-hidden="true" />
          Stok / ürün ekle
        </button>
      </div>
      <ul className="flex flex-col gap-3">
        {stok.map((k) => {
          const gerek = ihtiyac.get(k.kod) ?? 0;
          const kritik = k.adet <= k.kritik;
          const yetmez = gerek > k.adet;
          const yuzde = Math.min(100, Math.round((k.adet / k.hedef) * 100));
          return (
            <li key={k.kod} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,140px)_auto] items-center gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <b className="truncate text-[13px]">{k.ad}</b>
                <span className="text-xs text-muted">{k.kod}</span>
              </div>
              <div className="h-2 rounded-full bg-bg" role="img" aria-label={`${k.ad}: ${k.adet} adet, hedef ${k.hedef}`}>
                <div className={`h-full rounded-full ${kritik ? "bg-[#D93F3F]" : k.kod.endsWith("-HW") ? "bg-ink" : "bg-[#B6DD2E]"}`} style={{ width: `${yuzde}%` }} />
              </div>
              <span className="flex flex-col items-end text-right">
                <b className={`text-[13px] tabular-nums ${kritik ? "text-err" : ""}`}>{k.adet} adet</b>
                {gerek > 0 && <span className={`text-[11px] font-semibold tabular-nums ${yetmez ? "text-err" : "text-muted"}`}>({gerek} bekliyor{yetmez ? " · yetmez" : ""})</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
