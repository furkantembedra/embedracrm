"use client";

// RMA detay paneli: adımlar, hedef süre, garanti / ücret, karar, sıradaki adım (geliş / kargo bilgisiyle),
// notlar ve görüşmeler, servis formu yazdırma.
import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, Printer, StickyNote, Truck } from "lucide-react";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { pdfYazdir } from "@/lib/disa-aktar";
import { garantiKapsami, kararVer, oncelikDegistir, rmaIlerlet, rmaNotEkle, ucretOdendi, type RmaIslemSonucu } from "./actions";
import { ADIM_ADI, GELIS_KANALLARI, HEDEF_GUN, KARAR_ADI, ONCELIKLER, RMA_ADIMLARI, type RmaKaydi, type RmaKarari, type RmaOncelik } from "./queries";
import { acikMi, gunSay, kapsamda, tarihYaz } from "./ortak";

const BUTON = "min-h-10 cursor-pointer rounded-control px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50";
const GIRDI = "min-h-10 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink";
const zamanYaz = (z: string) => `${z.slice(8, 10)}.${z.slice(5, 7)}.${z.slice(0, 4)} ${z.slice(11, 16)}`;

function servisFormu(r: RmaKaydi) {
  pdfYazdir(`Servis formu · ${r.id}`, `${r.sahip.ad} · ${tarihYaz(r.acilis)}`, [
    ["Alan", "Bilgi"],
    ["RMA no", r.id],
    ["Cihaz", `${r.seriNo} · ${r.model}`],
    [r.sahip.tur === "bayi" ? "Bayi" : "Müşteri", r.sahip.ad],
    ["Arıza", `${r.arizaTipi} · ${r.ariza}`],
    ["Garanti", kapsamda(r) ? "Kapsamda" : `Kapsam dışı${r.ucret ? ` · servis ücreti ${tl(r.ucret)}${r.ucretOdendi ? " (tahsil edildi)" : ""}` : ""}`],
    ["Geliş", r.gelis ? `${r.gelis.kanal}${r.gelis.takipNo ? ` · ${r.gelis.takipNo}` : ""}` : "—"],
    ["Durum", ADIM_ADI[r.adim]],
    ["Karar", r.karar ? `${KARAR_ADI[r.karar]}${r.yeniSeri ? ` → ${r.yeniSeri}` : ""}` : "—"],
    ["Kullanılan parçalar", Object.entries(r.kullanilanParcalar).map(([k, n]) => `${n}× ${k}`).join(", ") || "—"],
    ["Gönderim", r.kargo ? `${r.kargo.firma} · ${r.kargo.takipNo}` : "—"],
    ...r.gecmis.map((g) => [zamanYaz(g.zaman), g.metin]),
  ]);
}

export default function RmaDetay({
  rma: r,
  bugun,
  bilesenler,
  havuz,
  kargoFirmalari,
  onGuncellendi,
}: {
  rma: RmaKaydi;
  bugun: string;
  bilesenler: { kod: string; ad: string; adet: number }[];
  havuz: { seriNo: string; model: string }[];
  kargoFirmalari: string[];
  onGuncellendi: (s: RmaIslemSonucu) => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [karar, setKarar] = useState<RmaKarari>("tamir");
  const [parcalar, setParcalar] = useState<Record<string, number>>({});
  const [yeniSeri, setYeniSeri] = useState("");
  const [adimNotu, setAdimNotu] = useState("");
  const [kararNotu, setKararNotu] = useState("");
  const [ucret, setUcret] = useState(r.ucret ? String(r.ucret) : "");
  const [gelis, setGelis] = useState({ kanal: "", takip: "" });
  const [kargo, setKargo] = useState({ firma: kargoFirmalari[0] ?? "", takip: "" });
  const [not, setNot] = useState({ tur: "not" as "not" | "gorusme", metin: "" });
  const i = RMA_ADIMLARI.indexOf(r.adim);
  const kapsam = kapsamda(r);
  const uygunHavuz = havuz.filter((h) => h.model === r.model);
  const gun = bugun ? gunSay(r.acilis, r.kapanis ?? bugun) : null;
  const sureAsildi = gun !== null && gun > HEDEF_GUN;
  const ucretBekliyor = !kapsam && !!r.ucret && !r.ucretOdendi;

  const calistir = (is: () => Promise<RmaIslemSonucu>, sonra?: () => void) =>
    baslat(async () => {
      const s = await is();
      if (s.hata) setHata(s.hata);
      else {
        setHata(null);
        sonra?.();
        onGuncellendi(s);
      }
    });

  const sonraki = RMA_ADIMLARI[i + 1];
  const ilerletilebilir = sonraki && sonraki !== "karar" && !(sonraki === "gonderildi" && r.karar === "iade");

  return (
    <section aria-label="RMA detayı" className="flex w-full min-w-0 flex-col gap-5 rounded-card border border-line bg-card p-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] font-extrabold">{r.id}</h2>
            {r.oncelik === "Acil" && <Chip ton="err">Acil</Chip>}
            <Chip ton={kapsam ? "lime" : "warn"}>{kapsam ? "Garantide" : "Garanti dışı"}</Chip>
            {r.kaynak === "bayi-portali" && <Chip ton="info">Bayi portalı</Chip>}
          </div>
          <span className="text-[13px] text-muted">{r.sahip.ad} · {tarihYaz(r.acilis)} tarihinde açıldı</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {acikMi(r) && (
            <label className="flex items-center gap-1.5 text-xs font-bold">
              <span className="sr-only">Öncelik</span>
              <select value={r.oncelik} disabled={bekliyor} onChange={(e) => calistir(() => oncelikDegistir(r.id, e.target.value as RmaOncelik))} className={`${GIRDI} min-h-9 text-xs font-bold`}>
                {ONCELIKLER.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => servisFormu(r)} className={`${BUTON} inline-flex items-center gap-1.5 border border-line-strong bg-card px-3 hover:bg-[#F4F5F0]`}>
            <Printer size={15} aria-hidden="true" /> Servis formu
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <ol aria-label="RMA adımları" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {RMA_ADIMLARI.map((a, k) => (
            <li key={a} aria-current={a === r.adim ? "step" : undefined} className="flex flex-col gap-1">
              <span className={`h-1.5 rounded-full ${k <= i ? (sureAsildi && acikMi(r) ? "bg-warn" : "bg-ink") : "bg-line"}`} />
              <span className={`text-[11px] font-bold leading-tight ${k <= i ? "text-ink" : "text-muted"}`}>{ADIM_ADI[a]}</span>
            </li>
          ))}
        </ol>
        {gun !== null && (
          <p className={`text-xs font-semibold ${sureAsildi ? "text-warn" : "text-muted"}`}>
            {acikMi(r) ? `${gun}. gün` : `${gun} günde kapandı`} · hedef {HEDEF_GUN} gün{sureAsildi ? (acikMi(r) ? ` · ${gun - HEDEF_GUN} gün gecikti` : " · hedef aşıldı") : ""}
          </p>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-[#F4F5F0] p-3 text-[13px] sm:grid-cols-2">
        <div className="sm:col-span-2"><dt className="text-xs text-muted">Arıza</dt><dd><b>{r.arizaTipi}</b> · {r.ariza}</dd></div>
        <div><dt className="text-xs text-muted">Cihaz</dt><dd className="font-bold"><Link href={`/cihaz-lisans/${r.seriNo}`} className="hover:underline">{r.seriNo}</Link> · {r.model}</dd></div>
        <div><dt className="text-xs text-muted">Geliş</dt><dd>{r.gelis ? `${r.gelis.kanal}${r.gelis.takipNo ? ` · ${r.gelis.takipNo}` : ""}` : "Cihaz henüz gelmedi"}</dd></div>
        {r.karar && <div><dt className="text-xs text-muted">Karar</dt><dd className="font-bold">{KARAR_ADI[r.karar]}{r.yeniSeri ? ` → ${r.yeniSeri}` : ""}</dd></div>}
        {Object.keys(r.kullanilanParcalar).length > 0 && (
          <div><dt className="text-xs text-muted">Kullanılan parçalar</dt><dd>{Object.entries(r.kullanilanParcalar).map(([k, n]) => `${n}× ${bilesenler.find((b) => b.kod === k)?.ad ?? k}`).join(", ")}</dd></div>
        )}
        {r.kargo && <div><dt className="text-xs text-muted">Geri gönderim</dt><dd className="flex items-center gap-1.5"><Truck size={14} aria-hidden="true" /> {r.kargo.firma} · <span className="font-mono text-xs">{r.kargo.takipNo}</span></dd></div>}
        {r.iadeId && <div><dt className="text-xs text-muted">İade kaydı</dt><dd><Link href="/siparisler" className="font-bold text-info hover:underline">{r.iadeId}</Link></dd></div>}
        {r.destekTalebiId && <div><dt className="text-xs text-muted">Destek talebi</dt><dd><Link href={`/destek/${r.destekTalebiId}`} className="font-bold text-info hover:underline">#{r.destekTalebiId}</Link></dd></div>}
        {r.fotograflar.length > 0 && <div><dt className="text-xs text-muted">Fotoğraflar</dt><dd>{r.fotograflar.join(", ")}</dd></div>}
      </dl>

      <section aria-label="Garanti ve ücret" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <b>Garanti ve ücret</b>
          {r.garantiElle !== null && <span className="text-xs text-muted">(elle değiştirildi · otomatik hesap: {r.garantide ? "kapsamda" : "dışı"})</span>}
          {!kapsam && r.ucret != null && (
            <span className="ml-auto flex items-center gap-2">
              <b className="tabular-nums">{tl(r.ucret)}</b>
              <Chip ton={r.ucretOdendi ? "ok" : "warn"}>{r.ucretOdendi ? "Tahsil edildi" : "Ödeme bekliyor"}</Chip>
            </span>
          )}
        </div>
        {acikMi(r) && (
          <div className="flex flex-wrap items-center gap-2">
            {!kapsam && (
              <>
                <label className="flex items-center gap-2 text-xs font-bold">
                  Ücret (TL)
                  <input type="number" min={0} step={100} value={ucret} onChange={(e) => setUcret(e.target.value)} className={`${GIRDI} w-28`} />
                </label>
                <button type="button" disabled={bekliyor} onClick={() => calistir(() => garantiKapsami(r.id, r.garantiElle, ucret ? Number(ucret) : null))} className={`${BUTON} border border-line-strong bg-card`}>Ücreti kaydet</button>
                {!!r.ucret && (
                  <button type="button" disabled={bekliyor} onClick={() => calistir(() => ucretOdendi(r.id, !r.ucretOdendi))} className={`${BUTON} ${r.ucretOdendi ? "text-info" : "bg-ink text-white hover:bg-ink-soft"}`}>
                    {r.ucretOdendi ? "Tahsilatı geri al" : "Ücret tahsil edildi"}
                  </button>
                )}
              </>
            )}
            <button type="button" disabled={bekliyor} onClick={() => calistir(() => garantiKapsami(r.id, !kapsam, kapsam ? (ucret ? Number(ucret) : null) : null))} className={`${BUTON} border border-line-strong bg-card`}>
              {kapsam ? "Kapsamdan çıkar" : "Garantiye al (elle)"}
            </button>
            {r.garantiElle !== null && <button type="button" disabled={bekliyor} onClick={() => calistir(() => garantiKapsami(r.id, null, r.ucret))} className={`${BUTON} text-info`}>Otomatiğe dön</button>}
          </div>
        )}
      </section>

      {r.adim === "inceleme" && (
        <section aria-label="Karar" className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-[13px] font-bold">İnceleme sonucu karar</legend>
            {(Object.keys(KARAR_ADI) as RmaKarari[]).map((k) => (
              <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-[13px] font-semibold has-checked:border-ink has-checked:bg-bg">
                <input type="radio" name={`karar-${r.id}`} checked={karar === k} onChange={() => setKarar(k)} className="accent-ink" /> {KARAR_ADI[k]}
              </label>
            ))}
          </fieldset>
          {karar === "tamir" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {bilesenler.map((b) => (
                <label key={b.kod} className="flex items-center justify-between gap-2 text-[13px]">
                  <span>{b.ad} <span className="text-xs text-muted">(stok {b.adet})</span></span>
                  <input type="number" min={0} max={Math.min(20, b.adet)} value={parcalar[b.kod] ?? 0} onChange={(e) => setParcalar((p) => ({ ...p, [b.kod]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} className={`${GIRDI} w-20 text-right`} aria-label={`${b.ad} kullanılan adet`} />
                </label>
              ))}
              <p className="text-xs text-muted sm:col-span-2">Girilen parçalar bileşen stoğundan düşer.</p>
            </div>
          )}
          {karar === "degisim" && (
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              Yeni cihaz (seri no havuzundan, {r.model})
              <select value={yeniSeri} onChange={(e) => setYeniSeri(e.target.value)} className={GIRDI}>
                <option value="">{uygunHavuz.length ? "Seçin…" : "Havuzda uygun cihaz yok"}</option>
                {uygunHavuz.map((h) => <option key={h.seriNo}>{h.seriNo}</option>)}
              </select>
              <span className="text-xs font-normal text-muted">Lisans yeni cihaza aktarılır, eski cihaz servise alınır.</span>
            </label>
          )}
          {karar === "iade" && <p className="text-xs text-muted">Cihaz bir siparişle eşleşirse Sipariş › İadeler&apos;e para iadesi kaydı açılır.</p>}
          {karar === "red" && <p className="text-xs text-muted">Arıza kapsam dışı (ör. kullanıcı hatası, fiziksel hasar). Cihaz işlem yapılmadan geri gönderilir.</p>}
          <input value={kararNotu} onChange={(e) => setKararNotu(e.target.value)} placeholder="Teknik açıklama (isteğe bağlı)" className={GIRDI} aria-label="Karar notu" />
          <button type="button" disabled={bekliyor || (karar === "degisim" && !yeniSeri)} onClick={() => calistir(() => kararVer(r.id, { karar, parcalar, yeniSeri, not: kararNotu }), () => setKararNotu(""))} className={`${BUTON} self-end bg-ink text-white hover:bg-ink-soft`}>
            Kararı kaydet
          </button>
        </section>
      )}

      {ilerletilebilir && (
        <section aria-label="Sıradaki adım" className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <b className="text-[13px]">Sıradaki adım: {ADIM_ADI[sonraki]}</b>
          {sonraki === "teslim_alindi" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={gelis.kanal} onChange={(e) => setGelis({ ...gelis, kanal: e.target.value })} className={GIRDI} aria-label="Cihaz nasıl geldi">
                <option value="">Nasıl geldi?</option>
                {GELIS_KANALLARI.map((k) => <option key={k}>{k}</option>)}
              </select>
              <input value={gelis.takip} onChange={(e) => setGelis({ ...gelis, takip: e.target.value })} placeholder="Kargo takip no (varsa)" className={GIRDI} aria-label="Geliş takip numarası" />
            </div>
          )}
          {sonraki === "gonderildi" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={kargo.firma} onChange={(e) => setKargo({ ...kargo, firma: e.target.value })} className={GIRDI} aria-label="Kargo firması">
                {kargoFirmalari.map((k) => <option key={k}>{k}</option>)}
              </select>
              <input value={kargo.takip} onChange={(e) => setKargo({ ...kargo, takip: e.target.value })} placeholder="Takip numarası *" className={GIRDI} aria-label="Kargo takip numarası" />
              {ucretBekliyor && <p className="text-xs font-semibold text-warn sm:col-span-2">Servis ücreti tahsil edilmeden gönderilemez.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input value={adimNotu} onChange={(e) => setAdimNotu(e.target.value)} placeholder="Not (isteğe bağlı)" className={`${GIRDI} flex-1`} aria-label="Adım notu" />
            <button
              type="button"
              disabled={bekliyor}
              onClick={() => calistir(() => rmaIlerlet(r.id, adimNotu, { gelisKanali: gelis.kanal, gelisTakip: gelis.takip, kargoFirma: kargo.firma, kargoTakip: kargo.takip }), () => setAdimNotu(""))}
              className={`${BUTON} bg-ink text-white hover:bg-ink-soft`}
            >
              {ADIM_ADI[sonraki]} →
            </button>
          </div>
        </section>
      )}
      {r.adim === "inceleme" && <p className="text-xs text-muted">Karar verilince işlem adımları devam eder.</p>}
      {hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{hata}</p>}

      <section aria-label="Notlar ve geçmiş" className="flex flex-col gap-3">
        <h3 className="text-[15px] font-extrabold">Notlar ve geçmiş</h3>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            calistir(() => rmaNotEkle(r.id, not.tur, not.metin), () => setNot({ ...not, metin: "" }));
          }}
        >
          <div role="group" aria-label="Not türü" className="flex w-fit gap-1 rounded-control bg-bg p-1">
            {([["not", "İç not"], ["gorusme", "Müşteri görüşmesi"]] as const).map(([t, ad]) => (
              <button key={t} type="button" aria-pressed={not.tur === t} onClick={() => setNot({ ...not, tur: t })} className={`min-h-9 cursor-pointer rounded-[9px] px-3 text-xs font-bold ${not.tur === t ? "bg-card shadow-sm" : "text-[#474A42]"}`}>{ad}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea value={not.metin} onChange={(e) => setNot({ ...not, metin: e.target.value })} rows={2} maxLength={1000} placeholder={not.tur === "not" ? "Teknik bulgu, ölçüm, test sonucu…" : "Müşteriyle ne konuşuldu?"} className="min-w-0 flex-1 rounded-control border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-ink" aria-label="Not" />
            <button type="submit" disabled={bekliyor || !not.metin.trim()} className={`${BUTON} self-end border border-ink`}>Ekle</button>
          </div>
        </form>
        <ol className="flex flex-col gap-2">
          {[...r.gecmis].reverse().map((g, k) => (
            <li key={k} className={`flex gap-2.5 rounded-xl px-3 py-2 text-[13px] ${g.tur === "not" ? "bg-warn-bg/50" : g.tur === "gorusme" ? "bg-info-bg/60" : ""}`}>
              <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">
                {g.tur === "not" ? <StickyNote size={14} /> : g.tur === "gorusme" ? <MessageSquare size={14} /> : <span className="mt-1 block h-2 w-2 rounded-full bg-line-strong" />}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-bold text-muted">{zamanYaz(g.zaman)}{g.tur === "not" ? " · İç not" : g.tur === "gorusme" ? " · Görüşme" : ""}{g.yazan && g.tur !== "sistem" ? ` · ${g.yazan}` : ""}</span>
                <span className="break-words">{g.metin}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
