"use client";

// Bayi portalı "Lisanslar": özet kartları, 12 aylık bitiş takvimi, sekmeli lisans listesi,
// seçilen lisansları plan / süre seçerek tek siparişte yenileme ve müşteriye hazır hatırlatma metni.
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Chip from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { portalHavuzdanYenile, portalLisansYenile, type PortalFormDurumu } from "./actions";
import { paraYaz } from "./katalog";
import type { PortalLisans } from "./lisanslar";
import { PORTAL_GIRDI } from "./stil";

type Plan = "Basic" | "Pro" | "Pro+";
type Sekme = "yakinda" | "dolmus" | "aktif" | "tumu";
type Props = {
  bugun: string;
  bayiAd: string;
  indirim: number;
  lisanslar: PortalLisans[];
  fiyatlar: Record<Plan, { liste: number; bayi: number }>;
  takvim: { anahtar: string; ad: string; adet: number; tutar: number }[];
  paraBirimi: "EUR" | "TRY";
  kur: number;
  hedef: number;
  ozet: { aktif: number; otuz: number; dolmus: number; doksanAdet: number; doksanTutar: number; oran: number | null };
  havuz: { paket: string; sureAy: number; adet: number; kaynak: string; tarih: string }[]; // bayinin lisans havuzu
};

const PLANLAR: Plan[] = ["Basic", "Pro", "Pro+"];
const SURELER = [12, 24, 36];
const tarihTr = (t: string | null) => (t ? new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const tarihEn = (t: string) => new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function LisanslarGorunumu(p: Props) {
  const py = (n: number) => paraYaz(n, p.paraBirimi, p.kur);
  const [sekme, setSekme] = useState<Sekme>(p.ozet.otuz || p.ozet.dolmus ? "yakinda" : "tumu");
  const [ay, setAy] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [secili, setSecili] = useState<Record<string, Plan>>({}); // seriNo → yenilenecek plan
  const [sure, setSure] = useState(12);
  const [hatirlat, setHatirlat] = useState<PortalLisans | null>(null);

  const [durum, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(portalLisansYenile, {});
  const [, baslat] = useTransition();
  const router = useRouter();
  const son = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) {
      son.current = durum.zaman;
      setSecili({});
      router.refresh();
    }
  }, [durum, router]);

  const q = arama.trim().toLocaleLowerCase("tr");
  const liste = useMemo(() => p.lisanslar.filter((l) => {
    if (q && !l.seriNo.toLocaleLowerCase("tr").includes(q) && !l.musteri.toLocaleLowerCase("tr").includes(q)) return false;
    if (ay) return !!l.bitis?.startsWith(ay);
    if (sekme === "yakinda") return l.kalan !== null && l.kalan >= 0 && l.kalan <= 60;
    if (sekme === "dolmus") return l.kalan === null || l.kalan < 0;
    if (sekme === "aktif") return l.kalan !== null && l.kalan > 60;
    return true;
  }), [p.lisanslar, q, ay, sekme]);

  const sayilar: Record<Sekme, number> = {
    yakinda: p.lisanslar.filter((l) => l.kalan !== null && l.kalan >= 0 && l.kalan <= 60).length,
    dolmus: p.lisanslar.filter((l) => l.kalan === null || l.kalan < 0).length,
    aktif: p.lisanslar.filter((l) => l.kalan !== null && l.kalan > 60).length,
    tumu: p.lisanslar.length,
  };
  const seciliListe = p.lisanslar.filter((l) => secili[l.seriNo]);
  // Lisans havuzu: paket başına kalan adet; seçilen yenilemeler havuzdan karşılanabiliyor mu?
  const havuzAdet = p.havuz.reduce<Record<string, number>>((t, k) => ((t[k.paket] = (t[k.paket] ?? 0) + k.adet), t), {});
  const gerekli = seciliListe.reduce<Record<string, number>>((t, l) => ((t[secili[l.seriNo]] = (t[secili[l.seriNo]] ?? 0) + 1), t), {});
  const havuzYeter = seciliListe.length > 0 && Object.entries(gerekli).every(([pl, n]) => (havuzAdet[pl] ?? 0) >= n);
  const [havuzBekliyor, havuzBaslat] = useTransition();
  const [havuzSonuc, setHavuzSonuc] = useState<PortalFormDurumu>({});
  const havuzdanYenile = () => havuzBaslat(async () => {
    const s = await portalHavuzdanYenile(seciliListe.map((l) => ({ seriNo: l.seriNo, plan: secili[l.seriNo] })));
    setHavuzSonuc(s);
    if (s.tamam) { setSecili({}); router.refresh(); }
  });
  const toplam = seciliListe.reduce((t, l) => t + p.fiyatlar[secili[l.seriNo]].bayi * (sure / 12), 0);
  const hepsiSecili = liste.length > 0 && liste.every((l) => secili[l.seriNo]);
  const sec = (l: PortalLisans, plan?: Plan) =>
    setSecili((s) => {
      const y = { ...s };
      if (plan) y[l.seriNo] = plan;
      else if (y[l.seriNo]) delete y[l.seriNo];
      else y[l.seriNo] = (PLANLAR.includes(l.plan as Plan) ? l.plan : "Pro") as Plan;
      return y;
    });
  const maksAy = Math.max(1, ...p.takvim.map((t) => t.adet));

  const KART = "flex flex-col gap-1 rounded-card border border-line bg-card p-4";
  return (
    <div className="flex flex-col gap-4">
      {/* Özet */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className={KART}><span className="text-xs font-semibold text-muted">Aktif lisans</span><b className="text-2xl tabular-nums">{p.ozet.aktif}</b></div>
        <div className={KART}><span className="text-xs font-semibold text-muted">30 gün içinde biten</span><b className={`text-2xl tabular-nums ${p.ozet.otuz ? "text-[#B25A12]" : ""}`}>{p.ozet.otuz}</b></div>
        <div className={KART}><span className="text-xs font-semibold text-muted">Süresi dolmuş</span><b className={`text-2xl tabular-nums ${p.ozet.dolmus ? "text-[#D93F3F]" : ""}`}>{p.ozet.dolmus}</b></div>
        <div className={KART}>
          <span className="text-xs font-semibold text-muted">90 gün yenileme potansiyeli</span>
          <b className="text-2xl tabular-nums">{py(p.ozet.doksanTutar)}</b>
          <span className="text-xs text-muted">{p.ozet.doksanAdet} lisans · bayi fiyatı</span>
          {p.ozet.oran !== null && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="h-1.5 min-w-16 flex-1 basis-full rounded-full bg-bg sm:basis-auto"><span className={`block h-1.5 rounded-full ${p.ozet.oran >= p.hedef ? "bg-[#1F8A4C]" : "bg-[#E58A2B]"}`} style={{ width: `${Math.min(100, p.ozet.oran)}%` }} /></span>
              <span className="font-semibold">Yenileme %{p.ozet.oran} <span className="text-muted">/ hedef %{p.hedef}</span></span>
            </span>
          )}
        </div>
      </div>

      {/* Lisans havuzu */}
      <section aria-label="Lisans havuzu" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[17px] font-extrabold">Lisans havuzunuz</h2>
          <span className="text-xs text-muted">satın aldığınız, henüz cihaza atanmamış lisanslar · satışta ya da yenilemede kullanın</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["Basic", "Pro", "Pro+"] as const).map((pl) => (
            <div key={pl} className={`flex flex-col gap-0.5 rounded-xl p-3 ${havuzAdet[pl] ? "bg-lime-bg" : "bg-[#F4F5F0]"}`}>
              <span className="text-xs font-semibold text-muted">ONESuite {pl}</span>
              <b className="text-2xl tabular-nums">{havuzAdet[pl] ?? 0}</b>
            </div>
          ))}
        </div>
        {p.havuz.length > 0 && <p className="text-xs text-muted">{p.havuz.map((k) => `${k.adet}× ${k.paket} (${k.sureAy} ay) · sipariş #${k.kaynak}`).join(" · ")}</p>}
        <p className="text-xs text-muted">Havuza lisans eklemek için Sipariş ver › ONESuite lisans&apos;tan sipariş verin; Embedra ödemeyi onaylayınca lisanslar buraya düşer.</p>
      </section>

      {/* Takvim */}
      <section aria-label="Yenileme takvimi" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[17px] font-extrabold">Yenileme takvimi</h2>
          <span className="text-xs text-muted">önümüzdeki 12 ay · aya tıklayınca o ay bitenler listelenir</span>
          {ay && <button type="button" onClick={() => setAy(null)} className="ml-auto cursor-pointer text-[13px] font-bold text-info hover:underline">Ay filtresini kaldır</button>}
        </div>
        <ol className="grid grid-cols-12 items-end gap-1.5">
          {p.takvim.map((t) => (
            <li key={t.anahtar} className="flex flex-col items-center">
              <button type="button" disabled={!t.adet} aria-pressed={ay === t.anahtar} onClick={() => setAy(ay === t.anahtar ? null : t.anahtar)}
                title={`${t.ad}: ${t.adet} lisans · ${py(t.tutar)}`}
                className="group flex h-28 w-full cursor-pointer flex-col items-center justify-end gap-1 disabled:cursor-default">
                <span className="text-[11px] font-bold tabular-nums">{t.adet || ""}</span>
                <span className={`w-full max-w-8 rounded-t ${ay === t.anahtar ? "bg-ink" : t.adet ? "bg-lime group-hover:bg-[#D9F04A]" : "bg-bg"}`} style={{ height: t.adet ? Math.max(6, (t.adet / maksAy) * 80) : 3 }} />
              </button>
              <span className={`mt-1 whitespace-nowrap text-[10px] sm:text-[11px] ${ay === t.anahtar ? "font-bold" : "text-muted"}`}>{t.ad}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Liste */}
      <section aria-label="Lisanslar" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {!ay && ([["yakinda", "60 gün içinde"], ["dolmus", "Süresi dolmuş"], ["aktif", "Aktif"], ["tumu", "Tümü"]] as const).map(([k, ad]) => (
            <button key={k} type="button" aria-pressed={sekme === k} onClick={() => setSekme(k)}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-bold ${sekme === k ? "border-ink bg-ink text-white" : "border-line-strong hover:border-ink"}`}>
              {ad} <span className={`rounded-full px-1.5 text-xs tabular-nums ${sekme === k ? "bg-lime text-ink" : "bg-bg"}`}>{sayilar[k]}</span>
            </button>
          ))}
          {ay && <b className="text-sm">{p.takvim.find((t) => t.anahtar === ay)?.ad} ayında bitenler</b>}
          <input type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Seri no veya müşteri…" aria-label="Ara" className={`${PORTAL_GIRDI} ml-auto w-full sm:w-60`} />
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold text-muted">
                <th className="w-10 py-2"><input type="checkbox" aria-label="Tümünü seç" checked={hepsiSecili} onChange={() => setSecili(hepsiSecili ? {} : Object.fromEntries(liste.map((l) => [l.seriNo, (PLANLAR.includes(l.plan as Plan) ? l.plan : "Pro") as Plan])))} className="h-4 w-4 accent-[#0E0F0C]" /></th>
                <th className="py-2 pr-3">Cihaz · müşteri</th><th className="py-2 pr-3">Mevcut</th><th className="py-2 pr-3">Bitiş</th><th className="py-2 pr-3">Yenileme planı</th><th className="py-2 pr-3 text-right">Yıllık (bayi)</th><th className="py-2 text-right">Müşteri</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((l) => {
                const s = secili[l.seriNo];
                const plan = s ?? ((PLANLAR.includes(l.plan as Plan) ? l.plan : "Pro") as Plan);
                const yukseltme = l.plan === "Basic" && !s;
                return (
                  <tr key={l.seriNo} className={`border-b border-bg align-middle last:border-0 ${s ? "bg-lime-bg" : ""}`}>
                    <td className="py-2.5"><input type="checkbox" aria-label={`${l.seriNo} seç`} checked={!!s} onChange={() => sec(l)} className="h-4 w-4 accent-[#0E0F0C]" /></td>
                    <td className="py-2.5 pr-3"><span className="block font-mono text-xs font-semibold">{l.seriNo}</span>{l.musteri}</td>
                    <td className="py-2.5 pr-3">{l.plan}{l.talepVar && <span className="ml-1.5"><Chip ton="info">Talep var</Chip></span>}</td>
                    <td className="py-2.5 pr-3">
                      {tarihTr(l.bitis)}
                      {l.kalan !== null && (
                        <span className={`block text-xs font-semibold ${l.kalan < 0 ? "text-[#D93F3F]" : l.kalan <= 30 ? "text-[#B25A12]" : "text-muted"}`}>
                          {l.kalan < 0 ? `${-l.kalan} gün önce doldu` : `${l.kalan} gün kaldı`}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select aria-label={`${l.seriNo} yenileme planı`} value={plan} onChange={(e) => sec(l, e.target.value as Plan)} className={`${PORTAL_GIRDI} min-h-9`}>
                        {PLANLAR.map((x) => <option key={x} value={x}>{x}{x === l.plan ? " (aynı)" : PLANLAR.indexOf(x) > PLANLAR.indexOf(l.plan as Plan) ? " ↑ yükselt" : ""}</option>)}
                      </select>
                      {yukseltme && <span className="mt-1 block text-[11px] text-info">Pro&apos;ya geçiş +{py(p.fiyatlar.Pro.bayi - p.fiyatlar.Basic.bayi)}/yıl</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{py(p.fiyatlar[plan].bayi)}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => setHatirlat(l)} className="min-h-9 cursor-pointer rounded-control border border-line-strong px-3 text-xs font-bold hover:border-ink">Müşteriye hatırlat</button>
                    </td>
                  </tr>
                );
              })}
              {!liste.length && <tr><td colSpan={7} className="py-8 text-center text-muted">Bu görünümde lisans yok.</td></tr>}
            </tbody>
          </table>
        </div>

        {seciliListe.length > 0 && (
          <form className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl bg-ink p-4 text-white shadow-lg"
            onSubmit={(e) => { e.preventDefault(); baslat(() => gonder(new FormData(e.currentTarget))); }}>
            {seciliListe.map((l) => (
              <span key={l.seriNo} hidden>
                <input type="hidden" name="seri" value={l.seriNo} />
                <input type="hidden" name={`plan:${l.seriNo}`} value={secili[l.seriNo]} />
              </span>
            ))}
            <div className="flex min-w-[200px] flex-[1_1_240px] flex-col">
              <b>{seciliListe.length} lisans yenilenecek</b>
              <span className="text-xs text-[#C3C6BC]">
                {Object.entries(seciliListe.reduce<Record<string, number>>((t, l) => ((t[secili[l.seriNo]] = (t[secili[l.seriNo]] ?? 0) + 1), t), {})).map(([pl, n]) => `${n}× ${pl}`).join(" · ")} · %{p.indirim} bayi iskontolu
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              Süre
              <select name="sure" value={sure} onChange={(e) => setSure(Number(e.target.value))} className="min-h-10 rounded-control border border-[#3A3D35] bg-ink px-2 text-sm font-semibold text-white">
                {SURELER.map((x) => <option key={x} value={x}>{x} ay</option>)}
              </select>
            </label>
            <b className="text-xl tabular-nums">{py(toplam)}</b>
            <button type="button" disabled={!havuzYeter || havuzBekliyor} onClick={havuzdanYenile}
              title={havuzYeter ? "Havuzdaki lisanslarla hemen uzat" : "Havuzda seçilen paketlerden yeterli lisans yok"}
              className="min-h-11 cursor-pointer rounded-control border border-[#3A3D35] px-4 text-sm font-bold text-white hover:bg-[#23251F] disabled:cursor-not-allowed disabled:opacity-40">
              {havuzBekliyor ? "İşleniyor…" : "Havuzdan yenile"}
            </button>
            <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-lime px-5 text-sm font-bold text-ink hover:brightness-95 disabled:opacity-60">
              {bekliyor ? "Gönderiliyor…" : "Yenileme siparişi ver"}
            </button>
          </form>
        )}
        {(durum.hata || havuzSonuc.hata) && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata ?? havuzSonuc.hata}</p>}
        {havuzSonuc.tamam && !seciliListe.length && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{havuzSonuc.tamam}</p>}
        {durum.tamam && !seciliListe.length && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{durum.tamam}</p>}
        <p className="text-xs text-muted">Yenileme, mevcut lisansın bitişinden devam eder. &quot;Havuzdan yenile&quot; hemen işler; &quot;Yenileme siparişi&quot; Embedra ödemeyi onaylayınca cihazlara otomatik işlenir. Lisanslar KDV&apos;siz faturalanır.</p>
      </section>

      <Modal acik={!!hatirlat} onKapat={() => setHatirlat(null)} baslik="Müşteriye hatırlatma" aciklama="Metni düzenleyip kopyalayın ya da doğrudan WhatsApp / e-posta ile gönderin.">
        {hatirlat && <Hatirlatma l={hatirlat} bayiAd={p.bayiAd} fiyat={py(p.fiyatlar[(PLANLAR.includes(hatirlat.plan as Plan) ? hatirlat.plan : "Pro") as Plan].liste)} />}
      </Modal>
    </div>
  );
}

function hatirlatmaMetni(dil: "tr" | "en", l: PortalLisans, bayiAd: string, fiyat: string) {
  const bitti = l.kalan !== null && l.kalan < 0;
  if (dil === "en") {
    return `Dear ${l.musteri} team,

Your ONESuite ${l.plan} licence for EmbedraONE (serial ${l.seriNo}) ${bitti ? `expired on ${tarihEn(l.bitis!)}` : `expires on ${tarihEn(l.bitis!)}`}. ${bitti ? "Diagnostics and updates are paused until it is renewed." : "Renew before this date to keep diagnostics and updates running without interruption."}

12-month renewal: ${fiyat} (excl. VAT). Reply to this message and we will send you the invoice.

Best regards,
${bayiAd}`;
  }
  return `Merhaba ${l.musteri},

EmbedraONE cihazınızın (seri no ${l.seriNo}) ONESuite ${l.plan} lisansı ${bitti ? `${tarihTr(l.bitis)} tarihinde sona erdi` : `${tarihTr(l.bitis)} tarihinde sona eriyor`}. ${bitti ? "Yenilenene kadar teşhis ve güncellemeler duraklatıldı." : "Teşhis ve güncellemelerin kesintisiz sürmesi için bu tarihten önce yenilemenizi öneririz."}

12 aylık yenileme: ${fiyat} (KDV hariç). Bu mesajı yanıtlamanız yeterli, faturayı hemen gönderelim.

Saygılarımızla,
${bayiAd}`;
}

function Hatirlatma({ l, bayiAd, fiyat }: { l: PortalLisans; bayiAd: string; fiyat: string }) {
  const [dil, setDil] = useState<"tr" | "en">("tr");
  const [metin, setMetin] = useState(() => hatirlatmaMetni("tr", l, bayiAd, fiyat));
  const [kopyalandi, setKopyalandi] = useState(false);
  const dilDegistir = (d: "tr" | "en") => { setDil(d); setMetin(hatirlatmaMetni(d, l, bayiAd, fiyat)); };
  const konu = dil === "tr" ? `ONESuite lisans yenileme · ${l.seriNo}` : `ONESuite licence renewal · ${l.seriNo}`;
  const BTN = "flex min-h-10 cursor-pointer items-center rounded-control px-4 text-sm font-bold";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{l.musteri}</span><span className="text-muted">· {l.seriNo} · {l.plan} · bitiş {tarihTr(l.bitis)}</span>
        <span className="ml-auto flex rounded-control border border-line-strong p-0.5">
          {(["tr", "en"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={dil === d} onClick={() => dilDegistir(d)} className={`min-h-8 cursor-pointer rounded-[6px] px-3 text-xs font-bold ${dil === d ? "bg-ink text-white" : ""}`}>{d === "tr" ? "Türkçe" : "English"}</button>
          ))}
        </span>
      </div>
      <textarea value={metin} onChange={(e) => setMetin(e.target.value)} rows={11} aria-label="Hatırlatma metni"
        className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-ink" />
      <p className="text-xs text-muted">Fiyat Embedra&apos;nın önerdiği liste fiyatıdır; kendi satış fiyatınızı yazabilirsiniz.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(metin); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000); } catch { /* izin yoksa sessiz */ } }}
          className={`${BTN} bg-ink text-white hover:bg-ink-soft`}>{kopyalandi ? "Kopyalandı ✓" : "Metni kopyala"}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(metin)}`} target="_blank" rel="noreferrer" className={`${BTN} bg-lime text-ink hover:brightness-95`}>WhatsApp ile gönder</a>
        <a href={`mailto:?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(metin)}`} className={`${BTN} border border-line-strong hover:border-ink`}>E-posta ile gönder</a>
      </div>
    </div>
  );
}
