"use client";

// Bayi portalı › Destek: yeni talep formu ve bayinin talepleri (durum, Embedra yanıtları, mesaj yazma)
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Chip, { type ChipTon } from "@/components/ui/chip";
import { portalDestekAc, portalDestekMesaj } from "./destek-actions";
import type { PortalFormDurumu } from "./actions";
import type { DestekVerisi, PortalTalebi } from "./destek";
import { PORTAL_ALAN, PORTAL_GIRDI } from "./stil";

const TON: Record<PortalTalebi["durumKod"], ChipTon> = { yeni: "warn", islemde: "info", beklemede: "gray", cozuldu: "ok" };
const zamanYaz = (z: string) =>
  new Date(z).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function DestekGorunumu({ v }: { v: DestekVerisi }) {
  const router = useRouter();
  const [acik, setAcik] = useState<string | null>(v.talepler[0]?.id ?? null);
  const [sonuc, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(async (o, f) => {
    const r = await portalDestekAc(o, f);
    if (r.kayitId) setAcik(r.kayitId); // yeni talep listede açık gelir
    return r;
  }, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (sonuc.tamam) formRef.current?.reset();
  }, [sonuc]);

  const h = sonuc.hatalar ?? {};

  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* Yeni talep */}
      <form ref={formRef} action={gonder} className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 rounded-card border border-line bg-card p-5">
        <h2 className="text-[17px] font-extrabold">Yeni destek talebi</h2>
        <p className="text-[13px] text-muted">Yazılım, lisans, bağlantı ya da araç kapsamı soruları için. Arızalı cihaz için <a href="/portal/rma" className="font-bold text-info hover:underline">Arıza / RMA</a> açın.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={PORTAL_ALAN}>Konu
            <select name="konu" defaultValue="" aria-invalid={!!h.konu} className={PORTAL_GIRDI}>
              <option value="" disabled>Seçin…</option>
              {v.konular.map((k) => <option key={k}>{k}</option>)}
            </select>
            {h.konu && <span className="font-semibold text-err">{h.konu}</span>}
          </label>
          <label className={PORTAL_ALAN}>Öncelik
            <select name="oncelik" defaultValue="Orta" className={PORTAL_GIRDI}>
              {v.oncelikler.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
        </div>
        <label className={PORTAL_ALAN}>İlgili cihaz <span className="font-normal text-muted">(isteğe bağlı)</span>
          <select name="seriNo" defaultValue="" className={PORTAL_GIRDI}>
            <option value="">Cihaz seçilmedi</option>
            {v.cihazlar.map((c) => <option key={c.seriNo} value={c.seriNo}>{c.ad}</option>)}
          </select>
          {h.seriNo && <span className="font-semibold text-err">{h.seriNo}</span>}
        </label>
        <label className={PORTAL_ALAN}>Başlık
          <input name="baslik" maxLength={120} placeholder="Ör. Pro lisans aktivasyon kodu geçersiz" aria-invalid={!!h.baslik} className={PORTAL_GIRDI} />
          {h.baslik && <span className="font-semibold text-err">{h.baslik}</span>}
        </label>
        <label className={PORTAL_ALAN}>Açıklama
          <textarea name="aciklama" rows={4} maxLength={2000} placeholder="Ne oldu, hangi araçta, hangi adımda?" aria-invalid={!!h.aciklama}
            className={`${PORTAL_GIRDI} resize-y py-2`} />
          {h.aciklama && <span className="font-semibold text-err">{h.aciklama}</span>}
        </label>
        {sonuc.tamam && <p role="status" className="rounded-control bg-[#EEF7E0] px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{sonuc.tamam}</p>}
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer self-end rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
          {bekliyor ? "Gönderiliyor…" : "Talebi gönder"}
        </button>
      </form>

      {/* Talepler */}
      <section aria-label="Destek taleplerim" className="flex min-w-0 flex-[2_1_480px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[17px] font-extrabold">Taleplerim</h2>
          {v.ozet.acik > 0 && <Chip ton="info">{v.ozet.acik} açık</Chip>}
          {v.ozet.yanitBekleyen > 0 && <Chip ton="warn">{v.ozet.yanitBekleyen} yanıtınızı bekliyor</Chip>}
        </div>
        {v.talepler.length === 0 ? (
          <p className="rounded-card border border-line bg-card p-6 text-center text-sm text-muted">Henüz destek talebiniz yok.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {v.talepler.map((t) => (
              <li key={t.id} className="rounded-card border border-line bg-card">
                <button type="button" onClick={() => setAcik(acik === t.id ? null : t.id)} aria-expanded={acik === t.id}
                  className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left">
                  <b>#{t.id}</b>
                  <span className="min-w-0 flex-1 font-semibold">{t.baslik}</span>
                  <Chip ton={TON[t.durumKod]}>{t.durum}</Chip>
                  <span className="w-full text-xs text-muted">{t.konu} · {t.oncelik} öncelik · {zamanYaz(t.acilis)}{t.seriNo ? ` · ${t.seriNo}` : ""}</span>
                </button>
                {acik === t.id && <TalepAkisi t={t} onGonderildi={() => router.refresh()} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TalepAkisi({ t, onGonderildi }: { t: PortalTalebi; onGonderildi: () => void }) {
  const [metin, setMetin] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  return (
    <div className="flex flex-col gap-3 border-t border-bg px-4 pb-4 pt-3">
      <ol className="flex flex-col gap-2">
        {t.akis.map((a, i) => (
          <li key={i} className={`flex max-w-[85%] flex-col gap-0.5 rounded-[14px] px-3 py-2 text-[13px] ${a.kim === "bayi" ? "self-end bg-[#F4F5F0]" : "self-start border border-line"}`}>
            <span className="text-[11px] font-bold text-muted">{a.baslik} · {zamanYaz(a.zaman)}</span>
            {a.metin && <span className="whitespace-pre-line">{a.metin}</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <label htmlFor={`mesaj-${t.id}`} className="sr-only">Mesajınız</label>
        <textarea id={`mesaj-${t.id}`} rows={2} maxLength={2000} value={metin} onChange={(e) => setMetin(e.target.value)}
          placeholder={t.durumKod === "cozuldu" ? "Sorun devam ediyorsa yazın; talep yeniden açılır" : "Embedra destek ekibine mesaj"}
          className={`${PORTAL_GIRDI} resize-y py-2`} />
        {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
        <button type="button" disabled={bekliyor || metin.trim().length < 2}
          onClick={() => baslat(async () => {
            const r = await portalDestekMesaj(t.id, metin);
            if (r.hata) setHata(r.hata);
            else { setMetin(""); setHata(null); onGonderildi(); }
          })}
          className="min-h-10 cursor-pointer self-end rounded-control border border-ink px-4 text-[13px] font-bold hover:bg-[#F4F5F0] disabled:opacity-60">
          {bekliyor ? "Gönderiliyor…" : "Mesaj gönder"}
        </button>
      </div>
    </div>
  );
}
