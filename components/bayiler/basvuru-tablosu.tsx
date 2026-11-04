// Bayi başvuruları tablosu
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
}: {
  basvurular: Basvuru[];
  asama: BayiAsamasi | null;
  seciliId: string | null;
  onSec: (id: string) => void;
}) {
  return (
    <section aria-labelledby="bs-baslik" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <h2 id="bs-baslik" className="text-[17px] font-extrabold">Başvurular</h2>
        <Chip>{asama ? ASAMA_BILGI[asama].ad : "Tüm aşamalar"}</Chip>
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
              <th scope="col" className={`${TH} pr-4`}>Başvuru</th>
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
                  <td className={`${TD} ${zemin} pr-4 text-[#474A42]`}>{tarihYaz(b.tarih)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {basvurular.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Bu aşamada başvuru yok.</p>}
      </div>
    </section>
  );
}
