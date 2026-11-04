// Kayıtlı cihaz, lisansı aktif, 30 günde biten, serviste
import { sayi } from "@/lib/format";
import type { CihazOzeti } from "./queries";

export default function OzetKartlari({ ozet }: { ozet: CihazOzeti }) {
  const aktifOran = ozet.kayitli ? Math.round((ozet.aktif / ozet.kayitli) * 100) : 0;
  const kartlar = [
    { etiket: "Kayıtlı cihaz", deger: sayi(ozet.kayitli), alt: `${ozet.ulke} ülkede`, renk: "text-muted" },
    { etiket: "Lisansı aktif", deger: sayi(ozet.aktif), alt: `Kayıtlı cihazların %${aktifOran}'i`, renk: "font-bold text-ok" },
    { etiket: "30 gün içinde biten", deger: sayi(ozet.bitiyor), alt: "Yenileme için arayın", renk: "font-bold text-warn" },
    {
      etiket: "Servis / RMA",
      deger: sayi(ozet.serviste),
      alt: `Ort. dönüş ${ozet.ortDonusGun.toLocaleString("tr-TR")} gün`,
      renk: "text-muted",
    },
  ];

  return (
    <section aria-label="Cihaz özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kartlar.map((k) => (
        <div key={k.etiket} className="flex flex-col gap-1.5 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">{k.etiket}</span>
          <b className="text-2xl font-extrabold tabular-nums">{k.deger}</b>
          <span className={`text-xs ${k.renk}`}>{k.alt}</span>
        </div>
      ))}
    </section>
  );
}
