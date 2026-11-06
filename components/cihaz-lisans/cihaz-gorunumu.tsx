"use client";

// Cihaz & Lisans sayfasının etkileşimli kısmı: durum sekmeleri, arama, model filtresi,
// CSV dışa aktarma ve ortada açılan "Lisans tanımla" penceresi.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { csvIndir } from "@/lib/disa-aktar";
import { useBugun } from "@/lib/use-bugun";
import { simdiyiYenile } from "@/lib/use-simdi";
import type { YeniLisans } from "./actions";
import { DURUM_ADI, type Cihaz, type LisansPlani, type CihazOzeti, type SurumKaydi } from "./queries";
import { bayiStogunda, guncelDurum, lisansUygula, tarihYaz } from "./ortak";
import OzetKartlari from "./ozet-kartlari";
import CihazTablosu, { type DurumSekmesi, type ModelSecimi, type PlanSecimi } from "./cihaz-tablosu";
import CihazModelleri, { type BayiSecimi } from "./cihaz-modelleri";
import LisansPlanlari from "./lisans-planlari";
import LisansFormu from "./lisans-formu";
import CihazFormu from "./cihaz-formu";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import type { Musteri } from "@/components/musteriler/queries";
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";

const IKINCIL_BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]";

export default function CihazGorunumu({
  cihazlar: ilk,
  ozet,
  musteriler,
  bayiler,
}: {
  cihazlar: Cihaz[];
  ozet: CihazOzeti;
  musteriler: Musteri[];
  bayiler: { id: string; ad: string }[];
}) {
  const bugun = useBugun();
  const [cihazlar, setCihazlar] = useState(ilk);
  const [sekme, setSekme] = useState<DurumSekmesi>("tumu");
  const [model, setModel] = useState<ModelSecimi>("tumu");
  const [plan, setPlan] = useState<PlanSecimi>("tumu");
  const [bayi, setBayi] = useState<BayiSecimi>("tumu");
  const [arama, setArama] = useState("");
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
        setBildirim(gelen.length === 1 ? `${gelen[0].seriNo} bağlandı` : `${gelen.length} cihaz bağlandı`);
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

  // Bayi stoğundaki cihaza lisans verilmez; önce müşteriye satılmalı
  const lisanslanabilir = useMemo(() => cihazlar.filter((c) => !bayiStogunda(c)), [cihazlar]);
  const musteriSecenekleri = useMemo(() => musteriler.map((m) => ({ id: m.id, ad: m.ad, ulke: m.ulke })), [musteriler]);

  // Satış kanalı (bayi) seçimi: model / plan sayıları ve tablo buna göre süzülür
  const kanaldakiler = useMemo(
    () =>
      bayi === "tumu"
        ? cihazlar
        : cihazlar.filter((c) => (bayi === "bayi" ? !!c.bayiId : bayi === "dogrudan" ? !c.bayiId : c.bayiId === bayi)),
    [cihazlar, bayi],
  );
  const kanalSayilari = useMemo(() => {
    if (bayi === "tumu") return { modeller: ozet.modeller, planlar: ozet.planlar };
    const modeller = Object.fromEntries(CIHAZ_MODELLERI.map((m) => [m, 0])) as Record<CihazModeli, number>;
    const planlar = { Basic: 0, Pro: 0, "Pro+": 0 } as Record<LisansPlani, number>;
    for (const c of kanaldakiler) {
      modeller[c.model]++;
      if (c.durum !== "lisanssiz" && !bayiStogunda(c)) planlar[c.plan]++;
    }
    return { modeller, planlar };
  }, [bayi, kanaldakiler, ozet]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return kanaldakiler.filter((c) => {
      if (sekme !== "tumu" && guncelDurum(c, bugun) !== sekme) return false;
      if (model !== "tumu" && c.model !== model) return false;
      if (plan !== "tumu" && (c.plan !== plan || c.durum === "lisanssiz")) return false;
      if (!q) return true;
      return [c.seriNo, c.model, c.musteri, c.ulke].some((a) => a.toLocaleLowerCase("tr-TR").includes(q));
    })
      // Bayi stoğundaki cihazlar listenin sonunda: müşteri cihazları önde kalsın
      .sort((a, b) => Number(bayiStogunda(a)) - Number(bayiStogunda(b)));
  }, [kanaldakiler, sekme, arama, model, plan, bugun]);

  // Sekme sayıları filo genelidir (özet); liste ise yüklenen kayıtlardır.
  // Bayi seçiliyken sayılar o kanalın kayıtlarından hesaplanır.
  const say = (d: DurumSekmesi) => kanaldakiler.filter((c) => guncelDurum(c, bugun) === d).length;
  const sayilar: Record<DurumSekmesi, number> =
    bayi === "tumu"
      ? { tumu: ozet.kayitli, aktif: ozet.aktif, bitiyor: ozet.bitiyor, stokta: cihazlar.filter(bayiStogunda).length }
      : { tumu: kanaldakiler.length, aktif: say("aktif"), bitiyor: say("bitiyor"), stokta: say("stokta") };

  const disaAktar = () => {
    csvIndir(
      [
        ["Seri no", "Model", "Müşteri", "Ülke", "Plan", "Aktivasyon", "Lisans bitişi", "Durum"],
        ...gorunen.map((c) => [
          c.seriNo,
          c.model,
          c.musteri,
          c.ulke,
          c.plan,
          tarihYaz(c.lisansBaslangic),
          tarihYaz(c.lisansBitis),
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
        <div className="flex min-w-0 flex-[1_1_640px]">
          <CihazTablosu
            cihazlar={gorunen}
            sekme={sekme}
            sayilar={sayilar}
            arama={arama}
            onSekme={setSekme}
            onArama={setArama}
            onMusteriAc={setAcikMusteri}
            yeniBildirenler={yeniBildirenler}
            model={model}
            modelSayilari={kanalSayilari.modeller}
            onModel={setModel}
            plan={plan}
            planSayilari={kanalSayilari.planlar}
            onPlan={setPlan}
          />
        </div>
        <div className="flex w-full min-w-0 flex-col gap-4 lg:w-[272px] lg:flex-none">
          <CihazModelleri modeller={kanalSayilari.modeller} secili={model} onSec={setModel} bayiler={bayiler} bayi={bayi} onBayi={setBayi} />
          <LisansPlanlari planlar={kanalSayilari.planlar} />
        </div>
      </div>

      <Modal acik={lisansAcik} onKapat={kapat} baslik="Lisans tanımla" aciklama="Cihaza yeni lisans verin veya mevcut lisansı yenileyin">
        <LisansFormu cihazlar={lisanslanabilir} onKaydedildi={kaydedildi} onVazgec={kapat} />
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
