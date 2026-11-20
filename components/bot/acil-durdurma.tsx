"use client";

// Acil durdurma anahtarı (P2.4): tek tıkla tüm botu durdurur. Bot › Ayarlar'da büyük kart, Gelen kutusu'nun üstünde
// kısa şerit olarak görünür. Yalnızca Yönetici değiştirir; diğer roller durumu görür (sunucu aksiyonu ve RLS denetler).
// Açıkken bot hiçbir kanalda çağrılmaz; bot açık konuşmaya müşteri yazınca konuşma ekibe devredilir (dongu.ts).
import { useState, useTransition } from "react";
import { OctagonAlert, Power } from "lucide-react";
import { acilDurdurmaAyarla } from "./actions";

export default function AcilDurdurma({ acik, duzenleyebilir, bicim }: { acik: boolean; duzenleyebilir: boolean; bicim: "kart" | "serit" }) {
  const [durum, setDurum] = useState(acik);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();

  const degistir = () => {
    const yeni = !durum;
    setDurum(yeni);
    setHata(null);
    baslat(async () => {
      const r = await acilDurdurmaAyarla(yeni).catch(() => ({ hata: "Kaydedilemedi: sunucuya ulaşılamadı." }));
      if (r.hata) {
        setDurum(!yeni);
        setHata(r.hata);
      }
    });
  };

  const anahtar = (
    <button
      type="button"
      role="switch"
      aria-checked={durum}
      aria-label="Acil durdurma"
      disabled={!duzenleyebilir || bekliyor}
      onClick={degistir}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${durum ? "bg-err" : "bg-line-strong"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${durum ? "translate-x-6" : "translate-x-1"}`} />
      <span className="sr-only">{durum ? "Açık" : "Kapalı"}</span>
    </button>
  );

  if (bicim === "serit") {
    return (
      <div
        role={durum ? "alert" : undefined}
        className={`mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-card border px-4 py-2 text-sm ${durum ? "border-err bg-err-bg text-err" : "border-line bg-card"}`}
      >
        {durum ? <OctagonAlert size={16} aria-hidden="true" /> : <Power size={16} aria-hidden="true" className="text-muted" />}
        <b className="font-bold">{durum ? "Acil durdurma açık: bot hiçbir konuşmada cevap vermiyor." : "Bot çalışıyor"}</b>
        {!durum && <span className="text-muted">Tek tıkla tüm botu durdurabilirsiniz.</span>}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs font-bold">Acil durdurma</span>
          {anahtar}
        </span>
        {!duzenleyebilir && <span className="w-full text-xs text-muted">Yalnızca Yönetici değiştirebilir.</span>}
        {hata && <span role="alert" className="w-full text-xs font-semibold text-err">{hata}</span>}
      </div>
    );
  }

  return (
    <section aria-labelledby="acil-baslik" className={`flex flex-col gap-3 rounded-card border p-5 ${durum ? "border-err bg-err-bg" : "border-line bg-card"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="acil-baslik" className="text-base font-bold">Acil durdurma</h2>
          <span className="text-sm text-muted">Açıkken bot hiçbir kanalda çağrılmaz; bot açık konuşmalara müşteri yazınca konuşma ekibe devredilir. Gelen kutusu&apos;nun üstünde de görünür.</span>
        </div>
        {anahtar}
      </div>
      <span className="text-sm font-bold">{durum ? "Bot durduruldu." : "Bot çalışıyor (kanalın bot modu Otomatik ise)."}</span>
      {hata && <span role="alert" className="text-sm font-semibold text-err">{hata}</span>}
    </section>
  );
}
