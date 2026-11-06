"use client";

// Bayi & Distribütör sayfasının etkileşimli kısmı: aşama filtresi, seçili başvuru,
// kontrol listesi / puan / aşama güncellemeleri, "Bayi ekle" ve "Görüşme planla" pencereleri.
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Megaphone, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { asamaIlerlet, basvuruSil, kontrolDegistir, puanKaydet, sozlesmeKaydet } from "./actions";
import { ASAMALAR, ASAMA_BILGI, ULKELER, type AktifBayi, type BayiHareketi, type Basvuru, type BayiAsamasi, type SozlesmeDetayi } from "./queries";
import OnboardingAsamalari from "./onboarding-asamalari";
import BasvuruTablosu from "./basvuru-tablosu";
import BasvuruDetay, { type DetayBildirimi } from "./basvuru-detay";
import BayiPerformansi from "./bayi-performansi";
import BolgeKapsamasi from "./bolge-kapsamasi";
import BasvuruFormu from "./basvuru-formu";
import GorusmeFormu from "./gorusme-formu";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import type { Musteri } from "@/components/musteriler/queries";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import BayiDetay from "./bayi-detay";

const adresAbone = () => () => {};

export default function BayiGorunumu({
  basvurular: ilk,
  bayiler: ilkBayiler,
  musteriler,
  hareketler = [],
  bayiCihazlari = [],
  seciliIlk,
}: {
  basvurular: Basvuru[];
  bayiler: AktifBayi[];
  musteriler: Musteri[]; // lansman sonrası "Müşteriyi aç" penceresi için
  hareketler?: BayiHareketi[]; // bayiye sevkiyat / satış / lisans (sunucu kaydedince sayfa yenilenir)
  bayiCihazlari?: Cihaz[]; // bayi üzerinden satılan / bayi stoğundaki cihazlar
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
  const [acikMusteri, setAcikMusteri] = useState<string | null>(null);
  const musteriKaydi = musteriler.find((m) => m.id === acikMusteri) ?? null;
  const musteriKapat = useCallback(() => setAcikMusteri(null), []);
  const [bekliyor, baslat] = useTransition();
  // /bayiler?bayi=ID ile gelinirse (ör. Cihaz & Lisans'taki "Bayi stoğu" satırından) o bayinin detayı açık başlar.
  // Adres yalnızca tarayıcıda okunur; kullanıcı pencereyi kapatınca bir daha açılmaz.
  const adrestekiBayi = useSyncExternalStore(
    adresAbone,
    () => new URLSearchParams(window.location.search).get("bayi"),
    () => null,
  );
  const [acikBayiSecim, setAcikBayi] = useState<string | null | undefined>(undefined);
  const acikBayi = acikBayiSecim === undefined ? adrestekiBayi : acikBayiSecim;
  const bayiKaydi = bayiler.find((b) => b.id === acikBayi) ?? null;
  const bayiKapat = useCallback(() => {
    setAcikBayi(null);
    if (window.location.search.includes("bayi=")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const musteriSecenekleri = useMemo(() => musteriler.map((m) => ({ id: m.id, ad: m.ad })).sort((a, b) => a.ad.localeCompare(b.ad, "tr")), [musteriler]);
  // Stok / satılan / MOQ hareketlerden hesaplanır; sunucu kaydedince sayfa verisi (hareketler) kendiliğinden yenilenir
  const hareketKaydedildi = useCallback(() => {}, []);
  const [acikMadde, setAcikMadde] = useState<number | null>(null);
  const [silinecekId, setSilinecekId] = useState<string | null>(null);
  const [silHata, setSilHata] = useState<string | null>(null);
  const silinecek = basvurular.find((b) => b.id === silinecekId) ?? null;
  const silKapat = useCallback(() => {
    setSilinecekId(null);
    setSilHata(null);
  }, []);
  const silOnayla = () => {
    if (!silinecek) return;
    const id = silinecek.id;
    baslat(async () => {
      const sonuc = await basvuruSil(id);
      if (sonuc.hata) return setSilHata(sonuc.hata);
      const kalan = basvurular.filter((b) => b.id !== id);
      setBasvurular(kalan);
      if (seciliId === id) setSeciliId(kalan.find((b) => !asama || b.asama === asama)?.id ?? null);
      setBildirim({ tur: "basari", metin: "Başvuru silindi." });
      silKapat();
    });
  };

  const sayilar = useMemo(() => {
    const s = Object.fromEntries(ASAMALAR.map((a) => [a, 0])) as Record<BayiAsamasi, number>;
    for (const b of basvurular) s[b.asama]++;
    return s;
  }, [basvurular]);

  const [arama, setArama] = useState("");
  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const gorunen = basvurular.filter(
    (b) => (!asama || b.asama === asama) && (!q || [b.sirket, b.yetkili, b.bolge, b.ulkeKodu, ULKELER[b.ulkeKodu] ?? ""].some((a) => a.toLocaleLowerCase("tr-TR").includes(q))),
  );
  // Başvuru ilerletilince filtre onun yeni aşamasına geçer; önceki sekmeye tek tıkla dönülebilsin
  const [donus, setDonus] = useState<{ asama: BayiAsamasi; metin: string; etiket: string } | null>(null);
  const secili = basvurular.find((b) => b.id === seciliId) ?? null;

  const guncelle = (id: string, f: (b: Basvuru) => Basvuru) => setBasvurular((l) => l.map((b) => (b.id === id ? f(b) : b)));

  const sec = (id: string) => {
    setSeciliId(id);
    setAcikMadde(null);
    setBildirim(null);
  };

  const asamaSec = (a: BayiAsamasi | null) => {
    setAsama(a);
    setDonus(null);
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

  const sozlesme = (sira: number, d: SozlesmeDetayi) => {
    if (!secili) return;
    const id = secili.id;
    guncelle(id, (b) => ({ ...b, sozlesme: d }));
    baslat(async () => {
      const sonuc = await sozlesmeKaydet(id, sira, d);
      if (sonuc.hata || !sonuc.sozlesme || !sonuc.kontroller) {
        setBildirim({ tur: "hata", metin: sonuc.hata ?? "Kaydedilemedi." });
        return;
      }
      const { sozlesme: s, kontroller: k } = sonuc;
      guncelle(id, (b) => ({ ...b, sozlesme: s, kontroller: k, bolge: sira === 0 && s.bolge.kapsam ? s.bolge.kapsam : b.bolge }));
      setBildirim(null);
    });
  };

  // Seçili başvurunun ülkesinde başka aktif bayi / açık başvuru var mı?
  const cakisanlar = secili
    ? [
        ...bayiler.filter((x) => x.ulkeKodu === secili.ulkeKodu && x.id !== secili.id).map((x) => x.ad),
        ...basvurular.filter((x) => x.ulkeKodu === secili.ulkeKodu && x.id !== secili.id && x.asama !== "lansman").map((x) => x.sirket),
      ]
    : [];

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

  const ilerlet = (kaydedilmemisPuan?: number) => {
    if (!secili) return;
    const id = secili.id;
    baslat(async () => {
      // Puan yazılıp Kaydet'e basılmadan geçilmek istendiyse önce puanı kaydet
      if (kaydedilmemisPuan !== undefined) {
        const p = await puanKaydet(id, kaydedilmemisPuan);
        if (p.hata) {
          setBildirim({ tur: "hata", metin: p.hata });
          return;
        }
        guncelle(id, (b) => ({ ...b, puan: kaydedilmemisPuan }));
      }
      const sonuc = await asamaIlerlet(id);
      if (sonuc.hata || !sonuc.basvuru) {
        setBildirim({ tur: "hata", metin: sonuc.hata ?? "Aşama değiştirilemedi." });
        if (sonuc.eksikMadde !== undefined && sonuc.eksikMadde >= 0) setAcikMadde(sonuc.eksikMadde); // eksik maddeyi aç
        return;
      }
      const yeni = sonuc.basvuru;
      guncelle(id, () => yeni);
      // Kaydı takip et: bir aşama filtrelenmişse yeni aşamaya geç ve eski sekmeye dönüş sun.
      // Tümü açıksa liste olduğu gibi kalır; yeni aşamaya gitme bağlantısı gösterilir.
      const metin = `${yeni.sirket} ${ASAMA_BILGI[yeni.asama].ad} aşamasına alındı.`;
      if (asama && asama !== yeni.asama) {
        setDonus({ asama, metin, etiket: `${ASAMA_BILGI[asama].ad} aşamasına dön` });
        setAsama(yeni.asama);
      } else if (!asama) {
        setDonus({ asama: yeni.asama, metin, etiket: `${ASAMA_BILGI[yeni.asama].ad} aşamasına git` });
      }
      if (yeni.asama === "lansman") {
        setBayiler((l) =>
          l.some((x) => x.id === yeni.id)
            ? l
            : [{ id: yeni.id, ad: yeni.sirket, bolge: yeni.bolge, ulkeKodu: yeni.ulkeKodu, satilan: 0, stok: (yeni.sozlesme.moq.one ?? 0) + (yeni.sozlesme.moq.lite ?? 0) || yeni.ilkSiparis, moqHedef: yeni.sozlesme.moq.yillik ? Math.ceil(yeni.sozlesme.moq.yillik / 4) : Math.max(yeni.ilkSiparis, 1) * 2, moqGerceklesen: 0 }, ...l],
        );
      }
      const m = sonuc.musteri;
      setBildirim({
        tur: "basari",
        metin: m
          ? `Lansman tamam. ${m.ad} aktif bayilere ${m.yeni ? "ve müşterilere eklendi." : "eklendi, müşteri kaydı bayi olarak güncellendi."}`
          : `${ASAMA_BILGI[yeni.asama].ad} aşamasına alındı.`,
        link: m ? { href: `/musteriler/${m.id}`, ad: "Müşteriyi aç →", onAc: () => setAcikMusteri(m.id) } : undefined,
      });
    });
  };

  const ekleKapat = useCallback(() => setEkleAcik(false), []);
  const eklendi = useCallback((b: Basvuru) => {
    setBasvurular((l) => [b, ...l]);
    setAsama("basvuru"); // yeni başvuru, Başvuru aşamasında açık kalsın
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
        <button
          type="button"
          onClick={() => setEkleAcik(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Bayi başvurusu ekle
        </button>
      </PageHeader>

      <OnboardingAsamalari secili={asama} sayilar={sayilar} onSec={asamaSec} />

      {donus && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-control border border-lime bg-lime-bg px-4 py-2.5 text-[13px] font-semibold">
          {donus.metin}
          <button type="button" onClick={() => asamaSec(donus.asama)} className="cursor-pointer font-bold underline">
            {donus.etiket}
          </button>
          <button type="button" onClick={() => setDonus(null)} aria-label="Bildirimi kapat" className="ml-auto cursor-pointer px-1 text-muted hover:text-ink">✕</button>
        </p>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_600px]">
          <BasvuruTablosu basvurular={gorunen} asama={asama} seciliId={seciliId} onSec={sec} onSil={setSilinecekId} arama={arama} onArama={setArama} />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px]">
          <BasvuruDetay
            key={seciliId ?? "yok"}
            basvuru={secili}
            bekliyor={bekliyor}
            bildirim={bildirim}
            onKontrol={kontrol}
            onSozlesme={sozlesme}
            acikMadde={acikMadde}
            onMaddeAc={setAcikMadde}
            cakisanlar={cakisanlar}
            onPuan={puan}
            onIlerlet={ilerlet}
            onGorusme={() => setGorusmeAcik(true)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_560px]">
          <BayiPerformansi bayiler={bayiler} hareketler={hareketler} onAc={setAcikBayi} />
        </div>
        <div className="flex min-w-0 flex-[1_1_300px]">
          <BolgeKapsamasi basvurular={basvurular} bayiler={bayiler} />
        </div>
      </div>

      <Modal acik={silinecek !== null} onKapat={silKapat} baslik="Başvuru silinsin mi?" aciklama={silinecek ? `${silinecek.sirket} · ${ASAMA_BILGI[silinecek.asama].ad}` : undefined}>
        <div className="flex flex-col gap-4 pb-5">
          <p className="text-sm text-[#474A42]">
            Başvuru, kontrol listesi, puan ve görüşme bilgileriyle birlikte kalıcı olarak silinir. Bu işlem geri alınamaz.
            {silinecek?.asama === "lansman" && " Lansmanı yapılmış bayinin aktif bayi ve müşteri kaydı silinmez."}
          </p>
          {silHata && <p role="alert" className="text-xs font-semibold text-err">{silHata}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={silKapat} className="min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0]">
              Vazgeç
            </button>
            <button type="button" onClick={silOnayla} disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-err px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
              {bekliyor ? "Siliniyor…" : "Başvuruyu sil"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal acik={bayiKaydi !== null} onKapat={bayiKapat} baslik={bayiKaydi?.ad ?? "Bayi"} aciklama="Satış, stok, asgari alım ve lisanslar">
        {bayiKaydi && (
          <BayiDetay
            key={bayiKaydi.id}
            bayi={bayiKaydi}
            basvuru={basvurular.find((b) => b.id === bayiKaydi.id) ?? null}
            hareketler={hareketler}
            cihazlar={bayiCihazlari.filter((c) => c.bayiId === bayiKaydi.id)}
            musteriler={musteriSecenekleri}
            onKaydedildi={hareketKaydedildi}
          />
        )}
      </Modal>

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

      <Modal
        acik={acikMusteri !== null}
        onKapat={musteriKapat}
        baslik="Müşteri"
        aciklama={musteriKaydi ? `${musteriKaydi.sehir}, ${musteriKaydi.ulke}` : undefined}
      >
        {musteriKaydi ? (
          <MusteriDetay musteri={musteriKaydi} yalin />
        ) : (
          <p className="pb-5 text-sm text-muted">Müşteri kaydı yükleniyor…</p>
        )}
      </Modal>
    </>
  );
}
