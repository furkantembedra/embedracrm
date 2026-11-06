// Bayi başvuruları tablosu
import { Search } from "lucide-react";
import { Trash2 } from "lucide-react";
import Chip from "@/components/ui/chip";
import { ASAMA_BILGI, type Basvuru, type BayiAsamasi } from "./queries";
import { ASAMA_TONU, puanRengi, tarihYaz } from "./ortak";

const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3";

export default function BasvuruTablosu({
  basvurular,
  asama,
  seciliId,
  onSec,
  onSil,
  arama,
  onArama,
}: {
  basvurular: Basvuru[];
  asama: BayiAsamasi | null;
  seciliId: string | null;
  onSec: (id: string) => void;
  onSil?: (id: string) => void; // verilirse satır sonunda silme düğmesi çıkar
  arama: string;
  onArama: (v: string) => void;
}) {
  return (
    <section aria-labelledby="bs-baslik" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-3">
        <h2 id="bs-baslik" className="text-[17px] font-extrabold">Başvurular</h2>
        <Chip>{asama ? ASAMA_BILGI[asama].ad : "Tüm aşamalar"}</Chip>
        <label className="ml-auto flex h-10 min-w-[180px] flex-[0_1_240px] items-center gap-2 rounded-control border border-line bg-[#F4F5F0] px-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Başvuru ara</span>
          <input
            type="search"
            value={arama}
            onChange={(e) => onArama(e.target.value)}
            placeholder="Şirket, yetkili veya ülke"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-4`}>Şirket</th>
              <th scope="col" className={TH}>Bölge</th>
              <th scope="col" className={TH}>Aşama</th>
              <th scope="col" className={TH}>Uygunluk</th>
              <th scope="col" className={`${TH} text-right`}>İlk sipariş</th>
              <th scope="col" className={`${TH} ${onSil ? "" : "pr-4"}`}>Başvuru</th>
              {onSil && <th scope="col" className={`${TH} w-12 pr-4`}><span className="sr-only">İşlem</span></th>}
            </tr>
          </thead>
          <tbody>
            {basvurular.map((b) => {
              const secili = b.id === seciliId;
              const zemin = secili ? "bg-[#F3FBD6]" : "";
              return (
                <tr
                  key={b.id}
                  onClick={() => onSec(b.id)}
                  aria-selected={secili}
                  className={`cursor-pointer transition-colors ${secili ? "" : "hover:bg-[#F6F7F2]"}`}
                >
                  <td className={`${TD} pl-4 ${zemin} ${secili ? "shadow-[inset_3px_0_0_var(--color-lime-dark)]" : ""}`}>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSec(b.id);
                        }}
                        className="cursor-pointer text-left text-sm font-bold"
                      >
                        {b.sirket}
                      </button>
                      <span className="text-xs text-muted">{b.yetkili}</span>
                    </div>
                  </td>
                  <td className={`${TD} ${zemin}`}>
                    <span className="mr-1.5 rounded-md bg-bg px-1.5 py-0.5 text-xs font-bold">{b.ulkeKodu}</span>
                    {b.bolge}
                  </td>
                  <td className={`${TD} ${zemin}`}><Chip ton={ASAMA_TONU[b.asama]}>{ASAMA_BILGI[b.asama].ad}</Chip></td>
                  <td className={`${TD} ${zemin}`}>
                    {b.puan === null ? (
                      <span className="text-xs text-muted">Puanlanmadı</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-[60px] rounded-full bg-bg" aria-hidden="true">
                          <div className={`h-full rounded-full ${puanRengi(b.puan)}`} style={{ width: `${b.puan}%` }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums">{b.puan}</span>
                      </div>
                    )}
                  </td>
                  <td className={`${TD} ${zemin} text-right font-bold tabular-nums`}>{b.ilkSiparis ? `${b.ilkSiparis} cihaz` : "—"}</td>
                  <td className={`${TD} ${zemin} ${onSil ? "" : "pr-4"} text-[#474A42]`}>{tarihYaz(b.tarih)}</td>
                  {onSil && (
                    <td className={`${TD} ${zemin} pr-4 text-right`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSil(b.id);
                        }}
                        aria-label={`${b.sirket} başvurusunu sil`}
                        title="Başvuruyu sil"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-[#474A42] transition-colors hover:bg-err-bg hover:text-err"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {basvurular.length === 0 && (
              <tr>
                <td colSpan={onSil ? 7 : 6} className="px-4 py-10 text-center text-[13px] text-muted">
                  {arama.trim() ? `"${arama.trim()}" ile eşleşen başvuru yok.` : "Bu aşamada başvuru yok."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {basvurular.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Bu aşamada başvuru yok.</p>}
      </div>
    </section>
  );
}
