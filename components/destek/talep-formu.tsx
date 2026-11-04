"use client";

// Yeni talep formu: müşteri, cihaz, kanal, konu, öncelik, dosya.
// Destek sayfasında ortada açılan pencerede, /destek/yeni adresinde ise tek başına gösterilir.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { KANALLAR, ONCELIKLER } from "@/lib/constants";
import { talepKaydet, type TalepFormDurumu } from "./actions";
import { KONULAR, type Talep } from "./queries";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI =
  "min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const IKINCIL_BTN = "inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]";

function Hata({ mesaj, id }: { mesaj?: string; id: string }) {
  if (!mesaj) return null;
  return <span id={id} className="text-xs font-semibold text-err">{mesaj}</span>;
}

export type TalepMusterisi = { id: string; ad: string; cihazlar: { seriNo: string; firmware: string }[] };

export default function TalepFormu({
  musteriler,
  sonrakiNo,
  onKaydedildi,
  onVazgec,
}: {
  musteriler: TalepMusterisi[];
  sonrakiNo: string;
  onKaydedildi?: (t: Talep) => void; // verilmezse kayıttan sonra /destek'e gider
  onVazgec?: () => void;
}) {
  const router = useRouter();
  const [durum, gonder, bekliyor] = useActionState<TalepFormDurumu, FormData>(talepKaydet, {});
  const [musteriId, setMusteriId] = useState("");
  const [dosya, setDosya] = useState<string | null>(null);
  const bildirildi = useRef<string | null>(null);
  const h = durum.hatalar ?? {};
  const pencerede = Boolean(onKaydedildi);
  const cihazlar = musteriler.find((m) => m.id === musteriId)?.cihazlar ?? [];

  useEffect(() => {
    const t = durum.talep;
    if (!t || bildirildi.current === t.id) return;
    bildirildi.current = t.id;
    if (onKaydedildi) onKaydedildi(t);
    else router.push(`/destek/${t.id}`);
  }, [durum.talep, onKaydedildi, router]);

  return (
    <form
      action={gonder}
      noValidate
      className={pencerede ? "flex flex-col gap-4" : "flex max-w-3xl flex-col gap-4 rounded-card border border-line bg-card p-5"}
    >
      <p className="text-xs font-semibold text-muted">Talep no otomatik verilir: #{sonrakiNo}</p>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className={ALAN}>
          Müşteri *
          <select
            name="musteriId"
            value={musteriId}
            onChange={(e) => setMusteriId(e.target.value)}
            autoFocus
            className={GIRDI}
            aria-invalid={!!h.musteriId}
            aria-describedby="hata-musteriId"
          >
            <option value="" disabled>Müşteri seçin…</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
          <Hata id="hata-musteriId" mesaj={h.musteriId} />
          <Link href="/musteriler" className="text-xs font-bold text-info hover:text-[#1A2A9E]">+ Yeni müşteri ekle</Link>
        </label>
        <label className={ALAN}>
          Cihaz (seri no)
          <select key={musteriId} name="seriNo" defaultValue={cihazlar[0]?.seriNo ?? ""} disabled={!musteriId} className={GIRDI}>
            {!musteriId && <option value="">Önce müşteri seçin</option>}
            {musteriId && cihazlar.length === 0 && <option value="">Kayıtlı cihaz yok</option>}
            {cihazlar.map((c) => <option key={c.seriNo} value={c.seriNo}>{c.seriNo} · {c.firmware}</option>)}
            {musteriId && cihazlar.length > 0 && <option value="">Cihaz belirtilmedi</option>}
          </select>
        </label>
        <label className={ALAN}>
          Talep nereden geldi? *
          <select name="kanal" defaultValue="Telefon" className={GIRDI} aria-invalid={!!h.kanal}>
            {KANALLAR.map((k) => <option key={k}>{k}</option>)}
          </select>
          <Hata id="hata-kanal" mesaj={h.kanal} />
        </label>
        <label className={ALAN}>
          Konu *
          <select name="konu" defaultValue="Bağlantı" className={GIRDI} aria-invalid={!!h.konu}>
            {KONULAR.map((k) => <option key={k}>{k}</option>)}
          </select>
          <Hata id="hata-konu" mesaj={h.konu} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold">Öncelik *</legend>
        <div className="flex flex-wrap gap-2">
          {ONCELIKLER.map((o) => (
            <label
              key={o}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-[#F4F5F0]"
            >
              <input type="radio" name="oncelik" value={o} defaultChecked={o === "Orta"} className="accent-[#0E0F0C]" />
              {o}
            </label>
          ))}
        </div>
        <Hata id="hata-oncelik" mesaj={h.oncelik} />
      </fieldset>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className={ALAN}>
          Kısa başlık *
          <input name="baslik" placeholder="Örn. Flash sonrası ECU yanıt vermiyor" className={GIRDI} aria-invalid={!!h.baslik} aria-describedby="hata-baslik" />
          <Hata id="hata-baslik" mesaj={h.baslik} />
        </label>
        <label className={ALAN}>
          Araç / sistem
          <input name="arac" placeholder="Örn. VW Golf 7 · kremayer EPS" className={GIRDI} />
        </label>
      </div>

      <label className={ALAN}>
        Sorunun açıklaması *
        <textarea
          name="aciklama"
          rows={5}
          placeholder="Müşterinin anlattığı sorun, araç modeli, denenen adımlar…"
          className={`${GIRDI} resize-y py-3`}
          aria-invalid={!!h.aciklama}
          aria-describedby="hata-aciklama"
        />
        <Hata id="hata-aciklama" mesaj={h.aciklama} />
      </label>

      <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[#C9CCC2] bg-[#FAFBF8] px-4 text-[13px] font-semibold text-[#474A42] hover:border-ink">
        <Paperclip size={18} aria-hidden="true" />
        <span className="truncate">{dosya ?? "Log dosyası veya fotoğraf ekleyin"}</span>
        <input type="file" name="dosya" className="sr-only" onChange={(e) => setDosya(e.target.files?.[0]?.name ?? null)} />
      </label>

      <div className={`flex justify-end gap-2 ${pencerede ? "sticky bottom-0 -mx-5 bg-card px-5 py-4" : ""}`}>
        {onVazgec ? (
          <button type="button" onClick={onVazgec} className={IKINCIL_BTN}>Vazgeç</button>
        ) : (
          <Link href="/destek" className={IKINCIL_BTN}>Vazgeç</Link>
        )}
        <button
          type="submit"
          disabled={bekliyor}
          className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          {bekliyor ? "Kaydediliyor…" : "Talebi kaydet"}
        </button>
      </div>
    </form>
  );
}
