"use client";

// Menüdeki bildirim zili: zamanı gelmiş hatırlatmalar. Sayfa değiştikçe ve 2 dakikada bir yenilenir.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import Modal from "@/components/ui/modal";
import { bildirimleriOkundu } from "./actions";
import HatirlatmaSatiri from "./hatirlatma-satiri";
import { okumaAnahtari, zamaniGeldi } from "./ortak";
import { useHatirlatmalar } from "./use-hatirlatmalar";

function Zil({ yol }: { yol: string }) {
  const { veri, setVeri, yenile, tamamla, ertele } = useHatirlatmalar(yol);
  const [acik, setAcik] = useState(false);
  const kapat = useCallback(() => setAcik(false), []);

  useEffect(() => {
    const t = setInterval(yenile, 120_000);
    return () => clearInterval(t);
  }, [yenile]);

  const gelen = veri ? veri.liste.filter((h) => zamaniGeldi(h, veri.simdi)) : [];
  const okunmamis = gelen.filter((h) => !h.okundu);

  function hepsiOkundu() {
    if (!okunmamis.length) return;
    setVeri((v) => v && { ...v, liste: v.liste.map((h) => (zamaniGeldi(h, v.simdi) ? { ...h, okundu: true } : h)) });
    void bildirimleriOkundu(okunmamis.map(okumaAnahtari));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        aria-label={okunmamis.length ? `Bildirimler, ${okunmamis.length} okunmamış` : "Bildirimler"}
        className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-[#C3C6BC] transition-colors hover:bg-[#23251F] hover:text-white"
      >
        <Bell size={20} aria-hidden="true" />
        {okunmamis.length > 0 && (
          <span aria-hidden="true" className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 text-[11px] font-extrabold text-ink">
            {okunmamis.length > 9 ? "9+" : okunmamis.length}
          </span>
        )}
      </button>
      <Modal acik={acik} onKapat={kapat} baslik="Bildirimler" aciklama={veri ? `${gelen.length} hatırlatmanın zamanı geldi` : "Yükleniyor…"}>
        <div className="flex flex-col gap-3 pb-5">
          {veri && gelen.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={hepsiOkundu} disabled={!okunmamis.length} className="min-h-9 cursor-pointer rounded-control px-2 text-[13px] font-bold text-info hover:bg-info-bg disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent">
                Tümünü okundu say
              </button>
              <Link href="/hatirlatmalar" onClick={kapat} className="text-[13px] font-bold text-info hover:underline">Tüm hatırlatmalar →</Link>
            </div>
          )}
          {veri && !gelen.length && <p className="py-6 text-center text-sm text-muted">Şu an bekleyen bildirim yok. 🎉</p>}
          <ul className="flex flex-col gap-2">
            {gelen.map((h) => (
                <HatirlatmaSatiri
                  key={h.id}
                  yeni={!h.okundu}
                  h={h}
                  simdi={veri!.simdi}
                  sorumlu={veri!.aktif.rol === "Yönetici" ? veri!.ekip.find((k) => k.id === h.sorumluId)?.ad : undefined}
                  onTamamla={(t) => tamamla(h.id, t)}
                  onErtele={(s) => ertele(h.id, s)}
                  onGit={kapat}
                />
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}

export default function BildirimZili() {
  return <Zil yol={usePathname() ?? ""} />;
}
