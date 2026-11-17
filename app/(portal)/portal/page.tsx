import Link from "next/link";
import Chip from "@/components/ui/chip";
import { tl } from "@/lib/format";
import { DURUM_ADI, DURUM_TONU, acikSiparis } from "@/components/siparisler/ortak";
import { tarihTr } from "@/components/portal/veri";
import { portalOzeti, type Olay, type Yapilacak } from "@/components/portal/ozet";
import YenilemeButonu from "@/components/portal/yenileme-butonu";
import SatisBildirDugmesi from "@/components/portal/satis-bildir";
import { satisFormVerisi } from "@/components/portal/satis-ortak";

const KART = "rounded-card border border-line bg-card";
const CUBUK_ALANI = 130; // grafik yüksekliği (176px) − üst sayı ve alt ay etiketleri
const para = (s: { paraBirimi: string; tutar: number }) => (s.paraBirimi === "TRY" ? tl(s.tutar) : `€${s.tutar.toLocaleString("tr-TR")}`);

const YAPILACAK_ETIKET: Record<Yapilacak["tur"], { ad: string; renk: string }> = {
  lisans: { ad: "Lisans", renk: "bg-[#EEF2FF] text-[#3346C9]" },
  rma: { ad: "RMA", renk: "bg-[#FFF1E6] text-[#B25A12]" },
  lead: { ad: "Lead", renk: "bg-[#EAF7EF] text-[#1F7A45]" },
  stok: { ad: "Stok", renk: "bg-[#F1F2EC] text-[#474A42]" },
};
const OLAY_RENK: Record<Olay["tur"], string> = { sevkiyat: "bg-info", satis: "bg-[#1F8A4C]", lisans: "bg-[#7A5AF8]", iade: "bg-[#D93F3F]", degisim: "bg-muted", rma: "bg-[#E58A2B]", siparis: "bg-ink" };

export default async function PortalOzetPage() {
  const [o, satisVeri] = await Promise.all([portalOzeti(), satisFormVerisi()]);
  const { v, lisans, stok, tempo } = o;
  const b = v.bayi;
  const yuzde = b.moqHedef ? Math.min(100, Math.round((b.moqGerceklesen / b.moqHedef) * 100)) : 0;
  const acik = v.siparisler.filter(acikSiparis);
  const maks = Math.max(o.aylikHedef, ...o.aylar.map((a) => a.adet), 1);

  return (
    <>
      <header className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-extrabold leading-tight">Merhaba, {v.basvuru?.yetkili ?? b.ad}</h1>
          <p className="text-sm text-muted">{b.ad} · {b.bolge} · {tarihTr(o.bugun)}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <SatisBildirDugmesi veri={satisVeri} ikincil />
          <Link href="/portal/siparis" className="flex min-h-11 items-center rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-[#23251F]">Yeni sipariş ver</Link>
        </div>
      </header>

      {/* Göstergeler */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${KART} flex flex-col gap-2 p-4`}>
          <span className="text-xs font-semibold text-muted">Bu çeyrek hedef (MOQ)</span>
          <b className="text-2xl tabular-nums">{b.moqGerceklesen} / {b.moqHedef} cihaz</b>
          <span className="h-2.5 rounded-full bg-bg"><span className={`block h-2.5 rounded-full ${yuzde >= 80 ? "bg-[#1F8A4C]" : yuzde >= 50 ? "bg-[#E58A2B]" : "bg-[#D93F3F]"}`} style={{ width: `${yuzde}%` }} /></span>
          <span className="text-xs text-muted">
            {tempo.kalanCihaz ? <>%{yuzde} · hedefe <b className="text-ink">{tempo.kalanCihaz}</b> cihaz, haftada ~{tempo.haftalik} satış ({tempo.kalanHafta} hafta kaldı)</> : <>Hedef tamamlandı 🎉</>}
          </span>
        </div>
        <div className={`${KART} flex flex-col gap-1 p-4`}>
          <span className="text-xs font-semibold text-muted">Lisans yenileme · 90 gün</span>
          <b className="text-2xl tabular-nums">{new Intl.NumberFormat("tr-TR", { style: "currency", currency: lisans.paraBirimi, maximumFractionDigits: 0 }).format(lisans.yenilemeTutari)}</b>
          <span className="text-xs text-muted">{lisans.doksanGun} lisans yenilenecek · liste fiyatı</span>
          {lisans.yenilemeOrani !== null && <span className="mt-auto text-xs font-semibold">Yenileme oranınız <b className={lisans.yenilemeOrani >= 85 ? "text-[#1F8A4C]" : "text-[#B25A12]"}>%{lisans.yenilemeOrani}</b></span>}
        </div>
        <Link href="/portal/cihazlar" className={`${KART} flex flex-col gap-1 p-4 hover:border-ink`}>
          <span className="text-xs font-semibold text-muted">Stoktaki cihaz</span>
          <b className="text-2xl tabular-nums">{stok.toplam || b.stok}</b>
          <span className="text-xs text-muted">{Object.entries(stok.modelStok).map(([m, n]) => `${n}× ${m}`).join(" · ") || "Seri kaydı yok"}</span>
          {stok.enEski > 0 && <span className={`mt-auto text-xs font-semibold ${stok.enEski >= 60 ? "text-[#B25A12]" : ""}`}>En eski stok {stok.enEski} gündür bekliyor</span>}
        </Link>
        <div className={`${KART} flex flex-col gap-1 p-4`}>
          <span className="text-xs font-semibold text-muted">Bu çeyrek satış</span>
          <b className="text-2xl tabular-nums">{b.satilan} cihaz</b>
          <Link href="/portal/leadler" className="mt-auto text-xs font-semibold text-info hover:underline">{o.acikLead} açık lead →</Link>
        </div>
      </div>

      {/* Yapılacaklar + satış grafiği */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section aria-label="Yapılacaklar" className={`${KART} flex flex-col gap-3 p-5`}>
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-extrabold">Yapılacaklar</h2>
            {o.yapilacaklar.length > 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white tabular-nums">{o.yapilacaklar.length}</span>}
          </div>
          {o.yapilacaklar.length ? (
            <ul className="flex flex-col divide-y divide-bg">
              {o.yapilacaklar.slice(0, 7).map((y, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${YAPILACAK_ETIKET[y.tur].renk}`}>{YAPILACAK_ETIKET[y.tur].ad}</span>
                  <Link href={y.href} className="flex min-w-0 flex-1 flex-col hover:underline">
                    <span className="font-semibold">{y.acil && <span className="mr-1 text-[#D93F3F]" aria-label="Acil">●</span>}{y.baslik}</span>
                    <span className="text-xs text-muted">{y.detay}</span>
                  </Link>
                  {y.seriNo && <YenilemeButonu seriNo={y.seriNo} gonderildi={!!y.talepVar} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Bekleyen işiniz yok 👌</p>
          )}
          {o.yapilacaklar.length > 7 && <p className="text-xs text-muted">+{o.yapilacaklar.length - 7} iş daha</p>}
        </section>

        <section aria-label="Aylık satış" className={`${KART} flex flex-col gap-3 p-5`}>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[17px] font-extrabold">Aylık satış</h2>
            <span className="text-xs text-muted">son 6 ay · cihaz</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted"><span className="inline-block w-4 border-t-2 border-dashed border-[#D93F3F]" />aylık hedef {o.aylikHedef}</span>
          </div>
          <div className="relative mt-2 h-44">
            <div className="absolute inset-x-0 border-t-2 border-dashed border-[#D93F3F]/70" style={{ bottom: 22 + Math.round((o.aylikHedef / maks) * CUBUK_ALANI) }} aria-hidden="true" />
            <ol className="absolute inset-0 grid grid-cols-6 items-end gap-2">
              {o.aylar.map((a) => (
                <li key={a.anahtar} className="flex h-full flex-col items-center justify-end gap-1" title={`${a.ad}: ${a.adet} cihaz`}>
                  <span className="text-xs font-bold tabular-nums">{a.adet}</span>
                  <span className={`w-full max-w-10 rounded-t-md ${a.buAy ? "bg-lime" : a.adet >= o.aylikHedef ? "bg-ink" : "bg-[#C9CCC2]"}`} style={{ height: a.adet ? Math.max(4, Math.round((a.adet / maks) * CUBUK_ALANI)) : 0 }} />
                  <span className={`h-[18px] text-xs ${a.buAy ? "font-bold" : "text-muted"}`}>{a.ad}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-muted">Bu ay sarı. Aylık hedef, çeyreklik MOQ&apos;nun üçte biri.</p>
        </section>
      </div>

      {/* Siparişler + son hareketler | duyurular + temsilci */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Açık siparişler" className={`${KART} flex flex-col gap-3 p-5`}>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-extrabold">Açık siparişler</h2>
              <Link href="/portal/siparis" className="ml-auto text-[13px] font-bold text-info hover:underline">Yeni sipariş →</Link>
            </div>
            {acik.length ? (
              <ul className="flex flex-col divide-y divide-bg">
                {acik.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                    <b>#{s.id}</b>
                    <span className="text-muted">{tarihTr(s.tarih)}</span>
                    <span>{s.kalemler.map((k) => (k.tur === "cihaz" ? `${k.adet}× ${k.model}` : k.tur === "lisans" ? `${k.adet}× ${k.paket}` : `${k.adet}× ${k.stokKodu}`)).join(" · ")}</span>
                    <span className="font-bold tabular-nums">{para(s)}</span>
                    <span className="ml-auto"><Chip ton={DURUM_TONU[s.durum]}>{DURUM_ADI[s.durum]}</Chip></span>
                    {s.kargo && <span className="w-full text-xs text-muted">🚚 Yolda · {s.kargo.firma} · takip {s.kargo.takipNo}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Açık siparişiniz yok.</p>
            )}
          </section>

          <section aria-label="Son hareketler" className={`${KART} flex flex-col gap-3 p-5`}>
            <h2 className="text-[17px] font-extrabold">Son hareketler</h2>
            {o.olaylar.length ? (
              <ol className="flex flex-col">
                {o.olaylar.map((e, i) => (
                  <li key={i} className="relative flex gap-3 pb-3 text-sm last:pb-0">
                    <span className="flex flex-col items-center">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${OLAY_RENK[e.tur]}`} />
                      {i < o.olaylar.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span>{e.metin}</span>
                      <span className="text-xs text-muted">{tarihTr(e.tarih)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Henüz hareket yok.</p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Embedra'dan duyurular" className={`${KART} flex flex-col gap-3 p-5`}>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-extrabold">Embedra&apos;dan</h2>
              <Link href="/portal/dokumanlar" className="ml-auto text-[13px] font-bold text-info hover:underline">Tüm dokümanlar →</Link>
            </div>
            {o.duyurular.length ? (
              <ul className="flex flex-col gap-2.5">
                {o.duyurular.map((d) => (
                  <li key={d.id}>
                    <Link href="/portal/dokumanlar" className="flex flex-col gap-0.5 rounded-xl border border-line p-3 hover:border-ink">
                      <span className="text-xs font-bold text-muted">{d.kanal} · {tarihTr(d.tarih)}</span>
                      <b className="text-sm">{d.baslik}</b>
                      {d.aciklama && <span className="line-clamp-2 text-[13px] text-[#474A42]">{d.aciklama}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Yeni duyuru yok. Embedra paylaştığında burada görünür.</p>
            )}
          </section>

          {o.temsilci && (
            <section aria-label="Temsilciniz" className="flex flex-col gap-3 rounded-card bg-ink p-5 text-white">
              <span className="text-[11px] font-bold tracking-[0.08em] text-[#8D9187]">EMBEDRA TEMSİLCİNİZ</span>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-sm font-extrabold text-ink">
                  {o.temsilci.ad.split(" ").map((s) => s[0]).join("")}
                </div>
                <div className="flex min-w-0 flex-col">
                  <b>{o.temsilci.ad}</b>
                  <span className="text-xs text-[#C3C6BC]">{o.temsilci.rol}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {o.temsilci.telefon && <a href={`https://wa.me/${o.temsilci.telefon.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex min-h-10 items-center rounded-control bg-lime px-3 text-sm font-bold text-ink hover:brightness-95">WhatsApp</a>}
                {o.temsilci.telefon && <a href={`tel:${o.temsilci.telefon.replace(/\s/g, "")}`} className="flex min-h-10 items-center rounded-control border border-[#3A3D35] px-3 text-sm font-bold hover:bg-[#23251F]">{o.temsilci.telefon}</a>}
                <a href={`mailto:${o.temsilci.eposta}`} className="flex min-h-10 items-center rounded-control border border-[#3A3D35] px-3 text-sm font-bold hover:bg-[#23251F]">E-posta</a>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
