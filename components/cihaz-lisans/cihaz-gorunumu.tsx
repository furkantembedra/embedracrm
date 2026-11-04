"use client";

// Cihaz & Lisans sayfasının etkileşimli kısmı: durum sekmeleri, arama, eski firmware filtresi,
// CSV dışa aktarma ve ortada açılan "Lisans tanımla" penceresi.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { csvIndir } from "@/lib/disa-aktar";
import { useBugun } from "@/lib/use-bugun";
import { simdiyiYenile } from "@/lib/use-simdi";
import type { YeniLisans } from "./actions";
import { DURUM_ADI, type Cihaz, type CihazOzeti, type RmaKaydi, type SurumKaydi } from "./queries";
import { eskiFirmware, guncelDurum, lisansUygula, tarihYaz } from "./ortak";
import OzetKartlari from "./ozet-kartlari";
import CihazTablosu, { type DurumSekmesi } from "./cihaz-tablosu";
import FirmwareDagilimi from "./firmware-dagilimi";
import ServisKuyrugu from "./servis-kuyrugu";
import LisansPlanlari from "./lisans-planlari";
import LisansFormu from "./lisans-formu";
import CihazFormu from "./cihaz-formu";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import type { Musteri } from "@/components/musteriler/queries";

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
  musteriler: Musteri[];
}) {
  const bugun = useBugun();
  const [cihazlar, setCihazlar] = useState(ilk);
  const [sekme, setSekme] = useState<DurumSekmesi>("tumu");
  const [arama, setArama] = useState("");
  const [eskiFiltre, setEskiFiltre] = useState(false);
  const [lisansAcik, setLisansAcik] = useState(false);
  const [cihazAcik, setCihazAcik] = useState(false);
  const [acikMusteri, setAcikMusteri] = useState<string | null>(null);
  const musteriKapat = useCallback(() => setAcikMusteri(null), []);
  const musteriKaydi = musteriler.find((m) => m.id === acikMusteri) ?? null;
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [yeniBildirenler, setYeniBildirenler] = useState<Set<string>>(() => new Set());
  const sonKontrol = useRef<string | null>(null);

  // Canlı güncelleme: ONESuite bir cihazdan sürüm bildirince bu sayfa 5 sn içinde görür.
  // Sekme arka plandayken sorgu yapılmaz. Supabase'e geçince bunun yerine Realtime aboneliği kullanılabilir.
  useEffect(() => {
    sonKontrol.current ??= new Date().toISOString();
    let iptal = false;
    const kontrol = async () => {
      if (document.hidden || !sonKontrol.current) return;
      const baslangic = new Date().toISOString();
      try {
        const yanit = await fetch(`/api/cihaz-bildirimi?sonra=${encodeURIComponent(sonKontrol.current)}`, { cache: "no-store" });
        if (!yanit.ok || iptal) return;
        const { cihazlar: gelen } = (await yanit.json()) as {
          cihazlar: { seriNo: string; firmware: string; sonGorulme: string; surumGecmisi: SurumKaydi[] }[];
        };
        sonKontrol.current = baslangic;
        if (!gelen.length) return;
        simdiyiYenile();
        setCihazlar((liste) =>
          liste.map((c) => {
            const y = gelen.find((x) => x.seriNo === c.seriNo);
            return y ? { ...c, firmware: y.firmware, sonGorulme: y.sonGorulme, surumGecmisi: y.surumGecmisi } : c;
          }),
        );
        setYeniBildirenler(new Set(gelen.map((x) => x.seriNo)));
        setTimeout(() => !iptal && setYeniBildirenler(new Set()), 4000);
        const tek = gelen[0];
        const sonDegisim = tek.surumGecmisi[0];
        const guncellendi = sonDegisim?.zaman === tek.sonGorulme;
        setBildirim(
          gelen.length === 1
            ? `${tek.seriNo} bağlandı · ${tek.firmware}${guncellendi ? ` (${sonDegisim.eski} sürümünden güncellendi)` : ""}`
            : `${gelen.length} cihaz bağlandı ve sürümünü bildirdi`,
        );
      } catch {
        // ağ hatası: bir sonraki turda tekrar denenir
      }
    };
    const zamanlayici = setInterval(kontrol, 5000);
    return () => {
      iptal = true;
      clearInterval(zamanlayici);
    };
  }, []);

  useEffect(() => {
    if (!bildirim) return;
    const t = setTimeout(() => setBildirim(null), 6000);
    return () => clearTimeout(t);
  }, [bildirim]);

  const musteriSecenekleri = useMemo(() => musteriler.map((m) => ({ id: m.id, ad: m.ad, ulke: m.ulke })), [musteriler]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return cihazlar.filter((c) => {
      if (sekme !== "tumu" && guncelDurum(c, bugun) !== sekme) return false;
      if (eskiFiltre && !eskiFirmware(c.firmware)) return false;
      if (!q) return true;
      return [c.seriNo, c.model, c.musteri, c.ulke].some((a) => a.toLocaleLowerCase("tr-TR").includes(q));
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
        ["Seri no", "Model", "Müşteri", "Ülke", "Plan", "Aktivasyon", "Lisans bitişi", "Firmware", "Durum"],
        ...gorunen.map((c) => [
          c.seriNo,
          c.model,
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

      {bildirim && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-card border border-lime bg-card px-4 py-3 text-[13px] font-semibold shadow-[0_16px_40px_rgba(14,15,12,0.18)]">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-ok" />
          {bildirim}
        </div>
      )}

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
            onMusteriAc={setAcikMusteri}
            yeniBildirenler={yeniBildirenler}
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

      <Modal
        acik={musteriKaydi !== null}
        onKapat={musteriKapat}
        baslik="Müşteri"
        aciklama={musteriKaydi ? `${musteriKaydi.sehir}, ${musteriKaydi.ulke}` : undefined}
      >
        {musteriKaydi && <MusteriDetay musteri={musteriKaydi} yalin />}
      </Modal>

      <Modal acik={cihazAcik} onKapat={cihazKapat} baslik="Yeni cihaz" aciklama="EmbedraONE cihazını müşterisine kaydedin">
        <CihazFormu musteriler={musteriSecenekleri} mevcutSeriler={cihazlar.map((c) => c.seriNo)} onKaydedildi={cihazEklendi} onVazgec={cihazKapat} />
      </Modal>
    </>
  );
}
