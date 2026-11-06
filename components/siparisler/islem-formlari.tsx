"use client";

// Sipariş adımlarının pencere içindeki küçük formları: seri no, kargo, teslim, lisans, fatura,
// iade / değişim kaydı ve depo stok girişi. Her biri kendi server action'ını çağırır.
import { useState, useTransition } from "react";
import { useBugun } from "@/lib/use-bugun";
import {
  faturaKes, iadeKaydet, kargoyaVer, lisansTeslim, seriAta, stokGirisi, teslimEdildi, yeniStokKalemi,
  type IadeSonucu, type IslemSonucu,
} from "./actions";
import { IADE_NEDENLERI, type IadeTuru, type Siparis, type StokKalemi } from "./queries";
import { SERI_NO, cihazAdedi, iadeSecenekleri, icerikOzeti, seriListesi, yurtDisi } from "./ortak";
import type { CihazModeli } from "@/lib/urunler";

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const ALAN = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold";
const IKINCIL = "min-h-11 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0]";
const BIRINCIL = "min-h-11 cursor-pointer rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60";

const kisalt = (m: string, n: number) => (m.length > n ? `${m.slice(0, n - 1).trimEnd()}…` : m);

/** Bugünün tarihi "2026-11-06" (tarayıcıda) */
function useBugunIso() {
  const b = useBugun();
  if (b === null) return "";
  const d = new Date(b);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Altlik({ bekliyor, etiket, onVazgec, hata }: { bekliyor: boolean; etiket: string; onVazgec: () => void; hata?: string | null }) {
  return (
    <>
      {hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{hata}</p>}
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className={IKINCIL}>Vazgeç</button>
        <button type="submit" disabled={bekliyor} className={BIRINCIL}>{bekliyor ? "Kaydediliyor…" : etiket}</button>
      </div>
    </>
  );
}

/** Ortak gönderim: işlemi çalıştırır, hata varsa gösterir, yoksa sonucu üst bileşene verir */
function useGonder(onTamam: (s: IslemSonucu) => void) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const gonder = (is: () => Promise<IslemSonucu>) =>
    baslat(async () => {
      const s = await is();
      if (s.hata) setHata(s.hata);
      else onTamam(s);
    });
  return { bekliyor, hata, gonder };
}

type Ortak = { siparis: Siparis; onTamam: (s: IslemSonucu) => void; onVazgec: () => void };

export function SeriAtaFormu({ siparis, havuz, onTamam, onVazgec }: Ortak & { havuz: { seriNo: string; model: CihazModeli }[] }) {
  const { bekliyor, hata, gonder } = useGonder(onTamam);
  const [metin, setMetin] = useState("");
  const [listeAcik, setListeAcik] = useState(false);
  const kalan = cihazAdedi(siparis) - siparis.seriNolar.length;
  // Atanmamış cihazların modelleri, kalem sırasıyla (önce ONE'lar, sonra ONE Lite'lar)
  const bekleyenModeller = siparis.kalemler.flatMap((k) => (k.tur === "cihaz" ? Array<CihazModeli>(k.adet).fill(k.model) : [])).slice(siparis.seriNolar.length);
  const modeller = [...new Set(bekleyenModeller)];
  const gereken = (m: CihazModeli) => bekleyenModeller.filter((x) => x === m).length;
  const yazilanlar = seriListesi(metin);
  const secili = new Set(yazilanlar);
  const modelinSecilen = (m: CihazModeli) => havuz.filter((h) => h.model === m && secili.has(h.seriNo)).length;

  /** Her model için gereken adet kadar havuzdan rastgele seri no seçer */
  const rastgele = () => {
    const secilen = modeller.flatMap((m) => {
      const aday = havuz.filter((h) => h.model === m).map((h) => h.seriNo);
      for (let i = aday.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [aday[i], aday[j]] = [aday[j], aday[i]];
      }
      return aday.slice(0, gereken(m));
    });
    setMetin(secilen.join("\n"));
  };
  /** Listeden işaretlenen seri no metin kutusuna eklenir / çıkarılır (elle yazılanlar korunur) */
  const degistir = (seriNo: string) =>
    setMetin((secili.has(seriNo) ? yazilanlar.filter((x) => x !== seriNo) : [...yazilanlar, seriNo]).join("\n"));

  const havuzSayisi = (m: CihazModeli) => havuz.filter((h) => h.model === m).length;
  const havuzVar = modeller.some((m) => havuzSayisi(m) > 0);
  const KUCUK = "min-h-8 cursor-pointer rounded-[9px] border border-line-strong bg-card px-2.5 text-xs font-bold text-ink hover:bg-[#F4F5F0] aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white";
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(() => seriAta(siparis.id, metin)); }} className="flex flex-col gap-4">
      {havuzVar && (
        <div className="flex flex-col gap-2 rounded-control bg-[#F4F5F0] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-xs font-semibold text-[#474A42]">
              Seri no havuzu: {modeller.map((m) => `${havuzSayisi(m)} ${m}`).join(" · ")} hazır
            </span>
            <button type="button" onClick={rastgele} className={KUCUK}>Rastgele seç</button>
            <button type="button" aria-pressed={listeAcik} aria-expanded={listeAcik} onClick={() => setListeAcik((x) => !x)} className={KUCUK}>Kendim seçeceğim</button>
          </div>
          {listeAcik && (
            <div className="flex flex-col gap-3 border-t border-line pt-2">
              {modeller.map((m) => {
                const dolu = modelinSecilen(m) >= gereken(m);
                const liste = havuz.filter((h) => h.model === m);
                return (
                  <fieldset key={m} className="flex flex-col gap-1.5">
                    <legend className="mb-1 text-xs font-bold">
                      {m} <span className={`font-semibold ${dolu ? "text-ok" : "text-muted"}`}>{modelinSecilen(m)}/{gereken(m)} seçildi</span>
                    </legend>
                    {liste.length === 0 && <span className="text-xs text-muted">Havuzda {m} yok.</span>}
                    <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                      {liste.map((h) => {
                        const isaretli = secili.has(h.seriNo);
                        return (
                          <label key={h.seriNo} className={`flex min-h-9 items-center gap-2 rounded-[9px] px-2 font-mono text-[13px] ${isaretli ? "bg-card font-bold" : ""} ${!isaretli && dolu ? "opacity-50" : "cursor-pointer hover:bg-card"}`}>
                            <input type="checkbox" checked={isaretli} disabled={!isaretli && dolu} onChange={() => degistir(h.seriNo)} className="size-4 accent-[#0E0F0C]" />
                            {h.seriNo}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}
        </div>
      )}
      <label className={ALAN}>
        Seri numaraları
        <textarea
          autoFocus
          rows={Math.min(8, Math.max(3, kalan))}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          placeholder={"Her satıra bir seri no\nEO1-2611-0001\nEO1-2611-0002"}
          className={`${GIRDI} py-2 font-mono text-[13px]`}
          aria-invalid={!!hata}
        />
        <span className={`text-xs font-semibold ${yazilanlar.length > kalan ? "text-err" : "text-muted"}`}>
          {yazilanlar.length}/{kalan} seri no · her satıra bir seri no yazın. Cihazlar Cihaz &amp; Lisans&apos;a {siparis.bayiId ? "bayi stoğu" : "müşteriye bağlı"} olarak eklenir.
        </span>
      </label>
      <Altlik bekliyor={bekliyor} etiket="Seri no ata" onVazgec={onVazgec} hata={hata} />
    </form>
  );
}

export function KargoFormu({ siparis, firmalar, onTamam, onVazgec }: Ortak & { firmalar: string[] }) {
  const { bekliyor, hata, gonder } = useGonder(onTamam);
  const [firma, setFirma] = useState<string>(() => {
    const tercih = yurtDisi(siparis) ? "UPS Express" : "Yurtiçi Kargo";
    return firmalar.includes(tercih) ? tercih : firmalar[0] ?? "";
  });
  const [takip, setTakip] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(() => kargoyaVer(siparis.id, firma, takip)); }} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Kargo firması
          <select value={firma} onChange={(e) => setFirma(e.target.value)} className={GIRDI}>
            {firmalar.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className={ALAN}>
          Takip no
          <input autoFocus value={takip} onChange={(e) => setTakip(e.target.value)} className={`${GIRDI} font-mono`} aria-invalid={!!hata && !takip.trim()} />
        </label>
      </div>
      <p className="text-xs text-muted">Kargoya verilince cihazlar, kutu içindeki kablolar ve aksesuarlar depo stoğundan düşer.</p>
      <Altlik bekliyor={bekliyor} etiket="Kargoya ver" onVazgec={onVazgec} hata={hata} />
    </form>
  );
}

export function TeslimFormu({ siparis, onTamam, onVazgec }: Ortak) {
  const { bekliyor, hata, gonder } = useGonder(onTamam);
  const bugun = useBugunIso();
  const [tarih, setTarih] = useState<string | null>(null);
  const deger = tarih ?? bugun;
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(() => teslimEdildi(siparis.id, deger)); }} className="flex flex-col gap-4">
      <label className={ALAN}>
        Teslim tarihi
        <input type="date" value={deger} onChange={(e) => setTarih(e.target.value)} className={GIRDI} />
      </label>
      <Altlik bekliyor={bekliyor} etiket="Teslim edildi" onVazgec={onVazgec} hata={hata} />
    </form>
  );
}

export function LisansFormu({ siparis, onTamam, onVazgec }: Ortak) {
  const { bekliyor, hata, gonder } = useGonder(onTamam);
  const bugun = useBugunIso();
  const [tarih, setTarih] = useState<string | null>(null);
  const deger = tarih ?? siparis.teslimTarihi ?? bugun;
  const l = siparis.kalemler.find((k) => k.tur === "lisans");
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(() => lisansTeslim(siparis.id, deger)); }} className="flex flex-col gap-4">
      <p className="rounded-control bg-[#F4F5F0] px-3 py-2.5 text-[13px] text-[#474A42]">
        {l && l.tur === "lisans" ? `${l.adet > 1 ? `${l.adet}× ` : ""}${l.paket} · ${l.sureAy} ay` : "Lisans"}
        {siparis.bayiId
          ? " · bayi siparişi: lisansı bayi aktive eder, burada yalnızca teslim kaydedilir."
          : siparis.seriNolar.length
            ? ` · ${siparis.seriNolar.join(", ")} cihazlarına işlenir.`
            : " · siparişe bağlı cihaz yok; yalnızca teslim kaydedilir."}
      </p>
      <label className={ALAN}>
        Lisans başlangıcı
        <input type="date" value={deger} onChange={(e) => setTarih(e.target.value)} className={GIRDI} />
      </label>
      <Altlik bekliyor={bekliyor} etiket="Lisansı teslim et" onVazgec={onVazgec} hata={hata} />
    </form>
  );
}

export function FaturaFormu({ siparis, onTamam, onVazgec }: Ortak) {
  const { bekliyor, hata, gonder } = useGonder(onTamam);
  const [no, setNo] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(() => faturaKes(siparis.id, no)); }} className="flex flex-col gap-4">
      <label className={ALAN}>
        {yurtDisi(siparis) ? "İhracat faturası no" : "e-Fatura no"}
        <input autoFocus value={no} onChange={(e) => setNo(e.target.value)} placeholder="EMB2026000432" className={`${GIRDI} font-mono uppercase`} aria-invalid={!!hata} />
      </label>
      <Altlik bekliyor={bekliyor} etiket="Faturayı kaydet" onVazgec={onVazgec} hata={hata} />
    </form>
  );
}

export function StokFormu({ stok, onTamam, onVazgec }: { stok: StokKalemi[]; onTamam: (s: IslemSonucu) => void; onVazgec: () => void }) {
  const [mod, setMod] = useState<"giris" | "yeni">("giris");
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Stok işlemi" className="flex gap-1 rounded-control bg-bg p-1">
        {([["giris", "Mevcut ürüne giriş"], ["yeni", "Yeni ürün ekle"]] as const).map(([v, ad]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mod === v}
            onClick={() => setMod(v)}
            className={`min-h-9 flex-1 cursor-pointer rounded-[9px] text-[13px] font-bold ${mod === v ? "bg-card shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42]"}`}
          >
            {ad}
          </button>
        ))}
      </div>
      {mod === "giris" ? <StokGirisFormu stok={stok} onTamam={onTamam} onVazgec={onVazgec} /> : <YeniUrunFormu onTamam={onTamam} onVazgec={onVazgec} />}
    </div>
  );
}

function StokGirisFormu({ stok, onTamam, onVazgec }: { stok: StokKalemi[]; onTamam: (s: IslemSonucu) => void; onVazgec: () => void }) {
  const { bekliyor, hata, gonder } = useGonder(onTamam);
  const [kod, setKod] = useState(stok[0]?.kod ?? "");
  const [adet, setAdet] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(() => stokGirisi(kod, parseInt(adet, 10))); }} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <label className={ALAN}>
          Ürün
          <select value={kod} onChange={(e) => setKod(e.target.value)} className={GIRDI}>
            {stok.map((k) => <option key={k.kod} value={k.kod}>{k.ad} · {k.adet} adet</option>)}
          </select>
        </label>
        <label className={ALAN}>
          Gelen adet
          <input autoFocus type="number" min={1} inputMode="numeric" value={adet} onChange={(e) => setAdet(e.target.value)} className={`${GIRDI} tabular-nums`} aria-invalid={!!hata} />
        </label>
      </div>
      <Altlik bekliyor={bekliyor} etiket="Stoğa ekle" onVazgec={onVazgec} hata={hata} />
    </form>
  );
}

function YeniUrunFormu({ onTamam, onVazgec }: { onTamam: (s: IslemSonucu) => void; onVazgec: () => void }) {
  const [bekliyor, baslat] = useTransition();
  const [h, setH] = useState<Record<string, string>>({});
  const [v, setV] = useState({ ad: "", kod: "", adet: "0", kritik: "10", hedef: "50", fiyat: "" });
  const alan = (ad: keyof typeof v) => ({
    value: v[ad],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [ad]: e.target.value }),
    "aria-invalid": !!h[ad],
  });
  const hataYaz = (ad: string) => (h[ad] ? <span className="text-xs font-semibold text-err">{h[ad]}</span> : null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        baslat(async () => {
          const s = await yeniStokKalemi({
            ad: v.ad, kod: v.kod,
            adet: Number(v.adet), kritik: Number(v.kritik), hedef: Number(v.hedef),
            fiyat: v.fiyat.trim() ? Number(v.fiyat.replace(/\./g, "").replace(",", ".")) : null,
          });
          if (s.hatalar || s.hata) setH(s.hatalar ?? { genel: s.hata ?? "" });
          else onTamam(s);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className={ALAN}>
          Ürün adı
          <input autoFocus {...alan("ad")} maxLength={60} placeholder="Ör. OBD-II adaptör kablosu" className={GIRDI} />
          {hataYaz("ad")}
        </label>
        <label className={ALAN}>
          Stok kodu
          <input {...alan("kod")} maxLength={24} placeholder="EO1-CBL-OBD" className={`${GIRDI} font-mono uppercase`} />
          {hataYaz("kod")}
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={ALAN}>
          Mevcut adet
          <input type="number" min={0} inputMode="numeric" {...alan("adet")} className={`${GIRDI} tabular-nums`} />
          {hataYaz("adet")}
        </label>
        <label className={ALAN}>
          Kritik seviye
          <input type="number" min={0} inputMode="numeric" {...alan("kritik")} className={`${GIRDI} tabular-nums`} />
          {hataYaz("kritik")}
        </label>
        <label className={ALAN}>
          Hedef stok
          <input type="number" min={1} inputMode="numeric" {...alan("hedef")} className={`${GIRDI} tabular-nums`} />
          {hataYaz("hedef")}
        </label>
      </div>
      <label className={ALAN}>
        <span>Satış fiyatı (₺, KDV hariç) <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input inputMode="decimal" {...alan("fiyat")} placeholder="Ör. 1.500" className={`${GIRDI} tabular-nums`} />
        <span className="text-xs text-muted">Fiyat girilirse manuel siparişte aksesuar olarak seçilebilir; boş bırakılırsa yalnızca depoda izlenir.</span>
        {hataYaz("fiyat")}
      </label>
      <Altlik bekliyor={bekliyor} etiket="Ürünü ekle" onVazgec={onVazgec} hata={h.genel} />
    </form>
  );
}

export function IadeFormu({
  siparisler,
  stok,
  ilkSiparis,
  onTamam,
  onVazgec,
}: {
  siparisler: Siparis[];
  stok: StokKalemi[];
  ilkSiparis?: string;
  onTamam: (s: IadeSonucu) => void;
  onVazgec: () => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [h, setH] = useState<Record<string, string>>({});
  const [siparisId, setSiparisId] = useState(ilkSiparis ?? "");
  const [secim, setSecim] = useState<string[]>(() => {
    const s = siparisler.find((x) => x.id === ilkSiparis);
    const l = s ? iadeSecenekleri(s, stok) : [];
    return l.length === 1 ? [l[0].id] : [];
  });
  const [seriArama, setSeriArama] = useState("");
  const [tur, setTur] = useState<IadeTuru>("degisim");
  const [neden, setNeden] = useState("");
  const [aciklama, setAciklama] = useState("");
  // Yalnızca müşteriye ulaşmış siparişler iade / değişime konu olabilir
  const uygun = siparisler.filter((s) => s.durum === "teslim" || s.durum === "tamamlandi" || s.durum === "kargoda");
  const siparis = uygun.find((s) => s.id === siparisId) ?? null;
  const secenekler = siparis ? iadeSecenekleri(siparis, stok) : [];

  const siparisSec = (id: string, isaretli: string[] = []) => {
    setSiparisId(id);
    const s = uygun.find((x) => x.id === id);
    const l = s ? iadeSecenekleri(s, stok) : [];
    setSecim(isaretli.length ? isaretli : l.length === 1 ? [l[0].id] : []); // tek ürünlü siparişte otomatik seçilir
    setH((x) => ({ ...x, siparisId: "", urunler: "" }));
  };
  // Seri no yazılınca o cihazın siparişi bulunur ve cihaz işaretlenir
  const seriNo = seriArama.trim().toUpperCase();
  const seriSiparisi = SERI_NO.test(seriNo) ? uygun.find((s) => s.seriNolar.includes(seriNo)) : undefined;
  const seriAra = (v: string) => {
    setSeriArama(v);
    const no = v.trim().toUpperCase();
    const s = SERI_NO.test(no) ? uygun.find((x) => x.seriNolar.includes(no)) : undefined;
    if (s) siparisSec(s.id, [no]);
  };
  const degistir = (id: string) => setSecim((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        baslat(async () => {
          const s = await iadeKaydet({ siparisId, tur, neden, aciklama, urunler: secim });
          if (s.hatalar || s.hata) setH(s.hatalar ?? { genel: s.hata ?? "" });
          else onTamam(s);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <label className={ALAN}>
          Sipariş / müşteri
          <select value={siparisId} onChange={(e) => siparisSec(e.target.value)} className={GIRDI} aria-invalid={!!h.siparisId}>
            <option value="" disabled>Seçin</option>
            {uygun.map((s) => <option key={s.id} value={s.id}>#{s.id} · {s.musteri} · {kisalt(icerikOzeti(s, stok), 42)}</option>)}
          </select>
          {h.siparisId && <span className="text-xs font-semibold text-err">{h.siparisId}</span>}
        </label>
        <label className={ALAN}>
          <span>Seri no ile bul <span className="font-normal text-muted">(isteğe bağlı)</span></span>
          <input value={seriArama} onChange={(e) => seriAra(e.target.value)} placeholder="EO1-2610-0661" className={`${GIRDI} font-mono uppercase`} />
          {seriNo && SERI_NO.test(seriNo) && !seriSiparisi && <span className="text-xs font-semibold text-err">Bu seri no teslim edilmiş bir siparişte yok.</span>}
        </label>
      </div>

      {siparis && (
        <fieldset className="flex flex-col gap-1.5" aria-invalid={!!h.urunler}>
          <legend className="mb-1.5 text-[13px] font-bold">
            İade / değişim edilen ürün <span className="font-semibold text-muted">· {secim.length}/{secenekler.length} seçildi</span>
          </legend>
          {secenekler.length === 0 && <span className="text-xs text-muted">Bu siparişte seçilebilecek ürün yok.</span>}
          <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto rounded-control border border-line p-1.5 sm:grid-cols-2">
            {secenekler.map((x) => {
              const isaretli = secim.includes(x.id);
              return (
                <label key={x.id} className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[9px] px-2 ${isaretli ? "bg-[#F3FBD6]" : "hover:bg-[#F4F5F0]"}`}>
                  <input type="checkbox" checked={isaretli} onChange={() => degistir(x.id)} className="size-4 shrink-0 accent-[#0E0F0C]" />
                  <span className="flex min-w-0 flex-col">
                    <b className={`truncate text-[13px] ${SERI_NO.test(x.ad) ? "font-mono" : ""}`}>{x.ad}</b>
                    <span className="text-[11px] text-muted">{x.alt}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {h.urunler && <span className="text-xs font-semibold text-err">{h.urunler}</span>}
        </fieldset>
      )}

      <div className={ALAN}>
        <span id="iade-tur">Talep</span>
        <div role="group" aria-labelledby="iade-tur" className="flex gap-1 rounded-control bg-bg p-1">
          {([["degisim", "Değişim"], ["iade", "İade (para iadesi)"]] as const).map(([v, ad]) => (
            <button
              key={v}
              type="button"
              aria-pressed={tur === v}
              onClick={() => setTur(v)}
              className={`min-h-9 flex-1 cursor-pointer rounded-[9px] text-[13px] font-bold ${tur === v ? "bg-card shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42]"}`}
            >
              {ad}
            </button>
          ))}
        </div>
      </div>
      <label className={ALAN}>
        Neden
        <select value={neden} onChange={(e) => setNeden(e.target.value)} className={GIRDI} aria-invalid={!!h.neden}>
          <option value="" disabled>Seçin</option>
          {IADE_NEDENLERI.map((n) => <option key={n}>{n}</option>)}
        </select>
        {h.neden && <span className="text-xs font-semibold text-err">{h.neden}</span>}
      </label>
      <label className={ALAN}>
        Açıklama {neden === "Diğer" ? "*" : <span className="font-normal text-muted">(isteğe bağlı)</span>}
        <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Ör. kutu açılmamış" className={GIRDI} aria-invalid={!!h.aciklama} />
        {h.aciklama && <span className="text-xs font-semibold text-err">{h.aciklama}</span>}
      </label>
      <Altlik bekliyor={bekliyor} etiket="Kaydı aç" onVazgec={onVazgec} hata={h.genel} />
    </form>
  );
}
