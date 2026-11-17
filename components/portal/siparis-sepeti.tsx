"use client";

// Bayi sipariş ekranı: ürün kartları (cihaz / lisans / aksesuar sekmeleri), canlı sepet özeti,
// lisans önerisi ve çeyrek MOQ etkisi. "Siparişlerim" sekmesinde geçmiş siparişler ve durum adımları.
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Chip, { type ChipTon } from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { portalSiparisIptal, portalSiparisVer, type PortalFormDurumu } from "./actions";
import { ODEME_SECENEKLERI, bayiFiyati, lisansKapsami, paraYaz, sepetToplami, type KatalogTuru, type KatalogUrunu, type PortalOdeme } from "./katalog";

export type GecmisSiparis = {
  id: string;
  tarih: string; // "31 Eki 2026"
  ozet: string; // "10× ONE · 10× ONESuite Pro"
  tutar: string; // "€31.500" / "₺820.000"
  durumAdi: string;
  ton: ChipTon;
  adim: number; // tamamlanan adım sayısı (0–5)
  kargo: string | null;
  faturaNo: string | null;
  iadeler: { id: string; tur: string; adim: string; urunler: string }[]; // CRM › Siparişler › İadeler
  iptalEdilebilir: boolean; // ödeme bekliyor: bayi portaldan iptal edebilir
  iptal: string | null; // "Bayi iptal etti · neden"
};

const SEKMELER: { tur: KatalogTuru; ad: string }[] = [
  { tur: "cihaz", ad: "Cihazlar" },
  { tur: "lisans", ad: "ONESuite lisans" },
  { tur: "aksesuar", ad: "Aksesuar & yedek" },
];
const ADIMLAR = ["Ödeme", "Hazırlık", "Kargo", "Teslim"];
const IKON: Record<KatalogTuru, string> = {
  cihaz: "M4 4h16v16H4zM9 9h6v6H9zM15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2",
  lisans: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78a5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
  aksesuar: "M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4",
};

function Ikon({ d, boyut = 22 }: { d: string; boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Sayac({ ad, deger, degistir }: { ad: string; deger: number; degistir: (n: number) => void }) {
  const sinirla = (n: number) => Math.max(0, Math.min(500, Math.floor(n) || 0));
  return (
    <div className="flex items-center rounded-control border border-line-strong">
      <button type="button" aria-label={`${ad} azalt`} disabled={!deger} onClick={() => degistir(sinirla(deger - 1))}
        className="flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-bold disabled:cursor-default disabled:opacity-30">−</button>
      <input aria-label={`${ad} adedi`} inputMode="numeric" value={deger} onChange={(e) => degistir(sinirla(Number(e.target.value.replace(/\D/g, ""))))}
        className="h-10 w-12 border-x border-line text-center text-sm font-bold tabular-nums outline-none" />
      <button type="button" aria-label={`${ad} artır`} onClick={() => degistir(sinirla(deger + 1))}
        className="flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-bold">+</button>
    </div>
  );
}

export type StokOnerisi = { model: string; anahtar: string; aylik: number; elde: number; yolda: number; adet: number };

const SONRAKI_ADIMLAR = [
  "Proforma / fatura ya da ödeme bağlantısı birkaç saat içinde e-postanıza gelir.",
  "Ödeme koşulu sağlanınca sipariş hazırlanır ve seri numaraları atanır.",
  "Kargoya verildiğinde takip numarası Siparişlerim'de görünür.",
  "Lisans anahtarları cihazlarla birlikte iletilir; aktivasyonu siz yaparsınız.",
];

export default function SiparisSepeti({
  katalog, indirim, kdv, paraBirimi, kur, kayitliAdres, enErkenTarih, moq, siparisler, tekrarSepetleri, oneri,
}: {
  katalog: KatalogUrunu[];
  indirim: number;
  kdv: number;
  paraBirimi: "EUR" | "TRY";
  kur: number;
  kayitliAdres: string;
  enErkenTarih: string; // "2026-11-19"
  moq: { gerceklesen: number; hedef: number };
  siparisler: GecmisSiparis[];
  tekrarSepetleri: Record<string, Record<string, number>>;
  oneri: StokOnerisi[];
}) {
  const [gorunum, setGorunum] = useState<"yeni" | "gecmis">("yeni");
  const [sekme, setSekme] = useState<KatalogTuru>("cihaz");
  const [sepet, setSepet] = useState<Record<string, number>>({});
  const [not, setNot] = useState("");
  const [onayAcik, setOnayAcik] = useState(false);
  const [basari, setBasari] = useState<string | null>(null); // gönderilen siparişin numarası
  const formRef = useRef<HTMLFormElement>(null);
  const [teslimat, setTeslimat] = useState<"kayitli" | "farkli">("kayitli");
  const [adres, setAdres] = useState("");
  const [istenenTarih, setIstenenTarih] = useState("");
  const [odeme, setOdeme] = useState<PortalOdeme>("Proforma");
  const py = (n: number) => paraYaz(n, paraBirimi, kur);
  const vergisiz = kdv === 0;
  const [durum, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(portalSiparisVer, {});
  const [, baslat] = useTransition();
  const router = useRouter();
  const son = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) {
      son.current = durum.zaman;
      setSepet({});
      setNot("");
      setAdres("");
      setIstenenTarih("");
      setTeslimat("kayitli");
      setOnayAcik(false);
      setBasari(durum.kayitId ?? "");
      router.refresh();
    }
  }, [durum, router]);

  const ayarla = (anahtar: string, adet: number) => setSepet((s) => ({ ...s, [anahtar]: adet }));
  const toplam = useMemo(() => sepetToplami(katalog, sepet, indirim, kdv), [katalog, sepet, indirim, kdv]);
  const kapsam = lisansKapsami(katalog, sepet);
  const sepettekiler = katalog.filter((u) => sepet[u.anahtar]);
  const sekmeAdedi = (t: KatalogTuru) => katalog.filter((u) => u.tur === t).reduce((n, u) => n + (sepet[u.anahtar] ?? 0), 0);
  const varsayilanLisans = katalog.find((u) => u.anahtar === "lisans:Pro") ?? katalog.find((u) => u.tur === "lisans");

  const tekrarla = (id: string) => {
    setSepet({ ...tekrarSepetleri[id] });
    setBasari(null);
    setSekme("cihaz");
    setGorunum("yeni");
  };
  const sonSiparis = siparisler.find((s) => tekrarSepetleri[s.id]);

  const sonra = moq.gerceklesen + kapsam.cihaz;
  const yuzde = (n: number) => (moq.hedef ? Math.min(100, Math.round((n / moq.hedef) * 100)) : 0);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Sipariş" className="flex gap-1 border-b border-line">
        {([["yeni", "Yeni sipariş"], ["gecmis", `Siparişlerim (${siparisler.length})`]] as const).map(([k, ad]) => (
          <button key={k} type="button" role="tab" aria-selected={gorunum === k} onClick={() => setGorunum(k)}
            className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-bold ${gorunum === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {ad}
          </button>
        ))}
      </div>

      {gorunum === "gecmis" ? (
        <ul className="flex flex-col gap-3">
          {siparisler.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <b className="text-base">#{s.id}</b>
                <span className="text-muted">{s.tarih}</span>
                <span className="font-bold tabular-nums">{s.tutar}</span>
                <span className="ml-auto"><Chip ton={s.ton}>{s.durumAdi}</Chip></span>
                <span className="w-full text-[13px] text-[#474A42]">{s.ozet}</span>
              </div>
              <ol className="grid grid-cols-4 gap-1.5" aria-label="Sipariş durumu">
                {ADIMLAR.map((a, i) => {
                  const bitti = i < s.adim;
                  const simdi = i === s.adim && s.adim < 4;
                  return (
                    <li key={a} className="flex flex-col gap-1.5">
                      <span className={`h-1.5 rounded-full ${bitti ? "bg-[#1F8A4C]" : simdi ? "bg-lime" : "bg-bg"}`} />
                      <span className={`text-xs ${bitti ? "font-semibold" : simdi ? "font-bold" : "text-muted"}`}>{bitti ? "✓ " : ""}{a}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                {s.kargo && <span>🚚 {s.kargo}</span>}
                {s.faturaNo && <span>Fatura: <span className="font-mono font-semibold text-ink">{s.faturaNo}</span></span>}
                {s.iptal && <span className="rounded-full bg-err-bg px-2 py-0.5 font-semibold text-err">{s.iptal}</span>}
                {s.iptalEdilebilir && <IptalDugmesi id={s.id} />}
                {s.iadeler.map((r) => (
                  <span key={r.id} className="rounded-full bg-[#FFF4E5] px-2 py-0.5 font-semibold text-[#8A4B00]">↩ {r.tur} #{r.id} · {r.adim}{r.urunler ? ` · ${r.urunler}` : ""}</span>
                ))}
                {tekrarSepetleri[s.id] && (
                  <button type="button" onClick={() => tekrarla(s.id)}
                    className="ml-auto min-h-9 cursor-pointer rounded-control border border-line-strong px-3 text-[13px] font-bold text-ink hover:border-ink">
                    ↻ Tekrar sipariş ver
                  </button>
                )}
              </div>
            </li>
          ))}
          {!siparisler.length && <li className="rounded-card border border-line bg-card p-8 text-center text-sm text-muted">Henüz siparişiniz yok.</li>}
        </ul>
      ) : basari !== null ? (
        <section aria-label="Sipariş alındı" className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-card border border-line bg-card p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime text-2xl font-extrabold text-ink" aria-hidden="true">✓</span>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-extrabold">Siparişiniz alındı</h2>
            {basari && <p className="text-sm text-muted">Sipariş numaranız <b className="font-mono text-ink">#{basari}</b></p>}
          </div>
          <ol className="flex w-full flex-col gap-2 rounded-control bg-[#F4F5F0] p-4 text-left text-sm">
            {SONRAKI_ADIMLAR.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{a}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => { setBasari(null); setGorunum("gecmis"); }}
              className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft">Siparişlerime git</button>
            <button type="button" onClick={() => setBasari(null)}
              className="min-h-11 cursor-pointer rounded-control border border-line-strong px-5 text-sm font-bold hover:border-ink">Yeni sipariş oluştur</button>
          </div>
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Katalog */}
          <section aria-label="Ürünler" className="flex min-w-0 flex-col gap-3">
            {(sonSiparis || oneri.length > 0) && (
              <div className="grid gap-3 xl:grid-cols-2">
                {oneri.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-card border border-[#CFE3A0] bg-lime-bg p-4">
                    <span className="text-[11px] font-bold tracking-[0.08em] text-[#3A4D00]">STOK ÖNERİSİ</span>
                    {oneri.map((o) => (
                      <p key={o.model} className="text-[13px] text-[#2E3A06]">
                        <b>{o.model}:</b> stokta {o.elde}{o.yolda ? `, yolda ${o.yolda}` : ""} · aylık satışınız ~{o.aylik}. <b>{o.adet} adet</b> öneriyoruz.
                      </p>
                    ))}
                    <button type="button" onClick={() => setSepet((s) => { const y = { ...s }; for (const o of oneri) y[o.anahtar] = Math.max(y[o.anahtar] ?? 0, o.adet); return y; })}
                      className="mt-auto min-h-9 w-fit cursor-pointer rounded-control bg-ink px-3 text-[13px] font-bold text-white hover:bg-ink-soft">
                      Öneriyi sepete ekle
                    </button>
                  </div>
                )}
                {sonSiparis && (
                  <div className="flex flex-col gap-2 rounded-card border border-line bg-card p-4">
                    <span className="text-[11px] font-bold tracking-[0.08em] text-muted">SON SİPARİŞİNİZ · #{sonSiparis.id}</span>
                    <p className="text-[13px]">{sonSiparis.ozet}</p>
                    <span className="text-xs text-muted">{sonSiparis.tarih} · {sonSiparis.tutar}</span>
                    <button type="button" onClick={() => tekrarla(sonSiparis.id)}
                      className="mt-auto min-h-9 w-fit cursor-pointer rounded-control border border-line-strong px-3 text-[13px] font-bold hover:border-ink">
                      ↻ Aynısını tekrarla
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {SEKMELER.map((s) => {
                const n = sekmeAdedi(s.tur);
                return (
                  <button key={s.tur} type="button" aria-pressed={sekme === s.tur} onClick={() => setSekme(s.tur)}
                    className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-bold ${sekme === s.tur ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:border-ink"}`}>
                    {s.ad}
                    {n > 0 && <span className={`rounded-full px-1.5 text-xs tabular-nums ${sekme === s.tur ? "bg-lime text-ink" : "bg-bg"}`}>{n}</span>}
                  </button>
                );
              })}
            </div>
            {sekme === "lisans" && (
              <p className="rounded-control bg-info-bg px-3 py-2 text-[13px] font-semibold text-info">Cihazlar ONESuite lisansı olmadan çalışmaz. Aldığınız lisanslar ödeme onayından sonra <b>lisans havuzunuza</b> eklenir; satışta ya da yenilemede cihaza atarsınız. 12 aylıktır, KDV&apos;siz faturalanır.</p>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {katalog.filter((u) => u.tur === sekme).map((u) => {
                const adet = sepet[u.anahtar] ?? 0;
                return (
                  <li key={u.anahtar} className={`flex flex-col gap-3 rounded-card border bg-card p-4 ${adet ? "border-ink" : "border-line"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${u.tur === "cihaz" ? "bg-ink text-lime" : u.tur === "lisans" ? "bg-[#EEF2FF] text-[#3346C9]" : "bg-bg text-ink"}`}>
                        <Ikon d={IKON[u.tur]} />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <b className="text-[15px] leading-tight">{u.ad}</b>
                        <span className="text-xs text-muted">{u.aciklama}</span>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-end gap-x-3 gap-y-2">
                      <div className="flex flex-col">
                        {indirim > 0 && <span className="text-xs text-muted line-through tabular-nums">{py(u.liste)}</span>}
                        <b className="text-lg tabular-nums">{py(bayiFiyati(u.liste, indirim))}</b>
                        <span className="text-[11px] text-muted">{u.tur === "lisans" ? (vergisiz ? "yıllık" : "yıllık · KDV'siz") : vergisiz ? "ihracat · KDV yok" : "KDV hariç"}</span>
                      </div>
                      <div className="ml-auto flex flex-col items-end gap-1">
                        {u.stokta !== undefined && (
                          <span className={`text-[11px] font-bold ${u.stokta ? "text-[#1F7A45]" : "text-[#B25A12]"}`}>{u.stokta ? "● Stokta" : "● Üretimden sevk"}</span>
                        )}
                        <Sayac ad={u.ad} deger={adet} degistir={(n) => ayarla(u.anahtar, n)} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Sepet */}
          <form
            ref={formRef}
            aria-label="Sepet"
            className="flex flex-col gap-4 rounded-card border border-line bg-card p-5 lg:sticky lg:top-6"
            onSubmit={(e) => {
              e.preventDefault();
              baslat(() => gonder(new FormData(e.currentTarget)));
            }}
          >
            <h2 className="text-[17px] font-extrabold">Sepet</h2>
            {Object.entries(sepet).map(([k, n]) => (n ? <input key={k} type="hidden" name={`adet:${k}`} value={n} /> : null))}

            {sepettekiler.length ? (
              <ul className="flex flex-col divide-y divide-bg text-sm">
                {sepettekiler.map((u) => (
                  <li key={u.anahtar} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1"><b className="tabular-nums">{sepet[u.anahtar]}×</b> {u.ad}</span>
                    <span className="font-semibold tabular-nums">{py(bayiFiyati(u.liste, indirim) * sepet[u.anahtar])}</span>
                    <button type="button" aria-label={`${u.ad} sepetten çıkar`} onClick={() => ayarla(u.anahtar, 0)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink">×</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-control bg-bg px-3 py-4 text-center text-sm text-muted">Sepetiniz boş. Soldan ürün ekleyin.</p>
            )}

            {kapsam.eksik > 0 && varsayilanLisans && (
              <div className="flex flex-col gap-2 rounded-control border border-[#F2C894] bg-[#FFF6EA] p-3 text-[13px]">
                <span className="font-semibold text-[#8A4A0E]">{kapsam.eksik} cihaz için lisans yok. Cihazlar ONESuite olmadan çalışmaz.</span>
                <button type="button" onClick={() => ayarla(varsayilanLisans.anahtar, (sepet[varsayilanLisans.anahtar] ?? 0) + Math.ceil(kapsam.eksik / (varsayilanLisans.lisansCihaz ?? 1)))}
                  className="min-h-9 w-fit cursor-pointer rounded-control bg-ink px-3 text-[13px] font-bold text-white hover:bg-ink-soft">
                  + {Math.ceil(kapsam.eksik / (varsayilanLisans.lisansCihaz ?? 1))}× {varsayilanLisans.ad} ekle
                </button>
              </div>
            )}

            {moq.hedef > 0 && (
              <div className="flex flex-col gap-1.5 rounded-control bg-[#F4F5F0] p-3">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-bold">Çeyrek hedefi (MOQ)</span>
                  <span className="tabular-nums text-muted">
                    {moq.gerceklesen}/{moq.hedef}
                    {kapsam.cihaz > 0 && <> → <b className={sonra >= moq.hedef ? "text-[#1F7A45]" : "text-ink"}>{sonra}/{moq.hedef}{sonra >= moq.hedef ? " ✓" : ""}</b></>}
                  </span>
                </div>
                <span className="relative h-2.5 overflow-hidden rounded-full bg-card">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-lime" style={{ width: `${yuzde(sonra)}%` }} />
                  <span className="absolute inset-y-0 left-0 rounded-full bg-[#1F8A4C]" style={{ width: `${yuzde(moq.gerceklesen)}%` }} />
                </span>
                <span className="text-[11px] text-muted">
                  {sonra >= moq.hedef
                    ? kapsam.cihaz > 0 && moq.gerceklesen < moq.hedef ? "Bu siparişle çeyrek hedefinizi tamamlıyorsunuz." : "Çeyrek hedefi tamamlandı."
                    : `Hedefe ${moq.hedef - sonra} cihaz kaldı.`}
                </span>
              </div>
            )}

            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Liste toplamı</dt><dd className="text-right tabular-nums">{py(toplam.liste)}</dd>
              <dt className="text-muted">Bayi iskontosu (%{indirim})</dt><dd className="text-right tabular-nums text-[#1F7A45]">−{py(toplam.iskonto)}</dd>
              <dt className="text-muted">Ara toplam</dt><dd className="text-right tabular-nums">{py(toplam.net)}</dd>
              {vergisiz
                ? <><dt className="text-muted">KDV (ihracat)</dt><dd className="text-right text-muted">Yok</dd></>
                : <><dt className="text-muted">KDV (%{Math.round(kdv * 100)}, cihaz ve aksesuar)</dt><dd className="text-right tabular-nums">{py(toplam.kdv)}</dd></>}
              <dt className="mt-1 border-t border-line pt-2 font-extrabold">Genel toplam</dt><dd className="mt-1 border-t border-line pt-2 text-right text-lg font-extrabold tabular-nums">{py(toplam.genel)}</dd>
            </dl>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-bold">Teslimat</legend>
              {(["kayitli", "farkli"] as const).map((t) => (
                <label key={t} className={`flex cursor-pointer items-start gap-2.5 rounded-control border p-2.5 text-sm ${teslimat === t ? "border-ink" : "border-line"}`}>
                  <input type="radio" name="teslimat" value={t} checked={teslimat === t} onChange={() => setTeslimat(t)} className="mt-0.5 accent-[#0E0F0C]" />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{t === "kayitli" ? "Kayıtlı adres" : "Farklı adrese gönder"}</span>
                    {t === "kayitli" && <span className="text-xs text-muted">{kayitliAdres}</span>}
                  </span>
                </label>
              ))}
              {teslimat === "farkli" && (
                <textarea name="adres" rows={2} maxLength={200} value={adres} onChange={(e) => setAdres(e.target.value)} aria-label="Teslimat adresi" placeholder="Firma, sokak, şehir, posta kodu, ülke"
                  className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
              )}
              <label className="flex flex-col gap-1 text-xs font-bold">
                İstenen teslim tarihi <span className="font-normal text-muted">(boş bırakırsanız en kısa sürede)</span>
                <input type="date" name="istenenTarih" min={enErkenTarih} value={istenenTarih} onChange={(e) => setIstenenTarih(e.target.value)}
                  className="min-h-10 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink" />
              </label>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-bold">Ödeme</legend>
              {ODEME_SECENEKLERI.map((o) => (
                <label key={o.deger} className={`flex cursor-pointer items-start gap-2.5 rounded-control border p-2.5 text-sm ${odeme === o.deger ? "border-ink" : "border-line"}`}>
                  <input type="radio" name="odeme" value={o.deger} checked={odeme === o.deger} onChange={() => setOdeme(o.deger)} className="mt-0.5 accent-[#0E0F0C]" />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{o.ad}</span>
                    <span className="text-xs text-muted">{o.aciklama}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              Not
              <textarea name="not" rows={2} maxLength={300} value={not} onChange={(e) => setNot(e.target.value)} placeholder="Kurulum talebi, acil durum…"
                className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
            </label>

            {(durum.hata ?? durum.hatalar?.genel) && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata ?? durum.hatalar?.genel}</p>}
            <button type="button" disabled={!sepettekiler.length} onClick={() => setOnayAcik(true)}
              className="min-h-12 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40">
              Siparişi gözden geçir
            </button>

            <Modal acik={onayAcik} onKapat={() => setOnayAcik(false)} baslik="Siparişi onaylayın" aciklama="Göndermeden önce kalemleri ve tutarı kontrol edin.">
              <div className="flex flex-col gap-4">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2">Ürün</th><th className="py-2 text-right">Adet</th><th className="py-2 text-right">Birim</th><th className="py-2 text-right">Tutar</th></tr></thead>
                  <tbody>
                    {sepettekiler.map((u) => {
                      const birim = bayiFiyati(u.liste, indirim);
                      return (
                        <tr key={u.anahtar} className="border-b border-bg">
                          <td className="py-2">{u.ad}{!u.kdvli && <span className="ml-1 text-xs text-muted">(KDV&apos;siz)</span>}</td>
                          <td className="py-2 text-right tabular-nums">{sepet[u.anahtar]}</td>
                          <td className="py-2 text-right tabular-nums">{py(birim)}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{py(birim * sepet[u.anahtar])}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Ara toplam (iskonto dahil)</dt><dd className="text-right tabular-nums">{py(toplam.net)}</dd>
                  <dt className="text-muted">KDV</dt><dd className="text-right tabular-nums">{vergisiz ? "Yok (ihracat)" : py(toplam.kdv)}</dd>
                  <dt className="font-extrabold">Genel toplam</dt><dd className="text-right text-lg font-extrabold tabular-nums">{py(toplam.genel)}</dd>
                </dl>
                {kapsam.eksik > 0 && <p className="rounded-control bg-[#FFF6EA] px-3 py-2 text-[13px] font-semibold text-[#8A4A0E]">Uyarı: {kapsam.eksik} cihaz için lisans eklemediniz.</p>}
                {not.trim() && <p className="rounded-control bg-[#F4F5F0] px-3 py-2 text-[13px]"><b>Notunuz:</b> {not}</p>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-control bg-[#F4F5F0] p-3 text-[13px]">
                  <dt className="text-muted">Teslimat adresi</dt><dd className="font-semibold">{teslimat === "kayitli" ? kayitliAdres : adres.trim() || <span className="text-err">Adres girilmedi</span>}</dd>
                  <dt className="text-muted">Teslim tarihi</dt><dd className="font-semibold">{istenenTarih ? new Date(istenenTarih + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "En kısa sürede"}</dd>
                  <dt className="text-muted">Ödeme</dt><dd className="font-semibold">{ODEME_SECENEKLERI.find((o) => o.deger === odeme)?.ad}</dd>
                  {paraBirimi === "EUR" && <><dt className="text-muted">Para birimi</dt><dd className="font-semibold">EUR · 1 € = {kur} TL</dd></>}
                </dl>
                {(durum.hata ?? durum.hatalar?.genel) && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata ?? durum.hatalar?.genel}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setOnayAcik(false)}
                    className="min-h-11 cursor-pointer rounded-control border border-line-strong px-5 text-sm font-bold hover:border-ink">Düzenle</button>
                  <button type="button" disabled={bekliyor} onClick={() => formRef.current?.requestSubmit()}
                    className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
                    {bekliyor ? "Gönderiliyor…" : "Onayla ve gönder"}
                  </button>
                </div>
              </div>
            </Modal>
          </form>
        </div>
      )}
    </div>
  );
}

/** Ödeme bekleyen siparişi iptal: neden sorulur, onaylanınca sipariş "İptal edildi" olur ve temsilciye haber gider */
function IptalDugmesi({ id }: { id: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [neden, setNeden] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="cursor-pointer text-[13px] font-bold text-err hover:underline">
        Siparişi iptal et
      </button>
    );
  }
  return (
    <span className="flex w-full flex-wrap items-center gap-2">
      <label htmlFor={`iptal-${id}`} className="sr-only">İptal nedeni</label>
      <input
        id={`iptal-${id}`}
        autoFocus
        value={neden}
        onChange={(e) => setNeden(e.target.value)}
        maxLength={300}
        placeholder="İptal nedeni (temsilcinize iletilir)"
        className="min-h-9 min-w-0 flex-1 rounded-control border border-line-strong bg-card px-3 text-[13px] text-ink outline-none focus:border-ink"
      />
      <button type="button" onClick={() => { setAcik(false); setHata(null); }} className="min-h-9 cursor-pointer rounded-control border border-line-strong px-3 text-[13px] font-bold text-ink">Vazgeç</button>
      <button
        type="button"
        disabled={neden.trim().length < 3 || bekliyor}
        onClick={() => baslat(async () => {
          const r = await portalSiparisIptal(id, neden);
          if (r.hata) setHata(r.hata);
          else { setAcik(false); router.refresh(); }
        })}
        className="min-h-9 cursor-pointer rounded-control bg-err px-3 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {bekliyor ? "İptal ediliyor…" : "İptal et"}
      </button>
      {hata && <span role="alert" className="w-full font-semibold text-err">{hata}</span>}
    </span>
  );
}
