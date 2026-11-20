// Lead kartının ekrandaki hâli (P2.2): satış hattı kartında kısa, Bot › Gelen kutusu sağ panelinde tam. Salt okunur;
// kartı yalnızca botun araçları yazar. Sunucu ve istemci bileşeninde kullanılabilir (durum yok).
import { AlertTriangle } from "lucide-react";
import Chip, { type ChipTon } from "@/components/ui/chip";
import { IZIN_KANAL_ADI } from "@/components/musteriler/izin";
import {
  ALAN_ADI, BILGI_ALANLARI, LEAD_SKORU_ADI, alanMetni, eksikAlanlar, type BilgiAlani, type LeadKarti, type LeadSkoru,
} from "./lead-karti";

const SKOR_TONU: Record<LeadSkoru, ChipTon> = { sicak: "err", ilik: "warn", soguk: "info" };
/** Satış hattı kartında gösterilen alanlar (gerisi gelen kutusunda) */
const KISA_ALANLAR: readonly BilgiAlani[] = ["yetkili", "kullanim_alani", "cihaz_adedi", "ekran_tercihi", "aciliyet"];

const tutar = (n: number | null, pb: string) =>
  n === null ? "özel fiyat" : new Intl.NumberFormat("tr-TR", { style: "currency", currency: pb, maximumFractionDigits: 0 }).format(n);

/** Kartta gösterilecek bir şey var mı */
export const leadKartiDolu = (k: LeadKarti | undefined | null): k is LeadKarti =>
  !!k && (BILGI_ALANLARI.some((a) => k[a] != null) || !!k.skor || !!k.plan || !!k.demo || !!k.bayi || !!k.izinler?.length);

export function BayiUyarisi({ k }: { k: LeadKarti }) {
  if (!k.bayi) return null;
  return (
    <p role="note" className="flex items-start gap-1.5 rounded-lg bg-warn-bg px-2.5 py-1.5 text-xs font-semibold text-warn">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">
        Bölgede münhasır bayi var: {k.bayi.ad}{k.bayi.kapsam ? ` (${k.bayi.kapsam})` : ""}. Karar satışçının.
      </span>
    </p>
  );
}

export default function LeadKartiGorunumu({ k, kisa = false, kanalTelefonu = false }: { k: LeadKarti; kisa?: boolean; kanalTelefonu?: boolean }) {
  const alanlar = (kisa ? KISA_ALANLAR : BILGI_ALANLARI).filter((a) => !(kisa && a === "firma")).map((a) => [a, alanMetni(k, a)] as const).filter(([, m]) => m);
  const eksik = eksikAlanlar(k, kanalTelefonu);
  return (
    <div className="flex min-w-0 flex-col gap-1.5" aria-label="Lead kartı">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold tracking-[0.06em] text-muted">LEAD KARTI</span>
        {k.skor && (
          <span title={k.skor.gerekce}>
            <Chip ton={SKOR_TONU[k.skor.deger]}>{LEAD_SKORU_ADI[k.skor.deger]}</Chip>
          </span>
        )}
        {k.demo && <Chip ton="info">Demo istedi</Chip>}
      </div>
      <BayiUyarisi k={k} />
      {alanlar.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
          {alanlar.map(([a, m]) => (
            <div key={a} className="contents">
              <dt className="font-semibold text-muted">{ALAN_ADI[a]}</dt>
              <dd className="min-w-0 break-words text-[#474A42]">{m}</dd>
            </div>
          ))}
        </dl>
      )}
      {k.skor && !kisa && <p className="text-xs text-muted">Skor gerekçesi: {k.skor.gerekce}</p>}
      {k.plan && (
        <p className="text-xs text-[#474A42]">
          <b>Plan önerisi:</b> {k.plan.plan} × {k.plan.lisans_adedi} ({k.plan.cihaz_adedi} cihaz) · {tutar(k.plan.yillik_tutar, k.plan.para_birimi)}/yıl
          {!kisa && k.plan.ust_plan && <> · bir üst: {k.plan.ust_plan}{k.plan.ust_plan_ek_tutar !== null ? ` (+${tutar(k.plan.ust_plan_ek_tutar, k.plan.para_birimi)})` : ""}</>}
        </p>
      )}
      {k.demo && !kisa && <p className="text-xs text-[#474A42]"><b>Demo tercihi:</b> {k.demo.not}</p>}
      {k.izinler?.length ? (
        <p className="text-xs text-[#474A42]">
          <b>Bekleyen izin:</b> {k.izinler.map((i) => `${IZIN_KANAL_ADI[i.kanal]} (${i.kaynak}, ${i.tarih})`).join(", ")}
          {!kisa && <span className="text-muted"> · fırsat bir müşteri yetkilisine bağlanınca izin kaydına taşınır</span>}
        </p>
      ) : null}
      {eksik.length > 0 && (
        <p className="text-[11px] text-muted">Eksik: {eksik.map((a) => ALAN_ADI[a]).join(", ")}</p>
      )}
    </div>
  );
}
