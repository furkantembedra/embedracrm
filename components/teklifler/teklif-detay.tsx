"use client";

// Tek teklif: A4 yazdırılabilir belge + işlem çubuğu (yazdır/PDF, gönderildi, kabul, red, revize).
// Tarayıcının "Yazdır › PDF olarak kaydet" seçeneğiyle PDF alınır; menü ve butonlar baskıda gizlenir.
import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Printer, Send, X } from "lucide-react";
import Modal from "@/components/ui/modal";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { useBugun } from "@/lib/use-bugun";
import type { FiyatListesi } from "@/lib/urunler";
import TeklifFormu from "./teklif-formu";
import { teklifDurumuDegistir } from "./actions";
import { kalemAdi, kalemKdvli, suresiDoldu, teklifToplami } from "./ortak";
import { DURUM_ADI, type Teklif } from "./queries";
import { DURUM_TONU, tarihYaz } from "./teklif-listesi";

const BUTON = "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function TeklifDetay({ teklif, surumler, fiyatListesi }: { teklif: Teklif; surumler: Teklif[]; fiyatListesi: FiyatListesi }) {
  const t = teklif;
  const router = useRouter();
  const bugunMs = useBugun();
  const bugun = bugunMs === null ? "" : new Date(bugunMs + 12 * 3_600_000).toISOString().slice(0, 10);
  const doldu = !!bugun && suresiDoldu(t, bugun);
  const toplam = teklifToplami(t);
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [revize, setRevize] = useState(false);
  const kapat = useCallback(() => setRevize(false), []);
  const revizeEdildi = useCallback((y: Teklif) => router.push(`/teklifler/${y.id}`), [router]);

  function islem(durum: "gonderildi" | "kabul" | "red") {
    setHata(null);
    baslat(async () => {
      const s = await teklifDurumuDegistir(t.id, durum);
      if (s.hata) setHata(s.hata);
      else if (durum === "kabul") setMesaj(s.musteri?.siparisNo ? `Fırsat kazanıldı, ödeme bekleyen sipariş açıldı: #${s.musteri.siparisNo}` : "Fırsat kazanıldı.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/teklifler" className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-bold text-[#474A42] hover:bg-card">
          <ArrowLeft size={18} aria-hidden="true" /> Teklifler
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className={`${BUTON} border border-line-strong bg-card hover:bg-[#F4F5F0]`}>
            <Printer size={16} aria-hidden="true" /> Yazdır / PDF
          </button>
          {(t.durum === "gonderildi" || t.durum === "taslak" || t.durum === "red") && (
            <button type="button" onClick={() => setRevize(true)} className={`${BUTON} border border-line-strong bg-card hover:bg-[#F4F5F0]`}>
              <Copy size={16} aria-hidden="true" /> Revize et
            </button>
          )}
          {t.durum === "taslak" && (
            <button type="button" disabled={bekliyor} onClick={() => islem("gonderildi")} className={`${BUTON} bg-ink text-white hover:bg-ink-soft`}>
              <Send size={16} aria-hidden="true" /> Gönderildi işaretle
            </button>
          )}
          {t.durum === "gonderildi" && (
            <>
              <button type="button" disabled={bekliyor} onClick={() => islem("red")} className={`${BUTON} border border-err text-err hover:bg-err-bg`}>
                <X size={16} aria-hidden="true" /> Reddedildi
              </button>
              <button type="button" disabled={bekliyor || doldu} title={doldu ? "Süresi dolan teklif önce revize edilmeli" : undefined} onClick={() => islem("kabul")} className={`${BUTON} bg-lime text-ink hover:brightness-95`}>
                <Check size={16} aria-hidden="true" /> Kabul edildi
              </button>
            </>
          )}
        </div>
      </div>

      {(hata || mesaj) && (
        <p role={hata ? "alert" : "status"} className={`rounded-control px-4 py-3 text-sm font-semibold print:hidden ${hata ? "bg-err-bg text-err" : "bg-lime-bg text-[#3A4D00]"}`}>
          {hata ?? mesaj}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <article className="mx-auto flex w-full max-w-[794px] flex-col gap-6 rounded-card border border-line bg-white p-6 text-ink sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-ink text-xl font-extrabold text-lime print:bg-ink">e</div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight">embedra</span>
                <span className="text-xs text-muted">Embedra Teknoloji · embedra.com</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <h1 className="text-2xl font-extrabold">FİYAT TEKLİFİ</h1>
              <span className="text-sm font-bold tabular-nums">{t.no}</span>
              <span className="print:hidden">
                {doldu ? <Chip ton="warn">Süresi doldu</Chip> : <Chip ton={DURUM_TONU[t.durum]}>{DURUM_ADI[t.durum]}</Chip>}
              </span>
            </div>
          </header>

          <section className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-muted">SAYIN</span>
              <b className="text-base">{t.firma}</b>
              <span className="text-muted">{t.konum}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 sm:justify-self-end">
              <dt className="text-muted">Tarih</dt><dd className="font-semibold">{tarihYaz(t.olusturma)}</dd>
              <dt className="text-muted">Geçerlilik</dt><dd className="font-semibold">{tarihYaz(t.gecerlilik)}</dd>
              {t.versiyon > 1 && (<><dt className="text-muted">Revizyon</dt><dd className="font-semibold">v{t.versiyon}</dd></>)}
            </dl>
          </section>

          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-ink text-left text-xs font-bold">
                  <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Ürün / hizmet</th><th className="py-2 pr-2 text-right">Adet</th>
                  <th className="py-2 pr-2 text-right">Birim fiyat</th><th className="py-2 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {t.kalemler.map((k, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-2.5 pr-2 text-muted">{i + 1}</td>
                    <td className="py-2.5 pr-2 font-semibold">{kalemAdi(k)}{!kalemKdvli(k) && <span className="ml-1 text-xs font-normal text-muted">(KDV&apos;siz)</span>}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{k.adet}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{tl(k.birimFiyat)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{tl(k.adet * k.birimFiyat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted">Ara toplam</dt><dd className="text-right tabular-nums">{tl(toplam.ara)}</dd>
            {toplam.iskonto > 0 && (<><dt className="text-muted">İskonto (%{t.iskonto})</dt><dd className="text-right tabular-nums">−{tl(toplam.iskonto)}</dd></>)}
            <dt className="text-muted">KDV (%{Math.round(t.kdv * 100)})</dt><dd className="text-right tabular-nums">{tl(toplam.kdv)}</dd>
            <dt className="border-t border-ink pt-1.5 font-extrabold">Genel toplam</dt><dd className="border-t border-ink pt-1.5 text-right text-lg font-extrabold tabular-nums">{tl(toplam.toplam)}</dd>
          </dl>

          <section className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1"><b>Ödeme şartları</b><span className="text-[#474A42]">{t.odemeSartlari}</span></div>
            <div className="flex flex-col gap-1"><b>Teslim şartları</b><span className="text-[#474A42]">{t.teslimSartlari}</span></div>
            {t.not && <div className="flex flex-col gap-1 sm:col-span-2"><b>Not</b><span className="whitespace-pre-line text-[#474A42]">{t.not}</span></div>}
          </section>

          <footer className="mt-4 border-t border-line pt-4 text-xs text-muted">
            Lisanslar KDV&apos;siz, cihaz ve aksesuarlar KDV dahil toplam üzerinden faturalandırılır. Fiyatlar TL&apos;dir. Bu teklif {tarihYaz(t.gecerlilik)} tarihine kadar geçerlidir.
          </footer>
        </article>

        <aside className="flex w-full flex-col gap-3 rounded-card border border-line bg-card p-5 lg:w-72 print:hidden">
          <h2 className="text-[15px] font-extrabold">Sürümler</h2>
          <ol className="flex flex-col gap-1">
            {surumler.map((s) => (
              <li key={s.id}>
                <Link href={`/teklifler/${s.id}`} aria-current={s.id === t.id ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-sm ${s.id === t.id ? "bg-bg font-bold" : "hover:bg-bg"}`}>
                  <span>v{s.versiyon} · {tarihYaz(s.olusturma)}</span>
                  <span className="text-xs text-muted">{DURUM_ADI[s.durum]}</span>
                </Link>
              </li>
            ))}
          </ol>
          <Link href="/satis-hatti" className="text-[13px] font-bold text-info hover:underline">Fırsatı satış hattında gör →</Link>
          {t.siparisNo && <Link href={`/siparisler/${t.siparisNo}`} className="text-[13px] font-bold text-info hover:underline">Sipariş #{t.siparisNo} →</Link>}
        </aside>
      </div>

      <Modal acik={revize} onKapat={kapat} baslik="Teklifi revize et" aciklama={`${t.no} → v${t.versiyon + 1}`}>
        <TeklifFormu onceki={t} fiyatListesi={fiyatListesi} onKaydedildi={revizeEdildi} onVazgec={kapat} />
      </Modal>
    </>
  );
}
