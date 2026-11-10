"use client";

// Teklifler sayfası: durum sekmeleri, tablo ve "Yeni teklif" penceresi
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import Chip, { type ChipTon } from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { useBugun } from "@/lib/use-bugun";
import type { FiyatListesi } from "@/lib/urunler";
import TeklifFormu from "./teklif-formu";
import { suresiDoldu, teklifToplami } from "./ortak";
import { DURUM_ADI, type Teklif } from "./queries";

type Filtre = "tumu" | "acik" | "taslak" | "kabul" | "red" | "doldu";
const FILTRELER: { id: Filtre; ad: string }[] = [
  { id: "tumu", ad: "Tümü" }, { id: "acik", ad: "Yanıt bekleyen" }, { id: "taslak", ad: "Taslak" },
  { id: "kabul", ad: "Kabul" }, { id: "red", ad: "Red" }, { id: "doldu", ad: "Süresi dolan" },
];

export const DURUM_TONU: Record<Teklif["durum"], ChipTon> = { taslak: "gray", gonderildi: "info", kabul: "lime", red: "err", revize: "gray" };

export function tarihYaz(t: string) {
  return new Date(t + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeklifListesi({
  teklifler,
  firsatlar,
  fiyatListesi,
}: {
  teklifler: Teklif[];
  firsatlar: { id: string; firma: string; icerik: string }[];
  fiyatListesi: FiyatListesi;
}) {
  const router = useRouter();
  const bugunMs = useBugun();
  const bugun = bugunMs === null ? "" : new Date(bugunMs + 12 * 3_600_000).toISOString().slice(0, 10);
  const [filtre, setFiltre] = useState<Filtre>("tumu");
  const [yeni, setYeni] = useState(false);
  const kapat = useCallback(() => setYeni(false), []);
  const kaydedildi = useCallback((t: Teklif) => router.push(`/teklifler/${t.id}`), [router]);

  const gorunen = useMemo(() => {
    const doldu = (t: Teklif) => !!bugun && suresiDoldu(t, bugun);
    return teklifler.filter((t) => {
      if (filtre === "tumu") return t.durum !== "revize";
      if (filtre === "acik") return t.durum === "gonderildi" && !doldu(t);
      if (filtre === "doldu") return doldu(t);
      return t.durum === filtre;
    });
  }, [teklifler, filtre, bugun]);

  const acikToplam = teklifler.filter((t) => t.durum === "gonderildi").reduce((s, t) => s + teklifToplami(t).net, 0);
  const kapanan = teklifler.filter((t) => t.durum === "kabul" || t.durum === "red");
  const kabulOrani = kapanan.length ? Math.round((kapanan.filter((t) => t.durum === "kabul").length / kapanan.length) * 100) : null;

  return (
    <>
      <PageHeader title="Teklifler" description="Satış hattındaki fırsatlardan hazırlanan teklifler · Kabul edilen teklif siparişe dönüşür">
        <button type="button" onClick={() => setYeni(true)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
          <Plus size={18} aria-hidden="true" /> Yeni teklif
        </button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { ad: "Yanıt bekleyen", deger: String(teklifler.filter((t) => t.durum === "gonderildi").length) },
          { ad: "Açık teklif tutarı (KDV hariç)", deger: tl(acikToplam) },
          { ad: "Kabul oranı", deger: kabulOrani === null ? "—" : `%${kabulOrani}` },
        ].map((k) => (
          <div key={k.ad} className="flex flex-col gap-1 rounded-card border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">{k.ad}</span>
            <b className="text-2xl tabular-nums">{k.deger}</b>
          </div>
        ))}
      </div>

      <div role="tablist" aria-label="Teklif durumu" className="flex w-full gap-1 overflow-x-auto rounded-control bg-card p-1 shadow-[0_0_0_1px_var(--color-line)] sm:w-fit">
        {FILTRELER.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}
            className={`min-h-10 shrink-0 cursor-pointer rounded-[9px] px-3.5 text-[13px] font-bold ${filtre === f.id ? "bg-ink text-white" : "text-[#474A42] hover:bg-bg"}`}>
            {f.ad}
          </button>
        ))}
      </div>

      <div className="relative overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-bold text-muted">
              <th className="px-4 py-3">Teklif no</th><th className="px-4 py-3">Firma</th><th className="px-4 py-3 text-right">Tutar (KDV dahil)</th>
              <th className="px-4 py-3">Geçerlilik</th><th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {gorunen.map((t) => {
              const doldu = !!bugun && suresiDoldu(t, bugun);
              return (
                <tr key={t.id} className="border-b border-bg last:border-0 hover:bg-[#FAFBF7]">
                  <td className="px-4 py-3"><Link href={`/teklifler/${t.id}`} className="font-bold text-info hover:underline">{t.no}</Link></td>
                  <td className="px-4 py-3"><span className="font-semibold">{t.firma}</span><span className="block text-xs text-muted">{t.konum}</span></td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{tl(teklifToplami(t).toplam)}</td>
                  <td className={`px-4 py-3 ${doldu ? "font-bold text-warn" : ""}`}>{tarihYaz(t.gecerlilik)}</td>
                  <td className="px-4 py-3">{doldu ? <Chip ton="warn">Süresi doldu</Chip> : <Chip ton={DURUM_TONU[t.durum]}>{DURUM_ADI[t.durum]}</Chip>}</td>
                </tr>
              );
            })}
            {!gorunen.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">Bu filtrede teklif yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal acik={yeni} onKapat={kapat} baslik="Yeni teklif" aciklama="Fırsatın ürünleri ve güncel fiyat listesiyle dolar">
        <TeklifFormu firsatlar={firsatlar} fiyatListesi={fiyatListesi} onKaydedildi={kaydedildi} onVazgec={kapat} />
      </Modal>
    </>
  );
}
