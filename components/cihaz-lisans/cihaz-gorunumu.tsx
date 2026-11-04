"use client";

// Cihaz & Lisans sayfasının etkileşimli kısmı: durum sekmeleri, arama, eski firmware filtresi,
// CSV dışa aktarma ve ortada açılan "Lisans tanımla" penceresi.
import { useCallback, useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { csvIndir } from "@/lib/disa-aktar";
import { useBugun } from "@/lib/use-bugun";
import type { YeniLisans } from "./actions";
import { DURUM_ADI, type Cihaz, type CihazOzeti, type RmaKaydi } from "./queries";
import { eskiFirmware, guncelDurum, lisansUygula, tarihYaz } from "./ortak";
import OzetKartlari from "./ozet-kartlari";
import CihazTablosu, { type DurumSekmesi } from "./cihaz-tablosu";
import FirmwareDagilimi from "./firmware-dagilimi";
import ServisKuyrugu from "./servis-kuyrugu";
import LisansPlanlari from "./lisans-planlari";
import LisansFormu from "./lisans-formu";
import CihazFormu, { type MusteriSecenegi } from "./cihaz-formu";

const IKINCIL_BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]";

export default function CihazGorunumu({
  cihazlar: ilk,
  ozet,
  rma,
  musteriler,
}: {
  cihazlar: Cihaz[];
  ozet: CihazOzeti;
  rma: RmaKaydi[];
  musteriler: MusteriSecenegi[];
}) {
  const bugun = useBugun();
  const [cihazlar, setCihazlar] = useState(ilk);
  const [sekme, setSekme] = useState<DurumSekmesi>("tumu");
  const [arama, setArama] = useState("");
  const [eskiFiltre, setEskiFiltre] = useState(false);
  const [lisansAcik, setLisansAcik] = useState(false);
  const [cihazAcik, setCihazAcik] = useState(false);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return cihazlar.filter((c) => {
      if (sekme !== "tumu" && guncelDurum(c, bugun) !== sekme) return false;
      if (eskiFiltre && !eskiFirmware(c.firmware)) return false;
      if (!q) return true;
      return [c.seriNo, c.musteri, c.ulke].some((a) => a.toLocaleLowerCase("tr-TR").includes(q));
    });
  }, [cihazlar, sekme, arama, eskiFiltre, bugun]);

  // Sekme sayıları filo genelidir (özet); liste ise yüklenen kayıtlardır.
  const sayilar: Record<DurumSekmesi, number> = {
    tumu: ozet.kayitli,
    aktif: ozet.aktif,
    bitiyor: ozet.bitiyor,
    serviste: ozet.serviste,
  };

  const disaAktar = () => {
    csvIndir(
      [
        ["Seri no", "Müşteri", "Ülke", "Plan", "Aktivasyon", "Lisans bitişi", "Firmware", "Durum"],
        ...gorunen.map((c) => [
          c.seriNo,
          c.musteri,
          c.ulke,
          c.plan,
          tarihYaz(c.lisansBaslangic),
          tarihYaz(c.lisansBitis),
          c.firmware,
          DURUM_ADI[guncelDurum(c, bugun)],
        ]),
      ],
      "cihazlar.csv",
    );
  };

  const kapat = useCallback(() => setLisansAcik(false), []);
  const cihazKapat = useCallback(() => setCihazAcik(false), []);
  const cihazEklendi = useCallback((c: Cihaz) => {
    setCihazlar((l) => [c, ...l]);
    setSekme("tumu");
    setArama("");
    setEskiFiltre(false);
    setCihazAcik(false);
  }, []);
  const kaydedildi = useCallback((l: YeniLisans) => {
    setCihazlar((liste) => liste.map((c) => lisansUygula(c, l)));
    setLisansAcik(false);
  }, []);

  return (
    <>
      <PageHeader title="Cihaz & lisans" description="Her EmbedraONE cihazı, sahibi ve bağlı lisansı">
        <button type="button" onClick={disaAktar} className={IKINCIL_BTN}>
          <Download size={18} aria-hidden="true" />
          Dışa aktar
        </button>
        <button type="button" onClick={() => setCihazAcik(true)} className={IKINCIL_BTN}>Cihaz ekle</button>
        <button
          type="button"
          onClick={() => setLisansAcik(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Lisans tanımla
        </button>
      </PageHeader>

      <OzetKartlari ozet={ozet} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_640px]">
          <CihazTablosu
            cihazlar={gorunen}
            sekme={sekme}
            sayilar={sayilar}
            arama={arama}
            eskiFiltre={eskiFiltre}
            onSekme={setSekme}
            onArama={setArama}
            onEskiFiltre={setEskiFiltre}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <FirmwareDagilimi
            firmware={ozet.firmware}
            onEskileriListele={() => {
              setEskiFiltre(true);
              setSekme("tumu");
            }}
          />
          <ServisKuyrugu kayitlar={rma} acik={ozet.serviste} />
          <LisansPlanlari planlar={ozet.planlar} />
        </div>
      </div>

      <Modal acik={lisansAcik} onKapat={kapat} baslik="Lisans tanımla" aciklama="Cihaza yeni lisans verin veya mevcut lisansı yenileyin">
        <LisansFormu cihazlar={cihazlar} onKaydedildi={kaydedildi} onVazgec={kapat} />
      </Modal>

      <Modal acik={cihazAcik} onKapat={cihazKapat} baslik="Yeni cihaz" aciklama="EmbedraONE cihazını müşterisine kaydedin">
        <CihazFormu musteriler={musteriler} mevcutSeriler={cihazlar.map((c) => c.seriNo)} onKaydedildi={cihazEklendi} onVazgec={cihazKapat} />
      </Modal>
    </>
  );
}
