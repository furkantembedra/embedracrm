"use client";

// Bayi portalı "Dokümanlar": solda bölümler, sağda içerik. Duyurular, sözleşme, fiyat listesi, ürün broşürleri,
// teknik dokümanlar, eğitim (tamamlama + sertifika), pazarlama içerikleri ve marka kiti. Üstte tüm dokümanlarda arama.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, Check, Copy, Download, Eye, FileText, Film, Image as ImageIcon, Megaphone, Palette, Receipt, ScrollText, Search, Wrench } from "lucide-react";
import Chip from "@/components/ui/chip";
import { boyutYaz, type BayiDokumani, type Duyuru } from "@/components/bayi-dokumanlar/ortak";
import type { Medya } from "@/components/pazarlama/queries";
import { portalDuyuruOkundu, portalEgitimTamamla } from "./dokuman-actions";
import { PORTAL_GIRDI } from "./stil";

type Dok = Omit<BayiDokumani, "hedef">;
type Props = {
  bugun: string;
  bayi: { ad: string; bolge: string };
  duyurular: (Duyuru & { okundu: boolean })[];
  dokumanlar: Dok[];
  tamamlanan: string[];
  sozlesme: null | {
    bolge: string; munhasir: boolean; yillik: number | null; indirim: number; destek: string[]; ilkSiparis: string; kitTarihi: string | null;
    baslangic: string | null; bitis: string | null; ceyrek: { hedef: number; gerceklesen: number; sonraki: number };
  };
  fiyat: { satirlar: { grup: string; ad: string; aciklama: string; liste: number; bayi: number; kdvli: boolean }[]; indirim: number; paraBirimi: "EUR" | "TRY"; kur: number; yurtDisi: boolean; kdv: number };
  pazarlama: { id: string; baslik: string; kanal: string; tarih: string; aciklama: string; hashtaglar: string[]; medya: Medya[] }[];
};
type Bolum = "duyurular" | "sozlesme" | "fiyat" | "brosur" | "teknik" | "egitim" | "pazarlama" | "marka";

const tarihTr = (t: string | null) => (t ? new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const KART = "rounded-card border border-line bg-card";
const BASLIK = "text-[17px] font-extrabold";
const BTN = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control px-3 text-xs font-bold";

export default function DokumanlarGorunumu(p: Props) {
  const okunmamis = p.duyurular.filter((d) => !d.okundu).length;
  const [bolum, setBolum] = useState<Bolum>(okunmamis ? "duyurular" : "sozlesme");
  const [arama, setArama] = useState("");
  const yeniMi = (t: string) => (Date.parse(p.bugun) - Date.parse(t.slice(0, 10))) / 86_400_000 <= 14;
  const kat = (k: string) => p.dokumanlar.filter((d) => d.kategori === k);
  const egitimler = kat("Eğitim");

  const BOLUMLER: { k: Bolum; ad: string; ikon: typeof FileText; sayi?: number; vurgu?: number }[] = [
    { k: "duyurular", ad: "Duyurular", ikon: Megaphone, sayi: p.duyurular.length, vurgu: okunmamis },
    { k: "sozlesme", ad: "Sözleşme", ikon: ScrollText, sayi: kat("Sözleşme ekleri").length + 1 },
    { k: "fiyat", ad: "Fiyat listesi", ikon: Receipt },
    { k: "brosur", ad: "Ürün broşürleri", ikon: BookOpen, sayi: kat("Ürün broşürleri").length },
    { k: "teknik", ad: "Teknik dokümanlar", ikon: Wrench, sayi: kat("Teknik dokümanlar").length },
    { k: "egitim", ad: "Eğitim", ikon: Award, sayi: egitimler.length },
    { k: "pazarlama", ad: "Pazarlama", ikon: ImageIcon, sayi: p.pazarlama.length + kat("Pazarlama").length },
    { k: "marka", ad: "Logo ve marka kiti", ikon: Palette },
  ];

  const q = arama.trim().toLocaleLowerCase("tr");
  const sonuclar = useMemo(() => (q ? p.dokumanlar.filter((d) => [d.baslik, d.aciklama, d.kategori].some((x) => x.toLocaleLowerCase("tr").includes(q))) : []), [p.dokumanlar, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Tüm dokümanlarda ara: kılavuz, broşür, firmware…" aria-label="Dokümanlarda ara" className={`${PORTAL_GIRDI} w-full pl-10`} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Doküman bölümleri" className={`${KART} flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible`}>
          {BOLUMLER.map(({ k, ad, ikon: Ikon, sayi, vurgu }) => (
            <button key={k} type="button" aria-current={!q && bolum === k ? "page" : undefined} onClick={() => { setBolum(k); setArama(""); }}
              className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-control px-3 text-left text-sm font-semibold ${!q && bolum === k ? "bg-ink text-white" : "hover:bg-bg"}`}>
              <Ikon size={16} aria-hidden="true" />
              <span className="flex-1">{ad}</span>
              {vurgu ? <span className="rounded-full bg-lime px-1.5 text-[11px] font-bold text-ink">{vurgu} yeni</span> : sayi !== undefined && <span className={`text-xs tabular-nums ${!q && bolum === k ? "text-[#C3C6BC]" : "text-muted"}`}>{sayi}</span>}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {q ? (
            <section className={`${KART} flex flex-col gap-3 p-5`}>
              <h2 className={BASLIK}>&quot;{arama}&quot; için {sonuclar.length} sonuç</h2>
              <DokumanListesi liste={sonuclar} yeniMi={yeniMi} kategoriGoster />
            </section>
          ) : bolum === "duyurular" ? (
            <Duyurular liste={p.duyurular} />
          ) : bolum === "sozlesme" ? (
            <Sozlesme s={p.sozlesme} ekler={kat("Sözleşme ekleri")} yeniMi={yeniMi} />
          ) : bolum === "fiyat" ? (
            <FiyatListesi f={p.fiyat} />
          ) : bolum === "brosur" ? (
            <section className={`${KART} flex flex-col gap-3 p-5`}><h2 className={BASLIK}>Ürün broşürleri</h2><DokumanListesi liste={kat("Ürün broşürleri")} yeniMi={yeniMi} /></section>
          ) : bolum === "teknik" ? (
            <section className={`${KART} flex flex-col gap-3 p-5`}><h2 className={BASLIK}>Teknik dokümanlar</h2><p className="text-[13px] text-muted">Kurulum ve kullanım kılavuzları, sık sorulan sorular, firmware sürüm notları, araç kapsam listesi.</p><DokumanListesi liste={kat("Teknik dokümanlar")} yeniMi={yeniMi} /></section>
          ) : bolum === "egitim" ? (
            <Egitim moduller={egitimler} tamamlanan={p.tamamlanan} bayi={p.bayi.ad} />
          ) : bolum === "pazarlama" ? (
            <Pazarlama icerikler={p.pazarlama} dosyalar={kat("Pazarlama")} yeniMi={yeniMi} />
          ) : (
            <MarkaKiti bayi={p.bayi.ad} />
          )}
        </div>
      </div>
    </div>
  );
}

function TurIkonu({ tur }: { tur: Dok["tur"] }) {
  const Ikon = tur === "video" ? Film : tur === "gorsel" ? ImageIcon : FileText;
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tur === "pdf" ? "bg-[#FDECEC] text-[#C0392B]" : tur === "video" ? "bg-[#EEF2FF] text-[#3346C9]" : "bg-[#EAF7EF] text-[#1F7A45]"}`}>
      <Ikon size={20} aria-hidden="true" />
    </span>
  );
}

function DokumanListesi({ liste, yeniMi, kategoriGoster = false }: { liste: Dok[]; yeniMi: (t: string) => boolean; kategoriGoster?: boolean }) {
  if (!liste.length) return <p className="py-6 text-center text-sm text-muted">Bu bölümde doküman yok.</p>;
  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {liste.map((d) => (
        <li key={d.id} className="flex gap-3 rounded-xl border border-line p-3.5">
          <TurIkonu tur={d.tur} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-1.5"><b className="text-sm leading-snug">{d.baslik}</b>{yeniMi(d.tarih) && <Chip ton="lime">Yeni</Chip>}</span>
            {d.aciklama && <span className="text-[13px] text-[#474A42]">{d.aciklama}</span>}
            <span className="text-xs text-muted">{[kategoriGoster ? d.kategori : "", d.tur.toUpperCase(), boyutYaz(d.boyut), tarihTr(d.tarih)].filter(Boolean).join(" · ")}</span>
            <span className="mt-1 flex flex-wrap gap-1.5">
              <a href={`/api/bayi-dokuman/${d.id}`} target="_blank" rel="noreferrer" className={`${BTN} border border-line-strong hover:border-ink`}><Eye size={14} aria-hidden="true" />Önizle</a>
              <a href={`/api/bayi-dokuman/${d.id}?indir=1`} className={`${BTN} bg-ink text-white hover:bg-ink-soft`}><Download size={14} aria-hidden="true" />İndir</a>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Duyurular({ liste }: { liste: Props["duyurular"] }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  return (
    <section className="flex flex-col gap-3">
      <h2 className={BASLIK}>Embedra&apos;dan duyurular</h2>
      {liste.map((d) => (
        <article key={d.id} className={`flex flex-col gap-2 rounded-card border p-5 ${d.okundu ? "border-line bg-card" : d.onem === "onemli" ? "border-[#F2C894] bg-[#FFF6EA]" : "border-ink bg-card"}`}>
          <div className="flex flex-wrap items-center gap-2">
            {!d.okundu && <span className="h-2.5 w-2.5 rounded-full bg-[#2F4BFF]" aria-label="Okunmadı" />}
            <b className="text-base">{d.baslik}</b>
            {d.onem === "onemli" && <Chip ton="warn">Önemli</Chip>}
            <span className="ml-auto text-xs text-muted">{tarihTr(d.tarih)}</span>
          </div>
          <p className="whitespace-pre-line text-sm text-[#474A42]">{d.metin}</p>
          {!d.okundu && (
            <button type="button" disabled={bekliyor} onClick={() => baslat(async () => { await portalDuyuruOkundu(d.id); router.refresh(); })} className={`${BTN} w-fit border border-line-strong bg-card hover:border-ink disabled:opacity-60`}>
              <Check size={14} aria-hidden="true" />Okundu işaretle
            </button>
          )}
        </article>
      ))}
      {!liste.length && <p className={`${KART} p-8 text-center text-sm text-muted`}>Duyuru yok.</p>}
    </section>
  );
}

function Sozlesme({ s, ekler, yeniMi }: { s: Props["sozlesme"]; ekler: Dok[]; yeniMi: (t: string) => boolean }) {
  if (!s) return <p className={`${KART} p-8 text-center text-sm text-muted`}>Sözleşme bilgisi bulunamadı.</p>;
  const y = s.ceyrek.hedef ? Math.min(100, Math.round((s.ceyrek.gerceklesen / s.ceyrek.hedef) * 100)) : 0;
  return (
    <>
      <section className={`${KART} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={BASLIK}>Bayilik sözleşmesi</h2>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <a href="/api/bayi-dokuman/sozlesme" target="_blank" rel="noreferrer" className={`${BTN} border border-line-strong hover:border-ink`}><Eye size={14} aria-hidden="true" />Önizle</a>
            {/* API yanıtı (PDF indirme), sayfa değil: Link gerekmez */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/bayi-dokuman/sozlesme?indir=1" className={`${BTN} bg-ink text-white hover:bg-ink-soft`}><Download size={14} aria-hidden="true" />Sözleşme özeti (PDF)</a>
          </span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Bölge", `${s.bolge}${s.munhasir ? " · münhasır" : ""}`],
            ["Sözleşme süresi", `${tarihTr(s.baslangic)} → ${tarihTr(s.bitis)}`],
            ["Bayi iskontosu", `%${s.indirim}`],
            ["Yıllık hedef", s.yillik ? `${s.yillik} cihaz` : "—"],
            ["İlk sipariş", s.ilkSiparis],
            ["Marka kiti teslimi", tarihTr(s.kitTarihi)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 rounded-control bg-[#F4F5F0] p-3"><dt className="text-xs text-muted">{k}</dt><dd className="text-sm font-semibold">{v}</dd></div>
          ))}
        </dl>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">BAYİNİN DESTEK KAPSAMI</span>
          <span className="flex flex-wrap gap-1.5">{s.destek.length ? s.destek.map((d) => <Chip key={d} ton="gray">{d}</Chip>) : <span className="text-sm text-muted">—</span>}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <b>Bu çeyrek hedef (MOQ)</b>
            <span className="tabular-nums">{s.ceyrek.gerceklesen} / {s.ceyrek.hedef} cihaz · %{y}</span>
          </div>
          <span className="h-2.5 rounded-full bg-bg"><span className={`block h-2.5 rounded-full ${y >= 80 ? "bg-[#1F8A4C]" : y >= 50 ? "bg-[#E58A2B]" : "bg-[#D93F3F]"}`} style={{ width: `${y}%` }} /></span>
          <span className="text-xs text-muted">Gelecek çeyrek hedefi: <b className="text-ink">{s.ceyrek.sonraki} cihaz</b>{s.yillik ? ` (yıllık ${s.yillik} cihazın dörtte biri)` : ""}</span>
        </div>
      </section>
      <section className={`${KART} flex flex-col gap-3 p-5`}>
        <h2 className={BASLIK}>Sözleşme ekleri</h2>
        <DokumanListesi liste={ekler} yeniMi={yeniMi} />
      </section>
    </>
  );
}

function FiyatListesi({ f }: { f: Props["fiyat"] }) {
  const para = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: f.paraBirimi, maximumFractionDigits: 0 }).format(n);
  const gruplar = [...new Set(f.satirlar.map((s) => s.grup))];
  return (
    <section className={`${KART} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={BASLIK}>Bayi fiyat listesi</h2>
        <a href="/portal/dokumanlar/fiyat-listesi" target="_blank" rel="noreferrer" className={`${BTN} ml-auto bg-ink text-white hover:bg-ink-soft`}><Download size={14} aria-hidden="true" />Yazdır / PDF</a>
      </div>
      <p className="text-[13px] text-muted">
        Fiyatlar {f.paraBirimi}, KDV hariç{f.yurtDisi ? ` · 1 € = ${f.kur} TL · ihracat, Embedra faturasında KDV yok` : ` · cihaz ve aksesuara %${Math.round(f.kdv * 100)} KDV eklenir`}. Bayi iskontonuz %{f.indirim}.
      </p>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2 pr-3">Ürün</th><th className="whitespace-nowrap py-2 pr-3 text-right">Liste</th><th className="whitespace-nowrap py-2 pr-3 text-right">Sizin fiyatınız</th><th className="whitespace-nowrap py-2 text-right">Önerilen satış</th></tr></thead>
          {gruplar.map((g) => (
            <tbody key={g}>
              <tr><td colSpan={4} className="pb-1 pt-4 text-[11px] font-bold tracking-[0.08em] text-muted">{g.toLocaleUpperCase("tr")}</td></tr>
              {f.satirlar.filter((s) => s.grup === g).map((s) => (
                <tr key={s.ad} className="border-b border-bg">
                  <td className="py-2 pr-3"><b>{s.ad}</b><span className="block text-xs text-muted">{s.aciklama}</span></td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-muted">{para(s.liste)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right font-extrabold tabular-nums">{para(s.bayi)}</td>
                  <td className="whitespace-nowrap py-2 text-right tabular-nums">{para(s.liste)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-xs text-muted">Önerilen satış fiyatı Embedra liste fiyatıdır; müşteriye satış fiyatınızı siz belirlersiniz. Sipariş vermek için Sipariş ver sayfasını kullanın.</p>
    </section>
  );
}

function Egitim({ moduller, tamamlanan, bayi }: { moduller: Dok[]; tamamlanan: string[]; bayi: string }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const biten = moduller.filter((m) => tamamlanan.includes(m.id)).length;
  const sertifika = moduller.length > 0 && biten === moduller.length;
  const y = moduller.length ? Math.round((biten / moduller.length) * 100) : 0;
  return (
    <>
      <section className={`flex flex-col gap-3 rounded-card p-5 ${sertifika ? "bg-ink text-white" : `${KART}`}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${sertifika ? "bg-lime text-ink" : "bg-bg text-[#474A42]"}`}><Award size={24} aria-hidden="true" /></span>
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="text-base">{sertifika ? "Sertifikalı Embedra bayisi" : "Bayi sertifika programı"}</b>
            <span className={`text-[13px] ${sertifika ? "text-[#C3C6BC]" : "text-muted"}`}>
              {sertifika ? `${bayi} tüm eğitim modüllerini tamamladı.` : `${moduller.length} modülü tamamlayınca "Sertifikalı bayi" rozeti alırsınız.`}
            </span>
          </div>
          <b className="text-2xl tabular-nums">{biten}/{moduller.length}</b>
        </div>
        <span className={`h-2.5 rounded-full ${sertifika ? "bg-[#23251F]" : "bg-bg"}`}><span className="block h-2.5 rounded-full bg-lime" style={{ width: `${y}%` }} /></span>
      </section>
      <section className={`${KART} flex flex-col gap-3 p-5`}>
        <h2 className={BASLIK}>Eğitim modülleri</h2>
        <ol className="flex flex-col gap-2.5">
          {moduller.map((m) => {
            const tamam = tamamlanan.includes(m.id);
            return (
              <li key={m.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${tamam ? "border-[#B9DFC6] bg-[#EEF8F1]" : "border-line"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tamam ? "bg-[#1F8A4C] text-white" : "bg-bg text-muted"}`}>{tamam ? <Check size={18} aria-hidden="true" /> : <BookOpen size={16} aria-hidden="true" />}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <b className="text-sm">{m.baslik}</b>
                  <span className="text-xs text-muted">{m.aciklama}{m.sure ? ` · ${m.sure}` : ""}</span>
                </div>
                <span className="flex gap-1.5">
                  <a href={`/api/bayi-dokuman/${m.id}`} target="_blank" rel="noreferrer" className={`${BTN} border border-line-strong bg-card hover:border-ink`}><Eye size={14} aria-hidden="true" />Aç</a>
                  <button type="button" disabled={bekliyor} onClick={() => baslat(async () => { await portalEgitimTamamla(m.id, !tamam); router.refresh(); })}
                    className={`${BTN} disabled:opacity-60 ${tamam ? "border border-line-strong bg-card hover:border-ink" : "bg-ink text-white hover:bg-ink-soft"}`}>
                    {tamam ? "Geri al" : "Tamamladım"}
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function Pazarlama({ icerikler, dosyalar, yeniMi }: { icerikler: Props["pazarlama"]; dosyalar: Dok[]; yeniMi: (t: string) => boolean }) {
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const kopyala = async (id: string, metin: string) => { try { await navigator.clipboard.writeText(metin); setKopyalanan(id); setTimeout(() => setKopyalanan(null), 2000); } catch { /* izin yoksa sessiz */ } };
  return (
    <>
      <section className={`${KART} flex flex-col gap-3 p-5`}>
        <h2 className={BASLIK}>Sosyal medya ve kampanya içerikleri</h2>
        <p className="text-[13px] text-muted">Embedra&apos;nın sizinle paylaştığı hazır paylaşımlar. Metni kopyalayıp görseli indirerek kendi hesaplarınızda kullanın.</p>
        <ul className="grid gap-3 xl:grid-cols-2">
          {icerikler.map((i) => {
            const ilk = i.medya[0];
            const metin = [i.aciklama, i.hashtaglar.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");
            return (
              <li key={i.id} className="flex flex-col overflow-hidden rounded-xl border border-line">
                <div className="flex aspect-[16/9] items-center justify-center bg-[#F4F5F0]">
                  {ilk?.tur === "gorsel" ? <img src={`/api/medya/${ilk.id}`} alt={i.baslik} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                    : ilk?.tur === "video" ? <video src={`/api/medya/${ilk.id}`} controls preload="metadata" className="h-full w-full object-cover" />
                    : <span className="flex flex-col items-center gap-1 text-muted"><ImageIcon size={28} aria-hidden="true" /><span className="text-xs">Görsel yok</span></span>}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">{i.kanal} · {tarihTr(i.tarih)}{yeniMi(i.tarih) && <Chip ton="lime">Yeni</Chip>}</span>
                  <b className="text-sm">{i.baslik}</b>
                  {metin && <p className="line-clamp-3 whitespace-pre-line text-[13px] text-[#474A42]">{metin}</p>}
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
                    {metin && <button type="button" onClick={() => kopyala(i.id, metin)} className={`${BTN} border border-line-strong hover:border-ink`}><Copy size={14} aria-hidden="true" />{kopyalanan === i.id ? "Kopyalandı ✓" : "Metni kopyala"}</button>}
                    {i.medya.map((m) => <a key={m.id} href={`/api/medya/${m.id}?indir=1`} className={`${BTN} bg-ink text-white hover:bg-ink-soft`}><Download size={14} aria-hidden="true" />{m.tur === "video" ? "Video" : "Görsel"}</a>)}
                  </span>
                </div>
              </li>
            );
          })}
          {!icerikler.length && <li className="py-6 text-center text-sm text-muted">Henüz paylaşılan içerik yok.</li>}
        </ul>
      </section>
      {dosyalar.length > 0 && (
        <section className={`${KART} flex flex-col gap-3 p-5`}><h2 className={BASLIK}>Pazarlama dosyaları</h2><DokumanListesi liste={dosyalar} yeniMi={yeniMi} /></section>
      )}
    </>
  );
}

/* ---------- Marka kiti: logolar, renkler, "Yetkili Embedra bayisi" rozeti (SVG, tarayıcıda üretilir) ---------- */

const RENKLER = [
  { ad: "Embedra siyah", hex: "#0E0F0C" },
  { ad: "Embedra sarı", hex: "#FBE222" },
  { ad: "Zemin", hex: "#EEEFEA" },
  { ad: "Vurgu mavi", hex: "#2F4BFF" },
];
const kacis = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const logoSvg = (koyu: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="96" viewBox="0 0 360 96"><rect width="360" height="96" fill="${koyu ? "#0E0F0C" : "#FFFFFF"}"/><rect x="20" y="20" width="56" height="56" rx="16" fill="#FBE222"/><text x="48" y="61" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="800" fill="#0E0F0C">e</text><text x="92" y="62" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="800" letter-spacing="-1" fill="${koyu ? "#FFFFFF" : "#0E0F0C"}">embedra</text></svg>`;
const rozetSvg = (bayi: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120"><rect x="2" y="2" width="416" height="116" rx="22" fill="#0E0F0C" stroke="#FBE222" stroke-width="4"/><rect x="22" y="28" width="64" height="64" rx="18" fill="#FBE222"/><text x="54" y="73" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="800" fill="#0E0F0C">e</text><text x="104" y="52" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#FBE222">YETKİLİ EMBEDRA BAYİSİ</text><text x="104" y="84" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF">${kacis(bayi)}</text></svg>`;

function svgIndir(svg: string, ad: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = ad;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MarkaKiti({ bayi }: { bayi: string }) {
  const [kopya, setKopya] = useState<string | null>(null);
  const ogeler = [
    { ad: "Logo · açık zemin", svg: logoSvg(false), dosya: "embedra-logo-acik.svg" },
    { ad: "Logo · koyu zemin", svg: logoSvg(true), dosya: "embedra-logo-koyu.svg" },
    { ad: "Yetkili bayi rozeti", svg: rozetSvg(bayi), dosya: "yetkili-embedra-bayisi.svg" },
  ];
  return (
    <>
      <section className={`${KART} flex flex-col gap-3 p-5`}>
        <h2 className={BASLIK}>Logo ve rozet</h2>
        <p className="text-[13px] text-muted">Vektör (SVG) dosyalar; her boyutta net çıkar. Kullanım kurallarını Sözleşme › Marka kullanım kılavuzu&apos;nda bulabilirsiniz.</p>
        <ul className="grid gap-3 xl:grid-cols-3">
          {ogeler.map((o) => (
            <li key={o.dosya} className="flex flex-col overflow-hidden rounded-xl border border-line">
              <div className="flex h-36 items-center justify-center bg-[repeating-conic-gradient(#F4F5F0_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-4"
                dangerouslySetInnerHTML={{ __html: o.svg.replace("<svg ", '<svg style="max-width:100%;height:auto" ') }} />
              <div className="flex items-center gap-2 p-3">
                <b className="flex-1 text-sm">{o.ad}</b>
                <button type="button" onClick={() => svgIndir(o.svg, o.dosya)} className={`${BTN} bg-ink text-white hover:bg-ink-soft`}><Download size={14} aria-hidden="true" />SVG</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${KART} flex flex-col gap-3 p-5`}>
        <h2 className={BASLIK}>Renkler</h2>
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {RENKLER.map((r) => (
            <li key={r.hex}>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(r.hex); setKopya(r.hex); setTimeout(() => setKopya(null), 1500); } catch { /* sessiz */ } }}
                className="flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-line text-left hover:border-ink">
                <span className="h-16" style={{ background: r.hex }} />
                <span className="flex flex-col p-2.5"><b className="text-[13px]">{r.ad}</b><span className="font-mono text-xs text-muted">{kopya === r.hex ? "Kopyalandı ✓" : r.hex}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Yazı tipi: Helvetica / Arial, kalın başlıklar. Logoyu esnetmeyin, renklerini değiştirmeyin.</p>
      </section>
    </>
  );
}
