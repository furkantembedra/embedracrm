// Tümü + Başvuru → Değerlendirme → Sözleşme → Lansman kartları; tıklayınca başvuruları filtreler
import { ASAMALAR, ASAMA_BILGI, type BayiAsamasi } from "./queries";

export default function OnboardingAsamalari({
  secili,
  sayilar,
  onSec,
}: {
  secili: BayiAsamasi | null;
  sayilar: Record<BayiAsamasi, number>;
  onSec: (a: BayiAsamasi | null) => void;
}) {
  return (
    <section aria-labelledby="ob-baslik" className="flex w-full flex-col gap-4 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ob-baslik" className="text-[17px] font-extrabold">Onboarding süreci</h2>
        <span className="ml-auto text-xs font-semibold text-muted">Bir aşamaya tıklayarak başvuruları filtreleyin</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          aria-pressed={secili === null}
          onClick={() => onSec(null)}
          className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-4 text-left transition-colors ${
            secili === null ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-[#F6F7F2]"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`flex h-7 items-center justify-center rounded-full px-2 text-[11px] font-extrabold text-ink ${secili === null ? "bg-lime" : "bg-bg"}`}
            >
              Tümü
            </span>
            <span className="text-sm font-extrabold">Tüm başvurular</span>
            <span className="ml-auto text-[22px] font-extrabold tabular-nums">{ASAMALAR.reduce((t, a) => t + sayilar[a], 0)}</span>
          </span>
          <span className={`text-xs leading-snug ${secili === null ? "text-[#C3C6BC]" : "text-[#474A42]"}`}>Bütün aşamalardaki başvurular bir arada</span>
        </button>
        {ASAMALAR.map((a, i) => {
          const aktif = a === secili;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={aktif}
              onClick={() => onSec(aktif ? null : a)}
              className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-4 text-left transition-colors ${
                aktif ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-[#F6F7F2]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-extrabold tabular-nums text-ink ${aktif ? "bg-lime" : "bg-bg"}`}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-extrabold">{ASAMA_BILGI[a].ad}</span>
                <span className="ml-auto text-[22px] font-extrabold tabular-nums">{sayilar[a]}</span>
              </span>
              <span className={`text-xs leading-snug ${aktif ? "text-[#C3C6BC]" : "text-[#474A42]"}`}>{ASAMA_BILGI[a].aciklama}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
