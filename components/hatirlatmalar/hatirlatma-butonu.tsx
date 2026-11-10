"use client";

// Detay ekranlarına konan "Hatırlatma ekle" butonu + penceresi
import { useCallback, useState } from "react";
import { Bell } from "lucide-react";
import Modal from "@/components/ui/modal";
import HatirlatmaFormu, { type KayitBaglantisi } from "./hatirlatma-formu";

export default function HatirlatmaButonu({ kayit, className = "" }: { kayit: KayitBaglantisi; className?: string }) {
  const [acik, setAcik] = useState(false);
  const [eklendi, setEklendi] = useState(false);
  const kapat = useCallback(() => setAcik(false), []);
  const kaydedildi = useCallback(() => {
    setAcik(false);
    setEklendi(true);
    setTimeout(() => setEklendi(false), 3000);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold transition-colors hover:bg-[#F4F5F0] ${className}`}
      >
        <Bell size={15} aria-hidden="true" />
        {eklendi ? "Eklendi ✓" : "Hatırlatma ekle"}
      </button>
      <span role="status" className="sr-only">{eklendi ? "Hatırlatma eklendi" : ""}</span>
      <Modal acik={acik} onKapat={kapat} baslik="Hatırlatma ekle" aciklama={kayit.ad}>
        <HatirlatmaFormu kayit={kayit} onKaydedildi={kaydedildi} onVazgec={kapat} />
      </Modal>
    </>
  );
}
