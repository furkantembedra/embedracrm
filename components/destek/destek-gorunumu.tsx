"use client";

// Destek sayfasının etkileşimli kısmı: durum filtresi, arama, seçili talep,
// not / durum güncellemeleri ve ortada açılan "Yeni talep" penceresi.
import { useCallback, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { aracKapsamiIstegi } from "./actions";
import type { Talep, TalepDurumu, TalepNotu } from "./queries";
import TalepListesi from "./talep-listesi";
import TalepDetay from "./talep-detay";
import MusteriBilgiPaneli from "./musteri-bilgi-paneli";
import TalepFormu from "./talep-formu";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import type { Musteri } from "@/components/musteriler/queries";
import CihazDetay from "@/components/cihaz-lisans/cihaz-detay";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import type { YeniLisans } from "@/components/cihaz-lisans/actions";
import { lisansUygula } from "@/components/cihaz-lisans/ortak";

const BOS_METIN: Record<TalepDurumu | "arama", { baslik: string; aciklama: string }> = {
  yeni: { baslik: "Yeni talep yok", aciklama: "Bekleyen yeni bir talep yok. Gelen talepler burada görünecek." },
  islemde: { baslik: "Çözülmesi gereken talep yok", aciklama: "Şu an üzerinde çalışılan bir talep bulunmuyor." },
  beklemede: { baslik: "Bekleyen talep yok", aciklama: "Müşteri veya parça beklenen bir talep bulunmuyor." },
  cozuldu: { baslik: "Henüz çözülen talep yok", aciklama: "Çözüldü olarak kapatılan talepler burada listelenir." },
  arama: { baslik: "Sonuç bulunamadı", aciklama: "Aramanızla eşleşen talep yok. Farklı bir kelime deneyin." },
};

export default function DestekGorunumu({
  talepler: ilk,
  musteriler,
  cihazlar: ilkCihazlar,
  sonrakiNo,
  seciliIlk,
}: {
  talepler: Talep[];
  musteriler: Musteri[];
  cihazlar: Cihaz[];
  sonrakiNo: string;
  seciliIlk?: string; // /destek/[id] adresinden gelindiyse
}) {
  const [talepler, setTalepler] = useState(ilk);
  const baslangic = ilk.find((t) => t.id === seciliIlk) ?? ilk.find((t) => t.durum === "yeni") ?? ilk.find((t) => t.durum === "islemde") ?? ilk[0];
  const [filtre, setFiltre] = useState<TalepDurumu>(baslangic?.durum ?? "yeni");
  const [arama, setArama] = useState("");
  const [seciliId, setSeciliId] = useState<string | null>(baslangic?.id ?? null);
  const [yeniAcik, setYeniAcik] = useState(false);
  const [acikMusteri, setAcikMusteri] = useState<string | null>(null);
  const [acikCihaz, setAcikCihaz] = useState<string | null>(null);
  const [cihazlar, setCihazlar] = useState(ilkCihazlar);
  const formMusterileri = useMemo(
    () => musteriler.map((m) => ({ id: m.id, ad: m.ad, cihazlar: m.cihazlar.map((c) => ({ seriNo: c.seriNo, firmware: c.firmware })) })),
    [musteriler],
  );
  const musteriKaydi = musteriler.find((m) => m.id === acikMusteri) ?? null;
  const cihazKaydi = cihazlar.find((c) => c.seriNo === acikCihaz) ?? null;
  const musteriKapat = useCallback(() => setAcikMusteri(null), []);
  const cihazKapat = useCallback(() => setAcikCihaz(null), []);
  const cihazLisans = useCallback((l: YeniLisans) => setCihazlar((liste) => liste.map((c) => lisansUygula(c, l))), []);
  const [, baslat] = useTransition();

  const sayilar = useMemo(() => {
    const s: Record<TalepDurumu, number> = { yeni: 0, islemde: 0, beklemede: 0, cozuldu: 0 };
    for (const t of talepler) s[t.durum]++;
    return s;
  }, [talepler]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR").replace(/^#/, "");
    return talepler.filter((t) => {
      if (t.durum !== filtre && t.id !== seciliId) return false; // durumu az önce değişen seçili talep listede kalsın
      if (!q) return true;
      return [t.id, t.baslik, t.musteri, t.seriNo ?? ""].some((a) => a.toLocaleLowerCase("tr-TR").includes(q));
    });
  }, [talepler, filtre, arama, seciliId]);

  const secili = talepler.find((t) => t.id === seciliId) ?? null;

  const guncelle = (id: string, f: (t: Talep) => Talep) => setTalepler((l) => l.map((t) => (t.id === id ? f(t) : t)));

  const notEklendi = useCallback((id: string, not: TalepNotu, durum?: TalepDurumu) => {
    setTalepler((l) => l.map((t) => (t.id === id ? { ...t, durum: durum ?? t.durum, notlar: [...t.notlar, not] } : t)));
  }, []);

  const aracKapsami = (id: string) => {
    baslat(async () => {
      const not = await aracKapsamiIstegi(id);
      if (not) guncelle(id, (t) => ({ ...t, konu: "Araç kapsamı isteği", notlar: [...t.notlar, not] }));
    });
  };

  const sec = (id: string) => setSeciliId(id);
  const filtreSec = (d: TalepDurumu) => {
    setFiltre(d);
    setSeciliId(talepler.find((t) => t.durum === d)?.id ?? null);
  };

  const kapat = useCallback(() => setYeniAcik(false), []);
  const eklendi = useCallback((t: Talep) => {
    setTalepler((l) => [t, ...l]);
    setFiltre("yeni");
    setArama("");
    setSeciliId(t.id);
    setYeniAcik(false);
  }, []);

  // Yeni talep numarası, bu ekranda eklenenleri de hesaba katar
  const no = String(Math.max(Number(sonrakiNo), ...talepler.map((t) => Number(t.id) + 1)));

  return (
    <>
      <PageHeader
        title="Destek talepleri"
        description="Telefon, WhatsApp veya e-postayla gelen talepleri buraya kaydedin ve çözülene kadar takip edin"
      >
        <button
          type="button"
          onClick={() => setYeniAcik(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Yeni talep
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex min-w-0 flex-[1_1_300px]">
          <TalepListesi
            talepler={gorunen}
            filtre={filtre}
            sayilar={sayilar}
            arama={arama}
            seciliId={seciliId}
            onFiltre={filtreSec}
            onArama={setArama}
            onSec={sec}
          />
        </div>
        <div className="flex min-w-0 flex-[2_1_460px]">
          <TalepDetay talep={secili} onNot={notEklendi} bos={gorunen.length === 0 ? BOS_METIN[arama.trim() ? "arama" : filtre] : undefined} />
        </div>
        {secili && (
          <div className="flex min-w-0 flex-[1_1_280px] items-start">
            <MusteriBilgiPaneli
              talep={secili}
              musteri={secili.musteriId ? musteriler.find((m) => m.id === secili.musteriId) ?? null : null}
              onAracKapsami={aracKapsami}
              onMusteriAc={musteriler.length ? setAcikMusteri : undefined}
              onCihazAc={setAcikCihaz}
            />
          </div>
        )}
      </div>

      <Modal acik={yeniAcik} onKapat={kapat} baslik="Yeni destek talebi" aciklama="Müşteriden gelen talebi kaydedin">
        <TalepFormu musteriler={formMusterileri} sonrakiNo={no} onKaydedildi={eklendi} onVazgec={kapat} />
      </Modal>

      <Modal acik={musteriKaydi !== null} onKapat={musteriKapat} baslik="Müşteri" aciklama={musteriKaydi ? `${musteriKaydi.sehir}, ${musteriKaydi.ulke}` : undefined}>
        {musteriKaydi && <MusteriDetay musteri={musteriKaydi} yalin />}
      </Modal>

      <Modal
        acik={acikCihaz !== null}
        onKapat={cihazKapat}
        baslik="Cihaz kaydı"
        aciklama={cihazKaydi ? `${cihazKaydi.musteri} · ${cihazKaydi.ulke}` : acikCihaz ? `${acikCihaz} cihaz listesinde bulunamadı` : undefined}
      >
        {cihazKaydi ? (
          <CihazDetay key={cihazKaydi.seriNo} cihaz={cihazKaydi} yalin onLisans={cihazLisans} />
        ) : (
          <p className="pb-5 text-sm text-muted">Bu seri numarası cihaz kayıtlarında yok. Cihaz & Lisans sayfasından ekleyebilirsiniz.</p>
        )}
      </Modal>
    </>
  );
}
