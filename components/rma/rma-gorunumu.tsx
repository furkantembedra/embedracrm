"use client";

// Garanti & RMA sayfası. Diğer modüllerle aynı düzen: tıklanınca filtreleyen özet kartları,
// solda aranabilir liste, ortada kayıt detayı, sağda cihaz / garanti / sahip paneli; altta analiz.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { csvIndir } from "@/lib/disa-aktar";
import { useBugun } from "@/lib/use-bugun";
import { garantiSuresiKaydet, seriSorgula, type RmaIslemSonucu } from "./actions";
import type { GarantiBilgisi } from "./garanti";
import { ADIM_ADI, ARIZA_TIPLERI, HEDEF_GUN, KARAR_ADI, type RmaKaydi, type RmaKarari } from "./queries";
import { acikMi, adimEtiketi, adimTonu, gunSay, kapsamda, tarihYaz } from "./ortak";
import RmaFormu, { GarantiKarti } from "./rma-formu";
import RmaDetay from "./rma-detay";

type Kart = "talep" | "inceleme" | "karar" | "gonderim" | "tamamlandi" | "geciken" | "ucret";
type Durum = "acik" | "kapali" | "tumu";

const ucretBekliyor = (r: RmaKaydi) => !kapsamda(r) && !!r.ucret && !r.ucretOdendi;
const KART_FILTRE: Record<Kart, (r: RmaKaydi, bugun: string) => boolean> = {
  talep: (r) => r.adim === "talep",
  inceleme: (r) => r.adim === "teslim_alindi" || r.adim === "inceleme",
  karar: (r) => r.adim === "karar",
  gonderim: (r) => r.adim === "tamamlandi" && r.karar !== "iade",
  tamamlandi: (r) => !acikMi(r),
  geciken: (r, b) => acikMi(r) && !!b && gunSay(r.acilis, b) > HEDEF_GUN,
  ucret: (r) => acikMi(r) && ucretBekliyor(r),
};

function Dagilim({ baslik, veri }: { baslik: string; veri: { ad: string; n: number }[] }) {
  const en = Math.max(1, ...veri.map((x) => x.n));
  return (
    <section aria-label={baslik} className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 rounded-card border border-line bg-card p-4">
      <h3 className="text-[15px] font-extrabold">{baslik}</h3>
      {veri.length ? (
        <ul className="flex flex-col gap-1.5">
          {veri.map((x) => (
            <li key={x.ad} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-2 text-xs">
              <span className="truncate font-semibold" title={x.ad}>{x.ad}</span>
              <span className="h-2 rounded-full bg-bg"><span className="block h-2 rounded-full bg-ink" style={{ width: `${(x.n / en) * 100}%` }} /></span>
              <b className="tabular-nums">{x.n}</b>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted">Veri yok.</p>}
    </section>
  );
}

function BilgiPaneli({ r }: { r: RmaKaydi }) {
  const [bilgi, setBilgi] = useState<{ seri: string; b: GarantiBilgisi | null } | null>(null);
  useEffect(() => {
    let iptal = false;
    seriSorgula(r.seriNo).then((s) => !iptal && setBilgi({ seri: r.seriNo, b: "hata" in s ? null : s }));
    return () => void (iptal = true);
  }, [r.seriNo, r.adim]);
  const b = bilgi?.seri === r.seriNo ? bilgi.b : undefined;
  return (
    <aside aria-label="Cihaz ve garanti" className="flex w-full flex-col gap-4 rounded-card border border-line bg-card p-5">
      <h2 className="text-[15px] font-extrabold">Cihaz ve garanti</h2>
      {b === undefined ? <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-bg motion-reduce:animate-none" /> : b ? <GarantiKarti b={b} /> : <p className="text-sm text-muted">Cihaz kaydı bulunamadı.</p>}
      <div className="flex flex-col gap-1.5 text-[13px]">
        <Link href={`/cihaz-lisans/${r.seriNo}`} className="font-bold text-info hover:underline">Cihaz kaydını aç →</Link>
        {r.yeniSeri && <Link href={`/cihaz-lisans/${r.yeniSeri}`} className="font-bold text-info hover:underline">Verilen cihaz {r.yeniSeri} →</Link>}
        {r.sahip.tur === "musteri" && r.sahip.id && <Link href={`/musteriler/${r.sahip.id}`} className="font-bold text-info hover:underline">Müşteri: {r.sahip.ad} →</Link>}
        {r.sahip.tur === "bayi" && <Link href="/bayiler" className="font-bold text-info hover:underline">Bayi: {r.sahip.ad} →</Link>}
        {b?.siparisId && <Link href={`/siparisler/${b.siparisId}`} className="font-bold text-info hover:underline">Satış siparişi #{b.siparisId} →</Link>}
      </div>
      {b && b.rmalar.filter((x) => x.id !== r.id).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <b className="text-[13px]">Bu cihazın diğer servis kayıtları</b>
          <ul className="flex flex-col gap-1 text-xs">
            {b.rmalar.filter((x) => x.id !== r.id).map((x) => (
              <li key={x.id} className="flex justify-between gap-2"><span className="font-bold">{x.id}</span><span className="text-muted">{tarihYaz(x.acilis)} · {x.arizaTipi}</span></li>
            ))}
          </ul>
          <p className="text-xs font-semibold text-warn">Tekrarlayan arıza: değişim kararını değerlendirin.</p>
        </div>
      )}
    </aside>
  );
}

export default function RmaGorunumu(p: {
  rmalar: RmaKaydi[];
  garantiAy: number;
  bilesenler: { kod: string; ad: string; adet: number }[];
  havuz: { seriNo: string; model: string }[];
  talepler: { id: string; baslik: string; seriNo: string | null; musteri: string }[];
  kargoFirmalari: string[];
}) {
  const router = useRouter();
  const bugunMs = useBugun();
  const bugun = bugunMs === null ? "" : new Date(bugunMs + 12 * 3_600_000).toISOString().slice(0, 10);
  const [rmalar, setRmalar] = useState(p.rmalar);
  const [kart, setKart] = useState<Kart | null>(null);
  const [durum, setDurum] = useState<Durum>("acik");
  const [arama, setArama] = useState("");
  const [tip, setTip] = useState("");
  const [garanti, setGaranti] = useState<"" | "kapsamda" | "disi">("");
  const istenen = useSearchParams().get("kayit");
  const [secili, setSecili] = useState<string | null>(istenen ?? p.rmalar.find(acikMi)?.id ?? null);
  const [yeni, setYeni] = useState<string | null>(null);
  const [sorgu, setSorgu] = useState("");
  const [sonuc, setSonuc] = useState<GarantiBilgisi | { hata: string } | null>(null);
  const [garantiAy, setGarantiAy] = useState(p.garantiAy);
  const [sorgulaniyor, baslat] = useTransition();
  const kapatYeni = useCallback(() => setYeni(null), []);

  const eklendi = useCallback((r: RmaKaydi) => {
    setRmalar((l) => [r, ...l]);
    setYeni(null);
    setSecili(r.id);
    setSonuc(null);
    setKart(null);
    setDurum("acik");
  }, []);
  const guncellendi = useCallback((s: RmaIslemSonucu) => {
    if (s.liste) setRmalar(s.liste.map((x) => ({ ...x, gecmis: [...x.gecmis] })));
    router.refresh();
  }, [router]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return rmalar
      .filter((r) => (kart ? KART_FILTRE[kart](r, bugun) : durum === "tumu" ? true : durum === "acik" ? acikMi(r) : !acikMi(r)))
      .filter((r) => !tip || r.arizaTipi === tip)
      .filter((r) => !garanti || (garanti === "kapsamda") === kapsamda(r))
      .filter((r) => !q || [r.id, r.seriNo, r.sahip.ad, r.ariza, r.yeniSeri ?? ""].some((x) => x.toLocaleLowerCase("tr-TR").includes(q)))
      .sort((a, b) => Number(b.oncelik === "Acil" && acikMi(b)) - Number(a.oncelik === "Acil" && acikMi(a)) || b.acilis.localeCompare(a.acilis));
  }, [rmalar, kart, durum, tip, garanti, arama, bugun]);
  const seciliKayit = rmalar.find((r) => r.id === secili) ?? null;

  const kartlar: { id: Kart; ad: string; alt: string; uyari?: boolean }[] = [
    { id: "talep", ad: "Cihaz bekleniyor", alt: "Talep açıldı, cihaz gelmedi" },
    { id: "inceleme", ad: "Serviste", alt: "Teslim alındı / incelemede" },
    { id: "karar", ad: "İşlemde", alt: "Karar verildi, uygulanıyor" },
    { id: "gonderim", ad: "Gönderim bekliyor", alt: "Tamamlandı, kargoya verilecek" },
    { id: "tamamlandi", ad: "Tamamlandı", alt: "Gönderildi ya da iade edildi" },
    { id: "geciken", ad: `${HEDEF_GUN} günü aşan`, alt: "Hedef süre aşıldı", uyari: true },
    { id: "ucret", ad: "Ücret bekleyen", alt: "Garanti dışı, tahsil edilmedi", uyari: true },
  ];

  const analiz = useMemo(() => {
    const kapali = rmalar.filter((r) => !acikMi(r) && r.kapanis);
    const sure = kapali.map((r) => gunSay(r.acilis, r.kapanis!));
    const ort = sure.length ? Math.round((sure.reduce((a, b) => a + b, 0) / sure.length) * 10) / 10 : null;
    const hedefte = sure.length ? Math.round((sure.filter((g) => g <= HEDEF_GUN).length / sure.length) * 100) : null;
    const say = (anahtar: (r: RmaKaydi) => string | null) => {
      const m = new Map<string, number>();
      for (const r of rmalar) { const a = anahtar(r); if (a) m.set(a, (m.get(a) ?? 0) + 1); }
      return [...m].map(([ad, n]) => ({ ad, n })).sort((a, b) => b.n - a.n);
    };
    const ucretli = rmalar.filter((r) => !kapsamda(r) && r.ucret);
    return {
      ort, hedefte,
      garantiOrani: rmalar.length ? Math.round((rmalar.filter(kapsamda).length / rmalar.length) * 100) : null,
      gelir: ucretli.filter((r) => r.ucretOdendi).reduce((s, r) => s + (r.ucret ?? 0), 0),
      bekleyen: ucretli.filter((r) => !r.ucretOdendi).reduce((s, r) => s + (r.ucret ?? 0), 0),
      tip: say((r) => r.arizaTipi),
      model: say((r) => r.model),
      // Seri no EO1-YYAA-NNNN: YYAA üretim yılı/ayı → hangi üretim döneminin cihazları arıza veriyor
      parti: say((r) => { const m = r.seriNo.match(/^EO1-(\d{2})(\d{2})-/); return m ? `20${m[1]}/${m[2]} üretimi` : null; }),
      karar: say((r) => (r.karar ? KARAR_ADI[r.karar as RmaKarari] : null)),
    };
  }, [rmalar]);

  function disaAktar() {
    csvIndir(
      [
        ["RMA", "Seri no", "Model", "Sahip", "Arıza tipi", "Arıza", "Garanti", "Ücret", "Ücret tahsil", "Durum", "Karar", "Yeni seri", "Açılış", "Kapanış", "Gün", "Gönderim"],
        ...gorunen.map((r) => [
          r.id, r.seriNo, r.model, r.sahip.ad, r.arizaTipi, r.ariza, kapsamda(r) ? "Kapsamda" : "Dışı", r.ucret ?? "", r.ucretOdendi ? "Evet" : "Hayır",
          ADIM_ADI[r.adim], r.karar ? KARAR_ADI[r.karar] : "", r.yeniSeri ?? "", r.acilis, r.kapanis ?? "", bugun ? gunSay(r.acilis, r.kapanis ?? bugun) : "",
          r.kargo ? `${r.kargo.firma} ${r.kargo.takipNo}` : "",
        ]),
      ],
      `rma-${bugun || "liste"}.csv`,
    );
  }

  return (
    <>
      <PageHeader title="Garanti & RMA" description={`Seri numarasıyla garanti sorgulama, arıza kabul, tamir / değişim / iade takibi · hedef çözüm ${HEDEF_GUN} gün`}>
        <label className="flex items-center gap-2 text-[13px] font-bold">
          Garanti süresi
          <select value={garantiAy} onChange={async (e) => { const ay = Number(e.target.value); setGarantiAy(ay); await garantiSuresiKaydet(ay); }} className="min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-3 text-sm font-semibold">
            {[12, 18, 24, 36].map((a) => <option key={a} value={a}>{a} ay</option>)}
          </select>
        </label>
        <button type="button" onClick={disaAktar} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          <Download size={16} aria-hidden="true" /> Dışa aktar
        </button>
        <button type="button" onClick={() => setYeni("")} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
          <Plus size={18} aria-hidden="true" /> Yeni RMA
        </button>
      </PageHeader>

      <section aria-label="RMA özeti" className="grid w-full grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {kartlar.map((k) => {
          const n = rmalar.filter((r) => KART_FILTRE[k.id](r, bugun)).length;
          const aktif = kart === k.id;
          return (
            <button key={k.id} type="button" aria-pressed={aktif} onClick={() => setKart(aktif ? null : k.id)}
              className={`flex min-w-0 cursor-pointer flex-col gap-1 rounded-card border p-4 text-left transition-colors ${aktif ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}>
              <span className={`text-xs font-semibold ${aktif ? "text-[#C3C6BC]" : "text-muted"}`}>{k.ad}</span>
              <b className={`text-2xl tabular-nums ${!aktif && k.uyari && n > 0 ? "text-warn" : ""}`}>{n}</b>
              <span className={`truncate text-[11px] ${aktif ? "text-[#C3C6BC]" : "text-muted"}`}>{k.alt}</span>
            </button>
          );
        })}
      </section>

      <form className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-3" onSubmit={(e) => { e.preventDefault(); baslat(async () => setSonuc(await seriSorgula(sorgu))); }}>
        <label className="sr-only" htmlFor="garanti-sorgu">Seri no ile garanti sorgula</label>
        <input id="garanti-sorgu" value={sorgu} onChange={(e) => setSorgu(e.target.value.toUpperCase())} placeholder="Garanti sorgula: EO1-2402-0611" className="min-h-11 min-w-0 flex-[1_1_220px] rounded-control border border-line-strong bg-card px-3 font-mono text-sm outline-none focus:border-ink" />
        <button type="submit" disabled={sorgulaniyor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-ink px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          <Search size={16} aria-hidden="true" /> Sorgula
        </button>
        {sonuc && ("hata" in sonuc ? (
          <p role="alert" className="w-full text-[13px] font-semibold text-err">{sonuc.hata}</p>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <GarantiKarti b={sonuc} />
            <div className="flex gap-3">
              <button type="button" onClick={() => setYeni(sonuc.seriNo)} className="text-[13px] font-bold text-info hover:underline">Bu cihaz için RMA aç →</button>
              <button type="button" onClick={() => setSonuc(null)} className="text-[13px] font-bold text-muted hover:underline">Kapat</button>
            </div>
          </div>
        ))}
      </form>

      <div className="flex flex-wrap items-start gap-4">
        <section aria-label="RMA listesi" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-line bg-card p-4">
          <label className="sr-only" htmlFor="rma-ara">Ara</label>
          <input id="rma-ara" type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="RMA no, seri no, müşteri…" className="min-h-11 rounded-control border border-line-strong bg-card px-3 text-sm outline-none focus:border-ink" />
          {kart ? (
            <div className="flex items-center gap-2 text-xs font-bold">
              <span>Filtre: {kartlar.find((k) => k.id === kart)?.ad}</span>
              <button type="button" onClick={() => setKart(null)} className="cursor-pointer text-info hover:underline">Kaldır</button>
            </div>
          ) : (
            <div role="tablist" aria-label="RMA durumu" className="flex w-fit gap-1 rounded-control bg-bg p-1">
              {([["acik", "Açık"], ["kapali", "Tamamlandı"], ["tumu", "Tümü"]] as const).map(([id, ad]) => (
                <button key={id} type="button" role="tab" aria-selected={durum === id} onClick={() => setDurum(id)} className={`min-h-9 cursor-pointer rounded-[9px] px-3 text-xs font-bold ${durum === id ? "bg-card shadow-sm" : "text-[#474A42]"}`}>{ad}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Arıza tipi" value={tip} onChange={(e) => setTip(e.target.value)} className="min-h-10 min-w-0 rounded-control border border-line-strong bg-card px-2 text-xs font-semibold">
              <option value="">Tüm arızalar</option>
              {ARIZA_TIPLERI.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select aria-label="Garanti" value={garanti} onChange={(e) => setGaranti(e.target.value as typeof garanti)} className="min-h-10 min-w-0 rounded-control border border-line-strong bg-card px-2 text-xs font-semibold">
              <option value="">Garanti: tümü</option>
              <option value="kapsamda">Garantide</option>
              <option value="disi">Garanti dışı</option>
            </select>
          </div>
          <ul className="flex max-h-[640px] flex-col gap-1.5 overflow-y-auto">
            {gorunen.map((r) => {
              const gun = bugun ? gunSay(r.acilis, r.kapanis ?? bugun) : null;
              const sec = r.id === secili;
              return (
                <li key={r.id}>
                  <button type="button" aria-current={sec ? "true" : undefined} onClick={() => setSecili(r.id)}
                    className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors ${sec ? "border-ink bg-[#F4F5F0]" : "border-line hover:border-line-strong"}`}>
                    <span className="flex items-center gap-2">
                      <b className="text-sm">{r.id}</b>
                      {r.oncelik === "Acil" && acikMi(r) && <Chip ton="err">Acil</Chip>}
                      <span className={`ml-auto text-xs tabular-nums ${acikMi(r) && gun !== null && gun > HEDEF_GUN ? "font-bold text-warn" : "text-muted"}`}>{gun !== null ? `${gun} gün` : ""}</span>
                    </span>
                    <span className="truncate text-[13px] font-semibold">{r.sahip.ad}</span>
                    <span className="truncate text-xs text-muted"><span className="font-mono">{r.seriNo}</span> · {r.arizaTipi}</span>
                    <span className="flex flex-wrap gap-1">
                      <Chip ton={adimTonu(r)}>{adimEtiketi(r)}</Chip>
                      {!kapsamda(r) && <Chip ton="warn">{ucretBekliyor(r) ? "Ücret bekliyor" : "Garanti dışı"}</Chip>}
                    </span>
                  </button>
                </li>
              );
            })}
            {!gorunen.length && <li className="py-8 text-center text-sm text-muted">Bu filtrede kayıt yok.</li>}
          </ul>
        </section>

        <div className="flex min-w-0 flex-[2_1_480px]">
          {seciliKayit ? (
            <RmaDetay key={seciliKayit.id} rma={seciliKayit} bugun={bugun} bilesenler={p.bilesenler} havuz={p.havuz} kargoFirmalari={p.kargoFirmalari} onGuncellendi={guncellendi} />
          ) : (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-card p-10 text-center text-sm text-muted">Soldan bir kayıt seçin ya da yeni RMA açın.</div>
          )}
        </div>

        {seciliKayit && (
          <div className="flex min-w-0 flex-[1_1_260px]">
            <BilgiPaneli r={seciliKayit} />
          </div>
        )}
      </div>

      <section aria-label="Analiz" className="flex flex-col gap-3">
        <h2 className="text-[19px] font-extrabold">Servis analizi</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { ad: "Ort. çözüm süresi", deger: analiz.ort === null ? "—" : `${analiz.ort} gün` },
            { ad: `${HEDEF_GUN} gün içinde kapanan`, deger: analiz.hedefte === null ? "—" : `%${analiz.hedefte}` },
            { ad: "Garanti kapsamındaki", deger: analiz.garantiOrani === null ? "—" : `%${analiz.garantiOrani}` },
            { ad: "Tahsil edilen servis", deger: tl(analiz.gelir) },
            { ad: "Bekleyen servis ücreti", deger: tl(analiz.bekleyen) },
          ].map((k) => (
            <div key={k.ad} className="flex flex-col gap-1 rounded-card border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{k.ad}</span>
              <b className="text-xl tabular-nums">{k.deger}</b>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          <Dagilim baslik="Arıza tipine göre" veri={analiz.tip.map((x) => x)} />
          <Dagilim baslik="Üretim dönemine göre" veri={analiz.parti} />
          <Dagilim baslik="Modele göre" veri={analiz.model} />
          <Dagilim baslik="Karar dağılımı" veri={analiz.karar} />
        </div>
      </section>

      <Modal acik={yeni !== null} onKapat={kapatYeni} baslik="Yeni RMA">
        {yeni !== null && <RmaFormu key={yeni} baslangicSeri={yeni} talepler={p.talepler} onKaydedildi={eklendi} onVazgec={kapatYeni} />}
      </Modal>
    </>
  );
}
