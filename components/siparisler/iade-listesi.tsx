// İade ve değişim kayıtları: her kayıt adım adım ilerletilir (ürün bekleniyor → alındı → para iadesi / yeni kargo)
import { Plus } from "lucide-react";
import Chip from "@/components/ui/chip";
import { IADE_ADIMLARI, type Iade } from "./queries";

export default function IadeListesi({
  iadeler,
  bekliyor,
  onEkle,
  onIlerlet,
  onSiparisAc,
  siparisIdleri,
}: {
  iadeler: Iade[];
  bekliyor: boolean;
  onEkle: () => void;
  onIlerlet: (id: string) => void;
  onSiparisAc: (id: string) => void;
  siparisIdleri: Set<string>; // listede olmayan (eski) siparişe bağlantı verilmez
}) {
  return (
    <section aria-labelledby="ia-baslik" className="flex w-full min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="ia-baslik" className="text-[17px] font-extrabold">İade &amp; değişim</h2>
          <span className="text-xs font-semibold text-muted">14 günlük cayma süresi ve arızalı ürün değişimleri</span>
        </div>
        <button type="button" onClick={onEkle} className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold hover:bg-[#F4F5F0]">
          <Plus size={16} aria-hidden="true" />
          İade kaydı ekle
        </button>
      </div>
      {iadeler.length === 0 && <p className="py-6 text-center text-[13px] text-muted">Açık iade veya değişim kaydı yok.</p>}
      <ul className="flex flex-col gap-2">
        {iadeler.map((i) => {
          const adimlar = IADE_ADIMLARI[i.tur];
          const bitti = i.adim >= adimlar.length - 1;
          const sonraki = adimlar[i.adim + 1];
          return (
            <li key={i.id} className={`flex flex-wrap items-center gap-3 rounded-[14px] border border-line p-3 ${bitti ? "opacity-70" : ""}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[13px]">
                  #{i.id} · {i.musteri}
                  <span className="ml-1.5 font-semibold text-muted">{i.tur === "iade" ? "İade" : "Değişim"}</span>
                </b>
                {i.urunler && i.urunler.length > 0 && <span className="text-xs font-semibold text-[#474A42]">{i.urunler.join(", ")}</span>}
                <span className="text-xs text-muted">
                  {i.neden} ·{" "}
                  {siparisIdleri.has(i.siparisId) ? (
                    <button type="button" onClick={() => onSiparisAc(i.siparisId)} className="cursor-pointer font-semibold text-info hover:underline">#{i.siparisId}</button>
                  ) : (
                    <span className="font-semibold">#{i.siparisId}</span>
                  )}
                </span>
              </div>
              <Chip ton={bitti ? "ok" : i.adim === 0 ? "warn" : "info"}>{adimlar[i.adim]}</Chip>
              {!bitti && (
                <button
                  type="button"
                  onClick={() => onIlerlet(i.id)}
                  disabled={bekliyor}
                  className="min-h-9 cursor-pointer rounded-control bg-ink px-3 text-xs font-bold text-white hover:bg-ink-soft disabled:opacity-60"
                >
                  {sonraki}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
