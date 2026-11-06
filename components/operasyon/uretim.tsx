"use client";

// Üretim & tedarik sekmesinin bölümleri: üretim partileri, bileşen stoğu, tedarik siparişleri ve seri no havuzu
import { useState } from "react";
import { ChevronDown, Factory, Package, Plus, Trash2, Truck } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useBugun } from "@/lib/use-bugun";
import { CIHAZ_MODELLERI, URUN_BILGI } from "@/lib/urunler";
import { type BilesenKalemi, type HavuzSeri, type IcUretimEmri, type Recete, type TedarikSiparisi, type UretimPartisi } from "./queries";
import { IC_URETIM_ADI, IC_URETIM_TONU, PARTI_ADI, PARTI_EYLEMI, PARTI_TONU, TEDARIK_ADI, TEDARIK_TONU, gunKaldi, icUretimDurumu, tarihKisa } from "./ortak";

const KART = "flex w-full min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5";
const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3 align-middle";
const KUCUK_BTN = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-card px-3 text-[13px] font-bold hover:bg-[#F4F5F0]";
const EYLEM_BTN = "min-h-9 cursor-pointer whitespace-nowrap rounded-control bg-ink px-3 text-xs font-bold text-white hover:bg-ink-soft disabled:opacity-60";

function Baslik({ id, baslik, alt, children }: { id: string; baslik: string; alt: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="text-[17px] font-extrabold">{baslik}</h2>
        <span className="text-xs font-semibold text-muted">{alt}</span>
      </div>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </div>
  );
}

/* ---------- Özet ---------- */

export function UretimOzeti({ partiler, tedarik, havuz, bilesenler, icUretim, bugun }: { partiler: UretimPartisi[]; tedarik: TedarikSiparisi[]; havuz: HavuzSeri[]; bilesenler: BilesenKalemi[]; icUretim: IcUretimEmri[]; bugun: string }) {
  const toplam = (d: UretimPartisi["durum"]) => partiler.filter((p) => p.durum === d).reduce((t, p) => t + p.adet, 0);
  const kritik = bilesenler.filter((b) => b.adet <= b.kritik).length;
  const tamirde = partiler.reduce((t, p) => t + (p.tamirde ?? 0), 0);
  const acikEmirler = icUretim.map((e) => icUretimDurumu(e, bugun)).filter((d) => d.hal !== "tamam");
  const geride = acikEmirler.filter((d) => d.hal === "geride" || d.hal === "gecikti").length;
  const kartlar = [
    { etiket: "Üretimde", deger: toplam("uretimde"), alt: `${toplam("planlandi")} cihaz planlandı` },
    { etiket: "Kalite kontrolde", deger: toplam("kalite"), alt: tamirde ? `${tamirde} cihaz tamirde` : "Depoya alınmayı bekliyor", uyari: tamirde > 0 },
    { etiket: "Seri no havuzu", deger: havuz.length, alt: CIHAZ_MODELLERI.map((m) => `${havuz.filter((h) => h.model === m).length} ${URUN_BILGI[m].ad}`).join(" · ") },
    {
      etiket: "İç üretim", deger: acikEmirler.reduce((t, d) => t + d.kalan, 0),
      alt: acikEmirler.length ? `${acikEmirler.length} açık emirde kalan adet${geride ? ` · ${geride} geride` : ""}` : "Açık iç üretim emri yok", uyari: geride > 0,
    },
    { etiket: "Açık tedarik", deger: tedarik.filter((t) => t.durum !== "teslim").length, alt: kritik ? `${kritik} bileşen kritik seviyede` : "Bileşen stoğu yeterli", uyari: kritik > 0 },
  ];
  return (
    <section aria-label="Üretim özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kartlar.map((k) => (
        <div key={k.etiket} className="flex flex-col gap-1.5 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">{k.etiket}</span>
          <b className="text-2xl font-extrabold tabular-nums">{k.deger}</b>
          <span className={`text-xs ${k.uyari ? "font-bold text-warn" : "text-muted"}`}>{k.alt}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------- Üretim partileri ---------- */

export function UretimPartileri({
  partiler,
  bekliyor,
  onPlanla,
  onEylem,
}: {
  partiler: UretimPartisi[];
  bekliyor: boolean;
  onPlanla: () => void;
  onEylem: (p: UretimPartisi) => void;
}) {
  const bugun = useBugun();
  return (
    <section aria-labelledby="up-baslik" className={`${KART} p-0`}>
      <div className="p-5 pb-0">
        <Baslik id="up-baslik" baslik="Üretim partileri" alt="Planlandı → Üretimde (bileşen düşer) → Kalite kontrol → Depoda (stoğa ve seri no havuzuna girer)">
          <button type="button" onClick={onPlanla} className={KUCUK_BTN}>
            <Plus size={16} aria-hidden="true" />
            Parti planla
          </button>
        </Baslik>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-5`}>Parti</th>
              <th scope="col" className={TH}>Model</th>
              <th scope="col" className={`${TH} text-right`}>Adet</th>
              <th scope="col" className={TH}>Hedef</th>
              <th scope="col" className={TH}>Durum</th>
              <th scope="col" className={`${TH} pr-5 text-right`}><span className="sr-only">İşlem</span></th>
            </tr>
          </thead>
          <tbody>
            {partiler.map((p) => {
              const kalan = p.durum === "depoda" ? null : gunKaldi(p.hedefTarih, bugun);
              const eylem = p.durum === "depoda" && p.tamirde ? "Tamir sonucu" : PARTI_EYLEMI[p.durum];
              return (
                <tr key={p.id}>
                  <td className={`${TD} pl-5`}>
                    <div className="flex flex-col gap-0.5">
                      <b className="whitespace-nowrap tabular-nums">{p.id}</b>
                      {p.not && <span className="max-w-[220px] text-xs text-muted">{p.not}</span>}
                    </div>
                  </td>
                  <td className={TD}><Chip ton={p.model === "ONE" ? "ink" : "gray"}>{URUN_BILGI[p.model].ad}</Chip></td>
                  <td className={`${TD} text-right tabular-nums`}>
                    <b>{p.adet}</b>
                    {p.saglam !== null && <span className="block whitespace-nowrap text-xs text-muted">{p.saglam} sağlam{p.hatali ? ` · ${p.hatali} hatalı` : ""}</span>}
                    {!!p.hatali && <HataliAkibeti p={p} />}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {tarihKisa(p.hedefTarih)}
                    {kalan !== null && <span className={`block text-xs ${kalan < 0 ? "font-bold text-err" : "text-muted"}`}>{kalan < 0 ? `${-kalan} gün gecikti` : kalan === 0 ? "Bugün" : `${kalan} gün kaldı`}</span>}
                  </td>
                  <td className={TD}><Chip ton={PARTI_TONU[p.durum]}>{PARTI_ADI[p.durum]}</Chip></td>
                  <td className={`${TD} pr-5 text-right`}>
                    {eylem && (
                      <button type="button" disabled={bekliyor} onClick={() => onEylem(p)} className={EYLEM_BTN}>
                        {eylem}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {partiler.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted">Henüz üretim partisi yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Hatalı cihazların akıbeti: tamirde / onarıldı / söküldü / hurda */
function HataliAkibeti({ p }: { p: UretimPartisi }) {
  const parcalar = [
    p.tamirde && <b key="t" className="text-warn">{p.tamirde} tamirde</b>,
    p.onarilan && `${p.onarilan} onarıldı`,
    p.sokulen && `${p.sokulen} söküldü`,
    p.hurda && `${p.hurda} hurda`,
  ].filter(Boolean);
  if (!parcalar.length) return null;
  const geri = Object.entries(p.geriAlinan ?? {}).reduce((t, [, n]) => t + n, 0);
  return (
    <span className="block whitespace-nowrap text-[11px] text-muted" title={geri ? `Sökülen cihazlardan ${geri} parça stoğa döndü: ${Object.entries(p.geriAlinan ?? {}).map(([k, n]) => `${k} ×${n}`).join(", ")}` : undefined}>
      {parcalar.map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)}
    </span>
  );
}

/* ---------- Bileşen stoğu ---------- */

export function BilesenStoku({ bilesenler, partiler, recete, onTedarik, onIcUretim }: { bilesenler: BilesenKalemi[]; partiler: UretimPartisi[]; recete: Recete; onTedarik: () => void; onIcUretim: () => void }) {
  // Planlanan partilerin henüz düşmemiş bileşen ihtiyacı
  const ihtiyac = new Map<string, number>();
  for (const p of partiler) if (p.durum === "planlandi") for (const kod of recete[p.model]) ihtiyac.set(kod, (ihtiyac.get(kod) ?? 0) + p.adet);
  const kullanan = (kod: string) => CIHAZ_MODELLERI.filter((m) => recete[m].includes(kod)).map((m) => URUN_BILGI[m].ad);
  return (
    <section aria-labelledby="bs-baslik-op" className={KART}>
      <Baslik id="bs-baslik-op" baslik="Bileşen stoğu" alt="Planlanan partilerin ihtiyacı parantezde" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onTedarik} className={KUCUK_BTN}>
          <Truck size={16} aria-hidden="true" />
          Tedarik siparişi
        </button>
        <button type="button" onClick={onIcUretim} className={KUCUK_BTN}>
          <Factory size={16} aria-hidden="true" />
          İç üretim emri
        </button>
      </div>
      <ul className="flex flex-col gap-3">
        {bilesenler.map((b) => {
          const gerek = ihtiyac.get(b.kod) ?? 0;
          const kritik = b.adet <= b.kritik;
          return (
            <li key={b.kod} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,140px)_auto] items-center gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <b className="truncate text-[13px]">{b.ad}</b>
                <span className="truncate text-xs text-muted">
                  <span className={b.kaynak === "ic" ? "font-bold text-[#5B7A0E]" : ""}>{b.kaynak === "ic" ? "İç üretim" : "Dış tedarik"}</span>
                  {" · "}{b.kod}{kullanan(b.kod).length ? ` · ${kullanan(b.kod).join(", ")}` : " · reçetede değil"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-bg" role="img" aria-label={`${b.ad}: ${b.adet} adet, hedef ${b.hedef}`}>
                <div className={`h-full rounded-full ${kritik ? "bg-[#D93F3F]" : "bg-[#B6DD2E]"}`} style={{ width: `${Math.min(100, Math.round((b.adet / b.hedef) * 100))}%` }} />
              </div>
              <span className="flex flex-col items-end">
                <b className={`text-[13px] tabular-nums ${kritik ? "text-err" : ""}`}>{b.adet} adet</b>
                {gerek > 0 && <span className={`text-[11px] font-semibold tabular-nums ${gerek > b.adet ? "text-err" : "text-muted"}`}>({gerek} gerekli{gerek > b.adet ? " · yetmez" : ""})</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Tedarik siparişleri ---------- */

export function TedarikListesi({ tedarik, bekliyor, onYolda, onTeslim }: { tedarik: TedarikSiparisi[]; bekliyor: boolean; onYolda: (id: string) => void; onTeslim: (id: string) => void }) {
  const bugun = useBugun();
  const sirali = [...tedarik].sort((a, b) => Number(a.durum === "teslim") - Number(b.durum === "teslim"));
  return (
    <section aria-labelledby="td-baslik" className={KART}>
      <Baslik id="td-baslik" baslik="Tedarik siparişleri" alt="Dış tedarik · Sipariş verildi → Yola çıktı → Teslim alındı (bileşen stoğuna, kablolar sipariş deposuna girer)" />
      <ul className="flex flex-col gap-2">
        {sirali.map((t) => {
          const kalan = t.durum === "teslim" ? null : gunKaldi(t.beklenen, bugun);
          return (
            <li key={t.id} className={`flex flex-wrap items-center gap-3 rounded-[14px] border border-line p-3 ${t.durum === "teslim" ? "opacity-70" : ""}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[13px]">{t.adet}× {t.kalemAdi}</b>
                <span className="text-xs text-muted">
                  #{t.id} · {t.tedarikci} · beklenen {tarihKisa(t.beklenen)}
                  {kalan !== null && kalan < 0 && <b className="text-err"> · {-kalan} gün gecikti</b>}
                </span>
              </div>
              <Chip ton={TEDARIK_TONU[t.durum]}>{TEDARIK_ADI[t.durum]}</Chip>
              {t.durum === "siparis" && <button type="button" disabled={bekliyor} onClick={() => onYolda(t.id)} className={KUCUK_BTN}>Yola çıktı</button>}
              {t.durum !== "teslim" && (
                <button
                  type="button" disabled={bekliyor || t.durum !== "yolda"} onClick={() => onTeslim(t.id)}
                  title={t.durum === "yolda" ? undefined : "Önce “Yola çıktı” olarak işaretleyin"}
                  className={`${EYLEM_BTN} disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  Teslim al
                </button>
              )}
            </li>
          );
        })}
        {tedarik.length === 0 && <li className="py-6 text-center text-[13px] text-muted">Tedarik siparişi yok.</li>}
      </ul>
    </section>
  );
}

/* ---------- İç üretim ---------- */

export function IcUretimListesi({
  emirler,
  bugun,
  bekliyor,
  onYeni,
  onGiris,
  onSil,
}: {
  emirler: IcUretimEmri[];
  bugun: string;
  bekliyor: boolean;
  onYeni: () => void;
  onGiris: (id: string) => void;
  onSil: (emirId: string, girisId: string) => void;
}) {
  const [acik, setAcik] = useState<string | null>(null);
  const satirlar = emirler.map((e) => ({ e, d: icUretimDurumu(e, bugun) })).sort((a, b) => Number(a.d.hal === "tamam") - Number(b.d.hal === "tamam"));
  return (
    <section aria-labelledby="iu-baslik" className={KART}>
      <Baslik id="iu-baslik" baslik="İç üretim" alt="Atölyede ürettiğimiz bileşenler · personel her gün sonunda ürettiğini girer, adet bileşen stoğuna eklenir">
        <button type="button" onClick={onYeni} className={KUCUK_BTN}>
          <Plus size={16} aria-hidden="true" />
          Emir aç
        </button>
      </Baslik>
      <ul className="flex flex-col gap-3">
        {satirlar.map(({ e, d }) => {
          const yuzde = Math.min(100, Math.round((d.uretilen / e.hedef) * 100));
          const beklenenYuzde = Math.min(100, Math.round((d.beklenen / e.hedef) * 100));
          const tamam = d.hal === "tamam";
          return (
            <li key={e.id} className={`flex flex-col gap-3 rounded-[14px] border border-line p-3.5 ${tamam ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[13px]">{e.hedef}× {e.kalemAdi}</b>
                  <span className="text-xs text-muted">
                    #{e.id} · {tarihKisa(e.baslangic)} – {tarihKisa(d.bitis)} · {e.gun} gün · günde ~{d.gunlukHedef}{e.not ? ` · ${e.not}` : ""}
                  </span>
                </div>
                <Chip ton={IC_URETIM_TONU[d.hal]}>
                  {IC_URETIM_ADI[d.hal]}{d.hal === "geride" ? ` · ${-d.fark} adet` : ""}
                </Chip>
              </div>

              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Üretilen", `${d.uretilen}`, `/ ${e.hedef}`],
                  ["Kalan adet", `${d.kalan}`, ""],
                  ["Kalan gün", tamam ? "—" : d.hal === "gecikti" ? "0" : `${d.kalanGun}`, tamam ? "" : d.hal === "bekliyor" ? "başlamadı" : d.bugunGirildi ? "bugün girildi" : "bugün dahil"],
                  ["Günlük gereken", tamam ? "—" : `${d.gereken}`, tamam ? "" : d.gereken > d.gunlukHedef ? `plan ${d.gunlukHedef}` : "planda"],
                ].map(([ad, deger, alt]) => (
                  <div key={ad} className="flex flex-col rounded-control bg-[#F8F9F5] px-3 py-2">
                    <dt className="text-[11px] font-semibold text-muted">{ad}</dt>
                    <dd className="text-lg font-extrabold tabular-nums">
                      {deger}
                      {alt && <span className="ml-1 text-[11px] font-semibold text-muted">{alt}</span>}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="relative h-2 rounded-full bg-bg" role="img" aria-label={`${d.uretilen} / ${e.hedef} üretildi, bugüne kadar beklenen ${d.beklenen}`}>
                <div className={`h-full rounded-full ${d.hal === "geride" || d.hal === "gecikti" ? "bg-[#E0A11B]" : "bg-[#B6DD2E]"}`} style={{ width: `${yuzde}%` }} />
                {!tamam && d.beklenen > 0 && <span aria-hidden="true" title={`Bugüne kadar beklenen: ${d.beklenen}`} className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${beklenenYuzde}%` }} />}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button" aria-expanded={acik === e.id} onClick={() => setAcik(acik === e.id ? null : e.id)}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control px-2 text-xs font-bold text-[#474A42] hover:bg-bg"
                >
                  <ChevronDown size={15} aria-hidden="true" className={`transition-transform ${acik === e.id ? "rotate-180" : ""}`} />
                  Günlük girişler ({e.girisler.length})
                </button>
                {!tamam && (
                  <button type="button" disabled={bekliyor || d.hal === "bekliyor"} onClick={() => onGiris(e.id)} className={`${EYLEM_BTN} ml-auto disabled:cursor-not-allowed`}>
                    Gün sonu girişi
                  </button>
                )}
              </div>

              {acik === e.id && (
                <ul className="flex flex-col divide-y divide-bg rounded-control border border-line text-[13px]">
                  {[...e.girisler].reverse().map((g) => (
                    <li key={g.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-14 shrink-0 text-xs font-semibold text-muted">{tarihKisa(g.tarih)}</span>
                      <span className="min-w-0 flex-1">
                        <b className="tabular-nums">{g.adet} adet</b> · {g.personel}
                        {g.not && <span className="block truncate text-xs text-muted">{g.not}</span>}
                      </span>
                      <button
                        type="button" disabled={bekliyor} onClick={() => onSil(e.id, g.id)}
                        aria-label={`${tarihKisa(g.tarih)} tarihli ${g.adet} adetlik girişi sil`} title="Girişi sil (adet stoktan düşer)"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-err-bg hover:text-err"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                  {e.girisler.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted">Henüz giriş yok.</li>}
                </ul>
              )}
            </li>
          );
        })}
        {emirler.length === 0 && <li className="py-6 text-center text-[13px] text-muted">Açık iç üretim emri yok.</li>}
      </ul>
    </section>
  );
}

/* ---------- Seri no havuzu ---------- */

export function SeriHavuzu({ havuz }: { havuz: HavuzSeri[] }) {
  return (
    <section aria-labelledby="sh-baslik" className={KART}>
      <Baslik id="sh-baslik" baslik="Seri no havuzu" alt="Üretilip depoya alınan, henüz siparişe atanmamış cihazlar · Sipariş › Seri no ata › Havuzdan doldur" />
      {CIHAZ_MODELLERI.map((m) => {
        const liste = havuz.filter((h) => h.model === m);
        return (
          <div key={m} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <Package size={15} aria-hidden="true" className="text-muted" />
              {URUN_BILGI[m].ad} <span className="font-semibold text-muted tabular-nums">{liste.length} hazır</span>
            </span>
            {liste.length ? (
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {liste.map((h) => (
                  <span key={h.seriNo} title={`Parti ${h.partiId}`} className="rounded-md bg-[#F4F5F0] px-2 py-1 font-mono text-[11px] font-semibold">{h.seriNo}</span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted">Havuzda {URUN_BILGI[m].ad} yok; parti depoya alınınca eklenir.</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
