"use client";

// Satış hattının etkileşimli kısmı: kart aşamaları ve "Fırsat ekle" paneli burada yönetilir,
// özet kartlar ve kanban aynı veriden beslenir. Kazanıldı'ya geçen firma müşterilere eklenir.
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Plus, X } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import OzetKartlari from "./ozet-kartlari";
import Kanban from "./kanban";
import FirsatFormu from "./firsat-formu";
import { firsatAsamasiGuncelle, type AsamaSonucu } from "./actions";
import { ASAMA_BILGI, type Asama, type Firsat } from "./queries";

type Bildirim = NonNullable<AsamaSonucu["musteri"]>;

function MusteriBildirimi({ bildirim, onKapat }: { bildirim: Bildirim; onKapat: () => void }) {
  useEffect(() => {
    const t = setTimeout(onKapat, 7000);
    return () => clearTimeout(t);
  }, [bildirim, onKapat]);

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex w-[calc(100%-40px)] max-w-sm items-start gap-3 rounded-card border border-lime bg-card p-4 shadow-[0_16px_40px_rgba(14,15,12,0.18)]"
    >
      <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[#3A4D00]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-sm">{bildirim.yeni ? "Müşterilere eklendi" : "Müşteri kaydına işlendi"}</b>
        <span className="text-[13px] text-muted">
          {bildirim.ad} {bildirim.yeni ? "yeni müşteri olarak kaydedildi." : "zaten müşteriydi; kazanılan satış geçmişine eklendi."}
        </span>
        <Link href={`/musteriler/${bildirim.id}`} className="text-[13px] font-bold text-info hover:text-[#1A2A9E]">
          Müşteriyi aç →
        </Link>
      </div>
      <button
        type="button"
        onClick={onKapat}
        aria-label="Bildirimi kapat"
        className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-[#474A42] hover:bg-bg"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function SatisHattiGorunumu({ firsatlar: ilk }: { firsatlar: Firsat[] }) {
  const [firsatlar, setFirsatlar] = useState(ilk);
  const [ekleAsama, setEkleAsama] = useState<Asama | null>(null);
  const [bildirim, setBildirim] = useState<Bildirim | null>(null);
  const [, baslat] = useTransition();

  function tasi(id: string, asama: Asama) {
    const firsat = firsatlar.find((f) => f.id === id);
    if (!firsat || firsat.asama === asama) return;
    setFirsatlar((l) => l.map((f) => (f.id === id ? { ...f, asama } : f)));
    baslat(async () => {
      const sonuc = await firsatAsamasiGuncelle(firsat, asama);
      if (sonuc.musteri) setBildirim(sonuc.musteri);
    });
  }

  const kapat = useCallback(() => setEkleAsama(null), []);
  const bildirimiKapat = useCallback(() => setBildirim(null), []);
  const eklendi = useCallback((f: Firsat, musteri?: AsamaSonucu["musteri"]) => {
    setFirsatlar((l) => [f, ...l]);
    setEkleAsama(null);
    if (musteri) setBildirim(musteri);
  }, []);

  return (
    <>
      <PageHeader title="Satış Hattı" description="Cihaz + lisans fırsatları · Kazanıldı'ya taşınan firma müşterilere eklenir">
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

      {bildirim && <MusteriBildirimi key={bildirim.id} bildirim={bildirim} onKapat={bildirimiKapat} />}
    </>
  );
}
