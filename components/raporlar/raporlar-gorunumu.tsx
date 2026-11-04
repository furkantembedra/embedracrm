"use client";

// Raporlar sayfasının etkileşimli kısmı: dönem seçimi tüm kartları ve hazır raporları besler
import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { csvIndir, pdfYazdir } from "@/lib/disa-aktar";
import { useBugun } from "@/lib/use-bugun";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import type { Talep } from "@/components/destek/queries";
import type { AktifBayi } from "@/components/bayiler/queries";
import { DONEM_BILGI, type Donem, type RaporOzeti } from "./queries";
import { HAZIR_RAPORLAR, raporAltBasligi, type RaporKaynaklari } from "./hazir-rapor-tanimlari";
import DonemSecici from "./donem-secici";
import OzetKartlari from "./ozet-kartlari";
import YenilemeGrafigi from "./yenileme-grafigi";
import UlkeGelirleri from "./ulke-gelirleri";
import DestekKonulari from "./destek-konulari";
import KaynakDonusumu from "./kaynak-donusumu";
import HazirRaporlar from "./hazir-raporlar";

const IKINCIL_BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]";

export default function RaporlarGorunumu({
  ozet,
  cihazlar,
  talepler,
  bayiler,
}: {
  ozet: RaporOzeti;
  cihazlar: Cihaz[];
  talepler: Talep[];
  bayiler: AktifBayi[];
}) {
  const bugun = useBugun();
  const [donem, setDonem] = useState<Donem>("ceyrek");
  const r = ozet.donemler[donem];
  const etiket = DONEM_BILGI[donem].uzun;
  const kaynaklar: RaporKaynaklari = { ozet, donem, cihazlar, talepler, bayiler, bugun };

  // Üstteki Excel / PDF: seçili dönemin satış özeti
  const satisOzeti = HAZIR_RAPORLAR.find((x) => x.id === "satis-ozeti")!;

  return (
    <>
      <PageHeader title="Raporlar" description={`Satış, lisans, destek ve bayi performansı · ${etiket}`}>
        <DonemSecici secili={donem} onSec={setDonem} />
        <button
          type="button"
          onClick={() => csvIndir(satisOzeti.tablo(kaynaklar), `satis-ozeti-${donem}.csv`)}
          className={IKINCIL_BTN}
        >
          <FileSpreadsheet size={18} aria-hidden="true" />Excel
        </button>
        <button
          type="button"
          onClick={() => pdfYazdir(satisOzeti.baslik, raporAltBasligi(satisOzeti, donem), satisOzeti.tablo(kaynaklar))}
          className={IKINCIL_BTN}
        >
          <FileText size={18} aria-hidden="true" />PDF
        </button>
      </PageHeader>

      <OzetKartlari kpi={r.kpi} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[3_1_560px]">
          <YenilemeGrafigi veri={ozet.yenileme} hedef={ozet.yenilemeHedefi} />
        </div>
        <div className="flex min-w-0 flex-[2_1_340px]">
          <UlkeGelirleri ulkeler={r.ulkeler} donem={etiket} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_420px]">
          <DestekKonulari konular={r.konular} donem={etiket} />
        </div>
        <div className="flex min-w-0 flex-[1_1_420px]">
          <KaynakDonusumu kaynaklar={r.kaynaklar} />
        </div>
      </div>

      <HazirRaporlar kaynaklar={kaynaklar} />
    </>
  );
}
