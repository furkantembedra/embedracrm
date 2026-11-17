"use client";

// Bayi portalı "Arıza / RMA": özet kartları, akıllı talep formu (garanti durumu, çözüm önerisi, öncelik,
// iletişim, ekler), açık / kapalı talepler (adım çubuğu, süre) ve talep detayı (ücret onayı, kargo, not, ek).
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Chip from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import type { PortalFormDurumu } from "./actions";
import { portalRmaAc, portalRmaEkEkle, portalRmaKargo, portalRmaNot, portalRmaUcretOnay } from "./rma-actions";
import type { FormCihazi, PortalRma } from "./rma";
import { PORTAL_ALAN, PORTAL_GIRDI } from "./stil";

type Props = {
  talepler: PortalRma[];
  cihazlar: FormCihazi[];
  kargoFirmalari: string[];
  hedefGun: number;
  adimlar: string[];
  arizaTipleri: readonly string[];
  servis: { ad: string; adres: string; telefon: string };
  ozet: { acik: number; bekleniyor: number; serviste: number; onay: number };
  ilkSeri: string;
};
type Filtre = "hepsi" | "bekleniyor" | "serviste" | "onay";

const tarihTr = (t: string | null) => (t ? new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const zamanTr = (t: string) => `${tarihTr(t)}${t.length > 10 ? ` ${t.slice(11, 16)}` : ""}`;
const tl = (n: number) => `₺${n.toLocaleString("tr-TR")}`;

/** Arıza tipine göre RMA açmadan önce denenebilecekler */
const COZUM_ONERILERI: Record<string, string[]> = {
  "Ekran / dokunmatik": ["Cihazı 10 saniye güç düğmesine basılı tutarak yeniden başlatın.", "Ekran koruyucu varsa çıkarıp dokunmatiği tekrar deneyin."],
  "Bağlantı (OBD / K-Line)": ["Farklı bir pin kablosuyla deneyin; sorun kabloda olabilir.", "Araçta kontağın açık ve akü voltajının 12 V üzerinde olduğundan emin olun."],
  "Güç / batarya": ["Orijinal USB-C kabloyla en az 2 saat şarj edin.", "Batarya kablosunun soketlere tam oturduğunu kontrol edin."],
  "Yazılım / firmware": ["ONESuite'ten güncel firmware'e (v2.4.x) güncelleyin.", "Lisansın aktif olduğunu Lisanslar sayfasından kontrol edin."],
  "Kablo / aksesuar": ["Kablo arızalarında cihazı göndermeniz gerekmez; Sipariş ver › Aksesuar'dan yedek kablo alabilirsiniz."],
};

const ADIM_KISA = ["Talep", "Teslim", "İnceleme", "Karar", "Tamam", "Gönderildi"];

function AdimCubugu({ t }: { t: PortalRma }) {
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label={`Durum: ${t.adimAdi}`}>
      {ADIM_KISA.map((a, i) => {
        const bitti = i < t.adim || (!t.acik && i <= t.adim);
        const simdi = i === t.adim && t.acik;
        return (
          <li key={a} className="flex flex-col gap-1">
            <span className={`h-1.5 rounded-full ${bitti ? "bg-[#1F8A4C]" : simdi ? (t.hedefAsildi ? "bg-[#E58A2B]" : "bg-lime") : "bg-bg"}`} />
            <span className={`truncate text-[10px] sm:text-[11px] ${simdi ? "font-bold" : bitti ? "font-semibold" : "text-muted"}`}>{a}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function RmaGorunumu(p: Props) {
  const [filtre, setFiltre] = useState<Filtre>("hepsi");
  const [sekme, setSekme] = useState<"acik" | "kapali">("acik");
  const [arama, setArama] = useState("");
  const [formAcik, setFormAcik] = useState(!!p.ilkSeri || p.talepler.length === 0);
  const [detay, setDetay] = useState<string | null>(null);

  const q = arama.trim().toLocaleLowerCase("tr");
  const liste = useMemo(() => p.talepler.filter((t) => {
    if (q && ![t.id, t.seriNo, t.musteri].some((x) => x.toLocaleLowerCase("tr").includes(q))) return false;
    if (filtre === "bekleniyor") return t.acik && t.cihazBekleniyor;
    if (filtre === "serviste") return t.acik && t.adim >= 1 && t.adim <= 3;
    if (filtre === "onay") return t.onayBekliyor;
    return sekme === "acik" ? t.acik : !t.acik;
  }), [p.talepler, q, filtre, sekme]);
  const detayTalep = p.talepler.find((t) => t.id === detay) ?? null;

  const KARTLAR: { f: Filtre; ad: string; deger: number; vurgu?: boolean }[] = [
    { f: "hepsi", ad: "Açık talep", deger: p.ozet.acik },
    { f: "bekleniyor", ad: "Cihaz bekleniyor", deger: p.ozet.bekleniyor, vurgu: p.ozet.bekleniyor > 0 },
    { f: "serviste", ad: "Serviste", deger: p.ozet.serviste },
    { f: "onay", ad: "Onayınızı bekleyen", deger: p.ozet.onay, vurgu: p.ozet.onay > 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {KARTLAR.map((k) => (
          <button key={k.f} type="button" aria-pressed={filtre === k.f && k.f !== "hepsi"} onClick={() => { setFiltre(filtre === k.f ? "hepsi" : k.f); if (k.f === "hepsi") setSekme("acik"); }}
            className={`flex cursor-pointer flex-col gap-1 rounded-card border bg-card p-4 text-left ${filtre === k.f && k.f !== "hepsi" ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink"}`}>
            <span className="text-xs font-semibold text-muted">{k.ad}</span>
            <b className={`text-2xl tabular-nums ${k.vurgu ? "text-[#B25A12]" : ""}`}>{k.deger}</b>
          </button>
        ))}
      </div>

      {/* Yeni talep */}
      <section aria-label="Yeni RMA talebi" className="rounded-card border border-line bg-card">
        <button type="button" aria-expanded={formAcik} onClick={() => setFormAcik(!formAcik)} className="flex min-h-14 w-full cursor-pointer items-center gap-2 px-5 text-left">
          <h2 className="text-[17px] font-extrabold">Yeni arıza talebi</h2>
          <span className="ml-auto text-sm font-bold text-info">{formAcik ? "Kapat" : "+ Talep aç"}</span>
        </button>
        {formAcik && <TalepFormu {...p} kapat={() => setFormAcik(false)} ac={(id) => setDetay(id)} />}
      </section>

      {/* Talepler */}
      <section aria-label="Taleplerim" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {filtre === "hepsi" ? (
            ([["acik", "Açık"], ["kapali", "Kapanan"]] as const).map(([k, ad]) => (
              <button key={k} type="button" aria-pressed={sekme === k} onClick={() => setSekme(k)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-bold ${sekme === k ? "border-ink bg-ink text-white" : "border-line-strong hover:border-ink"}`}>
                {ad} <span className={`rounded-full px-1.5 text-xs tabular-nums ${sekme === k ? "bg-lime text-ink" : "bg-bg"}`}>{p.talepler.filter((t) => (k === "acik" ? t.acik : !t.acik)).length}</span>
              </button>
            ))
          ) : (
            <span className="flex items-center gap-2 text-sm font-bold">{KARTLAR.find((k) => k.f === filtre)?.ad}
              <button type="button" onClick={() => setFiltre("hepsi")} className="cursor-pointer text-[13px] text-info hover:underline">Filtreyi kaldır</button>
            </span>
          )}
          <input type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="RMA no, seri no, müşteri…" aria-label="Ara" className={`${PORTAL_GIRDI} ml-auto w-full sm:w-64`} />
        </div>
        <ul className="flex flex-col gap-2.5">
          {liste.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setDetay(t.id)} className="flex w-full cursor-pointer flex-col gap-2.5 rounded-xl border border-line p-4 text-left hover:border-ink">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <b>{t.id}</b>
                  <span className="font-mono text-xs">{t.seriNo}</span>
                  <span className="text-muted">{t.musteri}</span>
                  {t.oncelik === "Acil" && <Chip ton="err">Acil</Chip>}
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {t.onayBekliyor && <Chip ton="warn">Ücret onayınız bekleniyor</Chip>}
                    {t.acik && t.cihazBekleniyor && <Chip ton="warn">Cihazı gönderin</Chip>}
                    {t.acik && t.adim === 0 && t.gelis && <Chip ton="info">Yolda</Chip>}
                    {!t.acik && <Chip ton="ok">{t.karar ?? t.adimAdi}</Chip>}
                  </span>
                </span>
                <span className="text-[13px] text-[#474A42]">{t.arizaTipi} · {t.ariza.length > 90 ? `${t.ariza.slice(0, 90)}…` : t.ariza}</span>
                <AdimCubugu t={t} />
                <span className="flex flex-wrap gap-x-4 text-xs text-muted">
                  <span>Açılış {tarihTr(t.acilis)}</span>
                  {t.acik
                    ? <span className={t.hedefAsildi ? "font-bold text-[#B25A12]" : ""}>{t.gun}. gün · hedef {p.hedefGun} gün</span>
                    : <span>{t.gun} günde çözüldü</span>}
                  <span>{t.garantide ? "Garanti kapsamında" : "Garanti dışı"}</span>
                </span>
              </button>
            </li>
          ))}
          {!liste.length && <li className="py-8 text-center text-sm text-muted">{p.talepler.length ? "Bu görünümde talep yok." : "Henüz arıza talebiniz yok."}</li>}
        </ul>
      </section>

      <Modal acik={!!detayTalep} onKapat={() => setDetay(null)} baslik={detayTalep ? `${detayTalep.id} · ${detayTalep.seriNo}` : "Talep"} aciklama={detayTalep ? `${detayTalep.musteri} · ${detayTalep.adimAdi}` : undefined}>
        {detayTalep && <TalepDetayi t={detayTalep} p={p} />}
      </Modal>
    </div>
  );
}

function TalepFormu(p: Props & { kapat: () => void; ac: (id: string) => void }) {
  const [seri, setSeri] = useState(p.ilkSeri);
  const [tip, setTip] = useState("");
  const [durum, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(portalRmaAc, {});
  const [, baslat] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const son = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) {
      son.current = durum.zaman;
      ref.current?.reset();
      setSeri("");
      setTip("");
      router.refresh();
      if (durum.kayitId) p.ac(durum.kayitId);
    }
  }, [durum, router, p]);
  const cihaz = p.cihazlar.find((c) => c.seriNo === seri);
  const hata = (ad: string) => durum.hatalar?.[ad] && <span className="text-xs font-semibold text-err">{durum.hatalar[ad]}</span>;

  return (
    <form ref={ref} className="flex flex-col gap-4 border-t border-line p-5" onSubmit={(e) => { e.preventDefault(); baslat(() => gonder(new FormData(e.currentTarget))); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={PORTAL_ALAN}>
          Cihaz *
          <select name="seriNo" value={seri} onChange={(e) => setSeri(e.target.value)} className={PORTAL_GIRDI}>
            <option value="" disabled>Seçin…</option>
            {p.cihazlar.map((c) => <option key={c.seriNo} value={c.seriNo} disabled={!!c.acikRma}>{c.seriNo} · {c.model} · {c.sahibi}{c.acikRma ? ` (açık ${c.acikRma})` : ""}</option>)}
          </select>
          {cihaz && (
            <span className={`rounded-control px-3 py-2 text-xs font-semibold ${cihaz.garantide ? "bg-lime-bg text-[#3A4D00]" : "bg-[#FFF6EA] text-[#8A4A0E]"}`}>
              {cihaz.garantide ? `✓ Garanti kapsamında · ${tarihTr(cihaz.garantiBitis)} tarihine kadar` : `Garanti dışı${cihaz.garantiBitis ? ` (${tarihTr(cihaz.garantiBitis)} bitti)` : ""} · onarım ücretli olabilir, ücret önce onayınıza sunulur`}
            </span>
          )}
          {hata("seriNo")}
        </label>
        <label className={PORTAL_ALAN}>
          Arıza tipi *
          <select name="arizaTipi" value={tip} onChange={(e) => setTip(e.target.value)} className={PORTAL_GIRDI}>
            <option value="" disabled>Seçin…</option>
            {p.arizaTipleri.map((a) => <option key={a}>{a}</option>)}
          </select>
          {COZUM_ONERILERI[tip] && (
            <span className="flex flex-col gap-1 rounded-control bg-info-bg px-3 py-2 text-xs font-semibold text-info">
              <span>Talep açmadan önce deneyin:</span>
              {COZUM_ONERILERI[tip].map((o) => <span key={o} className="font-normal">• {o}</span>)}
            </span>
          )}
          {hata("arizaTipi")}
        </label>
        <label className={`${PORTAL_ALAN} sm:col-span-2`}>
          Arıza açıklaması *
          <textarea name="ariza" rows={3} maxLength={1000} placeholder="Ne oluyor, ne zaman başladı, hangi araçta denendi…" className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />
          {hata("ariza")}
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-bold">Öncelik</legend>
          <div className="flex gap-2">
            {["Normal", "Acil"].map((o) => (
              <label key={o} className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-sm font-semibold has-[:checked]:border-ink has-[:checked]:bg-[#F4F5F0]">
                <input type="radio" name="oncelik" value={o} defaultChecked={o === "Normal"} className="accent-[#0E0F0C]" />{o}{o === "Acil" && <span className="text-xs font-normal text-muted">(müşteri işi durdu)</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={PORTAL_ALAN}>
          İletişim kişisi
          <input name="iletisim" maxLength={120} placeholder="Ad · telefon" className={PORTAL_GIRDI} />
        </label>
        <label className={`${PORTAL_ALAN} sm:col-span-2`}>
          Fotoğraf / video karesi / belge <span className="font-normal text-muted">(JPG, PNG, WEBP, PDF · dosya başına 1,5 MB, en çok 8)</span>
          <input name="dosyalar" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="rounded-control border border-dashed border-line-strong bg-[#F4F5F0] px-3 py-3 text-sm file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" />
          {hata("dosyalar")}
        </label>
      </div>
      {(durum.hata ?? durum.hatalar?.genel) && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata ?? durum.hatalar?.genel}</p>}
      {durum.tamam && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{durum.tamam}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">{bekliyor ? "Gönderiliyor…" : "Talebi gönder"}</button>
        <button type="button" onClick={p.kapat} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:border-ink">Vazgeç</button>
      </div>
    </form>
  );
}

function TalepDetayi({ t, p }: { t: PortalRma; p: Props }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<PortalFormDurumu>({});
  const [firma, setFirma] = useState(p.kargoFirmalari[0] ?? "");
  const [takip, setTakip] = useState("");
  const [not, setNot] = useState("");
  const dosyaRef = useRef<HTMLInputElement>(null);
  const calistir = (f: () => Promise<PortalFormDurumu>, sonra?: () => void) =>
    baslat(async () => {
      const s = await f();
      setSonuc(s);
      if (s.tamam) { sonra?.(); router.refresh(); }
    });
  const BASLIK = "text-[11px] font-bold tracking-[0.08em] text-muted";

  return (
    <div className="flex flex-col gap-5">
      <AdimCubugu t={t} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Arıza", t.arizaTipi],
          ["Garanti", t.garantide ? "Kapsamda" : "Garanti dışı"],
          ["Süre", t.acik ? `${t.gun}. gün / hedef ${p.hedefGun}` : `${t.gun} günde çözüldü`],
          ["Karar", t.karar ?? "Bekleniyor"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 rounded-control bg-[#F4F5F0] p-3"><dt className="text-xs text-muted">{k}</dt><dd className="text-[13px] font-semibold">{v}</dd></div>
        ))}
      </dl>
      <p className="text-sm text-[#474A42]">{t.ariza}</p>
      {t.yeniSeri && <p className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">Değişim: yerine <span className="font-mono">{t.yeniSeri}</span> seri numaralı yeni cihaz verildi.</p>}
      {t.kargo && <p className="rounded-control bg-info-bg px-3 py-2 text-[13px] font-semibold text-info">🚚 Size gönderildi · {t.kargo}</p>}

      {sonuc.tamam && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{sonuc.tamam}</p>}
      {sonuc.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{sonuc.hata}</p>}

      {/* Ücret onayı */}
      {t.onayBekliyor && t.ucret && (
        <section className="flex flex-col gap-2 rounded-xl border border-[#F2C894] bg-[#FFF6EA] p-4">
          <b className="text-sm text-[#8A4A0E]">Servis ücreti onayınızı bekliyor: {tl(t.ucret)} <span className="font-normal">(KDV hariç)</span></b>
          <span className="text-xs text-[#8A4A0E]">Cihaz garanti kapsamı dışında. Onaylarsanız onarım / değişim yapılır; reddederseniz cihaz işlem yapılmadan iade edilir.</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={bekliyor} onClick={() => calistir(() => portalRmaUcretOnay(t.id, true))} className="min-h-10 cursor-pointer rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">Onaylıyorum</button>
            <button type="button" disabled={bekliyor} onClick={() => calistir(() => portalRmaUcretOnay(t.id, false))} className="min-h-10 cursor-pointer rounded-control border border-[#8A4A0E] px-4 text-sm font-bold text-[#8A4A0E] hover:bg-[#FCE9D2] disabled:opacity-60">Reddediyorum</button>
          </div>
        </section>
      )}
      {!t.garantide && t.ucret && t.ucretOnay && <p className="text-xs text-muted">Servis ücreti {tl(t.ucret)} · onaylandı{t.ucretOdendi ? " · ödendi" : " · ödeme bekleniyor"}</p>}

      {/* Cihazı gönder */}
      {t.acik && t.adim === 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <h3 className={BASLIK}>CİHAZI SERVİSE GÖNDERİN</h3>
          <div className="flex flex-col gap-0.5 text-[13px]">
            <b>{p.servis.ad}</b><span>{p.servis.adres}</span><span className="text-muted">{p.servis.telefon}</span>
          </div>
          <ul className="list-disc pl-5 text-xs text-[#474A42]">
            <li>Cihazı orijinal kutusunda ya da darbeye dayanıklı pakette gönderin.</li>
            <li>Kutunun üzerine <b>{t.id}</b> numarasını yazın.</li>
            <li>Kabloları yalnızca arıza kabloyla ilgiliyse ekleyin.</li>
          </ul>
          {t.gelis ? (
            <p className="text-[13px] font-semibold text-info">Gönderim bildirildi: {t.gelis}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <select value={firma} onChange={(e) => setFirma(e.target.value)} aria-label="Kargo firması" className={PORTAL_GIRDI}>
                {p.kargoFirmalari.map((k) => <option key={k}>{k}</option>)}
                <option value="Diğer">Diğer</option>
              </select>
              <input value={takip} onChange={(e) => setTakip(e.target.value)} placeholder="Takip numarası" aria-label="Takip numarası" className={PORTAL_GIRDI} />
              <button type="button" disabled={bekliyor} onClick={() => calistir(() => portalRmaKargo(t.id, firma, takip))} className="min-h-11 cursor-pointer rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">Cihazı gönderdim</button>
            </div>
          )}
        </section>
      )}

      {/* Ekler */}
      <section className="flex flex-col gap-2">
        <h3 className={BASLIK}>EKLER ({t.ekler.length})</h3>
        {t.ekler.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {t.ekler.map((e) => <li key={e.id} className="rounded-control border border-line px-2.5 py-1.5 text-xs">📎 {e.ad} <span className="text-muted">· {Math.max(1, Math.round(e.boyut / 1024))} KB</span></li>)}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input ref={dosyaRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" aria-label="Dosya seç" className="max-w-full text-xs file:mr-2 file:cursor-pointer file:rounded-control file:border file:border-line-strong file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-bold" />
          <button type="button" disabled={bekliyor} onClick={() => {
            const f = new FormData();
            for (const d of Array.from(dosyaRef.current?.files ?? [])) f.append("dosyalar", d);
            calistir(() => portalRmaEkEkle(t.id, f), () => { if (dosyaRef.current) dosyaRef.current.value = ""; });
          }} className="min-h-9 cursor-pointer rounded-control border border-line-strong px-3 text-xs font-bold hover:border-ink disabled:opacity-60">Dosya ekle</button>
        </div>
      </section>

      {/* Geçmiş + not */}
      <section className="flex flex-col gap-2">
        <h3 className={BASLIK}>GEÇMİŞ</h3>
        <ol className="flex flex-col">
          {[...t.gecmis].reverse().map((g, i, a) => (
            <li key={i} className="flex gap-3 pb-3 text-sm last:pb-0">
              <span className="flex flex-col items-center">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${g.bayi ? "bg-info" : "bg-ink"}`} />
                {i < a.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span>{g.bayi && <b className="text-info">Siz: </b>}{g.metin}</span>
                <span className="text-xs text-muted">{zamanTr(g.zaman)}</span>
              </span>
            </li>
          ))}
        </ol>
        {t.acik && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={not} onChange={(e) => setNot(e.target.value)} maxLength={600} placeholder="Servis ekibine not ekleyin…" aria-label="Not" className={`${PORTAL_GIRDI} flex-1`} />
            <button type="button" disabled={bekliyor} onClick={() => calistir(() => portalRmaNot(t.id, not), () => setNot(""))} className="min-h-11 cursor-pointer rounded-control border border-ink px-4 text-sm font-bold hover:bg-[#F4F5F0] disabled:opacity-60">Not ekle</button>
          </div>
        )}
      </section>
    </div>
  );
}
