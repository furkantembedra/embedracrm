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
import TalepFormu, { type TalepMusterisi } from "./talep-formu";

export default function DestekGorunumu({
  talepler: ilk,
  musteriler,
  sonrakiNo,
  seciliIlk,
}: {
  talepler: Talep[];
  musteriler: TalepMusterisi[];
  sonrakiNo: string;
  seciliIlk?: string; // /destek/[id] adresinden gelindiyse
}) {
  const [talepler, setTalepler] = useState(ilk);
  const baslangic = ilk.find((t) => t.id === seciliIlk) ?? ilk.find((t) => t.durum === "acik") ?? ilk[0];
  const [filtre, setFiltre] = useState<TalepDurumu>(baslangic?.durum ?? "acik");
  const [arama, setArama] = useState("");
  const [seciliId, setSeciliId] = useState<string | null>(baslangic?.id ?? null);
  const [yeniAcik, setYeniAcik] = useState(false);
  const [, baslat] = useTransition();

  const sayilar = useMemo(() => {
    const s: Record<TalepDurumu, number> = { acik: 0, beklemede: 0, cozuldu: 0 };
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
    setFiltre("acik");
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
          <TalepDetay talep={secili} onNot={notEklendi} />
        </div>
        {secili && (
          <div className="flex min-w-0 flex-[1_1_280px] items-start">
            <MusteriBilgiPaneli talep={secili} onAracKapsami={aracKapsami} />
          </div>
        )}
      </div>

      <Modal acik={yeniAcik} onKapat={kapat} baslik="Yeni destek talebi" aciklama="Müşteriden gelen talebi kaydedin">
        <TalepFormu musteriler={musteriler} sonrakiNo={no} onKaydedildi={eklendi} onVazgec={kapat} />
      </Modal>
    </>
  );
}
