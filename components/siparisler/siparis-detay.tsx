"use client";

// Sağ panel: adımlar, kutu içeriği, sevkiyat & fatura bilgisi, notlar ve sıradaki işlem düğmesi
import { useState } from "react";
import Link from "next/link";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import { LISANS_PAKETLERI, URUN_BILGI } from "@/lib/urunler";
import type { Siparis, StokKalemi } from "./queries";
import SiparisAdimlari from "./siparis-adimlari";
import { DURUM_ADI, DURUM_TONU, para, siradakiEylem, tarihEtiketi, type Eylem } from "./ortak";

const IKINCIL = "min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0] disabled:opacity-50";
const BIRINCIL = "min-h-11 cursor-pointer rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60";

function Satir({ ad, children }: { ad: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted">{ad}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

export default function SiparisDetay({
  siparis: s,
  stok,
  bekliyor,
  hata,
  onEylem,
  onFatura,
  onNot,
  onMusteriAc,
  onIade,
}: {
  siparis: Siparis | null;
  stok: StokKalemi[];
  bekliyor: boolean;
  hata: string | null;
  onEylem: (e: Eylem) => void;
  onFatura: () => void;
  onNot: (metin: string) => Promise<boolean>;
  onMusteriAc: (id: string) => void;
  onIade: () => void;
}) {
  const bugun = useBugun();
  const [notAcik, setNotAcik] = useState(false);
  const [notMetni, setNotMetni] = useState("");

  if (!s) {
    return (
      <aside aria-label="Sipariş detayı" className="flex w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-card border border-line bg-card p-8 text-center">
        <b className="text-sm">Sipariş seçilmedi</b>
        <span className="text-[13px] text-muted">Ayrıntıları görmek için listeden bir sipariş seçin.</span>
      </aside>
    );
  }

  const eylem = siradakiEylem(s);
  const kutu = s.kalemler.map((k) => {
    if (k.tur === "cihaz") return { ad: `EmbedraONE${k.model === "ONE Lite" ? " LITE" : ""} cihaz`, alt: `${URUN_BILGI[k.model].ekran} · batarya, USB-C, ana teşhis ve universal pin kablosu dahil`, adet: k.adet };
    if (k.tur === "lisans") {
      const kapsam = (LISANS_PAKETLERI as Record<string, { cihaz: number | null }>)[k.paket]?.cihaz;
      return { ad: "ONESuite lisansı", alt: `${k.paket} · ${k.sureAy} ay${kapsam ? ` · ${kapsam} cihaz kapsar` : ""}`, adet: k.adet };
    }
    const u = stok.find((x) => x.kod === k.stokKodu);
    return { ad: u?.ad ?? k.stokKodu, alt: `Aksesuar · ${k.stokKodu}`, adet: k.adet };
  });

  const notKaydet = async () => {
    if (await onNot(notMetni)) {
      setNotMetni("");
      setNotAcik(false);
    }
  };

  return (
    <aside aria-label="Sipariş detayı" className="flex w-full min-w-0 flex-col gap-5 rounded-card border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[13px] font-bold tabular-nums text-muted">#{s.id} · {tarihEtiketi(s.tarih, bugun)}</span>
          <h2 className="text-[19px] font-extrabold leading-snug">
            {s.musteriId ? (
              <button type="button" onClick={() => onMusteriAc(s.musteriId!)} className="cursor-pointer text-left hover:underline">{s.musteri}</button>
            ) : s.bayiId ? (
              <Link href={`/bayiler?bayi=${s.bayiId}`} className="hover:underline">{s.musteri}</Link>
            ) : (
              s.musteri
            )}
          </h2>
          <span className="text-[13px] text-muted">{s.adres}</span>
        </div>
        <Chip ton={DURUM_TONU[s.durum]}>{DURUM_ADI[s.durum]}</Chip>
      </div>

      <SiparisAdimlari siparis={s} />

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold">Kutu içeriği</h3>
        <div className="overflow-hidden rounded-[14px] border border-line">
          {kutu.map((k, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-bg px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[13px]">{k.ad}</b>
                <span className="text-xs text-muted">{k.alt}</span>
              </div>
              <span className="text-[13px] font-bold tabular-nums">{k.adet}×</span>
            </div>
          ))}
          <div className="flex justify-between bg-[#F8F9F5] px-3 py-3 text-sm">
            <b>Toplam <span className="text-xs font-semibold text-muted">KDV hariç</span></b>
            <b className="tabular-nums">{para(s.tutar, s.paraBirimi)}</b>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2 text-[13px]">
        <h3 className="mb-0.5 text-sm font-extrabold">Sevkiyat &amp; fatura</h3>
        <Satir ad="Kargo">{s.kargo ? <b>{s.kargo.firma}</b> : <span className="text-muted">{s.kalemler.every((k) => k.tur === "lisans") ? "Dijital teslimat" : "Henüz verilmedi"}</span>}</Satir>
        {s.kargo && <Satir ad="Takip no"><span className="font-mono text-xs font-semibold">{s.kargo.takipNo}</span></Satir>}
        <Satir ad="Fatura">
          {s.faturaNo ? (
            <span className="font-mono text-xs font-semibold">{s.faturaNo}</span>
          ) : (
            <button type="button" onClick={onFatura} disabled={bekliyor} className="cursor-pointer font-bold text-warn hover:underline">Kesilmedi · fatura no gir</button>
          )}
        </Satir>
        <Satir ad="Seri no">
          {s.seriNolar.length ? (
            <span className="flex flex-wrap justify-end gap-x-2 gap-y-0.5 font-mono text-xs font-semibold">
              {s.seriNolar.map((no) => (
                <Link key={no} href={`/cihaz-lisans/${no}`} className="hover:underline">{no}</Link>
              ))}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Satir>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-extrabold">Notlar</h3>
        <ol className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {[...s.notlar].reverse().map((n, i) => (
            <li key={i} className={`flex flex-col gap-0.5 rounded-control px-3 py-2 text-[13px] ${n.sistem ? "bg-[#F8F9F5]" : "border border-line"}`}>
              <span>{n.metin}</span>
              <span className="text-[11px] font-semibold text-muted">{tarihEtiketi(n.zaman, bugun)}{n.sistem ? " · sistem" : ""}</span>
            </li>
          ))}
        </ol>
        {notAcik && (
          <div className="flex flex-col gap-2">
            <label className="sr-only" htmlFor={`not-${s.id}`}>Not</label>
            <textarea
              id={`not-${s.id}`}
              autoFocus
              rows={2}
              maxLength={500}
              value={notMetni}
              onChange={(e) => setNotMetni(e.target.value)}
              placeholder="Ör. Müşteri teslimatı cuma istedi"
              className="w-full resize-y rounded-control border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNotAcik(false)} className={IKINCIL}>Vazgeç</button>
              <button type="button" onClick={notKaydet} disabled={!notMetni.trim() || bekliyor} className={BIRINCIL}>Notu ekle</button>
            </div>
          </div>
        )}
      </section>

      {hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{hata}</p>}

      <div className="grid grid-cols-2 gap-2">
        {!notAcik && <button type="button" onClick={() => setNotAcik(true)} className={IKINCIL}>Not ekle</button>}
        {eylem ? (
          <button type="button" onClick={() => onEylem(eylem.eylem)} disabled={bekliyor} className={`${BIRINCIL} ${notAcik ? "col-span-2" : ""}`}>
            {bekliyor ? "Kaydediliyor…" : eylem.ad}
          </button>
        ) : (
          <button type="button" onClick={onIade} className={`${IKINCIL} ${notAcik ? "col-span-2" : ""}`}>İade / değişim aç</button>
        )}
      </div>
    </aside>
  );
}
