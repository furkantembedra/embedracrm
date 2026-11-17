"use client";

// Bayinin kendi satış hattı — CRM Satış Hattı ile aynı düzen: özet kartları, aşama sütunları (sürükle-bırak,
// sıra okları, aşama seçimi), kaynak etiketli kartlar. Kart detayında iletişim, sonraki adım, notlar, teklif;
// Kazanıldı'da stoktan satış bildirimi, Kaybedildi'de neden sorulur.
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, FileText, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Chip, { type ChipTon } from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { tarihEtiketi, yerlestir, type BirakmaKonumu } from "@/components/satis-hatti/ortak";
import { useBugun } from "@/lib/use-bugun";
import type { PortalFormDurumu } from "./actions";
import { portalLeadAsama, portalLeadKaydet, portalLeadKazan, portalLeadNot, portalLeadTakip } from "./lead-actions";
import BayiTeklifFormu from "./bayi-teklif-formu";
import { LisansSecici } from "./satis-bildir";
import { DURUM_ADI as TEKLIF_DURUM } from "@/components/teklifler/queries";
import { DURUM_TONU as TEKLIF_TONU } from "@/components/teklifler/teklif-listesi";
import { teklifToplami } from "@/components/teklifler/ortak";
import { ACIK_ASAMALAR, ASAMA_AD, KAYIP_NEDENLERI, LEAD_ASAMALARI, LEAD_KAYNAKLARI, guncelTeklif, type BayiLead, type BayiTeklif, type LeadAsamasi } from "./lead-ortak";
import { PORTAL_ALAN, PORTAL_GIRDI } from "./stil";

type Props = {
  bugun: string;
  leadler: BayiLead[];
  stok: { seriNo: string; model: string }[];
  paraBirimi: "EUR" | "TRY";
  oneriFiyat: Record<string, number>; // "ONE", "ONE Lite", "Basic"… → önerilen satış fiyatı (bayinin para biriminde)
  havuz: Record<string, number>; // bayinin lisans havuzu (paket → adet)
  varsayilanKdv: number; // bayinin ülkesindeki KDV / VAT (teklif formu)
};

const tarihTr = (t: string | null) => (t ? new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ASAMA_RENK: Record<LeadAsamasi, string> = { yeni: "bg-[#9AA0A6]", gorusuldu: "bg-info", demo: "bg-[#7A5AF8]", teklif: "bg-[#E58A2B]", kazanildi: "bg-[#1F8A4C]", kaybedildi: "bg-[#D93F3F]" };
const KAYNAK_TONU: Record<string, ChipTon> = { Fuar: "warn", Referans: "lime", "Sosyal medya": "info", "Saha ziyareti": "ink", "Mevcut müşteri": "gray", "Web sitesi": "gray", Diğer: "gray" };
const BTN = "flex min-h-10 cursor-pointer items-center justify-center rounded-control px-4 text-sm font-bold disabled:opacity-60";
const KUCUK = "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#474A42] transition-colors hover:bg-bg";
const IKON_BTN = "flex h-9 w-8 cursor-pointer items-center justify-center rounded-lg text-[#474A42] transition-colors hover:bg-bg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent";

const ilgiMetni = (l: BayiLead) => `${l.ilgi.adet}× ${l.ilgi.model === "ONE Lite" ? "ONE LITE" : "ONE"}${l.ilgi.plan ? ` + ${l.ilgi.plan}` : ""}`;

export default function LeadlerGorunumu(p: Props) {
  const para = useCallback((n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: p.paraBirimi, maximumFractionDigits: 0 }).format(n), [p.paraBirimi]);
  // CRM'deki kisaTl gibi: "€8,8K", "€1,25M" (tr-TR compact "B" = bin, milyar gibi okunuyor)
  const kisa = (n: number) => {
    const s = p.paraBirimi === "EUR" ? "€" : "₺";
    if (Math.abs(n) >= 1_000_000) return `${s}${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}M`;
    if (Math.abs(n) >= 10_000) return `${s}${Math.round(n / 1000).toLocaleString("tr-TR")}K`;
    if (Math.abs(n) >= 1_000) return `${s}${(n / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}K`;
    return `${s}${n.toLocaleString("tr-TR")}`;
  };
  const router = useRouter();
  const [, baslat] = useTransition();

  // Sunucudan gelen liste; yerel sıra korunur (CRM'deki gibi kartlar sütun içinde sıralanabilir)
  const [leadler, setLeadler] = useState(p.leadler);
  const [oncekiIlk, setOncekiIlk] = useState(p.leadler);
  if (p.leadler !== oncekiIlk) {
    setOncekiIlk(p.leadler);
    setLeadler((l) => {
      const yeni = new Map(p.leadler.map((x) => [x.id, x]));
      return [...l.filter((x) => yeni.has(x.id)).map((x) => yeni.get(x.id)!), ...p.leadler.filter((x) => !l.some((y) => y.id === x.id))];
    });
  }

  const [ekleAsama, setEkleAsama] = useState<LeadAsamasi | null>(null);
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const [detayId, setDetayId] = useState<string | null>(null);
  const [kayipId, setKayipId] = useState<string | null>(null);
  const [kazanId, setKazanId] = useState<string | null>(null);
  const [teklifId, setTeklifId] = useState<string | null>(null); // teklif formu açık lead
  // CRM'deki gibi: teklifi olan lead'de teklif sayfası, olmayanda teklif formu açılır
  const teklifAc = (id: string) => { const l = bul(id); if (l && guncelTeklif(l)) router.push(`/portal/leadler/${id}/teklif`); else setTeklifId(id); };
  const teklifKaydedildi = useCallback((t: BayiTeklif, leadId: string) => { setTeklifId(null); router.push(`/portal/leadler/${leadId}/teklif?v=${t.versiyon}`); }, [router]);
  const [duyuru, setDuyuru] = useState<string | null>(null);
  useEffect(() => {
    if (!duyuru) return;
    const t = setTimeout(() => setDuyuru(null), 5000);
    return () => clearTimeout(t);
  }, [duyuru]);
  const bul = (id: string | null) => leadler.find((l) => l.id === id) ?? null;

  function tasi(id: string, asama: LeadAsamasi, konum?: BirakmaKonumu) {
    const l = bul(id);
    if (!l) return;
    if (l.asama === asama) { if (konum) setLeadler((x) => yerlestir(x, l, konum)); return; }
    if (l.asama === "kazanildi") { setDuyuru("Kazanılan lead'in aşaması değiştirilemez."); return; }
    if (asama === "kaybedildi") { setKayipId(id); return; }
    if (asama === "kazanildi") { setKazanId(id); return; }
    setLeadler((x) => yerlestir(x, { ...l, asama }, konum));
    baslat(async () => {
      const s = await portalLeadAsama(id, asama);
      if (s.hata) setDuyuru(s.hata);
      router.refresh();
    });
  }
  function sirala(id: string, yon: -1 | 1) {
    setLeadler((l) => {
      const x = l.find((y) => y.id === id);
      if (!x) return l;
      const sutun = l.filter((y) => y.asama === x.asama);
      const komsu = sutun[sutun.findIndex((y) => y.id === id) + yon];
      return komsu ? yerlestir(l, x, { hedefId: komsu.id, once: yon === -1 }) : l;
    });
  }

  const detay = bul(detayId), duzenlenen = bul(duzenleId), kayip = bul(kayipId), kazan = bul(kazanId), teklifLead = bul(teklifId);
  return (
    <>
      <PageHeader title="Lead'lerim" description="Kendi müşteri adaylarınız · Kazanıldı'ya taşıyınca cihazı stoktan satıldı bildirin. Bu kayıtları yalnızca siz görürsünüz.">
        <button type="button" onClick={() => setEkleAsama("yeni")} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft">
          <Plus size={18} aria-hidden="true" />
          Lead ekle
        </button>
      </PageHeader>

      <OzetKartlari leadler={leadler} bugun={p.bugun} kisa={kisa} />
      <Kanban leadler={leadler} kisa={kisa} para={para} onTasi={tasi} onSirala={sirala} onEkle={setEkleAsama} onDuzenle={setDuzenleId} onDetay={setDetayId} onTeklif={teklifAc} />

      <Modal acik={!!detay} onKapat={() => setDetayId(null)} baslik={detay?.firma ?? "Lead"} aciklama={detay ? `${ASAMA_AD[detay.asama]} · ${detay.kaynak} · ${tarihTr(detay.olusturma)} eklendi` : undefined}>
        {detay && <LeadDetayi key={detay.id} l={detay} p={p} para={para} duzenle={() => { setDuzenleId(detay.id); setDetayId(null); }} teklifOlustur={() => { setTeklifId(detay.id); setDetayId(null); }} />}
      </Modal>
      <Modal acik={!!teklifLead} onKapat={() => setTeklifId(null)} baslik="Teklif oluştur" aciklama={teklifLead ? `${teklifLead.firma} · ${ilgiMetni(teklifLead)}` : undefined}>
        {teklifLead && <BayiTeklifFormu key={teklifLead.id} lead={teklifLead} fiyat={p.oneriFiyat} paraBirimi={p.paraBirimi} varsayilanKdv={p.varsayilanKdv} onKaydedildi={(t) => teklifKaydedildi(t, teklifLead.id)} onVazgec={() => setTeklifId(null)} />}
      </Modal>
      <Modal acik={ekleAsama !== null} onKapat={() => setEkleAsama(null)} baslik="Yeni lead" aciklama={ekleAsama ? `${ASAMA_AD[ekleAsama]} aşamasına eklenecek` : undefined}>
        {ekleAsama && <LeadFormu key={ekleAsama} lead={null} asama={ekleAsama} paraBirimi={p.paraBirimi} kapat={(id) => { setEkleAsama(null); if (id) setDuyuru("Lead eklendi."); }} />}
      </Modal>
      <Modal acik={!!duzenlenen} onKapat={() => setDuzenleId(null)} baslik="Lead'i düzenle" aciklama={duzenlenen ? `${duzenlenen.firma} · ${ASAMA_AD[duzenlenen.asama]}` : undefined}>
        {duzenlenen && <LeadFormu key={duzenlenen.id} lead={duzenlenen} paraBirimi={p.paraBirimi} kapat={() => setDuzenleId(null)} />}
      </Modal>
      <Modal acik={!!kayip} onKapat={() => setKayipId(null)} baslik="Lead kaybedildi" aciklama={kayip ? `${kayip.firma} · ${ilgiMetni(kayip)}` : undefined}>
        {kayip && (
          <KayipNedeniFormu firma={kayip.firma} onVazgec={() => setKayipId(null)} onOnayla={(neden) => {
            const id = kayip.id;
            setLeadler((x) => yerlestir(x, { ...kayip, asama: "kaybedildi", kayipNedeni: neden }));
            setKayipId(null);
            baslat(async () => { const s = await portalLeadAsama(id, "kaybedildi", neden); if (s.hata) setDuyuru(s.hata); router.refresh(); });
          }} />
        )}
      </Modal>
      <Modal acik={!!kazan} onKapat={() => setKazanId(null)} baslik="Lead kazanıldı" aciklama={kazan ? `${kazan.firma} · ${ilgiMetni(kazan)}` : undefined}>
        {kazan && (
          <KazanPaneli l={kazan} p={p} onKaydet={async (v) => {
            const s = await portalLeadKazan(kazan.id, v);
            if (s.tamam) { setKazanId(null); setDuyuru(s.tamam); router.refresh(); }
            return s;
          }} />
        )}
      </Modal>

      {duyuru && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-40px)] max-w-sm -translate-x-1/2 rounded-card bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_40px_rgba(14,15,12,0.25)]">
          {duyuru}
        </div>
      )}
    </>
  );
}

function OzetKartlari({ leadler, bugun, kisa }: { leadler: BayiLead[]; bugun: string; kisa: (n: number) => string }) {
  const acik = leadler.filter((l) => ACIK_ASAMALAR.includes(l.asama));
  const kazanilan = leadler.filter((l) => l.asama === "kazanildi");
  const kaybedilen = leadler.filter((l) => l.asama === "kaybedildi");
  const sonuclanan = kazanilan.length + kaybedilen.length;
  const geciken = acik.filter((l) => l.sonrakiTarih && l.sonrakiTarih < bugun).length;
  const toplam = (l: BayiLead[]) => l.reduce((t, x) => t + (x.tutar ?? 0), 0);
  const kartlar = [
    { etiket: "Açık lead değeri", deger: kisa(toplam(acik)), alt: `${acik.length} lead`, vurgu: false, uyari: false },
    { etiket: "Kazanılan", deger: kisa(toplam(kazanilan)), alt: `${kazanilan.length} lead`, vurgu: true, uyari: false },
    { etiket: "Kazanma oranı", deger: `%${sonuclanan ? Math.round((kazanilan.length / sonuclanan) * 100) : 0}`, alt: `${kazanilan.length} kazanıldı · ${kaybedilen.length} kaybedildi`, vurgu: false, uyari: false },
    { etiket: "Geciken takip", deger: String(geciken), alt: geciken ? "Sonraki adım tarihi geçti" : "Hepsi zamanında", vurgu: false, uyari: geciken > 0 },
  ];
  return (
    <section aria-label="Lead özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kartlar.map((k) => (
        <div key={k.etiket} className={`flex flex-col gap-1.5 rounded-card border p-4 ${k.vurgu ? "border-lime bg-lime-bg" : "border-line bg-card"}`}>
          <span className={`text-xs font-semibold ${k.vurgu ? "text-[#3A4D00]" : "text-muted"}`}>{k.etiket}</span>
          <b className="text-2xl font-extrabold tabular-nums">{k.deger}</b>
          <span className={`text-xs font-semibold ${k.uyari ? "text-warn" : k.vurgu ? "text-[#3A4D00]" : "text-muted"}`}>{k.alt}</span>
        </div>
      ))}
    </section>
  );
}

function Kanban({ leadler, kisa, para, onTasi, onSirala, onEkle, onDuzenle, onDetay, onTeklif }: {
  leadler: BayiLead[]; kisa: (n: number) => string; para: (n: number) => string;
  onTasi: (id: string, asama: LeadAsamasi, konum?: BirakmaKonumu) => void; onSirala: (id: string, yon: -1 | 1) => void;
  onEkle: (a: LeadAsamasi) => void; onDuzenle: (id: string) => void; onDetay: (id: string) => void; onTeklif: (id: string) => void;
}) {
  const [suruklenen, setSuruklenen] = useState<string | null>(null);
  const [hedef, setHedef] = useState<LeadAsamasi | null>(null);
  const [konum, setKonum] = useState<BirakmaKonumu | null>(null);
  const bitir = () => { setSuruklenen(null); setHedef(null); setKonum(null); };
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="grid min-w-[1500px] grid-cols-6 gap-3.5">
        {LEAD_ASAMALARI.map((asama) => {
          const liste = leadler.filter((l) => l.asama === asama);
          const ustunde = hedef === asama && suruklenen !== null;
          return (
            <section key={asama} aria-label={ASAMA_AD[asama]}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (hedef !== asama) setHedef(asama); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setHedef(null); setKonum(null); } }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const yer = konum && liste.some((l) => l.id === konum.hedefId) ? konum : undefined;
                if (id) onTasi(id, asama, yer);
                bitir();
              }}
              className={`flex min-h-[420px] flex-col gap-2.5 rounded-card p-3 transition-colors ${ustunde ? "bg-[#DCE9B0] outline-2 outline-dashed outline-lime-dark" : "bg-[#E4E6DF]"}`}>
              <header className="flex items-center gap-2 px-1 pt-1">
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${ASAMA_RENK[asama]}`} />
                <h2 className="text-sm font-extrabold">{ASAMA_AD[asama]}</h2>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums text-[#474A42]">{liste.length}</span>
                {ACIK_ASAMALAR.includes(asama) && (
                  <button type="button" onClick={() => onEkle(asama)} aria-label={`${ASAMA_AD[asama]} aşamasına lead ekle`}
                    className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-[#474A42] transition-colors hover:bg-[#D6D9D0]">
                    <Plus size={18} aria-hidden="true" />
                  </button>
                )}
              </header>
              <p className="px-1 text-xs font-semibold tabular-nums text-[#474A42]">{kisa(liste.reduce((t, l) => t + (l.tutar ?? 0), 0))}</p>
              {liste.map((l, i) => {
                const ustte = konum?.hedefId === l.id && konum.once && suruklenen !== l.id;
                const altta = konum?.hedefId === l.id && !konum.once && suruklenen !== l.id;
                return (
                  <div key={l.id} className={`relative ${suruklenen === l.id ? "opacity-40" : ""}`}
                    onDragOver={(e) => {
                      if (suruklenen === null) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      const once = e.clientY < r.top + r.height / 2;
                      if (konum?.hedefId !== l.id || konum.once !== once) setKonum({ hedefId: l.id, once });
                    }}>
                    {ustte && <span aria-hidden="true" className="absolute -top-[7px] left-1 right-1 h-[3px] rounded-full bg-ink" />}
                    <LeadKarti l={l} para={para} onTasi={onTasi} onDuzenle={() => onDuzenle(l.id)} onDetay={() => onDetay(l.id)} onTeklif={() => onTeklif(l.id)}
                      onSurukleBasla={setSuruklenen} onSurukleBitti={bitir}
                      onYukari={i > 0 ? () => onSirala(l.id, -1) : undefined} onAsagi={i < liste.length - 1 ? () => onSirala(l.id, 1) : undefined} />
                    {altta && <span aria-hidden="true" className="absolute -bottom-[7px] left-1 right-1 h-[3px] rounded-full bg-ink" />}
                  </div>
                );
              })}
              {liste.length === 0 && <p className="rounded-2xl border border-dashed border-[#C9CCC2] p-4 text-center text-xs text-muted">Kartı buraya sürükleyin</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LeadKarti({ l, para, onTasi, onDuzenle, onDetay, onTeklif, onSurukleBasla, onSurukleBitti, onYukari, onAsagi }: {
  l: BayiLead; para: (n: number) => string; onTasi: (id: string, a: LeadAsamasi) => void; onDuzenle: () => void; onDetay: () => void; onTeklif: () => void;
  onSurukleBasla: (id: string) => void; onSurukleBitti: () => void; onYukari?: () => void; onAsagi?: () => void;
}) {
  const bugun = useBugun();
  const kapali = !ACIK_ASAMALAR.includes(l.asama);
  const kaybedildi = l.asama === "kaybedildi";
  const tarih = l.sonrakiTarih ? tarihEtiketi(l.sonrakiTarih, bugun, kapali) : null;
  const tel = l.telefon.replace(/[^\d+]/g, "");
  return (
    <article draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; onSurukleBasla(l.id); }}
      onDragEnd={onSurukleBitti}
      className={`flex cursor-grab flex-col gap-2.5 rounded-2xl border bg-card p-3.5 transition-shadow hover:shadow-[0_6px_18px_rgba(14,15,12,0.08)] active:cursor-grabbing ${tarih?.gecikti ? "border-[#F5C089]" : "border-line"} ${kaybedildi ? "opacity-75" : ""}`}>
      <div className="flex items-center gap-2">
        <Chip ton={KAYNAK_TONU[l.kaynak] ?? "gray"}>{l.kaynak}</Chip>
        {tarih && !kapali && <span className={`ml-auto text-xs font-semibold ${tarih.gecikti ? "text-warn" : "text-muted"}`}>{tarih.metin}</span>}
      </div>
      <button type="button" onClick={onDetay} className="flex cursor-pointer flex-col gap-0.5 text-left">
        <h3 className="text-sm font-extrabold leading-snug hover:underline">{l.firma}</h3>
        <span className="text-xs text-muted">{[l.sehir, l.yetkili].filter(Boolean).join(" · ") || "—"}</span>
      </button>
      <div className="flex flex-col gap-1 rounded-xl bg-[#F4F5F0] p-2.5">
        <span className="text-xs font-semibold text-[#474A42]">{ilgiMetni(l)}</span>
        <b className={`text-base tabular-nums ${kaybedildi ? "text-muted line-through" : ""}`}>{l.tutar !== null ? para(l.tutar) : "Tutar yok"}</b>
      </div>
      {!kapali && l.sonrakiAdim && <span className="text-xs text-[#474A42]"><b>Sonraki:</b> {l.sonrakiAdim}</span>}
      {kaybedildi && l.kayipNedeni && <div className="rounded-xl bg-err-bg px-2.5 py-2 text-xs font-bold text-err">Neden: {l.kayipNedeni}</div>}
      {l.asama === "kazanildi" && l.satilanSeriler.length > 0 && <div className="rounded-xl bg-lime-bg px-2.5 py-2 text-xs font-semibold text-[#3A4D00]">{l.satilanSeriler.length} cihaz satıldı bildirildi</div>}
      <div className="-mx-1 flex flex-wrap items-center gap-0.5">
        {tel && <a href={`tel:${tel}`} className={KUCUK} aria-label={`${l.firma} ara`}><Phone size={14} aria-hidden="true" />Ara</a>}
        {tel && <a href={`https://wa.me/${tel.replace("+", "")}`} target="_blank" rel="noreferrer" className={`${KUCUK} text-ok`} aria-label={`${l.firma} WhatsApp`}><MessageCircle size={14} aria-hidden="true" />WhatsApp</a>}
        {(guncelTeklif(l) || !kapali) && (
          <button type="button" onClick={onTeklif} className={KUCUK} aria-label={guncelTeklif(l) ? `${l.firma} teklifini aç` : `${l.firma} için teklif oluştur`}>
            <FileText size={14} aria-hidden="true" />{guncelTeklif(l)?.no ?? "Teklif"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-bg pt-2.5">
        <label className="flex min-w-0 flex-1 items-center">
          <span className="sr-only">Aşama</span>
          <select value={l.asama} onChange={(e) => onTasi(l.id, e.target.value as LeadAsamasi)} disabled={l.asama === "kazanildi"}
            className="min-h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-line-strong bg-card px-2 text-xs font-bold text-ink disabled:cursor-default disabled:opacity-70">
            {LEAD_ASAMALARI.map((a) => <option key={a} value={a}>{ASAMA_AD[a]}</option>)}
          </select>
        </label>
        <div className="flex shrink-0 gap-0.5">
          <button type="button" onClick={onDuzenle} aria-label={`${l.firma} düzenle`} title="Düzenle" className={IKON_BTN}><Pencil size={15} aria-hidden="true" /></button>
          <button type="button" onClick={onYukari} disabled={!onYukari} aria-label={`${l.firma} yukarı taşı`} title="Yukarı taşı" className={IKON_BTN}><ChevronUp size={16} aria-hidden="true" /></button>
          <button type="button" onClick={onAsagi} disabled={!onAsagi} aria-label={`${l.firma} aşağı taşı`} title="Aşağı taşı" className={IKON_BTN}><ChevronDown size={16} aria-hidden="true" /></button>
        </div>
      </div>
    </article>
  );
}

// CRM'deki gibi: kart Kaybedildi'ye taşınınca neden sorulur
function KayipNedeniFormu({ firma, onOnayla, onVazgec }: { firma: string; onOnayla: (neden: string) => void; onVazgec: () => void }) {
  const [neden, setNeden] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (neden) onOnayla(neden); }} className="flex w-full flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold">{firma} neden kaybedildi?</legend>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {KAYIP_NEDENLERI.map((n) => (
            <label key={n} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border border-line-strong px-3 text-sm font-semibold has-checked:border-ink has-checked:bg-err-bg">
              <input type="radio" name="neden" value={n} checked={neden === n} onChange={() => setNeden(n)} className="accent-ink" />{n}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={!neden} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50">Kaybedildi olarak işaretle</button>
      </div>
    </form>
  );
}

function LeadFormu({ lead, asama, paraBirimi, kapat }: { lead: BayiLead | null; asama?: LeadAsamasi; paraBirimi: string; kapat: (id?: string) => void }) {
  const [durum, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(portalLeadKaydet, {});
  const [, baslat] = useTransition();
  const router = useRouter();
  const son = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) { son.current = durum.zaman; router.refresh(); kapat(durum.kayitId); }
  }, [durum, router, kapat]);
  const h = (ad: string) => durum.hatalar?.[ad] && <span className="text-xs font-semibold text-err">{durum.hatalar[ad]}</span>;
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); baslat(() => gonder(new FormData(e.currentTarget))); }}>
      {lead && <input type="hidden" name="id" value={lead.id} />}
      {!lead && asama && <input type="hidden" name="asama" value={asama} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={PORTAL_ALAN}>Firma *<input name="firma" defaultValue={lead?.firma} maxLength={120} className={PORTAL_GIRDI} />{h("firma")}</label>
        <label className={PORTAL_ALAN}>Yetkili<input name="yetkili" defaultValue={lead?.yetkili} maxLength={80} className={PORTAL_GIRDI} /></label>
        <label className={PORTAL_ALAN}>Telefon<input name="telefon" type="tel" defaultValue={lead?.telefon} maxLength={30} placeholder="+40 7xx xxx xxx" className={PORTAL_GIRDI} /></label>
        <label className={PORTAL_ALAN}>E-posta<input name="eposta" type="email" defaultValue={lead?.eposta} maxLength={120} className={PORTAL_GIRDI} />{h("eposta")}</label>
        <label className={PORTAL_ALAN}>Şehir<input name="sehir" defaultValue={lead?.sehir} maxLength={60} className={PORTAL_GIRDI} /></label>
        <label className={PORTAL_ALAN}>Kaynak *
          <select name="kaynak" defaultValue={lead?.kaynak ?? ""} className={PORTAL_GIRDI}><option value="" disabled>Seçin…</option>{LEAD_KAYNAKLARI.map((k) => <option key={k}>{k}</option>)}</select>{h("kaynak")}
        </label>
      </div>
      <fieldset className="grid gap-3 rounded-xl bg-[#F4F5F0] p-3 sm:grid-cols-4">
        <legend className="mb-1 text-[13px] font-bold">İlgilendiği ürün</legend>
        <label className={PORTAL_ALAN}>Model<select name="model" defaultValue={lead?.ilgi.model ?? "ONE"} className={PORTAL_GIRDI}><option value="ONE">ONE</option><option value="ONE Lite">ONE LITE</option></select></label>
        <label className={PORTAL_ALAN}>Adet<input name="adet" type="number" min={1} max={500} defaultValue={lead?.ilgi.adet ?? 1} className={PORTAL_GIRDI} />{h("adet")}</label>
        <label className={PORTAL_ALAN}>Lisans<select name="plan" defaultValue={lead?.ilgi.plan ?? "Pro"} className={PORTAL_GIRDI}><option value="">Belirsiz</option><option>Basic</option><option>Pro</option><option>Pro+</option></select></label>
        <label className={PORTAL_ALAN}>Tahmini tutar ({paraBirimi})<input name="tutar" inputMode="decimal" defaultValue={lead?.tutar ?? ""} className={PORTAL_GIRDI} />{h("tutar")}</label>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className={PORTAL_ALAN}>Sonraki adım<input name="sonrakiAdim" defaultValue={lead?.sonrakiAdim ?? "İlk arama"} maxLength={120} className={PORTAL_GIRDI} /></label>
        <label className={PORTAL_ALAN}>Tarih<input name="sonrakiTarih" type="date" defaultValue={lead?.sonrakiTarih ?? ""} className={PORTAL_GIRDI} />{h("sonrakiTarih")}</label>
      </div>
      {!lead && <label className={PORTAL_ALAN}>Not<textarea name="not" rows={2} maxLength={600} className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" /></label>}
      {durum.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => kapat()} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-50">{bekliyor ? "Kaydediliyor…" : lead ? "Kaydet" : "Lead ekle"}</button>
      </div>
    </form>
  );
}

function LeadDetayi({ l, p, para, duzenle, teklifOlustur }: { l: BayiLead; p: Props; para: (n: number) => string; duzenle: () => void; teklifOlustur: () => void }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<PortalFormDurumu>({});
  const [adim, setAdim] = useState(l.sonrakiAdim);
  const [tarih, setTarih] = useState(l.sonrakiTarih ?? "");
  const [not, setNot] = useState("");
  const [panel, setPanel] = useState<"" | "kazan" | "kayip">("");
  const calistir = (f: () => Promise<PortalFormDurumu>, sonra?: () => void) =>
    baslat(async () => { const s = await f(); setSonuc(s); if (s.tamam) { sonra?.(); router.refresh(); } });
  const acik = ACIK_ASAMALAR.includes(l.asama);
  const tel = l.telefon.replace(/[^\d+]/g, "");
  const BASLIK = "text-[11px] font-bold tracking-[0.08em] text-muted";

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Yetkili", l.yetkili || "—"], ["Şehir", l.sehir || "—"], ["İlgi", `${l.ilgi.adet}× ${l.ilgi.model}${l.ilgi.plan ? ` · ${l.ilgi.plan}` : ""}`], ["Tutar", l.tutar !== null ? para(l.tutar) : "—"]].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 rounded-control bg-[#F4F5F0] p-3"><dt className="text-xs text-muted">{k}</dt><dd className="text-[13px] font-semibold">{v}</dd></div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {tel && <a href={`tel:${tel}`} className={`${BTN} border border-line-strong hover:border-ink`}>Ara</a>}
        {tel && <a href={`https://wa.me/${tel.replace("+", "")}`} target="_blank" rel="noreferrer" className={`${BTN} bg-lime text-ink hover:brightness-95`}>WhatsApp</a>}
        {l.eposta && <a href={`mailto:${l.eposta}`} className={`${BTN} border border-line-strong hover:border-ink`}>E-posta</a>}
        <button type="button" onClick={duzenle} className={`${BTN} ml-auto border border-line-strong hover:border-ink`}>Düzenle</button>
      </div>

      {sonuc.tamam && <p role="status" className="rounded-control bg-lime-bg px-3 py-2 text-[13px] font-semibold text-[#3A4D00]">{sonuc.tamam}</p>}
      {sonuc.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{sonuc.hata}</p>}

      {/* Aşama */}
      <section className="flex flex-col gap-2">
        <h3 className={BASLIK}>AŞAMA</h3>
        <div className="flex flex-wrap gap-1.5">
          {LEAD_ASAMALARI.map((a) => (
            <button key={a} type="button" disabled={bekliyor || l.asama === "kazanildi"} aria-pressed={l.asama === a}
              onClick={() => a === "kazanildi" ? setPanel("kazan") : a === "kaybedildi" ? setPanel("kayip") : calistir(() => portalLeadAsama(l.id, a))}
              className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold disabled:cursor-default ${l.asama === a ? "border-ink bg-ink text-white" : "border-line-strong hover:border-ink disabled:opacity-50"}`}>
              <span className={`h-2 w-2 rounded-full ${ASAMA_RENK[a]}`} />{ASAMA_AD[a]}
            </button>
          ))}
        </div>
        {l.asama === "kaybedildi" && l.kayipNedeni && <span className="text-xs text-muted">Kayıp nedeni: {l.kayipNedeni}</span>}
        {l.asama === "kazanildi" && l.satilanSeriler.length > 0 && <span className="text-xs text-muted">Satılan cihazlar: <span className="font-mono">{l.satilanSeriler.join(", ")}</span></span>}
        {panel === "kayip" && <KayipPaneli onKaydet={(n) => calistir(() => portalLeadAsama(l.id, "kaybedildi", n), () => setPanel(""))} bekliyor={bekliyor} />}
        {panel === "kazan" && <KazanPaneli l={l} p={p} onKaydet={async (v) => { const s = await portalLeadKazan(l.id, v); setSonuc(s); if (s.tamam) { setPanel(""); router.refresh(); } return s; }} />}
      </section>

      {/* Sonraki adım */}
      {acik && (
        <section className="flex flex-col gap-2">
          <h3 className={BASLIK}>SONRAKİ ADIM</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
            <input value={adim} onChange={(e) => setAdim(e.target.value)} maxLength={120} placeholder="Ör. Demo, teklif takibi…" aria-label="Sonraki adım" className={PORTAL_GIRDI} />
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} aria-label="Tarih" className={PORTAL_GIRDI} />
            <button type="button" disabled={bekliyor} onClick={() => calistir(() => portalLeadTakip(l.id, adim, tarih))} className={`${BTN} border border-ink hover:bg-[#F4F5F0]`}>Kaydet</button>
          </div>
        </section>
      )}

      {/* Teklif (CRM'deki gibi: sürümler, teklif sayfası; yeni teklif formu) */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={BASLIK}>TEKLİFLER</h3>
          {acik && !guncelTeklif(l) && (
            <button type="button" onClick={teklifOlustur} className="ml-auto min-h-9 cursor-pointer rounded-control bg-ink px-3 text-xs font-bold text-white hover:bg-ink-soft">Teklif oluştur</button>
          )}
        </div>
        {l.teklifler.length ? (
          <ul className="flex flex-col gap-1.5">
            {[...l.teklifler].reverse().map((t) => (
              <li key={t.id}>
                <a href={`/portal/leadler/${l.id}/teklif?v=${t.versiyon}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-line px-3 py-2 text-sm hover:border-ink">
                  <b className="tabular-nums">{t.no}</b>
                  <span className="text-muted">{tarihTr(t.olusturma)}</span>
                  <span className="font-semibold tabular-nums">{para(teklifToplami(t).toplam)}</span>
                  <span className="ml-auto"><Chip ton={TEKLIF_TONU[t.durum]}>{TEKLIF_DURUM[t.durum]}</Chip></span>
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-muted">Henüz teklif yok.</p>}
      </section>

      {/* Notlar */}
      <section className="flex flex-col gap-2">
        <h3 className={BASLIK}>GÖRÜŞME NOTLARI</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={not} onChange={(e) => setNot(e.target.value)} maxLength={600} placeholder="Görüşmede ne konuşuldu?" aria-label="Not" className={`${PORTAL_GIRDI} flex-1`} />
          <button type="button" disabled={bekliyor} onClick={() => calistir(() => portalLeadNot(l.id, not), () => setNot(""))} className={`${BTN} border border-ink hover:bg-[#F4F5F0]`}>Not ekle</button>
        </div>
        <ol className="flex flex-col">
          {[...l.notlar].reverse().map((n, i, a) => (
            <li key={i} className="flex gap-3 pb-3 text-sm last:pb-0">
              <span className="flex flex-col items-center">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.sistem ? "bg-[#C9CCC2]" : "bg-ink"}`} />
                {i < a.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </span>
              <span className="flex min-w-0 flex-col"><span className={n.sistem ? "text-muted" : ""}>{n.metin}</span><span className="text-xs text-muted">{tarihTr(n.zaman)} {n.zaman.slice(11, 16)}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function KayipPaneli({ onKaydet, bekliyor }: { onKaydet: (neden: string) => void; bekliyor: boolean }) {
  const [neden, setNeden] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#F3B5B5] bg-[#FDF0F0] p-3 sm:flex-row sm:items-center">
      <span className="text-sm font-semibold">Neden kaybedildi?</span>
      <select value={neden} onChange={(e) => setNeden(e.target.value)} aria-label="Kayıp nedeni" className={`${PORTAL_GIRDI} flex-1`}>
        <option value="" disabled>Seçin…</option>{KAYIP_NEDENLERI.map((n) => <option key={n}>{n}</option>)}
      </select>
      <button type="button" disabled={bekliyor || !neden} onClick={() => onKaydet(neden)} className={`${BTN} bg-ink text-white hover:bg-ink-soft`}>Kaybedildi olarak kapat</button>
    </div>
  );
}

export function KazanPaneli({ l, p, onKaydet }: { l: BayiLead; p: { stok: Props["stok"]; bugun: string; havuz: Record<string, number> }; onKaydet: (v: { seriler: string[]; lisans: string; tarih: string }) => Promise<PortalFormDurumu> }) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const uygun = p.stok.filter((s) => s.model === l.ilgi.model);
  const [secili, setSecili] = useState<string[]>(uygun.slice(0, l.ilgi.adet).map((s) => s.seriNo));
  // Lisans: lead'in istediği paket havuzda varsa havuzdan, yoksa Embedra'dan sipariş
  const istenen = l.ilgi.plan || "Pro";
  const [lisans, setLisans] = useState<string>((p.havuz[istenen] ?? 0) >= l.ilgi.adet ? `havuz:${istenen}` : `siparis:${istenen}`);
  const [tarih, setTarih] = useState(p.bugun);
  const digerleri = p.stok.filter((s) => s.model !== l.ilgi.model);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#B9DFC6] bg-[#EEF8F1] p-3">
      <b className="text-sm">Kazanıldı · satılan cihazları stoktan seçin</b>
      <span className="text-xs text-[#2F5D3E]">Seçtiğiniz cihazlar <b>{l.firma}</b> adına satıldı bildirilir; lisans ve garanti müşteri adına başlar.</span>
      {p.stok.length ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {[...uygun, ...digerleri].map((s) => (
            <li key={s.seriNo}>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-card px-3 text-sm has-[:checked]:border-ink">
                <input type="checkbox" checked={secili.includes(s.seriNo)} onChange={() => setSecili((x) => x.includes(s.seriNo) ? x.filter((y) => y !== s.seriNo) : [...x, s.seriNo])} className="h-4 w-4 accent-[#0E0F0C]" />
                <span className="font-mono text-xs font-semibold">{s.seriNo}</span><span className="text-muted">{s.model === "ONE Lite" ? "LITE" : "ONE"}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted">Stoğunuzda cihaz yok. Önce Sipariş ver&apos;den cihaz alabilir ya da cihaz bildirmeden kapatabilirsiniz.</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <LisansSecici havuz={p.havuz} deger={lisans} onDegis={setLisans} etiket="Lisans (12 ay)" />
        <label className="flex flex-col gap-1 text-xs font-bold">Satış tarihi<input type="date" value={tarih} max={p.bugun} onChange={(e) => setTarih(e.target.value)} className={PORTAL_GIRDI} /></label>
        <button type="button" disabled={bekliyor} onClick={() => baslat(async () => { const s = await onKaydet({ seriler: secili, lisans, tarih }); setHata(s.hata ?? null); })} className={`${BTN} self-end bg-[#1F8A4C] text-white hover:brightness-95`}>
          {bekliyor ? "İşleniyor…" : secili.length ? `Kazanıldı · ${secili.length} cihazı bildir` : "Cihazsız kazanıldı"}
        </button>
      </div>
      {hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{hata}</p>}
    </div>
  );
}
