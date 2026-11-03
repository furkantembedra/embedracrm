"use client";

// Satış hattının etkileşimli kısmı: kart aşamaları ve "Fırsat ekle" paneli burada yönetilir,
// özet kartlar ve kanban aynı veriden beslenir.
import { useCallback, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import OzetKartlari from "./ozet-kartlari";
import Kanban from "./kanban";
import FirsatFormu from "./firsat-formu";
import { firsatAsamasiGuncelle } from "./actions";
import { ASAMA_BILGI, type Asama, type Firsat } from "./queries";

export default function SatisHattiGorunumu({ firsatlar: ilk }: { firsatlar: Firsat[] }) {
  const [firsatlar, setFirsatlar] = useState(ilk);
  const [ekleAsama, setEkleAsama] = useState<Asama | null>(null);
  const [, baslat] = useTransition();

  function tasi(id: string, asama: Asama) {
    setFirsatlar((l) => l.map((f) => (f.id === id ? { ...f, asama } : f)));
    baslat(() => firsatAsamasiGuncelle(id, asama));
  }

  const kapat = useCallback(() => setEkleAsama(null), []);
  const eklendi = useCallback((f: Firsat) => {
    setFirsatlar((l) => [f, ...l]);
    setEkleAsama(null);
  }, []);

  return (
    <>
      <PageHeader title="Satış Hattı" description="Cihaz + lisans fırsatları · kartları aşamalar arasında sürükleyin">
        <button
          type="button"
          onClick={() => setEkleAsama("yeni")}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Fırsat ekle
        </button>
      </PageHeader>

      <OzetKartlari firsatlar={firsatlar} />
      <Kanban firsatlar={firsatlar} onTasi={tasi} onEkle={setEkleAsama} />

      <Modal
        acik={ekleAsama !== null}
        onKapat={kapat}
        baslik="Yeni fırsat"
        aciklama={ekleAsama ? `${ASAMA_BILGI[ekleAsama].ad} aşamasına eklenecek` : undefined}
      >
        {ekleAsama && (
          <FirsatFormu key={ekleAsama} baslangicAsamasi={ekleAsama} onKaydedildi={eklendi} onVazgec={kapat} />
        )}
      </Modal>
    </>
  );
}
