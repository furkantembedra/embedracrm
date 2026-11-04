"use client";

// Bayi & Distribütör sayfasının etkileşimli kısmı: aşama filtresi, seçili başvuru,
// kontrol listesi / puan / aşama güncellemeleri, "Bayi ekle" ve "Görüşme planla" pencereleri.
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Megaphone, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { asamaIlerlet, kontrolDegistir, puanKaydet } from "./actions";
import { ASAMALAR, ASAMA_BILGI, type AktifBayi, type Basvuru, type BayiAsamasi } from "./queries";
import OnboardingAsamalari from "./onboarding-asamalari";
import BasvuruTablosu from "./basvuru-tablosu";
import BasvuruDetay, { type DetayBildirimi } from "./basvuru-detay";
import BayiPerformansi from "./bayi-performansi";
import BolgeKapsamasi from "./bolge-kapsamasi";
import BasvuruFormu from "./basvuru-formu";
import GorusmeFormu from "./gorusme-formu";

export default function BayiGorunumu({
  basvurular: ilk,
  bayiler: ilkBayiler,
  seciliIlk,
}: {
  basvurular: Basvuru[];
  bayiler: AktifBayi[];
  seciliIlk?: string; // /bayiler/[id] adresinden gelindiyse
}) {
  const [basvurular, setBasvurular] = useState(ilk);
  const [bayiler, setBayiler] = useState(ilkBayiler);
  const [asama, setAsama] = useState<BayiAsamasi | null>(null);
  const [seciliId, setSeciliId] = useState<string | null>(
    (ilk.find((b) => b.id === seciliIlk) ?? ilk.find((b) => b.asama !== "lansman") ?? ilk[0])?.id ?? null,
  );
  const [bildirim, setBildirim] = useState<DetayBildirimi | null>(null);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [gorusmeAcik, setGorusmeAcik] = useState(false);
  const [bekliyor, baslat] = useTransition();

  const sayilar = useMemo(() => {
    const s = Object.fromEntries(ASAMALAR.map((a) => [a, 0])) as Record<BayiAsamasi, number>;
    for (const b of basvurular) s[b.asama]++;
    return s;
  }, [basvurular]);

  // Aşaması az önce değişen seçili başvuru, filtre dışına çıksa da listede kalsın
  const gorunen = basvurular.filter((b) => !asama || b.asama === asama || b.id === seciliId);
  const secili = basvurular.find((b) => b.id === seciliId) ?? null;

  const guncelle = (id: string, f: (b: Basvuru) => Basvuru) => setBasvurular((l) => l.map((b) => (b.id === id ? f(b) : b)));

  const sec = (id: string) => {
    setSeciliId(id);
    setBildirim(null);
  };

  const asamaSec = (a: BayiAsamasi | null) => {
    setAsama(a);
    setBildirim(null);
    if (a && secili?.asama !== a) setSeciliId(basvurular.find((b) => b.asama === a)?.id ?? null);
  };

  const kontrol = (sira: number, deger: boolean) => {
    if (!secili) return;
    const id = secili.id;
    guncelle(id, (b) => ({ ...b, kontroller: b.kontroller.map((k, i) => (i === sira ? deger : k)) }));
    setBildirim(null);
    baslat(() => kontrolDegistir(id, sira, deger));
  };

  const puan = (p: number) => {
    if (!secili) return;
    const id = secili.id;
    baslat(async () => {
      const sonuc = await puanKaydet(id, p);
      if (sonuc.hata) setBildirim({ tur: "hata", metin: sonuc.hata });
      else {
        guncelle(id, (b) => ({ ...b, puan: p }));
        setBildirim({ tur: "basari", metin: "Uygunluk puanı kaydedildi." });
      }
    });
  };

  const ilerlet = () => {
    if (!secili) return;
    const id = secili.id;
    baslat(async () => {
      const sonuc = await asamaIlerlet(id);
      if (sonuc.hata || !sonuc.basvuru) {
        setBildirim({ tur: "hata", metin: sonuc.hata ?? "Aşama değiştirilemedi." });
        return;
      }
      const yeni = sonuc.basvuru;
      guncelle(id, () => yeni);
      if (yeni.asama === "lansman") {
        setBayiler((l) =>
          l.some((x) => x.id === yeni.id)
            ? l
            : [{ id: yeni.id, ad: yeni.sirket, bolge: yeni.bolge, ulkeKodu: yeni.ulkeKodu, satilan: 0, stok: yeni.ilkSiparis, moqHedef: Math.max(yeni.ilkSiparis, 1) * 2, moqGerceklesen: 0 }, ...l],
        );
      }
      const m = sonuc.musteri;
      setBildirim({
        tur: "basari",
        metin: m
          ? `Lansman tamam. ${m.ad} aktif bayilere ${m.yeni ? "ve müşterilere eklendi." : "eklendi, müşteri kaydı bayi olarak güncellendi."}`
          : `${ASAMA_BILGI[yeni.asama].ad} aşamasına alındı.`,
        link: m ? { href: `/musteriler/${m.id}`, ad: "Müşteriyi aç →" } : undefined,
      });
    });
  };

  const ekleKapat = useCallback(() => setEkleAcik(false), []);
  const eklendi = useCallback((b: Basvuru) => {
    setBasvurular((l) => [b, ...l]);
    setAsama(null);
    setSeciliId(b.id);
    setBildirim({ tur: "basari", metin: "Başvuru kaydedildi." });
    setEkleAcik(false);
  }, []);

  const gorusmeKapat = useCallback(() => setGorusmeAcik(false), []);
  const gorusmeKaydedildi = useCallback((id: string, gorusme: NonNullable<Basvuru["gorusme"]>) => {
    setBasvurular((l) => l.map((b) => (b.id === id ? { ...b, gorusme } : b)));
    setBildirim({ tur: "basari", metin: "Görüşme kaydedildi." });
    setGorusmeAcik(false);
  }, []);

  return (
    <>
      <PageHeader title="Bayi & distribütör ağı" description="Başvurudan lansmana: bölge hakları, MOQ ve performans tek yerde">
        <Link
          href="/pazarlama"
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]"
        >
          <Megaphone size={18} aria-hidden="true" />
          Pazarlama kiti
        </Link>
        <button
          type="button"
          onClick={() => setEkleAcik(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Bayi ekle
        </button>
      </PageHeader>

      <OnboardingAsamalari secili={asama} sayilar={sayilar} onSec={asamaSec} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_600px]">
          <BasvuruTablosu basvurular={gorunen} asama={asama} seciliId={seciliId} onSec={sec} />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px]">
          <BasvuruDetay
            key={seciliId ?? "yok"}
            basvuru={secili}
            bekliyor={bekliyor}
            bildirim={bildirim}
            onKontrol={kontrol}
            onPuan={puan}
            onIlerlet={ilerlet}
            onGorusme={() => setGorusmeAcik(true)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_560px]">
          <BayiPerformansi bayiler={bayiler} />
        </div>
        <div className="flex min-w-0 flex-[1_1_300px]">
          <BolgeKapsamasi basvurular={basvurular} bayiler={bayiler} />
        </div>
      </div>

      <Modal acik={ekleAcik} onKapat={ekleKapat} baslik="Yeni bayi başvurusu" aciklama="Şirket ve yetkili bilgilerini girin">
        <BasvuruFormu onKaydedildi={eklendi} onVazgec={ekleKapat} />
      </Modal>

      <Modal
        acik={gorusmeAcik && !!secili}
        onKapat={gorusmeKapat}
        baslik="Görüşme planla"
        aciklama={secili ? `${secili.sirket} · ${secili.yetkili}` : undefined}
      >
        {secili && <GorusmeFormu key={secili.id} basvuru={secili} onKaydedildi={gorusmeKaydedildi} onVazgec={gorusmeKapat} />}
      </Modal>
    </>
  );
}
