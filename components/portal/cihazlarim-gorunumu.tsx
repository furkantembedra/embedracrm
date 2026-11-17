"use client";

// Bayi portalı "Cihazlarım": özet kartları (filtre), arama / model filtresi, stokta toplu satış bildirimi,
// müşteri cihazları tablosu (lisans, garanti, bağlantı), cihaz detay penceresi, müşteri bazlı görünüm, CSV.
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Chip from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { csvIndir } from "@/lib/disa-aktar";
import { portalDuzeltmeTalebi, portalTopluSatis, type PortalFormDurumu } from "./actions";
import type { MusteriCihazi, StokCihazi } from "./cihazlar";
import { PORTAL_GIRDI } from "./stil";
import YenilemeButonu from "./yenileme-butonu";
import { LisansSecici, MusteriSecici } from "./satis-bildir";
import type { MusteriSecenegi } from "./satis-ortak";

type Filtre = "hepsi" | "stok" | "musteride" | "bitiyor" | "serviste";
type Props = {
  bugun: string;
  stok: StokCihazi[];
  cihazlar: MusteriCihazi[];
  ozet: { stok: number; musteride: number; bitiyor: number; serviste: number };
  guncelFirmware: string;
  havuz: Record<string, number>; // bayinin lisans havuzu (paket → adet)
  seriBilinmeyen: number; // seri numarası kayıtsız stok adedi
  musteriSecenekleri: MusteriSecenegi[]; // satış formundaki müşteri seçimi (kayıtlı müşteriler + lead'ler)
};

const GUN = 86_400_000;
const tarihTr = (t: string | null) => (t ? new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const modelAdi = (m: string) => (m === "ONE Lite" ? "ONE LITE" : m);
const DURUM_TON = { aktif: "ok", bitiyor: "err", lisanssiz: "gray", stokta: "info" } as const;

function sonGorulmeYaz(iso: string | null, bugun: string) {
  if (!iso) return { metin: "Hiç bağlanmadı", eski: true };
  const gun = Math.round((Date.parse(bugun) - Date.parse(iso.slice(0, 10))) / GUN);
  return { metin: gun <= 0 ? "Bugün" : gun === 1 ? "Dün" : `${gun} gün önce`, eski: gun > 14 };
}

function LisansCubugu({ c }: { c: MusteriCihazi }) {
  if (c.lisansKalan === null || !c.lisansBaslangic || !c.lisansBitis) return <span className="text-xs text-muted">Lisanssız</span>;
  const toplam = Math.max(1, (Date.parse(c.lisansBitis) - Date.parse(c.lisansBaslangic)) / GUN);
  const oran = Math.max(0, Math.min(100, (c.lisansKalan / toplam) * 100));
  const renk = c.lisansKalan < 0 ? "bg-[#D93F3F]" : c.lisansKalan <= 30 ? "bg-[#E58A2B]" : "bg-[#1F8A4C]";
  return (
    <span className="flex min-w-[130px] flex-col gap-1">
      <span className="text-[13px]"><b>{c.plan}</b> · {tarihTr(c.lisansBitis)}</span>
      <span className="h-1.5 rounded-full bg-bg"><span className={`block h-1.5 rounded-full ${renk}`} style={{ width: `${c.lisansKalan < 0 ? 100 : oran}%` }} /></span>
      <span className={`text-[11px] font-semibold ${c.lisansKalan < 0 ? "text-[#D93F3F]" : c.lisansKalan <= 30 ? "text-[#B25A12]" : "text-muted"}`}>
        {c.lisansKalan < 0 ? `${-c.lisansKalan} gün önce doldu` : `${c.lisansKalan} gün kaldı`}
      </span>
    </span>
  );
}

export default function CihazlarimGorunumu({ bugun, stok, cihazlar, ozet, guncelFirmware, musteriSecenekleri, havuz, seriBilinmeyen }: Props) {
  const [sekme, setSekme] = useState<"cihazlar" | "musteriler">("cihazlar");
  const [filtre, setFiltre] = useState<Filtre>("hepsi");
  const [arama, setArama] = useState("");
  const [model, setModel] = useState("hepsi");
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [detay, setDetay] = useState<string | null>(null);

  // Toplu satış formu
  const [satis, satisGonder, satisBekliyor] = useActionState<PortalFormDurumu, FormData>(portalTopluSatis, {});
  const [, baslat] = useTransition();
  const router = useRouter();
  const son = useRef<number | undefined>(undefined);
  const satisRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (satis.tamam && satis.zaman !== son.current) {
      son.current = satis.zaman;
      setSecili(new Set());
      satisRef.current?.reset();
      router.refresh();
    }
  }, [satis, router]);

  const q = arama.trim().toLocaleLowerCase("tr");
  const uyar = (seri: string, m: string, musteri = "") =>
    (model === "hepsi" || m === model) && (!q || seri.toLocaleLowerCase("tr").includes(q) || musteri.toLocaleLowerCase("tr").includes(q));

  const stokListe = useMemo(() => stok.filter((s) => uyar(s.seriNo, s.model)), [stok, q, model]); // eslint-disable-line react-hooks/exhaustive-deps
  const cihazListe = useMemo(
    () =>
      cihazlar.filter((c) =>
        uyar(c.seriNo, c.model, c.musteri) &&
        (filtre === "bitiyor" ? c.lisansKalan !== null && c.lisansKalan <= 30 : filtre === "serviste" ? !!c.acikRma : true),
      ),
    [cihazlar, q, model, filtre], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const stokGoster = filtre === "hepsi" || filtre === "stok";
  const musteriGoster = filtre !== "stok";

  const musteriler = useMemo(() => {
    const m = new Map<string, MusteriCihazi[]>();
    for (const c of cihazlar) m.set(c.musteri, [...(m.get(c.musteri) ?? []), c]);
    return [...m.entries()]
      .map(([ad, liste]) => ({
        ad,
        adet: liste.length,
        aktif: liste.filter((c) => c.lisansKalan !== null && c.lisansKalan >= 0).length,
        bitiyor: liste.filter((c) => c.lisansKalan !== null && c.lisansKalan <= 30).length,
        enYakin: liste.map((c) => c.lisansBitis).filter(Boolean).sort()[0] ?? null,
        modeller: [...new Set(liste.map((c) => modelAdi(c.model)))].join(", "),
      }))
      .sort((a, b) => b.adet - a.adet);
  }, [cihazlar]);

  const disaAktar = () => {
    const satirlar: (string | number)[][] = [["Seri no", "Model", "Durum", "Müşteri", "Satış tarihi", "Lisans planı", "Lisans bitiş", "Garanti bitiş", "Firmware", "Son bağlantı", "Stokta (gün)"]];
    if (stokGoster) for (const s of stokListe) satirlar.push([s.seriNo, modelAdi(s.model), "Stokta", "", "", "", "", "", "", "", s.gun]);
    if (musteriGoster) for (const c of cihazListe) satirlar.push([c.seriNo, modelAdi(c.model), c.durum, c.musteri, c.satisTarihi ?? "", c.plan, c.lisansBitis ?? "", c.garantiBitis ?? "", c.firmware, c.sonGorulme?.slice(0, 10) ?? "", ""]);
    csvIndir(satirlar, `cihazlarim-${bugun}.csv`);
  };

  const secimDegistir = (seri: string) => setSecili((s) => { const y = new Set(s); if (y.has(seri)) y.delete(seri); else y.add(seri); return y; });
  const hepsiSecili = stokListe.length > 0 && stokListe.every((s) => secili.has(s.seriNo));
  const detayCihaz = cihazlar.find((c) => c.seriNo === detay) ?? null;

  const KARTLAR: { f: Filtre; ad: string; deger: number; renk?: string }[] = [
    { f: "stok", ad: "Stokta", deger: ozet.stok },
    { f: "musteride", ad: "Müşteride", deger: ozet.musteride },
    { f: "bitiyor", ad: "Lisansı 30 günde biten", deger: ozet.bitiyor, renk: ozet.bitiyor ? "text-[#B25A12]" : "" },
    { f: "serviste", ad: "Serviste (açık RMA)", deger: ozet.serviste },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Görünüm" className="flex gap-1 border-b border-line">
        {([["cihazlar", "Cihazlar"], ["musteriler", `Müşterilerim (${musteriler.length})`]] as const).map(([k, ad]) => (
          <button key={k} type="button" role="tab" aria-selected={sekme === k} onClick={() => setSekme(k)}
            className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-bold ${sekme === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {ad}
          </button>
        ))}
      </div>

      {sekme === "musteriler" ? (
        <section aria-label="Müşterilerim" className="rounded-card border border-line bg-card p-5">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2 pr-3">Müşteri</th><th className="py-2 pr-3 text-right">Cihaz</th><th className="py-2 pr-3">Model</th><th className="py-2 pr-3 text-right">Aktif lisans</th><th className="py-2 pr-3">En yakın bitiş</th><th className="py-2" /></tr></thead>
              <tbody>
                {musteriler.map((m) => (
                  <tr key={m.ad} className="border-b border-bg last:border-0">
                    <td className="py-2.5 pr-3 font-semibold">{m.ad}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{m.adet}</td>
                    <td className="py-2.5 pr-3 text-muted">{m.modeller}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{m.aktif}/{m.adet}</td>
                    <td className="py-2.5 pr-3">{tarihTr(m.enYakin)} {m.bitiyor > 0 && <Chip ton="warn">{m.bitiyor} bitiyor</Chip>}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => { setArama(m.ad); setFiltre("musteride"); setSekme("cihazlar"); }}
                        className="min-h-9 cursor-pointer rounded-control border border-line-strong px-3 text-xs font-bold hover:border-ink">Cihazları gör</button>
                    </td>
                  </tr>
                ))}
                {!musteriler.length && <tr><td colSpan={6} className="py-8 text-center text-muted">Henüz müşterinize satılmış cihaz yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          {/* Özet kartları: tıklayınca filtre */}
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            {KARTLAR.map((k) => (
              <button key={k.f} type="button" aria-pressed={filtre === k.f} onClick={() => setFiltre(filtre === k.f ? "hepsi" : k.f)}
                className={`flex cursor-pointer flex-col gap-1 rounded-card border bg-card p-4 text-left ${filtre === k.f ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink"}`}>
                <span className="text-xs font-semibold text-muted">{k.ad}</span>
                <b className={`text-2xl tabular-nums ${k.renk ?? ""}`}>{k.deger}</b>
              </button>
            ))}
          </div>

          {/* Araç çubuğu */}
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Seri no veya müşteri ara…" aria-label="Ara" className={`${PORTAL_GIRDI} w-full sm:w-72`} />
            <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model" className={PORTAL_GIRDI}>
              <option value="hepsi">Tüm modeller</option>
              <option value="ONE">ONE</option>
              <option value="ONE Lite">ONE LITE</option>
            </select>
            {(filtre !== "hepsi" || arama || model !== "hepsi") && (
              <button type="button" onClick={() => { setFiltre("hepsi"); setArama(""); setModel("hepsi"); }} className="min-h-11 cursor-pointer px-2 text-sm font-bold text-info hover:underline">Filtreyi temizle</button>
            )}
            <button type="button" onClick={disaAktar} className="ml-auto min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:border-ink">Excel&apos;e aktar (CSV)</button>
          </div>

          {/* Stok */}
          {stokGoster && (
            <section aria-label="Stoktaki cihazlar" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-extrabold">Stokta ({stokListe.length})</h2>
                <span className="text-xs text-muted">Sattığınız cihazları seçip tek seferde bildirin.</span>
                {seriBilinmeyen > 0 && (
                  <span className="w-full rounded-control bg-[#FFF6EA] px-3 py-2 text-xs font-semibold text-[#8A4A0E]">
                    Ayrıca {seriBilinmeyen} cihaz seri numarası kayıtlı olmadan stoğunuzda. Sattığınızda üstteki &quot;Satış bildir&quot; ile seri numarasını yazarak bildirin.
                  </span>
                )}
              </div>
              {stokListe.length ? (
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-bold text-muted">
                        <th className="w-10 py-2"><input type="checkbox" aria-label="Tümünü seç" checked={hepsiSecili} onChange={() => setSecili(hepsiSecili ? new Set() : new Set(stokListe.map((s) => s.seriNo)))} className="h-4 w-4 accent-[#0E0F0C]" /></th>
                        <th className="py-2 pr-3">Seri no</th><th className="py-2 pr-3">Model</th><th className="py-2 pr-3">Sevk tarihi</th><th className="py-2 text-right">Stokta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stokListe.map((s) => (
                        <tr key={s.seriNo} className={`border-b border-bg last:border-0 ${secili.has(s.seriNo) ? "bg-lime-bg" : ""}`}>
                          <td className="py-2"><input type="checkbox" aria-label={`${s.seriNo} seç`} checked={secili.has(s.seriNo)} onChange={() => secimDegistir(s.seriNo)} className="h-4 w-4 accent-[#0E0F0C]" /></td>
                          <td className="py-2 pr-3 font-mono text-xs font-semibold">{s.seriNo}</td>
                          <td className="py-2 pr-3">{modelAdi(s.model)}</td>
                          <td className="py-2 pr-3 text-muted">{tarihTr(s.sevk)}</td>
                          <td className={`py-2 text-right tabular-nums ${s.gun >= 60 ? "font-bold text-[#B25A12]" : ""}`}>{s.gun} gün</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">{stok.length ? "Filtreye uyan stok yok." : "Stokta seri numarası kayıtlı cihazınız yok."}</p>
              )}

              {secili.size > 0 && (
                <form ref={satisRef} aria-label="Satış bildir" className="flex flex-col gap-3 rounded-xl bg-[#F4F5F0] p-4"
                  onSubmit={(e) => { e.preventDefault(); baslat(() => satisGonder(new FormData(e.currentTarget))); }}>
                  <b className="text-sm">{secili.size} cihazı satıldı olarak bildir</b>
                  {[...secili].map((x) => <input key={x} type="hidden" name="seri" value={x} />)}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_170px_280px]">
                    <MusteriSecici musteriler={musteriSecenekleri} hata={satis.hatalar?.musteri} />
                    <label className="flex flex-col gap-1 text-xs font-bold">
                      Satış tarihi
                      <input name="tarih" type="date" defaultValue={bugun} max={bugun} className={PORTAL_GIRDI} />
                      {satis.hatalar?.tarih && <span className="text-xs text-err">{satis.hatalar.tarih}</span>}
                    </label>
                    <LisansSecici havuz={havuz} etiket="Lisans (12 ay)" />
                  </div>
                  {satis.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{satis.hata}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={satisBekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
                      {satisBekliyor ? "Gönderiliyor…" : `Satışı bildir (${secili.size})`}
                    </button>
                    <button type="button" onClick={() => setSecili(new Set())} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:border-ink">Vazgeç</button>
                  </div>
                </form>
              )}
              {satis.tamam && !secili.size && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{satis.tamam}</p>}
            </section>
          )}

          {/* Müşterideki cihazlar */}
          {musteriGoster && (
            <section aria-label="Müşterilerinizdeki cihazlar" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
              <h2 className="text-[17px] font-extrabold">Müşterilerinizdeki cihazlar ({cihazListe.length})</h2>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2 pr-3">Cihaz</th><th className="py-2 pr-3">Müşteri</th><th className="py-2 pr-3">Lisans</th><th className="py-2 pr-3">Garanti</th><th className="py-2 pr-3">Bağlantı</th><th className="py-2 text-right">İşlem</th></tr></thead>
                  <tbody>
                    {cihazListe.map((c) => {
                      const sg = sonGorulmeYaz(c.sonGorulme, bugun);
                      return (
                        <tr key={c.seriNo} className="border-b border-bg align-top last:border-0">
                          <td className="py-3 pr-3">
                            <button type="button" onClick={() => setDetay(c.seriNo)} className="cursor-pointer text-left hover:underline">
                              <span className="block font-mono text-xs font-semibold">{c.seriNo}</span>
                              <span className="text-muted">{modelAdi(c.model)}</span>
                            </button>
                            {c.acikRma && <span className="mt-1 block"><Chip ton="warn">Serviste · {c.acikRma}</Chip></span>}
                          </td>
                          <td className="py-3 pr-3">{c.musteri}<span className="block text-xs text-muted">Satış {tarihTr(c.satisTarihi)}</span></td>
                          <td className="py-3 pr-3"><LisansCubugu c={c} /></td>
                          <td className="py-3 pr-3">
                            <span className={c.garantide ? "font-semibold text-[#1F7A45]" : "text-muted"}>{c.garantide ? "Garantide" : "Garanti dışı"}</span>
                            <span className="block text-xs text-muted">{tarihTr(c.garantiBitis)}{c.uzatmaAy ? ` · +${c.uzatmaAy} ay uzatma` : ""}</span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={sg.eski ? "text-[#B25A12]" : ""}>{sg.metin}</span>
                            <span className="block text-xs text-muted">{c.firmware} {c.eskiFirmware && <span className="font-bold text-info">· güncelleme var</span>}</span>
                          </td>
                          <td className="py-3">
                            <span className="flex flex-col items-end gap-1.5">
                              {c.lisansKalan !== null && c.lisansKalan <= 60 && <YenilemeButonu seriNo={c.seriNo} gonderildi={c.talepVar} />}
                              <span className="flex gap-1.5">
                                <button type="button" onClick={() => setDetay(c.seriNo)} className="min-h-9 cursor-pointer rounded-control border border-line-strong px-3 text-xs font-bold hover:border-ink">Detay</button>
                                {!c.acikRma && <Link href={`/portal/rma?seri=${encodeURIComponent(c.seriNo)}`} className="flex min-h-9 items-center rounded-control border border-line-strong px-3 text-xs font-bold hover:border-ink">Arıza bildir</Link>}
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!cihazListe.length && <tr><td colSpan={6} className="py-8 text-center text-muted">{cihazlar.length ? "Filtreye uyan cihaz yok." : "Henüz kayıtlı satış yok."}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">Güncel firmware {guncelFirmware}.x · cihazlar ONESuite&apos;e bağlandıkça son bağlantı güncellenir.</p>
            </section>
          )}
        </>
      )}

      <Modal acik={!!detayCihaz} onKapat={() => setDetay(null)} baslik={detayCihaz ? `${detayCihaz.seriNo} · ${modelAdi(detayCihaz.model)}` : "Cihaz"} aciklama={detayCihaz?.musteri}>
        {detayCihaz && <CihazDetayi c={detayCihaz} bugun={bugun} />}
      </Modal>
    </div>
  );
}

function CihazDetayi({ c, bugun }: { c: MusteriCihazi; bugun: string }) {
  const [duzeltme, setDuzeltme] = useState("");
  const [sonuc, setSonuc] = useState<PortalFormDurumu>({});
  const [bekliyor, baslat] = useTransition();
  const sg = sonGorulmeYaz(c.sonGorulme, bugun);
  const BOLUM = "flex flex-col gap-2";
  const BASLIK = "text-[11px] font-bold tracking-[0.08em] text-muted";
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Durum", <Chip key="d" ton={DURUM_TON[c.durumKod]}>{c.durum}</Chip>],
          ["Satış tarihi", tarihTr(c.satisTarihi)],
          ["Garanti", `${c.garantide ? "Garantide" : "Garanti dışı"} · ${tarihTr(c.garantiBitis)}`],
          ["Son bağlantı", `${sg.metin} · ${c.firmware}`],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex flex-col gap-1 rounded-control bg-[#F4F5F0] p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="text-[13px] font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {c.lisansKalan !== null && <YenilemeButonu seriNo={c.seriNo} gonderildi={c.talepVar} />}
        {!c.acikRma && <Link href={`/portal/rma?seri=${encodeURIComponent(c.seriNo)}`} className="flex min-h-9 items-center rounded-control border border-line-strong px-3 text-xs font-bold hover:border-ink">Arıza bildir</Link>}
      </div>

      <section className={BOLUM}>
        <h3 className={BASLIK}>LİSANS GEÇMİŞİ</h3>
        {c.lisansGecmisi.length ? (
          <ul className="flex flex-col divide-y divide-bg text-sm">
            {c.lisansGecmisi.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5"><b>{l.plan}</b><span className="text-muted">{tarihTr(l.baslangic)} → {tarihTr(l.bitis)}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Lisans kaydı yok.</p>}
      </section>

      <section className={BOLUM}>
        <h3 className={BASLIK}>SERVİS (RMA) GEÇMİŞİ</h3>
        {c.rmalar.length ? (
          <ul className="flex flex-col divide-y divide-bg text-sm">
            {c.rmalar.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-3 py-1.5"><span><b>{r.id}</b> · {r.arizaTipi}</span><span className="text-muted">{tarihTr(r.acilis)} · {r.durum}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Servis kaydı yok.</p>}
      </section>

      {c.surumGecmisi.length > 0 && (
        <section className={BOLUM}>
          <h3 className={BASLIK}>FIRMWARE GEÇMİŞİ</h3>
          <ul className="flex flex-col divide-y divide-bg text-sm">
            {c.surumGecmisi.slice(0, 5).map((s, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5"><span>{s.eski} → <b>{s.yeni}</b></span><span className="text-muted">{tarihTr(s.zaman)}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${BOLUM} border-t border-line pt-4`}>
        <h3 className={BASLIK}>BİR YANLIŞLIK MI VAR?</h3>
        {c.duzeltmeler.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {c.duzeltmeler.map((d) => (
              <li key={d.id} className="flex flex-col gap-0.5 rounded-control bg-[#F4F5F0] p-2.5">
                <span className="flex items-center gap-2"><span className="text-xs text-muted">{tarihTr(d.tarih)}</span>{d.durum === "acik" ? <Chip ton="warn">Embedra inceliyor</Chip> : <Chip ton="ok">Çözüldü</Chip>}</span>
                <span>{d.metin}</span>
                {d.cozum && <span className="text-xs font-semibold text-[#3A4D00]">Embedra: {d.cozum}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Yanlış müşteriye bildirilen satış, hatalı tarih gibi düzeltmeler için Embedra ekibine yazın.</p>
        {sonuc.tamam ? (
          <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{sonuc.tamam}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={duzeltme} onChange={(e) => setDuzeltme(e.target.value)} maxLength={300} placeholder="Örn. Bu cihaz Servo Direct'e değil Auto Volan'a satıldı" aria-label="Düzeltme talebi" className={`${PORTAL_GIRDI} flex-1`} />
            <button type="button" disabled={bekliyor} onClick={() => baslat(async () => setSonuc(await portalDuzeltmeTalebi(c.seriNo, duzeltme)))}
              className="min-h-11 cursor-pointer rounded-control border border-ink px-4 text-sm font-bold hover:bg-[#F4F5F0] disabled:opacity-60">Gönder</button>
          </div>
        )}
        {sonuc.hata && <p role="alert" className="text-xs font-semibold text-err">{sonuc.hata}</p>}
      </section>
    </div>
  );
}
