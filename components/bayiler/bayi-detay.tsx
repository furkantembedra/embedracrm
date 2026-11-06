"use client";

// Aktif bayi detayı (ortada açılan pencere): dönem seçimi, sevk / satış / lisans özeti, çeyrek tablosu,
// bayinin müşterilerindeki lisanslar, hareket geçmişi ve üç işlem (cihaz sevk et, satış bildir, lisans sat).
import { useMemo, useState } from "react";
import { PackagePlus, ReceiptText, ShoppingCart } from "lucide-react";
import Chip from "@/components/ui/chip";
import { sayi } from "@/lib/format";
import { useBugun } from "@/lib/use-bugun";
import { URUN_BILGI } from "@/lib/urunler";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import { lisansIlerleme, tarihYaz as gunYaz } from "@/components/cihaz-lisans/ortak";
import { HAREKET_ADI, type AktifBayi, type Basvuru, type BayiHareketi } from "./queries";
import { bayiOzeti, buCeyrek, ceyregi, moqRengi, stokDurumu, stoktakiSeriler, type Donem } from "./ortak";
import { LisansSatisFormu, SatisFormu, SevkFormu } from "./bayi-hareket-formlari";
import type { HareketDurumu } from "./hareket-actions";

const ISLEM_BTN =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-card px-3 text-sm font-bold transition-colors hover:bg-[#F4F5F0] aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white";
const SEGMENT = (aktif: boolean) =>
  `min-h-9 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
    aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
  }`;
const HAREKET_TONU = { sevkiyat: "info", satis: "ok", lisans: "lime" } as const;

type Islem = "sevk" | "satis" | "lisans" | null;
type LisansFiltresi = "tumu" | "aktif" | "bitiyor" | "doldu" | "yok";

const isoGun = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function BayiDetay({
  bayi,
  basvuru,
  hareketler,
  cihazlar,
  musteriler,
  onKaydedildi,
}: {
  bayi: AktifBayi;
  basvuru: Basvuru | null; // iletişim ve sözleşme bilgisi
  hareketler: BayiHareketi[];
  cihazlar: Cihaz[]; // bu bayinin cihazları (stokta ve satılmış)
  musteriler: { id: string; ad: string }[];
  onKaydedildi: (d: HareketDurumu) => void;
}) {
  const bugun = useBugun();
  const simdi = bugun === null ? null : buCeyrek(bugun);
  const [secim, setSecim] = useState<Donem | null>(null);
  const donem: Donem = secim ?? (simdi ? { yil: simdi.yil, ceyrekler: [simdi.ceyrek] } : { yil: 2026, ceyrekler: [4] });
  const [islem, setIslem] = useState<Islem>(null);
  const [lisansFiltre, setLisansFiltre] = useState<LisansFiltresi>("tumu");

  const kendi = useMemo(() => hareketler.filter((h) => h.bayiId === bayi.id), [hareketler, bayi.id]);
  const yillar = useMemo(() => {
    const s = new Set(kendi.map((h) => ceyregi(h.tarih).yil));
    if (simdi) s.add(simdi.yil);
    return [...s].sort((a, b) => b - a);
  }, [kendi, simdi]);
  const ozet = bayiOzeti(bayi, hareketler, donem);
  const stokDurum = stokDurumu(ozet.stok.toplam);
  const tumYil = donem.ceyrekler.length === 4;

  const ceyrekSec = (c: number) => {
    const var_ = donem.ceyrekler.includes(c);
    const yeni = var_ ? donem.ceyrekler.filter((x) => x !== c) : [...donem.ceyrekler, c].sort();
    if (yeni.length) setSecim({ ...donem, ceyrekler: yeni }); // en az bir çeyrek seçili kalsın
  };
  const donemAdi = tumYil ? `${donem.yil} tüm yıl` : `${donem.yil} · ${donem.ceyrekler.map((c) => `Ç${c}`).join(", ")}`;

  // Bayinin müşterilerindeki lisanslar
  const lisansli = cihazlar
    .filter((c) => c.musteriId)
    .map((c) => {
      const i = lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun);
      const durum: Exclude<LisansFiltresi, "tumu"> = !c.lisansBitis ? "yok" : !i ? "aktif" : i.kalan < 0 ? "doldu" : i.kalan <= 30 ? "bitiyor" : "aktif";
      return { c, i, durum };
    });
  const lisansSayi = (f: LisansFiltresi) => (f === "tumu" ? lisansli.length : lisansli.filter((x) => x.durum === f).length);
  const LISANS_ETIKET: Record<Exclude<LisansFiltresi, "tumu">, { ad: string; ton: "ok" | "warn" | "err" | "gray" }> = {
    aktif: { ad: "Aktif", ton: "ok" },
    bitiyor: { ad: "30 gün içinde bitiyor", ton: "warn" },
    doldu: { ad: "Süresi doldu", ton: "err" },
    yok: { ad: "Lisanssız", ton: "gray" },
  };

  const kaydedildi = (d: HareketDurumu) => {
    onKaydedildi(d);
    setIslem(null);
    // Yeni hareket görünsün diye dönemi o tarihin çeyreğine al
    if (d.hareket && !donemde(d.hareket.tarih)) {
      const c = ceyregi(d.hareket.tarih);
      setSecim({ yil: c.yil, ceyrekler: [c.ceyrek] });
    }
  };
  const donemde = (tarih: string) => {
    const c = ceyregi(tarih);
    return c.yil === donem.yil && donem.ceyrekler.includes(c.ceyrek);
  };
  const bugunIso = bugun === null ? "" : isoGun(bugun);

  return (
    <div className="flex flex-col gap-5 pb-5">
      {/* Kim */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#474A42]">
        <span className="rounded-md bg-bg px-1.5 py-0.5 text-xs font-bold text-ink">{bayi.ulkeKodu}</span>
        {bayi.bolge}
        {basvuru && (
          <>
            <span aria-hidden="true">·</span>
            <span>{basvuru.yetkili}</span>
            <a href={`tel:${basvuru.telefon.replace(/[^\d+]/g, "")}`} className="tabular-nums hover:underline">{basvuru.telefon}</a>
            <a href={`mailto:${basvuru.eposta}`} className="hover:underline">{basvuru.eposta}</a>
          </>
        )}
      </div>

      {/* Dönem seçici */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`yil-${bayi.id}`}>Yıl</label>
        <select
          id={`yil-${bayi.id}`}
          value={donem.yil}
          onChange={(e) => setSecim({ ...donem, yil: Number(e.target.value) })}
          className="min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm font-bold"
        >
          {yillar.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div role="group" aria-label="Çeyrekler (birden fazla seçilebilir)" className="flex gap-1 rounded-control bg-bg p-1">
          {[1, 2, 3, 4].map((c) => (
            <button key={c} type="button" aria-pressed={donem.ceyrekler.includes(c) && !tumYil} onClick={() => (tumYil ? setSecim({ ...donem, ceyrekler: [c] }) : ceyrekSec(c))} className={SEGMENT(donem.ceyrekler.includes(c) && !tumYil)}>
              Ç{c}
            </button>
          ))}
          <button type="button" aria-pressed={tumYil} onClick={() => setSecim({ ...donem, ceyrekler: [1, 2, 3, 4] })} className={SEGMENT(tumYil)}>
            Tüm yıl
          </button>
        </div>
        {simdi && !(donem.yil === simdi.yil && donem.ceyrekler.length === 1 && donem.ceyrekler[0] === simdi.ceyrek) && (
          <button type="button" onClick={() => setSecim(null)} className="min-h-9 cursor-pointer px-2 text-xs font-bold text-info hover:underline">
            Bu çeyreğe dön
          </button>
        )}
      </div>

      {/* Özet */}
      <section aria-label={`${donemAdi} özeti`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { etiket: "Bayiye sevk", deger: ozet.sevk.toplam, alt: `${ozet.sevk.ONE} ONE · ${ozet.sevk["ONE Lite"]} LITE` },
          { etiket: "Müşteriye satış", deger: ozet.satis.toplam, alt: `${ozet.satis.ONE} ONE · ${ozet.satis["ONE Lite"]} LITE` },
          { etiket: "Lisans satışı", deger: ozet.lisans, alt: "cihaza lisans" },
          { etiket: "Stok (bugün)", deger: ozet.stok.toplam, alt: stokDurum.ad, ton: stokDurum.ton },
        ].map((k) => (
          <div key={k.etiket} className="flex flex-col gap-1 rounded-[14px] bg-[#F4F5F0] p-3">
            <span className="text-xs font-semibold text-muted">{k.etiket}</span>
            <b className="text-xl font-extrabold tabular-nums">{sayi(k.deger)}</b>
            {k.ton ? <Chip ton={k.ton} className="h-5 self-start px-2 text-[11px]">{k.alt}</Chip> : <span className="text-xs text-[#474A42]">{k.alt}</span>}
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="font-bold">Asgari alım hedefi (MOQ)</span>
          <span className="text-xs font-bold tabular-nums">
            %{ozet.moqYuzde} · {ozet.sevk.toplam}/{ozet.moqHedef} cihaz
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg" role="img" aria-label={`${donemAdi}: asgari alım hedefinin yüzde ${ozet.moqYuzde}'i`}>
          <div className={`h-full rounded-full ${moqRengi(ozet.moqYuzde)}`} style={{ width: `${ozet.moqYuzde}%` }} />
        </div>
        <span className="text-xs text-muted">
          Sözleşmeye göre bayi çeyrekte en az {bayi.moqHedef} cihaz almalı{donem.ceyrekler.length > 1 ? ` (seçili ${donem.ceyrekler.length} çeyrek: ${ozet.moqHedef})` : ""}.
        </span>
      </div>

      {/* Çeyrek tablosu */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <caption className="mb-1.5 text-left text-sm font-extrabold">{donem.yil} çeyrekleri</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-1.5 text-left font-semibold">Çeyrek</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Sevk</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Satış</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Lisans</th>
              <th scope="col" className="py-1.5 pl-3 text-left font-semibold">Hedef</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((c) => {
              const o = bayiOzeti(bayi, hareketler, { yil: donem.yil, ceyrekler: [c] });
              const secili = donem.ceyrekler.includes(c);
              const gelecek = simdi && (donem.yil > simdi.yil || (donem.yil === simdi.yil && c > simdi.ceyrek));
              return (
                <tr key={c} className={`border-t border-bg ${secili ? "bg-[#F3FBD6]" : ""}`}>
                  <th scope="row" className="py-2 text-left font-bold">Ç{c}</th>
                  <td className="py-2 text-right tabular-nums">{gelecek ? "—" : o.sevk.toplam}</td>
                  <td className="py-2 text-right tabular-nums">{gelecek ? "—" : o.satis.toplam}</td>
                  <td className="py-2 text-right tabular-nums">{gelecek ? "—" : o.lisans}</td>
                  <td className="py-2 pl-3">
                    {gelecek ? (
                      <span className="text-xs text-muted">Henüz başlamadı</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 rounded-full bg-bg" aria-hidden="true">
                          <span className={`block h-full rounded-full ${moqRengi(o.moqYuzde)}`} style={{ width: `${o.moqYuzde}%` }} />
                        </span>
                        <span className="text-xs font-bold tabular-nums">%{o.moqYuzde}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* İşlemler */}
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" aria-pressed={islem === "sevk"} onClick={() => setIslem(islem === "sevk" ? null : "sevk")} className={ISLEM_BTN}>
            <PackagePlus size={18} aria-hidden="true" />Cihaz sevk et
          </button>
          <button type="button" aria-pressed={islem === "satis"} onClick={() => setIslem(islem === "satis" ? null : "satis")} className={ISLEM_BTN}>
            <ShoppingCart size={18} aria-hidden="true" />Satış bildir
          </button>
          <button type="button" aria-pressed={islem === "lisans"} onClick={() => setIslem(islem === "lisans" ? null : "lisans")} className={ISLEM_BTN}>
            <ReceiptText size={18} aria-hidden="true" />Lisans sat
          </button>
        </div>
        {islem && (
          <div className="rounded-[14px] border border-ink bg-[#F8F9F5] p-4">
            <h3 className="mb-3 text-sm font-extrabold">
              {islem === "sevk" ? "Embedra'dan bayiye cihaz sevki" : islem === "satis" ? "Bayinin bildirdiği müşteri satışı" : "Bayinin müşterisine sattığı lisans"}
            </h3>
            {islem === "sevk" && <SevkFormu bayiId={bayi.id} bugun={bugunIso} onKaydedildi={kaydedildi} onVazgec={() => setIslem(null)} />}
            {islem === "satis" && (
              <SatisFormu
                bayiId={bayi.id}
                bugun={bugunIso}
                stokSerileri={stoktakiSeriler(bayi.id, hareketler)}
                stok={ozet.stok}
                musteriler={musteriler}
                onKaydedildi={kaydedildi}
                onVazgec={() => setIslem(null)}
              />
            )}
            {islem === "lisans" && <LisansSatisFormu bayiId={bayi.id} bugun={bugunIso} cihazlar={cihazlar} onKaydedildi={kaydedildi} onVazgec={() => setIslem(null)} />}
          </div>
        )}
      </section>

      {/* Lisanslar */}
      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-extrabold">Bayinin müşterilerindeki lisanslar</h3>
          <div role="group" aria-label="Lisans durumu" className="ml-auto flex flex-wrap gap-1 rounded-control bg-bg p-1">
            {(["tumu", "aktif", "bitiyor", "doldu", "yok"] as LisansFiltresi[]).map((f) => (
              <button key={f} type="button" aria-pressed={lisansFiltre === f} onClick={() => setLisansFiltre(f)} className={`${SEGMENT(lisansFiltre === f)} min-h-8 px-2.5 text-xs`}>
                {f === "tumu" ? "Tümü" : f === "bitiyor" ? "30 günde biten" : LISANS_ETIKET[f].ad} <span className="tabular-nums opacity-70">{lisansSayi(f)}</span>
              </button>
            ))}
          </div>
        </div>
        {lisansli.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line-strong p-4 text-center text-[13px] text-muted">
            Bu bayiden henüz seri numarasıyla bildirilmiş satış yok. Satış bildirildikçe cihazlar ve lisansları burada listelenir.
          </p>
        ) : (
          <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
            {lisansli
              .filter((x) => lisansFiltre === "tumu" || x.durum === lisansFiltre)
              .map(({ c, i, durum }) => (
                <li key={c.seriNo} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border border-line px-3 py-2 text-[13px]">
                  <span className="font-mono text-xs font-semibold">{c.seriNo}</span>
                  <span className="text-xs text-muted">{URUN_BILGI[c.model].ad}</span>
                  <b className="min-w-0 flex-1 truncate">{c.musteri}</b>
                  {c.lisansBitis && <span className="text-xs tabular-nums text-[#474A42]">{c.plan} · {gunYaz(c.lisansBitis)}{i ? ` · ${i.kalan < 0 ? `${-i.kalan} gün geçti` : `${i.kalan} gün`}` : ""}</span>}
                  <Chip ton={LISANS_ETIKET[durum].ton} className="h-5 px-2 text-[11px]">{LISANS_ETIKET[durum].ad}</Chip>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Hareketler */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold">
          Hareketler <span className="font-semibold text-muted">· {donemAdi} ({ozet.hareketler.length})</span>
        </h3>
        {ozet.hareketler.length === 0 ? (
          <p className="text-[13px] text-muted">Bu dönemde hareket yok.</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {ozet.hareketler.map((h) => {
              const one = h.kalemler.filter((k) => k.model === "ONE").length;
              const lite = h.kalemler.length - one;
              const seriler = h.kalemler.map((k) => k.seriNo).filter(Boolean) as string[];
              return (
                <li key={h.id} className="flex flex-col gap-1 rounded-[14px] border border-line px-3 py-2.5 text-[13px]">
                  <span className="flex flex-wrap items-center gap-2">
                    <Chip ton={HAREKET_TONU[h.tur]} className="h-5 px-2 text-[11px]">{HAREKET_ADI[h.tur]}</Chip>
                    <b className="tabular-nums">
                      {[one && `${one}× ONE`, lite && `${lite}× ONE LITE`].filter(Boolean).join(" + ")}
                      {h.tur === "lisans" && h.plan ? ` · ${h.plan} ${h.sureAy} ay` : ""}
                    </b>
                    {h.musteri && <span className="min-w-0 truncate text-[#474A42]">→ {h.musteri.ad}</span>}
                    <span className="ml-auto text-xs tabular-nums text-muted">{gunYaz(h.tarih)}</span>
                  </span>
                  {(seriler.length > 0 || h.not) && (
                    <span className="truncate font-mono text-[11px] text-muted" title={seriler.join(", ")}>
                      {h.not ? <span className="font-sans">{h.not}{seriler.length ? " · " : ""}</span> : null}
                      {seriler.slice(0, 4).join(", ")}{seriler.length > 4 ? ` +${seriler.length - 4}` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
