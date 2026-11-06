"use client";

// Sipariş & Sevkiyat sayfasının etkileşimli kısmı: durum sekmeleri, arama, seçili sipariş,
// adım işlemleri (pencerelerde), depo stoku ve iade / değişim kayıtları.
import { useCallback, useMemo, useState, useTransition } from "react";
import { Download, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { csvIndir } from "@/lib/disa-aktar";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import type { Musteri } from "@/components/musteriler/queries";
import type { CihazModeli, FiyatListesi } from "@/lib/urunler";
import { iadeIlerlet, odemeAlindi, siparisNotu, siparisiTamamla, type IadeSonucu, type IslemSonucu } from "./actions";
import type { Iade, Siparis, StokKalemi } from "./queries";
import { DURUM_ADI, SEKMELER, faturaBekliyor, icerikOzeti, sekmede, type Eylem, type Sekme } from "./ortak";
import OzetKartlari from "./ozet-kartlari";
import SiparisTablosu from "./siparis-tablosu";
import SiparisDetay from "./siparis-detay";
import DepoStoku from "./depo-stoku";
import IadeListesi from "./iade-listesi";
import SiparisFormu, { type FormMusterisi } from "./siparis-formu";
import { FaturaFormu, IadeFormu, KargoFormu, LisansFormu, SeriAtaFormu, StokFormu, TeslimFormu } from "./islem-formlari";

const IKINCIL_BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]";

type Pencere = null | "yeni" | "stok" | "iade" | "fatura" | Exclude<Eylem, "odeme" | "tamamla">;
const PENCERE_BASLIGI: Record<Exclude<Pencere, null>, string> = {
  yeni: "Manuel sipariş",
  stok: "Stok girişi / yeni ürün",
  iade: "İade / değişim kaydı",
  fatura: "Fatura bilgisi",
  seri: "Seri no ata",
  kargo: "Kargoya ver",
  teslim: "Teslim edildi",
  lisans: "Lisansı teslim et",
};

export default function SiparisGorunumu({
  siparisler: ilk,
  stok: ilkStok,
  iadeler: ilkIadeler,
  musteriler,
  seciliIlk,
  havuz: ilkHavuz = [],
  kargoFirmalari = [],
  fiyatListesi,
}: {
  siparisler: Siparis[];
  stok: StokKalemi[];
  iadeler: Iade[];
  musteriler: Musteri[];
  seciliIlk?: string; // /siparisler/[id] adresinden gelindiyse
  havuz?: { seriNo: string; model: CihazModeli }[]; // üretimden gelen, atanmamış seri no'lar (Operasyon)
  kargoFirmalari?: string[];
  fiyatListesi?: FiyatListesi;
}) {
  const [havuz, setHavuz] = useState(ilkHavuz);
  const [siparisler, setSiparisler] = useState(ilk);
  const [stok, setStok] = useState(ilkStok);
  const [iadeler, setIadeler] = useState(ilkIadeler);
  const [sekme, setSekmeHam] = useState<Sekme>("tumu");
  const [faturasiz, setFaturasiz] = useState(false); // "Fatura bekleyen" kartı: durum sekmelerinden bağımsız filtre
  const setSekme = useCallback((x: Sekme) => {
    setSekmeHam(x);
    setFaturasiz(false);
  }, []);
  const faturaFiltresi = (acik: boolean) => {
    setSekmeHam("tumu");
    setFaturasiz(acik);
  };
  const [arama, setArama] = useState("");
  const [seciliId, setSeciliId] = useState<string | null>(seciliIlk ?? ilk.find((s) => s.durum !== "tamamlandi")?.id ?? ilk[0]?.id ?? null);
  const [pencere, setPencere] = useState<Pencere>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const [acikMusteri, setAcikMusteri] = useState<string | null>(null);
  const musteriKaydi = musteriler.find((m) => m.id === acikMusteri) ?? null;
  const musteriKapat = useCallback(() => setAcikMusteri(null), []);
  const kapat = useCallback(() => setPencere(null), []);

  const secili = siparisler.find((s) => s.id === seciliId) ?? null;
  const formMusterileri: FormMusterisi[] = useMemo(
    () => musteriler.map((m) => ({ id: m.id, ad: m.ad, sehir: m.sehir, ulke: m.ulke, cihazlar: m.cihazlar.map((c) => ({ seriNo: c.seriNo, model: c.model })) })),
    [musteriler],
  );

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return siparisler.filter(
      (s) =>
        (faturasiz ? faturaBekliyor(s) : sekmede(s, sekme)) &&
        (!q || [s.id, s.musteri, s.ulke, s.kargo?.takipNo ?? "", s.faturaNo ?? "", ...s.seriNolar].some((a) => a.toLocaleLowerCase("tr-TR").includes(q))),
    );
  }, [siparisler, sekme, faturasiz, arama]);
  const sayilar = Object.fromEntries(SEKMELER.map((t) => [t.id, siparisler.filter((s) => sekmede(s, t.id)).length])) as Record<Sekme, number>;

  const sec = (id: string) => {
    setSeciliId(id);
    setHata(null);
  };

  /** Sunucudan dönen güncel sipariş / stokla yerel listeyi yeniler; sipariş başka sekmeye düştüyse "Tümü"ne geçer */
  const uygula = useCallback(
    (s: IslemSonucu) => {
      if (s.hata) {
        setHata(s.hata);
        return;
      }
      setHata(null);
      if (s.stok) setStok(s.stok);
      if (s.siparis) {
        const yeni = s.siparis;
        setHavuz((h) => h.filter((x) => !yeni.seriNolar.includes(x.seriNo))); // atanan seri no'lar havuzdan çıkar
        setSiparisler((l) => l.map((x) => (x.id === yeni.id ? yeni : x)));
        if (faturasiz ? !faturaBekliyor(yeni) : !sekmede(yeni, sekme)) setSekme("tumu");
      }
      setPencere(null);
    },
    [sekme, faturasiz, setSekme],
  );

  const eylem = (e: Eylem) => {
    if (!secili) return;
    if (e === "odeme") baslat(async () => uygula(await odemeAlindi(secili.id)));
    else if (e === "tamamla") baslat(async () => uygula(await siparisiTamamla(secili.id)));
    else setPencere(e);
  };

  const notEkle = async (metin: string) => {
    if (!secili) return false;
    const s = await siparisNotu(secili.id, metin);
    uygula(s);
    return !s.hata;
  };

  const eklendi = useCallback((s: Siparis) => {
    setSiparisler((l) => [s, ...l]);
    setSekme("tumu");
    setArama("");
    setSeciliId(s.id);
    setPencere(null);
  }, [setSekme]);

  const iadeEklendi = useCallback((s: IadeSonucu) => {
    if (s.iade) setIadeler((l) => [s.iade!, ...l]);
    setPencere(null);
  }, []);

  const ilerlet = (id: string) =>
    baslat(async () => {
      const s = await iadeIlerlet(id);
      if (s.iade) setIadeler((l) => l.map((x) => (x.id === id ? s.iade! : x)));
    });

  const siparisAc = (id: string) => {
    setSekme("tumu");
    setArama("");
    sec(id);
    document.getElementById("siparis-listesi")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const disaAktar = () =>
    csvIndir(
      [
        ["Sipariş", "Tarih", "Müşteri", "Ülke", "İçerik", "Tutar", "Para birimi", "Ödeme", "Durum", "Kargo", "Takip no", "Fatura", "Seri no"],
        ...gorunen.map((s) => [
          s.id, s.tarih.replace("T", " "), s.musteri, s.ulke, icerikOzeti(s, stok), s.tutar, s.paraBirimi, s.odeme, DURUM_ADI[s.durum],
          s.kargo?.firma ?? "", s.kargo?.takipNo ?? "", s.faturaNo ?? "", s.seriNolar.join(" "),
        ]),
      ],
      "siparisler.csv",
    );

  const siparisIdleri = useMemo(() => new Set(siparisler.map((s) => s.id)), [siparisler]);
  const ortak = secili ? { siparis: secili, onTamam: uygula, onVazgec: kapat } : null;

  return (
    <>
      <PageHeader title="Sipariş & sevkiyat" description="Ödemeden lisans teslimine kadar her siparişin adımları">
        <button type="button" onClick={disaAktar} className={IKINCIL_BTN}>
          <Download size={18} aria-hidden="true" />
          Dışa aktar
        </button>
        <button
          type="button"
          onClick={() => setPencere("yeni")}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Manuel sipariş
        </button>
      </PageHeader>

      <OzetKartlari siparisler={siparisler} sekme={sekme} faturasiz={faturasiz} onSekme={setSekme} onFatura={faturaFiltresi} />

      <div id="siparis-listesi" className="flex scroll-mt-4 flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_620px]">
          <SiparisTablosu
            siparisler={gorunen}
            stok={stok}
            sekme={sekme}
            sayilar={sayilar}
            faturasiz={faturasiz ? siparisler.filter(faturaBekliyor).length : null}
            onFaturaKapat={() => setFaturasiz(false)}
            arama={arama}
            seciliId={seciliId}
            onSekme={setSekme}
            onArama={setArama}
            onSec={sec}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_340px]">
          <SiparisDetay
            key={secili?.id ?? "yok"}
            siparis={secili}
            stok={stok}
            bekliyor={bekliyor}
            hata={hata}
            onEylem={eylem}
            onFatura={() => setPencere("fatura")}
            onNot={notEkle}
            onMusteriAc={setAcikMusteri}
            onIade={() => setPencere("iade")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_420px]">
          <DepoStoku stok={stok} siparisler={siparisler} onGiris={() => setPencere("stok")} />
        </div>
        <div className="flex min-w-0 flex-[1_1_420px]">
          <IadeListesi iadeler={iadeler} bekliyor={bekliyor} onEkle={() => setPencere("iade")} onIlerlet={ilerlet} onSiparisAc={siparisAc} siparisIdleri={siparisIdleri} />
        </div>
      </div>

      <Modal
        acik={pencere !== null}
        onKapat={kapat}
        baslik={pencere ? PENCERE_BASLIGI[pencere] : ""}
        aciklama={pencere && !["yeni", "stok", "iade"].includes(pencere) && secili ? `#${secili.id} · ${secili.musteri}` : pencere === "yeni" ? "Telefon, e-posta veya fuardan gelen siparişi kaydedin" : undefined}
      >
        {pencere === "yeni" && <SiparisFormu musteriler={formMusterileri} stok={stok} fiyatListesi={fiyatListesi} onKaydedildi={eklendi} onVazgec={kapat} />}
        {pencere === "stok" && <StokFormu stok={stok} onTamam={uygula} onVazgec={kapat} />}
        {pencere === "iade" && <IadeFormu key={seciliId} siparisler={siparisler} stok={stok} ilkSiparis={secili && ["kargoda", "teslim", "tamamlandi"].includes(secili.durum) ? secili.id : undefined} onTamam={iadeEklendi} onVazgec={kapat} />}
        {ortak && pencere === "seri" && <SeriAtaFormu {...ortak} havuz={havuz} />}
        {ortak && pencere === "kargo" && <KargoFormu {...ortak} firmalar={kargoFirmalari} />}
        {ortak && pencere === "teslim" && <TeslimFormu {...ortak} />}
        {ortak && pencere === "lisans" && <LisansFormu {...ortak} />}
        {ortak && pencere === "fatura" && <FaturaFormu {...ortak} />}
      </Modal>

      <Modal
        acik={musteriKaydi !== null}
        onKapat={musteriKapat}
        baslik="Müşteri"
        aciklama={musteriKaydi ? `${musteriKaydi.sehir}, ${musteriKaydi.ulke}` : undefined}
      >
        {musteriKaydi && <MusteriDetay musteri={musteriKaydi} yalin />}
      </Modal>
    </>
  );
}
