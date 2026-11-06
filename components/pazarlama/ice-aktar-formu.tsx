"use client";

// Kitle içe aktarma: CSV / Excel dosyası ya da Excel'den yapıştırılan tablo → sütun eşleme → izin beyanı → hedef liste.
// Dosya tarayıcıda okunur; sunucuya yalnızca eşlenmiş kişiler gönderilir.
import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { IZIN_KAYNAKLARI, IZIN_KANAL_ADI, type IzinKanali } from "@/components/musteriler/izin";
import { csvCoz, tabloOku } from "@/lib/tablo-oku";
import { listeIceAktar, type ListeSonucu } from "./actions";
import type { AktarilanKisi } from "./queries";
import { telefonRakam } from "./ortak";

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const ALAN = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold";
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Alan = "firma" | "kisi" | "eposta" | "telefon" | "ulke";
const ALANLAR: { id: Alan; ad: string; ipucu: string[] }[] = [
  { id: "firma", ad: "Firma", ipucu: ["firma", "sirket", "company", "kurum", "isletme", "organization"] },
  { id: "kisi", ad: "Yetkili / ad soyad", ipucu: ["adsoyad", "yetkili", "isim", "kisi", "name", "contact", "ad"] },
  { id: "eposta", ad: "E-posta", ipucu: ["eposta", "email", "mail"] },
  { id: "telefon", ad: "Telefon / WhatsApp", ipucu: ["telefon", "whatsapp", "gsm", "cep", "phone", "mobile", "tel"] },
  { id: "ulke", ad: "Ülke / şehir", ipucu: ["ulke", "country", "sehir", "city", "il"] },
];
const IZINLER: IzinKanali[] = ["eposta", "whatsapp", "sms"];

const sade = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[^a-z0-9]/g, "");
const harf = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));

/** Başlık satırından alanları tahmin eder: "E-posta adresi" → eposta */
function eslemeTahmini(baslik: string[]): Record<Alan, number> {
  const e = { firma: -1, kisi: -1, eposta: -1, telefon: -1, ulke: -1 } as Record<Alan, number>;
  const kullanilan = new Set<number>();
  for (const a of ALANLAR) {
    const i = baslik.findIndex((b, n) => !kullanilan.has(n) && a.ipucu.some((ip) => (ip.length <= 3 ? sade(b) === ip : sade(b).includes(ip))));
    if (i >= 0) {
      e[a.id] = i;
      kullanilan.add(i);
    }
  }
  return e;
}

export default function IceAktarFormu({ onKaydedildi, onVazgec }: { onKaydedildi: (s: ListeSonucu) => void; onVazgec: () => void }) {
  const [bekliyor, baslat] = useTransition();
  const [okunuyor, setOkunuyor] = useState(false);
  const [h, setH] = useState<Record<string, string>>({});
  const [kaynak, setKaynak] = useState("");
  const [satirlar, setSatirlar] = useState<string[][]>([]);
  const [baslikVar, setBaslikVar] = useState(true);
  const [esleme, setEsleme] = useState<Record<Alan, number>>({ firma: -1, kisi: -1, eposta: -1, telefon: -1, ulke: -1 });
  const [ad, setAd] = useState("");
  const [izinler, setIzinler] = useState<IzinKanali[]>([]);
  const [izinKaynagi, setIzinKaynagi] = useState("");
  const [yapistir, setYapistir] = useState(false);

  const yukle = (rows: string[][], dosyaAdi: string) => {
    if (!rows.length) {
      setH({ dosya: "Dosyada satır bulunamadı." });
      return;
    }
    const tahmin = eslemeTahmini(rows[0]);
    const baslik = Object.values(tahmin).some((x) => x >= 0);
    setSatirlar(rows);
    setBaslikVar(baslik);
    setEsleme(baslik ? tahmin : eslemeTahmini([]));
    setKaynak(dosyaAdi);
    setAd((a) => a || dosyaAdi.replace(/\.[^.]+$/, "").slice(0, 60));
    setH({});
  };

  const dosyaSec = async (f: File | undefined) => {
    if (!f) return;
    setOkunuyor(true);
    try {
      yukle(await tabloOku(f), f.name);
    } catch (e) {
      setH({ dosya: e instanceof Error ? e.message : "Dosya okunamadı." });
    } finally {
      setOkunuyor(false);
    }
  };

  const sutunSayisi = Math.max(0, ...satirlar.slice(0, 50).map((s) => s.length));
  const sutunAdi = (i: number) => (baslikVar && satirlar[0]?.[i] ? `${harf(i)} · ${satirlar[0][i]}` : `Sütun ${harf(i)}`);
  const veri = baslikVar ? satirlar.slice(1) : satirlar;

  const { kisiler, tekrar, gecersiz } = useMemo(() => {
    const al = (s: string[], a: Alan) => (esleme[a] >= 0 ? (s[esleme[a]] ?? "").trim() : "");
    const gorulen = new Set<string>();
    let tekrar = 0;
    let gecersiz = 0;
    const kisiler: AktarilanKisi[] = [];
    for (const s of veri) {
      const epostaHam = al(s, "eposta").toLocaleLowerCase("en");
      const eposta = EPOSTA.test(epostaHam) ? epostaHam : "";
      const telefon = al(s, "telefon");
      const anahtar = eposta || telefonRakam(telefon);
      if (!anahtar) {
        gecersiz++;
        continue;
      }
      if (gorulen.has(anahtar)) {
        tekrar++;
        continue;
      }
      gorulen.add(anahtar);
      kisiler.push({ firma: al(s, "firma"), kisi: al(s, "kisi"), eposta, telefon: telefon ? `+${telefonRakam(telefon)}` : "", ulke: al(s, "ulke"), kanallar: [] });
    }
    return { kisiler, tekrar, gecersiz };
  }, [veri, esleme]);

  const kaydet = () =>
    baslat(async () => {
      const s = await listeIceAktar({ ad, kaynak, izinler, izinKaynagi, kisiler });
      if (s.hatalar || s.hata) setH(s.hatalar ?? { genel: s.hata ?? "" });
      else onKaydedildi(s);
    });

  return (
    <form onSubmit={(e) => { e.preventDefault(); kaydet(); }} className="flex flex-col gap-4">
      {/* 1. Kaynak */}
      {satirlar.length === 0 ? (
        <div className="flex flex-col gap-3">
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-[#F8F9F5] p-5 text-center hover:border-ink"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); dosyaSec(e.dataTransfer.files[0]); }}
          >
            <Upload size={22} aria-hidden="true" className="text-muted" />
            <b className="text-sm">{okunuyor ? "Okunuyor…" : "CSV ya da Excel dosyası seçin"}</b>
            <span className="text-xs text-muted">.csv, .xlsx veya .txt · sürükleyip bırakabilirsiniz · en fazla 5.000 kişi</span>
            <input type="file" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => dosyaSec(e.target.files?.[0])} />
          </label>
          {h.dosya && <span role="alert" className="text-xs font-semibold text-err">{h.dosya}</span>}
          <button type="button" onClick={() => setYapistir((x) => !x)} aria-expanded={yapistir} className="self-start text-[13px] font-bold text-info hover:underline">
            Dosya yerine Excel&apos;den kopyalayıp yapıştırın
          </button>
          {yapistir && (
            <textarea
              rows={6}
              placeholder={"Excel'de satırları seçip kopyalayın, buraya yapıştırın.\nFirma\tYetkili\tE-posta\tTelefon"}
              onPaste={(e) => {
                e.preventDefault();
                yukle(csvCoz(e.clipboardData.getData("text")), "Yapıştırılan tablo");
              }}
              className={`${GIRDI} py-2 font-mono text-xs`}
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-control bg-[#F4F5F0] px-3 py-2.5 text-[13px]">
            <FileSpreadsheet size={18} aria-hidden="true" className="text-muted" />
            <b className="min-w-0 flex-1 truncate">{kaynak}</b>
            <span className="text-muted tabular-nums">{veri.length} satır</span>
            <button type="button" onClick={() => setSatirlar([])} className="font-bold text-info hover:underline">Değiştir</button>
          </div>

          {/* 2. Sütun eşleme */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 flex w-full flex-wrap items-center gap-2 text-[13px] font-bold">
              Sütunları eşleyin
              <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#474A42]">
                <input type="checkbox" checked={baslikVar} onChange={(e) => setBaslikVar(e.target.checked)} className="size-4 accent-[#0E0F0C]" />
                İlk satır başlık
              </label>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALANLAR.map((a) => (
                <label key={a.id} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2 text-[13px] font-semibold">
                  {a.ad}
                  <select value={esleme[a.id]} onChange={(e) => setEsleme({ ...esleme, [a.id]: Number(e.target.value) })} className={`${GIRDI} min-h-10`}>
                    <option value={-1}>— Yok —</option>
                    {Array.from({ length: sutunSayisi }, (_, i) => <option key={i} value={i}>{sutunAdi(i)}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Önizleme */}
          <div className="overflow-x-auto rounded-control border border-line">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-[#F8F9F5] text-left text-muted">
                <tr>{ALANLAR.map((a) => <th key={a.id} className="px-2 py-2 font-semibold">{a.ad}</th>)}</tr>
              </thead>
              <tbody>
                {kisiler.slice(0, 4).map((k, i) => (
                  <tr key={i} className="border-t border-bg">
                    {ALANLAR.map((a) => <td key={a.id} className="max-w-[160px] truncate px-2 py-1.5">{k[a.id] || <span className="text-muted">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`rounded-control px-3 py-2.5 text-[13px] font-semibold ${kisiler.length ? "bg-[#F4F5F0]" : "bg-warn-bg text-warn"}`} aria-live="polite">
            {kisiler.length} kişi aktarılacak
            {tekrar > 0 && ` · ${tekrar} tekrar eden atlandı`}
            {gecersiz > 0 && ` · ${gecersiz} satırda geçerli e-posta ya da telefon yok`}
          </p>
          {h.kisiler && <span role="alert" className="text-xs font-semibold text-err">{h.kisiler}</span>}

          {/* 3. Liste adı ve izin */}
          <label className={ALAN}>
            Liste adı *
            <input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={60} className={GIRDI} aria-invalid={!!h.ad} />
            {h.ad && <span className="text-xs font-semibold text-err">{h.ad}</span>}
          </label>
          <fieldset className="flex flex-col gap-2 rounded-control border border-line p-3">
            <legend className="px-1 text-[13px] font-bold">Bu kişilerden hangi kanallarda ticari ileti izni alındı?</legend>
            <div className="flex flex-wrap gap-2">
              {IZINLER.map((k) => (
                <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-line-strong px-3 text-[13px] font-semibold has-checked:border-ink has-checked:bg-[#F3FBD6]">
                  <input type="checkbox" checked={izinler.includes(k)} onChange={() => setIzinler((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))} className="size-4 accent-[#0E0F0C]" />
                  {IZIN_KANAL_ADI[k]}
                </label>
              ))}
            </div>
            {izinler.length > 0 && (
              <label className={ALAN}>
                İzin nereden alındı? *
                <select value={izinKaynagi} onChange={(e) => setIzinKaynagi(e.target.value)} className={GIRDI} aria-invalid={!!h.izinKaynagi}>
                  <option value="" disabled>Seçin</option>
                  {IZIN_KAYNAKLARI.map((k) => <option key={k}>{k}</option>)}
                </select>
                {h.izinKaynagi && <span className="text-xs font-semibold text-err">{h.izinKaynagi}</span>}
              </label>
            )}
            <span className="text-xs text-muted">
              Yalnızca gerçekten izin verdiyse işaretleyin. İşaretlemezseniz liste indirilebilir ama bu kişilere CRM&apos;den kampanya mesajı gönderilmez.
            </span>
          </fieldset>
        </>
      )}

      {h.genel && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{h.genel}</p>}
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor || !kisiler.length} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60">
          {bekliyor ? "Aktarılıyor…" : `${kisiler.length || ""} kişiyi aktar`}
        </button>
      </div>
    </form>
  );
}
