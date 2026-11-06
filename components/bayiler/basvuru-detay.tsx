"use client";

// Başvuru bilgileri, uygunluk puanı, sözleşme kontrol listesi ve aşama butonları
import Link from "next/link";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import Chip from "@/components/ui/chip";
import { ASAMA_BILGI, type Basvuru, type SozlesmeDetayi } from "./queries";
import SozlesmeKontrolleri from "./sozlesme-kontrolleri";
import { ASAMA_TONU, gorusmeYaz, sonrakiAsama } from "./ortak";

const IKINCIL_BTN =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-card px-3 text-sm font-bold transition-colors hover:bg-[#F4F5F0] disabled:cursor-default disabled:opacity-60";

export type DetayBildirimi = { tur: "hata" | "basari"; metin: string; link?: { href: string; ad: string; onAc?: () => void } };

export default function BasvuruDetay({
  basvuru,
  bekliyor = false,
  bildirim,
  onKontrol,
  onSozlesme,
  acikMadde = null,
  onMaddeAc,
  cakisanlar = [],
  onPuan,
  onIlerlet,
  onGorusme,
}: {
  basvuru: Basvuru | null;
  bekliyor?: boolean;
  bildirim?: DetayBildirimi | null;
  onKontrol: (sira: number, deger: boolean) => void;
  onSozlesme: (sira: number, d: SozlesmeDetayi) => void;
  acikMadde?: number | null;
  onMaddeAc: (sira: number | null) => void;
  cakisanlar?: string[];
  onPuan: (puan: number) => void;
  onIlerlet: (kaydedilmemisPuan?: number) => void; // puan yazılıp Kaydet'e basılmadıysa önce o kaydedilir
  onGorusme: () => void;
}) {
  const [puanTaslak, setPuanTaslak] = useState<{ id: string; deger: string } | null>(null);

  if (!basvuru) {
    return (
      <aside className="flex w-full items-center justify-center rounded-card border border-line bg-card p-10 text-sm text-muted">
        Ayrıntıları görmek için bir başvuru seçin.
      </aside>
    );
  }
  const b = basvuru;
  const sonraki = sonrakiAsama(b.asama);
  const puanDegeri = puanTaslak?.id === b.id ? puanTaslak.deger : b.puan === null ? "" : String(b.puan);
  const puanDegisti = puanDegeri !== (b.puan === null ? "" : String(b.puan));

  return (
    <aside aria-label="Başvuru detayı" className="flex w-full min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Chip ton={ASAMA_TONU[b.asama]} className="self-start">{ASAMA_BILGI[b.asama].ad}</Chip>
        <h2 className="text-[19px] font-extrabold leading-snug">{b.sirket}</h2>
        <span className="text-[13px] text-muted">
          {b.ulkeKodu} · talep edilen bölge: <b className="text-ink">{b.bolge}</b>
        </span>
      </div>

      <dl className="flex flex-col gap-2 rounded-[14px] bg-[#F4F5F0] p-3.5 text-[13px]">
        {[
          ["Yetkili", <b key="y">{b.yetkili}</b>],
          ["E-posta", <a key="e" href={`mailto:${b.eposta}`} className="hover:underline">{b.eposta}</a>],
          ["Telefon", <a key="t" href={`tel:${b.telefon.replace(/[^\d+]/g, "")}`} className="tabular-nums hover:underline">{b.telefon}</a>],
          ["Vergi No", <span key="v" className="tabular-nums">{b.vergiNo}</span>],
        ].map(([etiket, deger]) => (
          <div key={etiket as string} className="flex justify-between gap-3">
            <dt className="text-muted">{etiket}</dt>
            <dd className="min-w-0 truncate text-right">{deger}</dd>
          </div>
        ))}
      </dl>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onPuan(Number(puanDegeri));
          setPuanTaslak(null);
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-bold">
          Uygunluk puanı (0–100)
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={puanDegeri}
            onChange={(e) => setPuanTaslak({ id: b.id, deger: e.target.value })}
            placeholder="Değerlendirmede verilir"
            className="min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium tabular-nums outline-none focus:border-ink"
          />
        </label>
        <button type="submit" disabled={!puanDegisti || puanDegeri === "" || bekliyor} className={IKINCIL_BTN}>Kaydet</button>
      </form>

      <SozlesmeKontrolleri
        basvuru={b}
        acikMadde={acikMadde}
        onAc={onMaddeAc}
        onKontrol={onKontrol}
        onKaydet={onSozlesme}
        cakisanlar={cakisanlar}
      />

      {b.gorusme && (
        <p className="flex items-start gap-2 rounded-control border border-line px-3 py-2.5 text-[13px]">
          <CalendarClock size={18} aria-hidden="true" className="mt-px shrink-0 text-info" />
          <span>
            <b>Görüşme: {gorusmeYaz(b.gorusme.tarih)}</b>
            {b.gorusme.not && <span className="block text-xs text-muted">{b.gorusme.not}</span>}
          </span>
        </p>
      )}

      {bildirim && (
        <p
          role={bildirim.tur === "hata" ? "alert" : "status"}
          className={`rounded-control px-3 py-2.5 text-[13px] font-semibold ${bildirim.tur === "hata" ? "bg-err-bg text-err" : "bg-ok-bg text-ok"}`}
        >
          {bildirim.metin}
          {bildirim.link?.onAc ? (
            <button type="button" onClick={bildirim.link.onAc} className="ml-1 cursor-pointer font-bold underline">{bildirim.link.ad}</button>
          ) : bildirim.link ? (
            <Link href={bildirim.link.href} className="ml-1 font-bold underline">{bildirim.link.ad}</Link>
          ) : null}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onGorusme} className={IKINCIL_BTN}>
          {b.gorusme ? "Görüşmeyi değiştir" : "Görüşme planla"}
        </button>
        <button
          type="button"
          onClick={() => {
            // Yazılan puan silinmez: hata olursa alanda kalır, başarılıysa kayıtlı puanla aynı olur
            onIlerlet(puanDegisti && puanDegeri !== "" ? Number(puanDegeri) : undefined);
          }}
          disabled={!sonraki || bekliyor}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control bg-ink px-3 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-default disabled:opacity-60"
        >
          {sonraki ? `Sonraki: ${ASAMA_BILGI[sonraki].ad}` : "Lansman tamam"}
        </button>
      </div>
    </aside>
  );
}
