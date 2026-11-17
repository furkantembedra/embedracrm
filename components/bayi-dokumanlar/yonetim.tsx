"use client";

// CRM › Bayi & Distribütör › Doküman & duyurular: bayilerle paylaşılan dosyalar, duyurular ve eğitim takibi.
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Megaphone, Plus, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Chip from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { dokumanSil, dokumanYukle, duyuruSil, duyuruYayinla, type DokumanFormDurumu } from "./actions";
import { DOKUMAN_KATEGORILERI, boyutYaz, type BayiDokumani, type Duyuru } from "./ortak";

const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";
const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink";
const TAB = "-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-bold";
const tarihTr = (t: string) => new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

type Bayi = { id: string; ad: string };

export default function DokumanYonetimi({ dokumanlar, duyurular, bayiler, egitim }: {
  dokumanlar: BayiDokumani[]; duyurular: Duyuru[]; bayiler: Bayi[]; egitim: Record<string, string[]>;
}) {
  const [sekme, setSekme] = useState<"dokuman" | "duyuru" | "egitim">("dokuman");
  const [kategori, setKategori] = useState("");
  const [yukleAcik, setYukleAcik] = useState(false);
  const [duyuruAcik, setDuyuruAcik] = useState(false);
  const [, baslat] = useTransition();
  const router = useRouter();
  const hedefYaz = (h: "hepsi" | string[]) => (h === "hepsi" ? "Tüm bayiler" : h.map((id) => bayiler.find((b) => b.id === id)?.ad ?? id).join(", "));
  const egitimler = dokumanlar.filter((d) => d.kategori === "Eğitim");
  const liste = dokumanlar.filter((d) => !kategori || d.kategori === kategori);

  return (
    <>
      <Link href="/bayiler" className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-control px-2 text-sm font-bold text-[#474A42] hover:bg-card">
        <ArrowLeft size={18} aria-hidden="true" /> Bayi & distribütör ağı
      </Link>
      <PageHeader title="Bayi dokümanları ve duyurular" description="Bayi portalının Dokümanlar sayfasında görünür · tüm bayilerle ya da seçili bayilerle paylaşın">
        <button type="button" onClick={() => setDuyuruAcik(true)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          <Megaphone size={18} aria-hidden="true" /> Duyuru yayınla
        </button>
        <button type="button" onClick={() => setYukleAcik(true)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
          <Upload size={18} aria-hidden="true" /> Doküman yükle
        </button>
      </PageHeader>

      <div role="tablist" className="flex gap-1 border-b border-line">
        {([["dokuman", `Dokümanlar (${dokumanlar.length})`], ["duyuru", `Duyurular (${duyurular.length})`], ["egitim", "Eğitim takibi"]] as const).map(([k, ad]) => (
          <button key={k} type="button" role="tab" aria-selected={sekme === k} onClick={() => setSekme(k)} className={`${TAB} ${sekme === k ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}>{ad}</button>
        ))}
      </div>

      {sekme === "dokuman" && (
        <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
          <div className="flex flex-wrap gap-1.5">
            {["", ...DOKUMAN_KATEGORILERI].map((k) => (
              <button key={k || "hepsi"} type="button" aria-pressed={kategori === k} onClick={() => setKategori(k)}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-bold ${kategori === k ? "border-ink bg-ink text-white" : "border-line-strong hover:border-ink"}`}>
                {k || "Tümü"}
              </button>
            ))}
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2 pr-3">Doküman</th><th className="py-2 pr-3">Kategori</th><th className="py-2 pr-3">Paylaşım</th><th className="py-2 pr-3">Tarih</th><th className="py-2 text-right">İşlem</th></tr></thead>
              <tbody>
                {liste.map((d) => (
                  <tr key={d.id} className="border-b border-bg last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-start gap-2">
                        <FileText size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
                        <span className="flex min-w-0 flex-col"><b>{d.baslik}</b><span className="text-xs text-muted">{d.dosyaAdi} · {boyutYaz(d.boyut)}{d.demo ? " · örnek dosya" : ""}</span></span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{d.kategori}{d.sure && <span className="text-xs text-muted"> · {d.sure}</span>}</td>
                    <td className="py-2.5 pr-3 text-[13px]">{hedefYaz(d.hedef)}</td>
                    <td className="py-2.5 pr-3 text-muted">{tarihTr(d.tarih)}</td>
                    <td className="py-2.5">
                      <span className="flex justify-end gap-1">
                        <a href={`/api/bayi-dokuman/${d.id}`} target="_blank" rel="noreferrer" aria-label={`${d.baslik} aç`} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#474A42] hover:bg-bg"><Download size={16} aria-hidden="true" /></a>
                        <button type="button" aria-label={`${d.baslik} sil`} onClick={() => { if (confirm(`"${d.baslik}" silinsin mi? Bayiler artık göremez.`)) baslat(async () => { await dokumanSil(d.id); router.refresh(); }); }}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#474A42] hover:bg-err-bg hover:text-err"><Trash2 size={16} aria-hidden="true" /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Sözleşme özeti ve bayi fiyat listesi portalda bayinin kendi kaydından otomatik üretilir; buraya yüklemeniz gerekmez.</p>
        </section>
      )}

      {sekme === "duyuru" && (
        <section className="flex flex-col gap-3">
          {duyurular.map((d) => {
            const hedefSayi = d.hedef === "hepsi" ? bayiler.length : d.hedef.length;
            return (
              <article key={d.id} className="flex flex-col gap-2 rounded-card border border-line bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-base">{d.baslik}</b>
                  {d.onem === "onemli" && <Chip ton="warn">Önemli</Chip>}
                  <span className="ml-auto text-xs text-muted">{tarihTr(d.tarih)}</span>
                  <button type="button" aria-label={`${d.baslik} sil`} onClick={() => { if (confirm("Duyuru silinsin mi?")) baslat(async () => { await duyuruSil(d.id); router.refresh(); }); }}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#474A42] hover:bg-err-bg hover:text-err"><Trash2 size={16} aria-hidden="true" /></button>
                </div>
                <p className="whitespace-pre-line text-sm text-[#474A42]">{d.metin}</p>
                <p className="text-xs text-muted">{hedefYaz(d.hedef)} · <b className="text-ink">{d.okuyanlar.length}/{hedefSayi}</b> bayi okudu{d.okuyanlar.length ? ` (${d.okuyanlar.map((id) => bayiler.find((b) => b.id === id)?.ad ?? id).join(", ")})` : ""}</p>
              </article>
            );
          })}
          {!duyurular.length && <p className="rounded-card border border-line bg-card p-8 text-center text-sm text-muted">Duyuru yok.</p>}
        </section>
      )}

      {sekme === "egitim" && (
        <section className="rounded-card border border-line bg-card p-5">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold text-muted">
                  <th className="py-2 pr-3">Bayi</th>
                  {egitimler.map((e) => <th key={e.id} className="py-2 pr-3 text-center" title={e.baslik}>{e.baslik.split("·")[0].trim()}</th>)}
                  <th className="py-2 text-right">Sertifika</th>
                </tr>
              </thead>
              <tbody>
                {bayiler.map((b) => {
                  const tamam = egitim[b.id] ?? [];
                  const hepsi = egitimler.length > 0 && egitimler.every((e) => tamam.includes(e.id));
                  return (
                    <tr key={b.id} className="border-b border-bg last:border-0">
                      <td className="py-2.5 pr-3 font-semibold">{b.ad}</td>
                      {egitimler.map((e) => <td key={e.id} className="py-2.5 pr-3 text-center">{tamam.includes(e.id) ? <span className="font-bold text-[#1F7A45]" aria-label="Tamamlandı">✓</span> : <span className="text-muted" aria-label="Tamamlanmadı">—</span>}</td>)}
                      <td className="py-2.5 text-right">{hepsi ? <Chip ton="ok">Sertifikalı</Chip> : <span className="text-xs text-muted">{egitimler.filter((e) => tamam.includes(e.id)).length}/{egitimler.length}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal acik={yukleAcik} onKapat={() => setYukleAcik(false)} baslik="Doküman yükle" aciklama="PDF, görsel ya da video · en çok 4 MB">
        {yukleAcik && <YuklemeFormu bayiler={bayiler} kapat={() => setYukleAcik(false)} />}
      </Modal>
      <Modal acik={duyuruAcik} onKapat={() => setDuyuruAcik(false)} baslik="Duyuru yayınla" aciklama="Bayi portalının Dokümanlar sayfasında en üstte görünür">
        {duyuruAcik && <DuyuruFormu bayiler={bayiler} kapat={() => setDuyuruAcik(false)} />}
      </Modal>
    </>
  );
}

function HedefSecimi({ bayiler, hata }: { bayiler: Bayi[]; hata?: string }) {
  const [tur, setTur] = useState<"hepsi" | "secili">("hepsi");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-bold">Kimler görsün?</legend>
      <div className="flex gap-2">
        {([["hepsi", "Tüm bayiler"], ["secili", "Seçili bayiler"]] as const).map(([k, ad]) => (
          <label key={k} className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-sm font-semibold has-checked:border-ink has-checked:bg-[#F4F5F0]">
            <input type="radio" name="hedefTur" value={k} checked={tur === k} onChange={() => setTur(k)} className="accent-ink" />{ad}
          </label>
        ))}
      </div>
      {tur === "secili" && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {bayiler.map((b) => (
            <label key={b.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-3 text-sm has-checked:border-ink">
              <input type="checkbox" name="bayi" value={b.id} className="h-4 w-4 accent-ink" />{b.ad}
            </label>
          ))}
        </div>
      )}
      {hata && <span className="text-xs font-semibold text-err">{hata}</span>}
    </fieldset>
  );
}

function useKayit(islem: (o: DokumanFormDurumu, f: FormData) => Promise<DokumanFormDurumu>, kapat: () => void) {
  const [durum, gonder, bekliyor] = useActionState(islem, {});
  const router = useRouter();
  const son = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (durum.tamam && durum.zaman !== son.current) { son.current = durum.zaman; router.refresh(); kapat(); }
  }, [durum, router, kapat]);
  return { durum, bekliyor, gonder: (f: FormData) => startTransition(() => gonder(f)) };
}

function YuklemeFormu({ bayiler, kapat }: { bayiler: Bayi[]; kapat: () => void }) {
  const { durum, bekliyor, gonder } = useKayit(dokumanYukle, kapat);
  const [kategori, setKategori] = useState("");
  const h = durum.hatalar ?? {};
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); gonder(new FormData(e.currentTarget)); }}>
      <label className={ALAN}>Başlık *<input name="baslik" maxLength={120} className={GIRDI} />{h.baslik && <span className="text-xs font-semibold text-err">{h.baslik}</span>}</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>Kategori *
          <select name="kategori" value={kategori} onChange={(e) => setKategori(e.target.value)} className={GIRDI}>
            <option value="" disabled>Seçin…</option>{DOKUMAN_KATEGORILERI.map((k) => <option key={k}>{k}</option>)}
          </select>
          {h.kategori && <span className="text-xs font-semibold text-err">{h.kategori}</span>}
        </label>
        {kategori === "Eğitim" && <label className={ALAN}>Süre<input name="sure" placeholder="ör. 12 dk" maxLength={20} className={GIRDI} /></label>}
      </div>
      <label className={ALAN}>Açıklama<textarea name="aciklama" rows={2} maxLength={300} className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" /></label>
      <label className={ALAN}>Dosya *
        <input name="dosya" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm"
          className="rounded-control border border-dashed border-line-strong bg-[#F4F5F0] px-3 py-3 text-sm file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" />
        {h.dosya && <span className="text-xs font-semibold text-err">{h.dosya}</span>}
      </label>
      <HedefSecimi bayiler={bayiler} hata={h.hedef} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={kapat} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60"><Upload size={16} aria-hidden="true" />{bekliyor ? "Yükleniyor…" : "Yükle ve paylaş"}</button>
      </div>
    </form>
  );
}

function DuyuruFormu({ bayiler, kapat }: { bayiler: Bayi[]; kapat: () => void }) {
  const { durum, bekliyor, gonder } = useKayit(duyuruYayinla, kapat);
  const h = durum.hatalar ?? {};
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); gonder(new FormData(e.currentTarget)); }}>
      <label className={ALAN}>Başlık *<input name="baslik" maxLength={120} className={GIRDI} />{h.baslik && <span className="text-xs font-semibold text-err">{h.baslik}</span>}</label>
      <label className={ALAN}>Metin *<textarea name="metin" rows={4} maxLength={1000} className="rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink" />{h.metin && <span className="text-xs font-semibold text-err">{h.metin}</span>}</label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" name="onem" value="onemli" className="h-4 w-4 accent-ink" />Önemli (portalda vurgulu gösterilir)</label>
      <HedefSecimi bayiler={bayiler} hata={h.hedef} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={kapat} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
        <button type="submit" disabled={bekliyor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60"><Plus size={16} aria-hidden="true" />{bekliyor ? "Yayınlanıyor…" : "Yayınla"}</button>
      </div>
    </form>
  );
}
