// Ödeme → Hazırlık → Kargo → Teslim → Lisans adım izleyici. Tamamlanan adımda gerçekleşen bilgi, sıradakinde ne yapılacağı yazar.
import { Check } from "lucide-react";
import { SIPARIS_ADIMLARI } from "@/lib/constants";
import type { Siparis } from "./queries";
import { cihazAdedi, dijital, lisansVar, tamamlananAdim, tarihYaz } from "./ortak";

function notlar(s: Siparis): string[] {
  const d = dijital(s);
  const lisans = s.kalemler.find((k) => k.tur === "lisans");
  return [
    s.durum === "odeme" ? `${s.odeme} ödemesi kontrol edilip işaretlenir` : `${s.odeme} ile alındı`,
    d
      ? "Kargo gerekmez, lisans anahtarı hazırlanır"
      : s.seriNolar.length >= cihazAdedi(s)
        ? `${s.seriNolar.length} cihaza seri no atandı`
        : `Seri no atanır (${s.seriNolar.length}/${cihazAdedi(s)})`,
    d ? "Dijital teslimat" : s.kargo ? `${s.kargo.firma} · ${s.kargo.takipNo}` : "Kargo firması ve takip no girilir",
    d ? "Dijital teslimat" : s.teslimTarihi ? tarihYaz(s.teslimTarihi) : "Teslim tarihi girilir",
    !lisans || lisans.tur !== "lisans"
      ? "Bu siparişte lisans yok"
      : s.bayiId
        ? "Lisansı bayi aktive eder"
        : s.lisansBaslangic
          ? `${lisans.paket} · ${tarihYaz(s.lisansBaslangic)} başlangıçlı`
          : "Lisans anahtarı müşteriye iletilir",
  ];
}

export default function SiparisAdimlari({ siparis: s }: { siparis: Siparis }) {
  const biten = tamamlananAdim(s);
  const aciklama = notlar(s);
  const atlanir = (i: number) => (dijital(s) && (i === 2 || i === 3)) || (i === 4 && (!lisansVar(s) || !!s.bayiId));
  return (
    <ol aria-label="Sipariş adımları" className="flex flex-col">
      {SIPARIS_ADIMLARI.map((ad, i) => {
        const bitti = i < biten;
        const aktif = i === biten;
        const son = i === SIPARIS_ADIMLARI.length - 1;
        const pas = atlanir(i) && !bitti;
        return (
          <li key={ad} className="flex gap-3" aria-current={aktif ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                  bitti ? "border-ink bg-ink text-lime" : aktif ? "border-ink bg-lime" : "border-line-strong bg-card"
                }`}
              >
                {bitti && <Check size={12} strokeWidth={3.5} aria-hidden="true" />}
              </span>
              {!son && <span className={`min-h-[18px] w-0.5 flex-1 ${bitti ? "bg-ink" : "bg-line"}`} />}
            </div>
            <div className={`flex flex-col gap-0.5 ${son ? "" : "pb-3.5"}`}>
              <span className={`text-[13px] font-bold ${bitti || aktif ? "text-ink" : "text-muted"} ${pas ? "line-through decoration-line-strong" : ""}`}>
                {ad}
                <span className="sr-only">{bitti ? " (tamamlandı)" : aktif ? " (sıradaki adım)" : ""}</span>
              </span>
              <span className="text-xs text-muted">{aciklama[i]}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
