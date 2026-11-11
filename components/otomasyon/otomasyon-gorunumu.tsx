"use client";

// Otomasyon sayfası: kural listesi (aç/kapat, düzenle, şimdi çalıştır, sil) + çalışma geçmişi
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Chip from "@/components/ui/chip";
import Modal from "@/components/ui/modal";
import { kuralAcKapat, kuraliSimdiCalistir, kuralSilAction, otomasyonVerisi, tumKurallariCalistir, type OtomasyonVerisi } from "./actions";
import KuralFormu from "./kural-formu";
import { TETIKLEYICILER } from "./ortak";
import type { Kural } from "./queries";

const DURUM_TON = { yapildi: "ok", atlandi: "gray", hata: "err" } as const;
const DURUM_ADI = { yapildi: "Yapıldı", atlandi: "Atlandı", hata: "Hata" } as const;
const EYLEM_ADI = { hatirlatma: "Hatırlatma", eposta: "E-posta" } as const;

const zamanYaz = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function OtomasyonGorunumu() {
  const [veri, setVeri] = useState<OtomasyonVerisi | null>(null);
  const [form, setForm] = useState<{ kural?: Kural } | null>(null);
  const [silinecek, setSilinecek] = useState<Kural | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [calisiyor, baslat] = useTransition();

  const yenile = useCallback(() => {
    otomasyonVerisi().then(setVeri).catch(() => {});
  }, []);

  useEffect(() => {
    yenile();
    const t = setInterval(yenile, 30_000); // zamanlayıcı arka planda çalıştırdıkça geçmiş kendiliğinden güncellenir
    return () => clearInterval(t);
  }, [yenile]);

  const kaydedildi = useCallback(() => {
    setForm(null);
    yenile();
  }, [yenile]);

  const ozetMesaji = (o: { kural: number; yeni: number; eylem: number } | null) =>
    !o ? "Başka bir çalıştırma sürüyor, biraz sonra tekrar deneyin."
      : o.yeni ? `${o.yeni} yeni kayıt işlendi, ${o.eylem} eylem yapıldı.` : "Yeni eşleşen kayıt yok.";

  const calistir = (id?: string) =>
    baslat(async () => {
      const { ozet } = id ? await kuraliSimdiCalistir(id) : await tumKurallariCalistir();
      setMesaj(ozetMesaji(ozet));
      yenile();
    });

  const acKapat = (k: Kural, aktif: boolean) => {
    setVeri((v) => v && { ...v, kurallar: v.kurallar.map((x) => (x.id === k.id ? { ...x, aktif } : x)) });
    baslat(async () => {
      await kuralAcKapat(k.id, aktif);
      yenile();
    });
  };

  const sil = () => {
    const k = silinecek;
    if (!k) return;
    setSilinecek(null);
    baslat(async () => {
      await kuralSilAction(k.id);
      yenile();
    });
  };

  const aktifSayi = veri?.kurallar.filter((k) => k.aktif).length ?? 0;
  const calismaSayisi = veri?.kayitlar.length ?? 0;

  return (
    <>
      <PageHeader title="Otomasyon" description="“Şu olursa şunu yap” kuralları: lisans, teklif, RMA, sipariş, fırsat ve stok olaylarında hatırlatma açar, müşteriye e-posta gönderir">
        <button type="button" onClick={() => calistir()} disabled={calisiyor || !aktifSayi} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0] disabled:cursor-not-allowed disabled:opacity-60">
          <Play size={16} aria-hidden="true" /> Etkin kuralları şimdi çalıştır
        </button>
        <button type="button" onClick={() => setForm({})} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
          <Plus size={18} aria-hidden="true" /> Yeni kural
        </button>
      </PageHeader>

      <p role="status" aria-live="polite" className={mesaj ? "rounded-control bg-bg px-4 py-2.5 text-sm font-semibold" : "sr-only"}>{mesaj}</p>

      {!veri && <div aria-busy="true" aria-label="Yükleniyor" className="h-80 animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />}

      {veri && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Etkin kural", `${aktifSayi} / ${veri.kurallar.length}`],
              ["İşlenmeyi bekleyen kayıt", String(veri.kurallar.filter((k) => k.aktif).reduce((t, k) => t + k.onizleme.yeni, 0))],
              ["Son çalışmalar (kayıtlı)", String(calismaSayisi)],
            ].map(([ad, deger]) => (
              <div key={ad} className="flex flex-col gap-1 rounded-card border border-line bg-card p-5">
                <span className="text-[13px] font-bold text-muted">{ad}</span>
                <span className="text-[28px] font-extrabold leading-none">{deger}</span>
              </div>
            ))}
          </div>

          <section aria-label="Kurallar" className="flex flex-col gap-3">
            {veri.kurallar.length === 0 && <p className="rounded-card border border-line bg-card p-8 text-center text-sm text-muted">Henüz kural yok. “Yeni kural” ile başlayın.</p>}
            {veri.kurallar.map((k) => {
              const t = TETIKLEYICILER[k.tetikleyici];
              return (
                <article key={k.id} className={`flex flex-col gap-3 rounded-card border border-line bg-card p-5 ${k.aktif ? "" : "opacity-80"}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
                      <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
                        {k.ad}
                        <Chip ton={k.aktif ? "ok" : "gray"}>{k.aktif ? "Etkin" : "Kapalı"}</Chip>
                      </h2>
                      <p className="text-sm text-muted"><b className="text-ink">Şu olursa:</b> {t.aciklama(k.gun)}</p>
                      <p className="text-sm text-muted">
                        <b className="text-ink">Şunu yap:</b>{" "}
                        {[
                          k.hatirlatma && `${veri.ekip.find((u) => u.id === k.hatirlatma!.sorumluId)?.ad ?? "Pasif kullanıcı"} için ${k.hatirlatma.onem === "yuksek" ? "yüksek önemli " : ""}hatırlatma aç`,
                          k.eposta && "müşteriye e-posta gönder (izni olan yetkiliye)",
                        ].filter(Boolean).join(" + ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-bold">
                        <input type="checkbox" role="switch" checked={k.aktif} onChange={(e) => acKapat(k, e.target.checked)} className="h-4 w-4 accent-ink" />
                        Etkin
                      </label>
                      <button type="button" onClick={() => calistir(k.id)} disabled={calisiyor} title="Bu kuralı şimdi çalıştır" className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong px-3 text-[13px] font-bold hover:bg-[#F4F5F0] disabled:opacity-60">
                        <Play size={14} aria-hidden="true" /> Çalıştır
                      </button>
                      <button type="button" onClick={() => setForm({ kural: k })} aria-label={`${k.ad} kuralını düzenle`} className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-control border border-line-strong hover:bg-[#F4F5F0]">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setSilinecek(k)} aria-label={`${k.ad} kuralını sil`} className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-control border border-line-strong text-err hover:bg-err-bg">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                    <span>Şu an eşleşen: <b className="text-ink">{k.onizleme.toplam}</b></span>
                    <span>İşlenmeyi bekleyen: <b className="text-ink">{k.onizleme.yeni}</b>{k.onizleme.ornekler.length > 0 && ` (${k.onizleme.ornekler.join(", ")}${k.onizleme.yeni > 3 ? "…" : ""})`}</span>
                    <span>Son çalışma: <b className="text-ink">{k.sonCalisma ? zamanYaz(k.sonCalisma) : "henüz çalışmadı"}</b></span>
                  </div>
                </article>
              );
            })}
          </section>

          <section aria-label="Çalışma geçmişi" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
            <h2 className="text-[17px] font-extrabold">Çalışma geçmişi</h2>
            {veri.kayitlar.length === 0 ? (
              <p className="py-4 text-sm text-muted">Henüz çalışan kural yok. Etkin kurallar dakikada bir kendiliğinden çalışır.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {veri.kayitlar.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="w-28 shrink-0 text-xs font-semibold text-muted">{zamanYaz(c.zaman)}</span>
                    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                      <span className="font-bold">{c.kuralAd}</span>
                      <Link href={c.href} className="w-fit text-[13px] font-semibold text-blue hover:underline">{c.kayitAd}</Link>
                    </div>
                    <ul className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                      {c.sonuclar.map((s, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                          <Chip ton={DURUM_TON[s.durum]}>{EYLEM_ADI[s.eylem]} · {DURUM_ADI[s.durum]}</Chip>
                          <span className="min-w-0 text-muted">{s.ayrinti}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Modal acik={!!form} onKapat={() => setForm(null)} baslik={form?.kural ? "Kuralı düzenle" : "Yeni otomasyon kuralı"} aciklama="Bir olay ve o olayda yapılacak eylemleri seçin. Her kayıt için eylem yalnızca bir kez çalışır.">
            {form && <KuralFormu key={form.kural?.id ?? "yeni"} kural={form.kural} ekip={veri.ekip} epostaSaglayici={veri.epostaSaglayici} onKaydedildi={kaydedildi} onVazgec={() => setForm(null)} />}
          </Modal>

          <Modal acik={!!silinecek} onKapat={() => setSilinecek(null)} baslik="Kuralı sil">
            <div className="flex flex-col gap-5">
              <p className="text-sm"><b>{silinecek?.ad}</b> kuralı silinecek. Daha önce açılan hatırlatmalar silinmez. Bu işlem geri alınamaz.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSilinecek(null)} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
                <button type="button" onClick={sil} className="min-h-11 cursor-pointer rounded-control bg-err px-5 text-sm font-bold text-white hover:opacity-90">Sil</button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </>
  );
}
