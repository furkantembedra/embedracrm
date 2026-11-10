"use client";

// Hatırlatma verisini sunucudan çeker ve tamamla / ertele işlemlerini iyimser uygular.
import { useCallback, useEffect, useState, useTransition } from "react";
import { hatirlatmaErtele, hatirlatmalariGetir, hatirlatmaTamamla, type HatirlatmaVerisi } from "./actions";

export function useHatirlatmalar(tetik?: unknown) {
  const [veri, setVeri] = useState<HatirlatmaVerisi | null>(null);
  const [, baslat] = useTransition();

  const yenile = useCallback(() => {
    hatirlatmalariGetir().then(setVeri).catch(() => {});
  }, []);

  useEffect(() => {
    let iptal = false;
    hatirlatmalariGetir().then((v) => !iptal && setVeri(v)).catch(() => {});
    return () => void (iptal = true);
  }, [tetik]);

  const tamamla = useCallback((id: string, tamam: boolean) => {
    setVeri((v) => v && { ...v, liste: v.liste.map((h) => (h.id === id ? { ...h, durum: tamam ? "tamam" : "bekliyor", tamamlanma: tamam ? v.simdi : null } : h)) });
    baslat(async () => {
      await hatirlatmaTamamla(id, tamam);
    });
  }, []);

  const ertele = useCallback((id: string, sure: "1s" | "yarin" | "hafta") => {
    baslat(async () => {
      const zaman = await hatirlatmaErtele(id, sure);
      setVeri((v) => v && { ...v, liste: v.liste.map((h) => (h.id === id ? { ...h, zaman } : h)).sort((a, b) => a.zaman.localeCompare(b.zaman)) });
    });
  }, []);

  return { veri, setVeri, yenile, tamamla, ertele };
}
