"use client";

// CRM › Bayi detayı: portal erişimini aç / kapat, giriş bilgisi ve "Bayi gibi görüntüle"
import { useEffect, useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { bayiGibiGoruntule, portalDurumu, portalErisimiAyarla } from "./actions";

type Durum = Awaited<ReturnType<typeof portalDurumu>>;

export default function PortalKontrolleri({ bayiId }: { bayiId: string }) {
  const [durum, setDurum] = useState<Durum | null>(null);
  const [bekliyor, baslat] = useTransition();
  useEffect(() => {
    let iptal = false;
    portalDurumu(bayiId).then((d) => !iptal && setDurum(d));
    return () => void (iptal = true);
  }, [bayiId]);

  if (!durum) return <span className="text-xs text-muted">Portal durumu yükleniyor…</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={bekliyor}
        onClick={() => baslat(async () => {
          const d = await portalErisimiAyarla(bayiId, !durum.erisim);
          if (!("hata" in d)) setDurum(d);
        })}
        className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border px-3 text-[13px] font-bold transition-colors disabled:opacity-60 ${durum.erisim ? "border-line-strong bg-card hover:bg-err-bg hover:text-err" : "border-ink bg-ink text-white hover:bg-ink-soft"}`}
      >
        {durum.erisim ? "Portal erişimini kaldır" : "Portal erişimi ver"}
      </button>
      <button
        type="button"
        disabled={bekliyor}
        onClick={() => baslat(() => bayiGibiGoruntule(bayiId))}
        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold hover:bg-[#F4F5F0] disabled:opacity-60"
      >
        <ExternalLink size={15} aria-hidden="true" /> Bayi gibi görüntüle
      </button>
      <span className="text-xs text-muted">
        {durum.erisim ? (
          <>Portal açık · giriş: <b className="text-ink">{durum.eposta}</b> · demo şifre <code>{durum.demoSifre}</code>{durum.sonGiris ? ` · son giriş ${durum.sonGiris.replace("T", " ")}` : ""}</>
        ) : (
          "Portal erişimi kapalı"
        )}
      </span>
    </div>
  );
}
