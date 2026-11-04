"use client";

// Talep başlığı, açıklama, notlar ve not / durum formu
import { Paperclip } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import { DURUM_ADI, NOT_BILGI, type Talep, type TalepDurumu, type TalepNotu } from "./queries";
import { DURUM_TONU, ONCELIK_TONU, zamanYaz } from "./ortak";
import NotFormu from "./not-formu";

export default function TalepDetay({
  talep,
  onNot,
}: {
  talep: Talep | null;
  onNot: (id: string, not: TalepNotu, durum?: TalepDurumu) => void;
}) {
  const bugun = useBugun();
  if (!talep) {
    return (
      <section className="flex w-full items-center justify-center rounded-card border border-line bg-card p-10 text-sm text-muted">
        Ayrıntıları görmek için bir talep seçin.
      </section>
    );
  }
  const t = talep;

  return (
    <section aria-label="Talep detayı" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <header className="flex flex-col gap-2.5 border-b border-bg px-5 py-[18px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold tabular-nums text-muted">#{t.id}</span>
          <Chip ton={DURUM_TONU[t.durum]}>{DURUM_ADI[t.durum]}</Chip>
          <Chip ton={ONCELIK_TONU[t.oncelik]}>{t.oncelik} öncelik</Chip>
          <Chip>{t.konu}</Chip>
        </div>
        <h2 className="text-xl font-extrabold leading-snug">{t.baslik}</h2>
        <span className="text-[13px] text-muted">
          {zamanYaz(t.acilis, bugun)} tarihinde açıldı · {t.kanal} ile geldi
        </span>
      </header>

      <div className="flex flex-col gap-2 border-b border-bg px-5 py-[18px]">
        <h3 className="text-sm font-extrabold">Sorunun açıklaması</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{t.aciklama}</p>
        {t.dosya && (
          <span className="inline-flex items-center gap-2.5 self-start rounded-control border border-line px-3 py-2">
            <Paperclip size={18} aria-hidden="true" className="text-[#474A42]" />
            <span className="font-mono text-xs font-semibold">{t.dosya}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 bg-[#FAFBF8] px-5 py-[18px]">
        <h3 className="text-sm font-extrabold">Notlar ve yapılanlar</h3>
        <ol className="ml-[5px] flex flex-col gap-3.5 border-l-2 border-line">
          {t.notlar.map((n, i) => (
            <li key={`${n.zaman}-${i}`} className="relative flex flex-col gap-1 pl-4">
              <span
                aria-hidden="true"
                className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-[#FAFBF8]"
                style={{ background: NOT_BILGI[n.tur].renk }}
              />
              <span className="text-xs text-muted">
                <b className="text-ink">{NOT_BILGI[n.tur].ad}</b> · {zamanYaz(n.zaman, bugun)}
              </span>
              <span className="text-sm leading-normal">{n.metin}</span>
              {n.dosya && (
                <span className="inline-flex items-center gap-1.5 self-start text-xs text-[#474A42]">
                  <Paperclip size={14} aria-hidden="true" />
                  <span className="font-mono">{n.dosya}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <NotFormu key={t.id} talepId={t.id} durum={t.durum} onKaydedildi={(not, durum) => onNot(t.id, not, durum)} />
    </section>
  );
}
