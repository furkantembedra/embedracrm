import Link from "next/link";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { DURUM_ADI, DURUM_TONU } from "@/components/siparisler/ortak";
import { bayiVerisi, tarihTr } from "@/components/portal/veri";

export default async function PortalOzetPage() {
  const v = await bayiVerisi();
  const b = v.bayi;
  const yuzde = b.moqHedef ? Math.min(100, Math.round((b.moqGerceklesen / b.moqHedef) * 100)) : 0;
  const acik = v.siparisler.filter((s) => s.durum !== "tamamlandi");
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-tight">Merhaba, {v.basvuru?.yetkili ?? b.ad}</h1>
        <p className="text-sm text-muted">{b.ad} · {b.bolge}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-card border border-line bg-card p-4 sm:col-span-2">
          <span className="text-xs font-semibold text-muted">Bu çeyrek hedef (MOQ)</span>
          <b className="text-2xl tabular-nums">{b.moqGerceklesen} / {b.moqHedef} cihaz</b>
          <span className="h-2.5 rounded-full bg-bg"><span className={`block h-2.5 rounded-full ${yuzde >= 80 ? "bg-[#1F8A4C]" : yuzde >= 50 ? "bg-[#E58A2B]" : "bg-[#D93F3F]"}`} style={{ width: `${yuzde}%` }} /></span>
          <span className="text-xs text-muted">%{yuzde} · hedefe {Math.max(0, b.moqHedef - b.moqGerceklesen)} cihaz kaldı</span>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">Bu çeyrek satış</span>
          <b className="text-2xl tabular-nums">{b.satilan}</b>
        </div>
        <Link href="/portal/cihazlar" className="flex flex-col gap-1 rounded-card border border-line bg-card p-4 hover:border-ink">
          <span className="text-xs font-semibold text-muted">Stoktaki cihaz</span>
          <b className="text-2xl tabular-nums">{v.stokSeriler.length || b.stok}</b>
        </Link>
      </div>
      <section aria-label="Açık siparişler" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-extrabold">Açık siparişler</h2>
          <Link href="/portal/siparis" className="ml-auto text-[13px] font-bold text-info hover:underline">Yeni sipariş →</Link>
        </div>
        {acik.length ? (
          <ul className="flex flex-col divide-y divide-bg">
            {acik.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <b>#{s.id}</b>
                <span className="text-muted">{tarihTr(s.tarih)}</span>
                <span>{s.kalemler.map((k) => (k.tur === "cihaz" ? `${k.adet}× ${k.model}` : k.tur === "lisans" ? `${k.adet}× ${k.paket}` : `${k.adet}× ${k.stokKodu}`)).join(" · ")}</span>
                <span className="font-bold tabular-nums">{s.paraBirimi === "TRY" ? tl(s.tutar) : `€${s.tutar.toLocaleString("tr-TR")}`}</span>
                <span className="ml-auto"><Chip ton={DURUM_TONU[s.durum]}>{DURUM_ADI[s.durum]}</Chip></span>
                {s.kargo && <span className="w-full text-xs text-muted">{s.kargo.firma} · takip {s.kargo.takipNo}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Açık siparişiniz yok.</p>
        )}
      </section>
    </>
  );
}
