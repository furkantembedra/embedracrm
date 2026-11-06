"use client";

// Üretim pencerelerindeki formlar: parti planla, kalite / tamir sonucu, tedarik siparişi, iç üretim emri ve günlük giriş
import { useState, useTransition } from "react";
import { CIHAZ_MODELLERI, URUN_BILGI } from "@/lib/urunler";
import { depoyaAl, icUretimBaslat, icUretimGir, partiPlanla, tamirSonucu, tedarikVer, type UretimSonucu, type YeniKalem } from "./actions";
import { icUretimDurumu, isoGunEkle, seriAyikla, tarihKisa } from "./ortak";
import type { BilesenKalemi, IcUretimEmri, Recete, UretimPartisi } from "./queries";

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const ALAN = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold";

function Hata({ mesaj }: { mesaj?: string | null }) {
  return mesaj ? <span role="alert" className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

function Altlik({ bekliyor, etiket, onVazgec }: { bekliyor: boolean; etiket: string; onVazgec: () => void }) {
  return (
    <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
      <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
      <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
        {bekliyor ? "Kaydediliyor…" : etiket}
      </button>
    </div>
  );
}

function useIslem(onTamam: (s: UretimSonucu) => void) {
  const [bekliyor, baslat] = useTransition();
  const [h, setH] = useState<Record<string, string>>({});
  const calistir = (is: () => Promise<UretimSonucu>) =>
    baslat(async () => {
      const s = await is();
      if (s.hatalar || s.hata) setH(s.hatalar ?? { genel: s.hata! });
      else onTamam(s);
    });
  return { bekliyor, h, calistir };
}

type Ortak = { onTamam: (s: UretimSonucu) => void; onVazgec: () => void };

export function PartiFormu({ bilesenler, recete, bugun, onTamam, onVazgec }: Ortak & { bilesenler: BilesenKalemi[]; recete: Recete; bugun: string }) {
  const { bekliyor, h, calistir } = useIslem(onTamam);
  const [v, setV] = useState({ model: "ONE" as string, adet: "", hedefTarih: bugun, not: "" });
  const adet = parseInt(v.adet, 10) || 0;
  const eksik = adet ? recete[v.model as keyof Recete].map((kod) => bilesenler.find((b) => b.kod === kod)!).filter((b) => b && b.adet < adet) : [];
  return (
    <form onSubmit={(e) => { e.preventDefault(); calistir(() => partiPlanla({ ...v, adet })); }} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ALAN}>
          Model
          <select value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} className={GIRDI}>
            {CIHAZ_MODELLERI.map((m) => <option key={m} value={m}>{URUN_BILGI[m].ad}</option>)}
          </select>
        </label>
        <label className={ALAN}>
          Adet
          <input autoFocus type="number" min={1} max={1000} inputMode="numeric" value={v.adet} onChange={(e) => setV({ ...v, adet: e.target.value })} className={`${GIRDI} tabular-nums`} aria-invalid={!!h.adet} />
          <Hata mesaj={h.adet} />
        </label>
        <label className={ALAN}>
          Hedef tarih
          <input type="date" value={v.hedefTarih} onChange={(e) => setV({ ...v, hedefTarih: e.target.value })} className={GIRDI} aria-invalid={!!h.hedefTarih} />
          <Hata mesaj={h.hedefTarih} />
        </label>
      </div>
      <label className={ALAN}>
        <span>Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input value={v.not} onChange={(e) => setV({ ...v, not: e.target.value })} maxLength={200} placeholder="Ör. Eğitim seti siparişleri için" className={GIRDI} />
      </label>
      <p className={`rounded-control px-3 py-2.5 text-[13px] ${eksik.length ? "bg-warn-bg font-semibold text-warn" : "bg-[#F4F5F0] text-[#474A42]"}`}>
        {eksik.length
          ? `Üretime alırken bileşen yetmeyecek: ${eksik.map((b) => `${b.ad} (${b.adet}/${adet})`).join(", ")}. Önce tedarik siparişi verin.`
          : `Üretime alınınca her cihaz için ${recete[v.model as keyof Recete].map((kod) => bilesenler.find((b) => b.kod === kod)?.ad ?? kod).join(", ")} stoktan düşer.`}
      </p>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Partiyi planla" onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- Kalite sonucu / tamir sonucu ---------- */

const SAYI = (v: string) => (v.trim() === "" ? 0 : Number(v));
const gecerli = (n: number, en: number) => Number.isInteger(n) && n >= 0 && n <= en;

function SayiAlani({ etiket, alt, deger, onDeger, en, hata }: { etiket: string; alt?: string; deger: string; onDeger: (v: string) => void; en: number; hata?: boolean }) {
  return (
    <label className={ALAN}>
      <span>{etiket}{alt && <span className="block text-xs font-normal text-muted">{alt}</span>}</span>
      <input type="number" min={0} max={en} inputMode="numeric" value={deger} onChange={(e) => onDeger(e.target.value)} className={`${GIRDI} tabular-nums`} aria-invalid={hata} />
    </label>
  );
}

/**
 * mod "kalite": parti kalite kontrolden çıkıyor. Hatalı cihazların hepsine karar verilir (tamir / sök / hurda).
 * mod "tamir": tamirdeki cihazların sonucu. Onarılanlar depoya girer, kalanlar tamirde bekleyebilir.
 */
export function KaliteFormu({ parti, mod, recete, bilesenAdi, onTamam, onVazgec }: Ortak & { parti: UretimPartisi; mod: "kalite" | "tamir"; recete: string[]; bilesenAdi: (kod: string) => string }) {
  const { bekliyor, h, calistir } = useIslem(onTamam);
  const toplam = mod === "kalite" ? parti.adet : (parti.tamirde ?? 0);
  const [saglam, setSaglam] = useState(String(toplam));
  const [tamir, setTamir] = useState("0");
  const [sok, setSok] = useState("0");
  const [hurda, setHurda] = useState("0");
  const [geri, setGeri] = useState<Record<string, string>>({});
  const [seriTuru, setSeriTuru] = useState<"oto" | "elle">("oto");
  const [seriMetni, setSeriMetni] = useState("");

  const nSaglam = SAYI(saglam);
  const nTamir = mod === "kalite" ? SAYI(tamir) : 0;
  const nSok = SAYI(sok);
  const nHurda = SAYI(hurda);
  const hataliToplam = mod === "kalite" ? toplam - nSaglam : null;
  const dagitilan = nTamir + nSok + nHurda;
  const kalanTamirde = mod === "tamir" ? toplam - nSaglam - dagitilan : 0;
  const geriSayi = (kod: string) => (geri[kod] === undefined ? nSok : SAYI(geri[kod]));
  const yazilanSeri = seriAyikla(seriMetni);

  // Kalite modunda sağlam adedi değişince hatalıların hepsi varsayılan olarak tamire ayrılır; kullanıcı dağıtımı değiştirir
  const saglamDegisti = (v: string) => {
    setSaglam(v);
    if (mod === "kalite") {
      const n = SAYI(v);
      if (gecerli(n, toplam)) { setTamir(String(toplam - n)); setSok("0"); setHurda("0"); }
    }
  };

  let uyari: string | null = null;
  if (!gecerli(nSaglam, toplam)) uyari = `${mod === "kalite" ? "Sağlam" : "Onarılan"} adet 0–${toplam} arası olmalı.`;
  else if (![nTamir, nSok, nHurda].every((n) => gecerli(n, toplam))) uyari = "Adetler 0 veya üzeri tam sayı olmalı.";
  else if (hataliToplam !== null && dagitilan !== hataliToplam) uyari = `${hataliToplam} hatalı cihaz var, ${dagitilan} tanesine karar verildi.`;
  else if (kalanTamirde < 0) uyari = `Tamirde ${toplam} cihaz var; ${toplam - kalanTamirde} yazıldı.`;

  const gonder = () =>
    calistir(() =>
      (mod === "kalite" ? depoyaAl : tamirSonucu)(parti.id, {
        saglam: nSaglam,
        karar: { tamir: nTamir, sok: nSok, hurda: nHurda, geriAlinan: Object.fromEntries(recete.map((kod) => [kod, nSok ? geriSayi(kod) : 0])) },
        seri: seriTuru === "oto" ? null : seriMetni,
      }),
    );

  const hataliVar = mod === "tamir" || (hataliToplam !== null && hataliToplam > 0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); gonder(); }} className="flex flex-col gap-4">
      <SayiAlani
        etiket={mod === "kalite" ? "Kaliteden geçen (sağlam) cihaz" : "Onarılan cihaz"}
        alt={mod === "kalite" ? `Partide ${toplam} cihaz var; kalanlar hatalı sayılır` : `Tamirde ${toplam} cihaz var; onarılanlar depoya girer`}
        deger={saglam} onDeger={saglamDegisti} en={toplam} hata={!!h.saglam}
      />
      <Hata mesaj={h.saglam} />

      {hataliVar && (
        <fieldset className="flex flex-col gap-3 rounded-[14px] border border-line p-3">
          <legend className="px-1 text-[13px] font-bold">
            {mod === "kalite" ? `Hatalı ${hataliToplam ?? 0} cihaz ne olacak?` : "Onarılamayanlar"}
          </legend>
          <div className={`grid gap-3 ${mod === "kalite" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {mod === "kalite" && <SayiAlani etiket="Tamire ayır" alt="Sonra “Tamir sonucu” ile kapanır" deger={tamir} onDeger={setTamir} en={toplam} />}
            <SayiAlani etiket="Sök, parçaları al" alt="Çalışan parçalar stoğa döner" deger={sok} onDeger={setSok} en={toplam} />
            <SayiAlani etiket="Hurdaya ayır" alt="Hiçbir parça geri alınmaz" deger={hurda} onDeger={setHurda} en={toplam} />
          </div>
          {mod === "tamir" && kalanTamirde > 0 && <p className="text-xs text-muted">{kalanTamirde} cihaz tamirde beklemeye devam eder.</p>}

          {nSok > 0 && gecerli(nSok, toplam) && (
            <div className="flex flex-col gap-2 rounded-control bg-[#F8F9F5] p-3">
              <span className="text-[13px] font-bold">
                Sökülen {nSok} cihazdan geri alınacak parçalar
                <span className="block text-xs font-normal text-muted">Arızalı parçanın adedini düşürün (ör. ekran arızasında AMOLED 0); geri alınmayan parçalar hurdaya ayrılır.</span>
              </span>
              {recete.map((kod) => (
                <label key={kod} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2 text-[13px]">
                  <span className="min-w-0 truncate font-semibold">{bilesenAdi(kod)} <span className="font-normal text-muted">{kod}</span></span>
                  <input
                    type="number" min={0} max={nSok} inputMode="numeric" aria-label={`${bilesenAdi(kod)} geri alınan adet`}
                    value={geri[kod] ?? String(nSok)} onChange={(e) => setGeri({ ...geri, [kod]: e.target.value })}
                    className={`${GIRDI} min-h-10 tabular-nums`}
                  />
                </label>
              ))}
            </div>
          )}
          <Hata mesaj={h.karar} />
        </fieldset>
      )}

      {nSaglam > 0 && gecerli(nSaglam, toplam) && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1.5 text-[13px] font-bold">Seri numaraları ({nSaglam} cihaz)</legend>
          <div className="flex flex-wrap gap-2">
            {([["oto", "Otomatik ver"], ["elle", "Kendim gireceğim"]] as const).map(([id, ad]) => (
              <label key={id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-[13px] font-semibold ${seriTuru === id ? "border-ink bg-[#F4F5F0]" : "border-line-strong"}`}>
                <input type="radio" name="seri-turu" checked={seriTuru === id} onChange={() => setSeriTuru(id)} className="accent-[#0E0F0C]" />
                {ad}
              </label>
            ))}
          </div>
          {seriTuru === "oto" ? (
            <p className="text-xs text-muted">Bu ayın sıradaki numaraları verilir (EO1-YYAA-NNNN, kullanılmış numaraların devamı).</p>
          ) : (
            <>
              <textarea
                value={seriMetni} onChange={(e) => setSeriMetni(e.target.value)} rows={Math.min(8, Math.max(3, nSaglam))}
                placeholder={"Her satıra bir seri no\nÖr. EO1-2611-0101"} aria-label="Seri numaraları" aria-invalid={!!h.seri}
                className={`${GIRDI} py-2 font-mono text-[13px]`}
              />
              <span className={`text-xs font-semibold tabular-nums ${yazilanSeri.length === nSaglam ? "text-ok" : "text-muted"}`}>
                {yazilanSeri.length} / {nSaglam} seri no · satır, virgül ya da boşlukla ayırabilirsiniz
              </span>
            </>
          )}
          <Hata mesaj={h.seri} />
        </fieldset>
      )}

      <p className={`rounded-control px-3 py-2.5 text-[13px] ${uyari ? "bg-warn-bg font-semibold text-warn" : "bg-[#F4F5F0] text-[#474A42]"}`}>
        {uyari ??
          [
            nSaglam && `${nSaglam} ${URUN_BILGI[parti.model].ad} depo stoğuna ve seri no havuzuna girer`,
            nTamir && `${nTamir} tamire ayrılır`,
            nSok && `${nSok} sökülür, ${recete.reduce((t, kod) => t + geriSayi(kod), 0)} parça bileşen stoğuna döner`,
            nHurda && `${nHurda} hurdaya ayrılır`,
            kalanTamirde && `${kalanTamirde} tamirde kalır`,
          ].filter(Boolean).join(" · ") + "."}
      </p>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket={mod === "kalite" ? "Depoya al" : "Sonucu kaydet"} onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- Yeni kalem (tedarik ve iç üretim formlarında) ---------- */

const YENI = "__yeni";
type YeniTaslak = { ad: string; kod: string; tur: "bilesen" | "kablo"; kritik: string; hedef: string; modeller: string[] };
const BOS_YENI: YeniTaslak = { ad: "", kod: "", tur: "bilesen", kritik: "", hedef: "", modeller: [] };
const yeniGonder = (y: YeniTaslak): YeniKalem => ({ ...y, kritik: parseInt(y.kritik, 10) || 0, hedef: parseInt(y.hedef, 10) || 0 });
/** Addan öneri kod: "Pil kapağı · ONE" → "PIL-KAPAGI-ONE" */
const kodOner = (ad: string) =>
  ad.toLocaleUpperCase("tr-TR").replace(/Ç/g, "C").replace(/Ğ/g, "G").replace(/İ/g, "I").replace(/Ö/g, "O").replace(/Ş/g, "S").replace(/Ü/g, "U")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

function YeniKalemAlanlari({ y, setY, h, sadeceBilesen }: { y: YeniTaslak; setY: (y: YeniTaslak) => void; h: Record<string, string>; sadeceBilesen?: boolean }) {
  const [kodElle, setKodElle] = useState(false);
  return (
    <fieldset className="flex flex-col gap-3 rounded-[14px] border border-line bg-[#F8F9F5] p-3">
      <legend className="px-1 text-[13px] font-bold">Yeni kalem</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Ad
          <input autoFocus value={y.ad} onChange={(e) => setY({ ...y, ad: e.target.value, kod: kodElle ? y.kod : kodOner(e.target.value) })} placeholder="Ör. Pil kapağı · ONE" maxLength={80} className={GIRDI} aria-invalid={!!h.yeniAd} />
          <Hata mesaj={h.yeniAd} />
        </label>
        <label className={ALAN}>
          Stok kodu
          <input value={y.kod} onChange={(e) => { setKodElle(true); setY({ ...y, kod: e.target.value.toUpperCase() }); }} placeholder="PIL-KAPAGI-ONE" maxLength={24} className={`${GIRDI} font-mono`} aria-invalid={!!h.yeniKod} />
          <Hata mesaj={h.yeniKod} />
        </label>
      </div>
      {!sadeceBilesen && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kalem türü">
          {([["bilesen", "Üretim bileşeni"], ["kablo", "Kablo / aksesuar (sipariş deposu)"]] as const).map(([id, ad]) => (
            <label key={id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border bg-card px-3 text-[13px] font-semibold ${y.tur === id ? "border-ink" : "border-line-strong"}`}>
              <input type="radio" name="yeni-tur" checked={y.tur === id} onChange={() => setY({ ...y, tur: id })} className="accent-[#0E0F0C]" />
              {ad}
            </label>
          ))}
        </div>
      )}
      {y.tur === "bilesen" && (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <span className="font-bold">Reçete <span className="font-normal text-muted">· hangi cihazda kullanılır? (üretime alınınca cihaz başına 1 adet düşer)</span></span>
          <div className="flex flex-wrap gap-3">
            {CIHAZ_MODELLERI.map((m) => (
              <label key={m} className="flex min-h-9 cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox" checked={y.modeller.includes(m)} className="h-4 w-4 accent-[#0E0F0C]"
                  onChange={(e) => setY({ ...y, modeller: e.target.checked ? [...y.modeller, m] : y.modeller.filter((x) => x !== m) })}
                />
                {URUN_BILGI[m].ad}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Kritik seviye
          <input type="number" min={0} inputMode="numeric" value={y.kritik} onChange={(e) => setY({ ...y, kritik: e.target.value })} className={`${GIRDI} tabular-nums`} aria-invalid={!!h.yeniKritik} />
          <Hata mesaj={h.yeniKritik} />
        </label>
        <label className={ALAN}>
          Hedef stok
          <input type="number" min={1} inputMode="numeric" value={y.hedef} onChange={(e) => setY({ ...y, hedef: e.target.value })} className={`${GIRDI} tabular-nums`} aria-invalid={!!h.yeniHedef} />
          <Hata mesaj={h.yeniHedef} />
        </label>
      </div>
      <Hata mesaj={h.yeniTur} />
    </fieldset>
  );
}

/* ---------- Tedarik siparişi (dış tedarik) ---------- */

export function TedarikFormu({
  kalemler,
  tedarikciler,
  bugun,
  onTamam,
  onVazgec,
}: Ortak & { kalemler: { kod: string; ad: string; grup: string }[]; tedarikciler: string[]; bugun: string }) {
  const { bekliyor, h, calistir } = useIslem(onTamam);
  const [v, setV] = useState({ tedarikci: "", kalemKodu: "", adet: "", beklenen: bugun });
  const [y, setY] = useState<YeniTaslak>(BOS_YENI);
  const yeni = v.kalemKodu === YENI;
  const gruplar = [...new Set(kalemler.map((k) => k.grup))];
  return (
    <form onSubmit={(e) => { e.preventDefault(); calistir(() => tedarikVer({ ...v, adet: parseInt(v.adet, 10) || 0, yeni: yeni ? yeniGonder(y) : null })); }} className="flex flex-col gap-4">
      <label className={ALAN}>
        Kalem
        <select value={v.kalemKodu} onChange={(e) => setV({ ...v, kalemKodu: e.target.value })} className={GIRDI} aria-invalid={!!h.kalemKodu}>
          <option value="" disabled>Seçin</option>
          {gruplar.map((gr) => (
            <optgroup key={gr} label={gr}>
              {kalemler.filter((k) => k.grup === gr).map((k) => <option key={k.kod} value={k.kod}>{k.ad}</option>)}
            </optgroup>
          ))}
          <option value={YENI}>+ Listede yok, yeni kalem tanımla</option>
        </select>
        <Hata mesaj={h.kalemKodu} />
      </label>
      {yeni && <YeniKalemAlanlari y={y} setY={setY} h={h} />}
      <label className={ALAN}>
        Tedarikçi
        <input list="tedarikciler" value={v.tedarikci} onChange={(e) => setV({ ...v, tedarikci: e.target.value })} placeholder="Ör. Shenzhen Display Co." className={GIRDI} aria-invalid={!!h.tedarikci} />
        <datalist id="tedarikciler">{tedarikciler.map((t) => <option key={t} value={t} />)}</datalist>
        <Hata mesaj={h.tedarikci} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Adet
          <input type="number" min={1} inputMode="numeric" value={v.adet} onChange={(e) => setV({ ...v, adet: e.target.value })} className={`${GIRDI} tabular-nums`} aria-invalid={!!h.adet} />
          <Hata mesaj={h.adet} />
        </label>
        <label className={ALAN}>
          Beklenen teslim
          <input type="date" min={bugun} value={v.beklenen} onChange={(e) => setV({ ...v, beklenen: e.target.value })} className={GIRDI} aria-invalid={!!h.beklenen} />
          <Hata mesaj={h.beklenen} />
        </label>
      </div>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Siparişi kaydet" onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- İç üretim ---------- */

export function IcUretimFormu({ bilesenler, bugun, onTamam, onVazgec }: Ortak & { bilesenler: BilesenKalemi[]; bugun: string }) {
  const { bekliyor, h, calistir } = useIslem(onTamam);
  const icler = bilesenler.filter((b) => b.kaynak === "ic");
  const digerleri = bilesenler.filter((b) => b.kaynak !== "ic");
  const [v, setV] = useState({ kalemKodu: icler[0]?.kod ?? "", hedef: "", baslangic: bugun, gun: "", not: "" });
  const [y, setY] = useState<YeniTaslak>({ ...BOS_YENI, tur: "bilesen" });
  const yeni = v.kalemKodu === YENI;
  const hedef = parseInt(v.hedef, 10) || 0;
  const gun = parseInt(v.gun, 10) || 0;
  const secili = bilesenler.find((b) => b.kod === v.kalemKodu);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); calistir(() => icUretimBaslat({ ...v, hedef, gun, yeni: yeni ? yeniGonder(y) : null })); }}
      className="flex flex-col gap-4"
    >
      <label className={ALAN}>
        Üretilecek bileşen
        <select value={v.kalemKodu} onChange={(e) => setV({ ...v, kalemKodu: e.target.value })} className={GIRDI} aria-invalid={!!h.kalemKodu}>
          <option value="" disabled>Seçin</option>
          {icler.length > 0 && <optgroup label="İç üretim">{icler.map((b) => <option key={b.kod} value={b.kod}>{b.ad}</option>)}</optgroup>}
          {digerleri.length > 0 && <optgroup label="Şimdiye kadar dışarıdan alınan">{digerleri.map((b) => <option key={b.kod} value={b.kod}>{b.ad}</option>)}</optgroup>}
          <option value={YENI}>+ Listede yok, yeni bileşen tanımla</option>
        </select>
        {secili && secili.kaynak !== "ic" && <span className="text-xs font-normal text-muted">Bu bileşen bundan sonra “iç üretim” olarak görünür.</span>}
        <Hata mesaj={h.kalemKodu} />
      </label>
      {yeni && <YeniKalemAlanlari y={y} setY={setY} h={h} sadeceBilesen />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ALAN}>
          Hedef adet
          <input type="number" min={1} inputMode="numeric" value={v.hedef} onChange={(e) => setV({ ...v, hedef: e.target.value })} placeholder="100" className={`${GIRDI} tabular-nums`} aria-invalid={!!h.hedef} />
          <Hata mesaj={h.hedef} />
        </label>
        <label className={ALAN}>
          Süre (gün)
          <input type="number" min={1} max={365} inputMode="numeric" value={v.gun} onChange={(e) => setV({ ...v, gun: e.target.value })} placeholder="10" className={`${GIRDI} tabular-nums`} aria-invalid={!!h.gun} />
          <Hata mesaj={h.gun} />
        </label>
        <label className={ALAN}>
          Başlangıç
          <input type="date" value={v.baslangic} onChange={(e) => setV({ ...v, baslangic: e.target.value })} className={GIRDI} aria-invalid={!!h.baslangic} />
          <Hata mesaj={h.baslangic} />
        </label>
      </div>
      <label className={ALAN}>
        <span>Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input value={v.not} onChange={(e) => setV({ ...v, not: e.target.value })} maxLength={200} placeholder="Ör. Enjeksiyon kalıbı 2" className={GIRDI} />
      </label>
      <p className="rounded-control bg-[#F4F5F0] px-3 py-2.5 text-[13px] text-[#474A42]">
        {hedef > 0 && gun > 0 && v.baslangic
          ? `${gun} günde ${hedef} adet: günde ortalama ${Math.ceil(hedef / gun)} adet, bitiş ${tarihKisa(isoGunEkle(v.baslangic, gun - 1))}. Personel her gün sonunda ürettiğini girer; adet bileşen stoğuna eklenir.`
          : "Hedef adet ve süreyi yazın; personel her gün sonunda ürettiği adedi girer, kalan adet ve gün otomatik hesaplanır."}
      </p>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Emri başlat" onVazgec={onVazgec} />
    </form>
  );
}

/** Personelin gün sonu üretim girişi */
export function GunlukGirisFormu({ emir, personeller, bugun, onTamam, onVazgec }: Ortak & { emir: IcUretimEmri; personeller: string[]; bugun: string }) {
  const { bekliyor, h, calistir } = useIslem(onTamam);
  const [v, setV] = useState({ tarih: bugun, adet: "", personel: "", not: "" });
  const adet = parseInt(v.adet, 10) || 0;
  const once = icUretimDurumu(emir, bugun);
  const sonra = icUretimDurumu({ ...emir, girisler: [...emir.girisler, { tarih: v.tarih, adet }] }, bugun);
  return (
    <form onSubmit={(e) => { e.preventDefault(); calistir(() => icUretimGir(emir.id, { ...v, adet })); }} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Üretilen adet
          <input autoFocus type="number" min={1} inputMode="numeric" value={v.adet} onChange={(e) => setV({ ...v, adet: e.target.value })} placeholder={String(once.gereken || "")} className={`${GIRDI} tabular-nums`} aria-invalid={!!h.adet} />
          <Hata mesaj={h.adet} />
        </label>
        <label className={ALAN}>
          Tarih
          <input type="date" min={emir.baslangic} max={bugun} value={v.tarih} onChange={(e) => setV({ ...v, tarih: e.target.value })} className={GIRDI} aria-invalid={!!h.tarih} />
          <Hata mesaj={h.tarih} />
        </label>
      </div>
      <label className={ALAN}>
        Giren personel
        <select value={v.personel} onChange={(e) => setV({ ...v, personel: e.target.value })} className={GIRDI} aria-invalid={!!h.personel}>
          <option value="" disabled>Seçin</option>
          {personeller.map((p) => <option key={p}>{p}</option>)}
        </select>
        <Hata mesaj={h.personel} />
      </label>
      <label className={ALAN}>
        <span>Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input value={v.not} onChange={(e) => setV({ ...v, not: e.target.value })} maxLength={200} placeholder="Ör. Kalıp bakımı 1 saat sürdü" className={GIRDI} />
      </label>
      <dl className="grid grid-cols-3 gap-2 rounded-control bg-[#F4F5F0] p-3 text-center text-[13px]">
        {[
          ["Üretilen", once.uretilen, sonra.uretilen],
          ["Kalan adet", once.kalan, sonra.kalan],
          ["Kalan gün", once.kalanGun, sonra.kalanGun],
        ].map(([ad, a, b]) => (
          <div key={ad} className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-muted">{ad}</dt>
            <dd className="font-extrabold tabular-nums">
              {adet > 0 && a !== b ? <>{a} → <span className="text-ok">{b}</span></> : a}
            </dd>
          </div>
        ))}
      </dl>
      <Hata mesaj={h.genel} />
      <Altlik bekliyor={bekliyor} etiket="Girişi kaydet" onVazgec={onVazgec} />
    </form>
  );
}
