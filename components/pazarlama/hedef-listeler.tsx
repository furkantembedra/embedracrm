"use client";

// Hedef listeler: CRM kayıtlarından süzülür, Excel'de açılan CSV olarak indirilir. Filtreli liste kaydedilebilir.
import { BadgePercent, Clock, Download, FileSpreadsheet, Globe, Mail, Plus, Trash2, Upload, UserX, Users } from "lucide-react";
import { HAZIR_LISTELER, type OzelListe } from "./queries";

const SIMGE = {
  bitiyor: { simge: Clock, zemin: "bg-err-bg", renk: "text-err" },
  basic: { simge: BadgePercent, zemin: "bg-lime-bg/50", renk: "text-[#3A4D00]" },
  izinli: { simge: Mail, zemin: "bg-bg", renk: "text-[#474A42]" },
  bayiler: { simge: Globe, zemin: "bg-info-bg", renk: "text-info" },
  kayip: { simge: UserX, zemin: "bg-warn-bg", renk: "text-warn" },
} as const;

const SIMGE_BTN = "flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-control border border-line-strong bg-card hover:bg-[#F4F5F0] disabled:cursor-not-allowed disabled:opacity-40";

export default function HedefListeler({
  ozelListeler,
  sayi,
  filtreOzeti,
  onIndir,
  onSil,
  onYeni,
  onIceAktar,
  hata,
}: {
  ozelListeler: OzelListe[];
  sayi: (id: string) => number | null; // null: henüz hesaplanmadı (tarih bekleniyor)
  filtreOzeti: (l: OzelListe) => string;
  onIndir: (id: string) => void;
  onSil: (id: string) => void;
  onYeni: () => void;
  onIceAktar: () => void;
  hata: string | null;
}) {
  const satir = (id: string, ad: string, ipucu: string, ikon: { simge: typeof Clock; zemin: string; renk: string }, silinebilir: boolean) => {
    const n = sayi(id);
    const Simge = ikon.simge;
    return (
      <li key={id} className="flex items-center gap-3 rounded-[14px] border border-line py-2.5 pl-3 pr-2.5">
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] ${ikon.zemin}`}>
          <Simge size={18} aria-hidden="true" className={ikon.renk} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="truncate text-[13px]">{ad}</b>
          <span className="truncate text-xs text-muted tabular-nums">{n === null ? "—" : n} kişi · {ipucu}</span>
        </div>
        {silinebilir && (
          <button type="button" onClick={() => onSil(id)} aria-label={`${ad} listesini sil`} title="Listeyi sil" className={`${SIMGE_BTN} text-muted hover:text-err`}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={() => onIndir(id)} disabled={!n} aria-label={`${ad} listesini indir`} title="Excel'e indir" className={SIMGE_BTN}>
          <Download size={16} aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby="hl-baslik" className="flex w-full min-w-0 flex-col gap-2.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id="hl-baslik" className="text-[17px] font-extrabold">Hedef listeler</h2>
        <span className="text-xs font-semibold text-muted">CRM kayıtlarından süzülür ya da dosyadan içe aktarılır · Excel olarak indirilir</span>
      </div>
      <ul className="flex flex-col gap-2">
        {HAZIR_LISTELER.map((l) => satir(l.id, l.ad, l.ipucu, SIMGE[l.id], false))}
        {ozelListeler.map((l) =>
          satir(l.id, l.ad, filtreOzeti(l), l.aktarim ? { simge: FileSpreadsheet, zemin: "bg-ok-bg", renk: "text-ink" } : { simge: Users, zemin: "bg-bg", renk: "text-ink" }, true),
        )}
      </ul>
      {hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{hata}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onYeni} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-card px-3 text-sm font-bold hover:bg-[#F4F5F0]">
          <Plus size={18} aria-hidden="true" />
          Filtreyle oluştur
        </button>
        <button type="button" onClick={onIceAktar} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-card px-3 text-sm font-bold hover:bg-[#F4F5F0]">
          <Upload size={18} aria-hidden="true" />
          CSV / Excel aktar
        </button>
      </div>
    </section>
  );
}
