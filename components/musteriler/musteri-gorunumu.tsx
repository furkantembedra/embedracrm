"use client";

// Müşteriler sayfasının etkileşimli kısmı: segment filtresi, arama, seçili müşteri
// ve ortada açılan "Müşteri ekle" penceresi.
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import SegmentKartlari, { type SegmentSecimi } from "./segment-kartlari";
import MusteriTablosu from "./musteri-tablosu";
import MusteriDetay from "./musteri-detay";
import type { IletisimDegisikligi } from "./musteri-iletisim";
import MusteriFormu from "./musteri-formu";
import type { Musteri, Olay } from "./queries";

export default function MusteriGorunumu({ musteriler: ilk }: { musteriler: Musteri[] }) {
  const [musteriler, setMusteriler] = useState(ilk);
  const [segment, setSegment] = useState<SegmentSecimi>("tumu");
  const [arama, setArama] = useState("");
  const [seciliId, setSeciliId] = useState<string | null>(ilk[0]?.id ?? null);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [pencereId, setPencereId] = useState<string | null>(null);
  const pencereKapat = useCallback(() => setPencereId(null), []);

  const sayilar = useMemo(() => {
    const s: Record<SegmentSecimi, number> = { tumu: musteriler.length, servis: 0, muhendislik: 0, egitim: 0, bayi: 0 };
    for (const m of musteriler) s[m.segment]++;
    return s;
  }, [musteriler]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return musteriler.filter((m) => {
      if (segment !== "tumu" && m.segment !== segment) return false;
      if (!q) return true;
      const alanlar = [m.ad, ...m.yetkililer.flatMap((y) => [y.ad, y.telefon, y.eposta]), m.sehir, m.ulke, ...m.cihazlar.flatMap((c) => [c.seriNo, c.model])];
      return alanlar.some((a) => a.toLocaleLowerCase("tr-TR").includes(q));
    });
  }, [musteriler, segment, arama]);

  const ulkeSayisi = useMemo(() => new Set(musteriler.map((m) => m.ulke)).size, [musteriler]);
  const secili = musteriler.find((m) => m.id === seciliId) ?? null;

  const kapat = useCallback(() => setEkleAcik(false), []);
  // Panelde yetkili / vergi no değişince tablodaki kayıt da güncellensin (arama yeni yetkiliyi bulsun)
  const iletisimDegisti = useCallback((id: string, d: IletisimDegisikligi) => {
    setMusteriler((l) => l.map((m) => (m.id === id ? { ...m, ...d } : m)));
  }, []);
  const notEklendi = useCallback((id: string, olay: Olay) => {
    setMusteriler((l) => l.map((m) => (m.id === id ? { ...m, sonTemas: "Bugün", olaylar: [olay, ...m.olaylar] } : m)));
  }, []);
  const eklendi = useCallback((m: Musteri) => {
    setMusteriler((l) => [m, ...l]);
    setSegment("tumu");
    setArama("");
    setSeciliId(m.id);
    setEkleAcik(false);
  }, []);

  return (
    <>
      <PageHeader title="Müşteriler" description={`${musteriler.length} hesap · ${ulkeSayisi} ülke`}>
        <button
          type="button"
          onClick={() => setEkleAcik(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Müşteri ekle
        </button>
      </PageHeader>

      <SegmentKartlari secili={segment} sayilar={sayilar} onSec={setSegment} />
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_600px]">
          <MusteriTablosu musteriler={gorunen} seciliId={seciliId} arama={arama} onArama={setArama} onSec={setSeciliId} />
        </div>
        <div className="flex min-w-0 flex-[1_1_340px]">
          <MusteriDetay musteri={secili} onNotEklendi={notEklendi} onAdaTikla={setPencereId} onIletisimDegisti={iletisimDegisti} />
        </div>
      </div>

      <Modal
        acik={pencereId !== null}
        onKapat={pencereKapat}
        baslik="Müşteri"
        aciklama={(() => {
          const p = musteriler.find((m) => m.id === pencereId);
          return p ? `${p.sehir}, ${p.ulke}` : undefined;
        })()}
      >
        <MusteriDetay musteri={musteriler.find((m) => m.id === pencereId) ?? null} yalin onNotEklendi={notEklendi} onIletisimDegisti={iletisimDegisti} />
      </Modal>

      <Modal acik={ekleAcik} onKapat={kapat} baslik="Yeni müşteri" aciklama="Firma ve iletişim bilgilerini girin">
        <MusteriFormu onKaydedildi={eklendi} onVazgec={kapat} />
      </Modal>
    </>
  );
}
