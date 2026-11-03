"use client";

// Açık fırsat değeri, kazanılan, kazanma oranı, geciken takip
import { kisaTl } from "@/lib/format";
import type { Firsat } from "./queries";
import { gunFarki, useBugun } from "@/lib/use-bugun";

export default function OzetKartlari({ firsatlar }: { firsatlar: Firsat[] }) {
  const bugun = useBugun();
  const acik = firsatlar.filter((f) => f.asama !== "kazanildi");
  const kazanilan = firsatlar.filter((f) => f.asama === "kazanildi");
  const teklifSonrasi = firsatlar.filter((f) => ["teklif", "muzakere", "kazanildi"].includes(f.asama));
  const oran = teklifSonrasi.length ? Math.round((kazanilan.length / teklifSonrasi.length) * 100) : 0;
  const geciken = bugun === null ? null : acik.filter((f) => (gunFarki(f.sonrakiTarih, bugun) ?? 0) < 0).length;
  const toplam = (l: Firsat[]) => l.reduce((t, f) => t + f.tutar, 0);

  const kartlar = [
    { etiket: "Açık fırsat değeri", deger: kisaTl(toplam(acik)), alt: `${acik.length} fırsat`, vurgu: false },
    { etiket: "Kazanılan", deger: kisaTl(toplam(kazanilan)), alt: `${kazanilan.length} fırsat`, vurgu: true },
    { etiket: "Kazanma oranı", deger: `%${oran}`, alt: "Teklif aşamasına gelenlerden", vurgu: false },
    { etiket: "Geciken takip", deger: geciken === null ? "—" : String(geciken), alt: geciken ? "Sonraki adım tarihi geçti" : "Hepsi zamanında", vurgu: false, uyari: !!geciken },
  ];

  return (
    <section aria-label="Satış özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kartlar.map((k) => (
        <div
          key={k.etiket}
          className={`flex flex-col gap-1.5 rounded-card border p-4 ${k.vurgu ? "border-lime bg-lime-bg" : "border-line bg-card"}`}
        >
          <span className={`text-xs font-semibold ${k.vurgu ? "text-[#3A4D00]" : "text-muted"}`}>{k.etiket}</span>
          <b className="text-2xl font-extrabold tabular-nums">{k.deger}</b>
          <span className={`text-xs font-semibold ${k.uyari ? "text-warn" : k.vurgu ? "text-[#3A4D00]" : "text-muted"}`}>{k.alt}</span>
        </div>
      ))}
    </section>
  );
}
