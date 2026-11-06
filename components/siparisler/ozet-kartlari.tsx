"use client";

// Özet kartları listedeki filtrelerle birebir aynıdır: karta tıklamak o sekmeyi (ya da "fatura bekleyen" filtresini) açar,
// karttaki sayı da o filtrede listelenen sipariş sayısıdır.
import type { Siparis } from "./queries";
import { dijital, faturaBekliyor, lisansVar, seriTamam, yurtDisi, type Sekme } from "./ortak";

type Kart = { id: Sekme | "fatura"; etiket: string; deger: number; alt: string; uyari?: boolean };

export default function OzetKartlari({
  siparisler,
  sekme,
  faturasiz,
  onSekme,
  onFatura,
}: {
  siparisler: Siparis[];
  sekme: Sekme;
  faturasiz: boolean;
  onSekme: (s: Sekme) => void;
  onFatura: (acik: boolean) => void;
}) {
  const durumda = (d: Siparis["durum"]) => siparisler.filter((s) => s.durum === d);
  const odeme = durumda("odeme");
  const hazirlanan = durumda("hazirlaniyor");
  const kargoyaHazir = hazirlanan.filter((s) => !dijital(s) && seriTamam(s)).length;
  const seriBekleyen = hazirlanan.filter((s) => !dijital(s) && !seriTamam(s)).length;
  const kargoda = durumda("kargoda");
  const teslim = durumda("teslim");
  const lisansBekleyen = teslim.filter((s) => lisansVar(s) && !s.lisansBaslangic).length;
  const faturaBekleyen = siparisler.filter(faturaBekliyor).length;

  const kartlar: Kart[] = [
    { id: "odeme", etiket: "Ödeme bekliyor", deger: odeme.length, alt: odeme.length ? `${odeme.filter((s) => s.odeme !== "Kart").length} havale / proforma` : "Bekleyen ödeme yok" },
    {
      id: "hazirlaniyor", etiket: "Hazırlanıyor", deger: hazirlanan.length,
      alt: hazirlanan.length ? [kargoyaHazir && `${kargoyaHazir} kargoya hazır`, seriBekleyen && `${seriBekleyen} seri no bekliyor`].filter(Boolean).join(" · ") || "Lisans teslimi bekliyor" : "Hazırlanan sipariş yok",
    },
    { id: "kargoda", etiket: "Kargoda", deger: kargoda.length, alt: kargoda.length ? `${kargoda.filter(yurtDisi).length} yurt dışı` : "Yolda sipariş yok" },
    { id: "teslim", etiket: "Teslim edildi", deger: teslim.length, alt: lisansBekleyen ? `${lisansBekleyen} lisans teslimi bekliyor` : "Tamamlanmayı bekliyor" },
    { id: "fatura", etiket: "Fatura bekleyen", deger: faturaBekleyen, alt: faturaBekleyen ? "Ödendi, faturası kesilmedi" : "Tüm faturalar kesildi", uyari: faturaBekleyen > 0 },
  ];

  return (
    <section aria-label="Sipariş özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kartlar.map((k) => {
        const aktif = k.id === "fatura" ? faturasiz : !faturasiz && sekme === k.id;
        return (
          <button
            key={k.id}
            type="button"
            aria-pressed={aktif}
            onClick={() => (k.id === "fatura" ? onFatura(!faturasiz) : onSekme(aktif ? "tumu" : k.id))}
            className={`flex cursor-pointer flex-col gap-1.5 rounded-card border p-4 text-left transition-colors ${
              aktif ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-line-strong"
            }`}
          >
            <span className={`text-xs font-semibold ${aktif ? "text-[#C3C6BC]" : "text-muted"}`}>{k.etiket}</span>
            <b className={`text-2xl font-extrabold tabular-nums ${aktif ? "text-lime" : ""}`}>{k.deger}</b>
            <span className={`text-xs ${aktif ? "text-[#C3C6BC]" : k.uyari ? "font-bold text-warn" : "text-muted"}`}>{k.alt}</span>
          </button>
        );
      })}
    </section>
  );
}
