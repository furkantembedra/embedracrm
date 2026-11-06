// İki EmbedraONE cihazı: kayıtlı adet ve pay. Üstteki seçimle bayiye göre süzülür;
// model satırına tıklanınca tablo o modele süzülür.
import Card from "@/components/ui/card";
import Chip from "@/components/ui/chip";
import { sayi } from "@/lib/format";
import { CIHAZ_MODELLERI, URUN_BILGI, type CihazModeli } from "@/lib/urunler";

/** "tumu": filtre yok · "bayi": bayi üzerinden gelen tüm cihazlar · "dogrudan": Embedra'nın doğrudan sattıkları · diğerleri bayi id */
export type BayiSecimi = "tumu" | "bayi" | "dogrudan" | (string & {});

export default function CihazModelleri({
  modeller,
  secili,
  onSec,
  bayiler,
  bayi,
  onBayi,
}: {
  modeller: Record<CihazModeli, number>;
  secili?: CihazModeli | "tumu";
  onSec?: (m: CihazModeli | "tumu") => void;
  bayiler: { id: string; ad: string }[];
  bayi: BayiSecimi;
  onBayi: (b: BayiSecimi) => void;
}) {
  const toplam = CIHAZ_MODELLERI.reduce((t, m) => t + modeller[m], 0);
  return (
    <Card title="Cihaz modelleri" description={`${sayi(toplam)} cihaz · lisans ayrı satılır`}>
      <label className="flex flex-col gap-1.5 text-xs font-bold">
        Satış kanalı
        <select
          value={bayi}
          onChange={(e) => onBayi(e.target.value)}
          className={`min-h-10 w-full cursor-pointer rounded-control border bg-card px-3 text-[13px] font-semibold outline-none focus:border-ink ${
            bayi === "tumu" ? "border-line-strong" : "border-ink"
          }`}
        >
          <option value="tumu">Tüm cihazlar</option>
          <option value="bayi">Tüm bayiler</option>
          <option value="dogrudan">Doğrudan (Embedra)</option>
          {bayiler.length > 0 && (
            <optgroup label="Bayi">
              {bayiler.map((b) => (
                <option key={b.id} value={b.id}>{b.ad}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <ul className="flex flex-col gap-2">
        {CIHAZ_MODELLERI.map((m) => {
          const pay = toplam ? Math.round((modeller[m] / toplam) * 100) : 0;
          const aktif = secili === m;
          const icerik = (
            <span className="flex items-center gap-2">
              <Chip ton={m === "ONE" ? "ink" : "gray"}>{URUN_BILGI[m].ad}</Chip>
              <b className="ml-auto tabular-nums">{sayi(modeller[m])}</b>
              <span className="w-9 text-right text-xs font-semibold tabular-nums text-muted">%{pay}</span>
            </span>
          );
          return (
            <li key={m}>
              {onSec ? (
                <button
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => onSec(aktif ? "tumu" : m)}
                  className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-[14px] border p-3 text-left transition-colors ${
                    aktif ? "border-ink bg-[#F4F5F0]" : "border-transparent bg-[#F4F5F0] hover:border-line-strong"
                  }`}
                >
                  {icerik}
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 rounded-[14px] bg-[#F4F5F0] p-3">{icerik}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
