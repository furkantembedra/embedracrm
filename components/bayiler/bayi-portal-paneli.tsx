"use client";

// CRM › Bayi detayı › Portal: bayi portalının ayarları ve portaldan gelen açık işler (tek bakışta).
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Chip from "@/components/ui/chip";
import { bayiDuzeltmeCoz, bayiPortalAyariKaydet, bayiPortalPaneli, bayiYenilemeTalebiKapat, type PortalPaneli } from "./portal-panel-actions";

const GIRDI = "min-h-10 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink";
const BASLIK = "text-[11px] font-bold tracking-[0.08em] text-muted";
const tarihTr = (t: string | null) => (t ? new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const para = (n: number, pb: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: pb, maximumFractionDigits: 0 }).format(n);

export default function BayiPortalPaneli({ bayiId }: { bayiId: string }) {
  const [v, setV] = useState<PortalPaneli | null>(null);
  const [bekliyor, baslat] = useTransition();
  const [mesaj, setMesaj] = useState<{ hata?: string; tamam?: string }>({});
  const [ayar, setAyar] = useState<PortalPaneli["ayar"] | null>(null);
  const [cozum, setCozum] = useState<Record<string, string>>({});
  const [yetkisiz, setYetkisiz] = useState(false);
  // Yalnızca Yönetici / Satış: diğer roller için sunucu reddeder
  const yukle = useCallback(() => bayiPortalPaneli(bayiId).then((d) => { if (d) { setV(d); setAyar(d.ayar); } }, () => setYetkisiz(true)), [bayiId]);
  useEffect(() => { yukle(); }, [yukle]);

  if (yetkisiz) return <p className="text-xs text-muted">Bayi portalı paneli yalnızca Yönetici ve Satış rollerine açık.</p>;
  if (!v || !ayar) return <p className="text-xs text-muted">Portal bilgileri yükleniyor…</p>;
  const acikDuzeltme = v.duzeltme.filter((d) => d.durum === "acik");
  const havuzToplam = v.havuz.reduce((t, k) => t + k.adet, 0);

  return (
    <section aria-label="Bayi portalı" className="flex flex-col gap-4 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-extrabold">Bayi portalı</h3>
        {v.siparisler.length > 0 && <Chip ton="info">{v.siparisler.length} açık sipariş</Chip>}
        {v.yenileme.length > 0 && <Chip ton="warn">{v.yenileme.length} yenileme talebi</Chip>}
        {acikDuzeltme.length > 0 && <Chip ton="err">{acikDuzeltme.length} düzeltme talebi</Chip>}
        {v.rmalar.length > 0 && <Chip ton="gray">{v.rmalar.length} açık RMA</Chip>}
        {v.destek.length > 0 && <Chip ton="info">{v.destek.length} destek talebi</Chip>}
      </div>

      {/* Ayarlar */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-bold">Embedra temsilcisi
          <select value={ayar.temsilciId ?? ""} onChange={(e) => setAyar({ ...ayar, temsilciId: e.target.value || null })} className={GIRDI}>
            <option value="">Seçilmedi (Satış ekibi)</option>
            {v.ekip.map((k) => <option key={k.id} value={k.id}>{k.ad} · {k.rol}</option>)}
          </select>
          <span className="font-normal text-muted">Portalda görünür; bayinin talepleri bu kişiye hatırlatma olarak düşer</span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Kayıtlı teslimat adresi
          <input value={ayar.adres} onChange={(e) => setAyar({ ...ayar, adres: e.target.value })} maxLength={200} placeholder="Firma, sokak, şehir, ülke" className={GIRDI} />
          <span className="font-normal text-muted">Portal siparişlerinde varsayılan adres</span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Sözleşme başlangıcı
          <input type="date" value={ayar.sozlesmeBaslangic ?? ""} onChange={(e) => setAyar({ ...ayar, sozlesmeBaslangic: e.target.value || null })} className={GIRDI} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Sözleşme süresi (ay)
          <input type="number" min={1} max={120} value={ayar.sozlesmeSureAy ?? ""} onChange={(e) => setAyar({ ...ayar, sozlesmeSureAy: e.target.value ? Number(e.target.value) : null })} className={GIRDI} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mesaj.hata && <span role="alert" className="text-xs font-semibold text-err">{mesaj.hata}</span>}
        {mesaj.tamam && <span role="status" className="text-xs font-semibold text-[#3A4D00]">{mesaj.tamam}</span>}
        <button type="button" disabled={bekliyor} onClick={() => baslat(async () => { setMesaj(await bayiPortalAyariKaydet(bayiId, ayar)); await yukle(); })}
          className="ml-auto min-h-10 cursor-pointer rounded-control bg-ink px-4 text-[13px] font-bold text-white hover:bg-ink-soft disabled:opacity-60">Portal ayarlarını kaydet</button>
      </div>

      {/* Açık siparişler */}
      {v.siparisler.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={BASLIK}>AÇIK PORTAL SİPARİŞLERİ</span>
          <ul className="flex flex-col divide-y divide-bg text-[13px]">
            {v.siparisler.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <Link href={`/siparisler/${s.id}`} className="font-bold hover:underline">#{s.id}</Link>
                <span className="text-muted">{tarihTr(s.tarih)}</span>
                <span className="min-w-0 flex-1">{s.ozet}</span>
                <span className="font-semibold tabular-nums">{para(s.tutar, s.paraBirimi)}</span>
                <Chip ton="gray">{s.durum}</Chip>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Yenileme talepleri */}
      {v.yenileme.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={BASLIK}>LİSANS YENİLEME TALEPLERİ</span>
          <ul className="flex flex-col divide-y divide-bg text-[13px]">
            {v.yenileme.map((y) => (
              <li key={y.seriNo} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <Link href={`/cihaz-lisans/${y.seriNo}`} className="font-mono text-xs font-bold hover:underline">{y.seriNo}</Link>
                <span>{y.musteri}</span>
                <span className="text-muted">{y.plan} · bitiş {tarihTr(y.bitis)}</span>
                <span className="ml-auto flex items-center gap-2">
                  {y.siparisli ? <Chip ton="info">Siparişi var</Chip> : <Chip ton="warn">Sipariş yok</Chip>}
                  <button type="button" disabled={bekliyor} onClick={() => baslat(async () => { await bayiYenilemeTalebiKapat(y.seriNo); await yukle(); })} className="cursor-pointer text-xs font-bold text-info hover:underline">Kapat</button>
                </span>
              </li>
            ))}
          </ul>
          <span className="text-xs text-muted">Lisans cihaza işlendiğinde talep kendiliğinden kapanır.</span>
        </div>
      )}

      {/* Düzeltme talepleri */}
      {v.duzeltme.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={BASLIK}>DÜZELTME TALEPLERİ</span>
          <ul className="flex flex-col gap-2 text-[13px]">
            {v.duzeltme.map((d) => (
              <li key={d.id} className={`flex flex-col gap-1.5 rounded-control border p-2.5 ${d.durum === "acik" ? "border-[#F3B5B5]" : "border-line opacity-70"}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/cihaz-lisans/${d.seriNo}`} className="font-mono text-xs font-bold hover:underline">{d.seriNo}</Link>
                  <span className="text-xs text-muted">{tarihTr(d.tarih)}</span>
                  <span className="ml-auto">{d.durum === "acik" ? <Chip ton="err">Açık</Chip> : <Chip ton="ok">Çözüldü</Chip>}</span>
                </span>
                <span>{d.metin}</span>
                {d.durum === "cozuldu" ? <span className="text-xs text-muted">Çözüm: {d.cozum}</span> : (
                  <span className="flex gap-2">
                    <input value={cozum[d.id] ?? ""} onChange={(e) => setCozum({ ...cozum, [d.id]: e.target.value })} placeholder="Ne yapıldı? (bayiye görünür)" aria-label="Çözüm notu" className={`${GIRDI} flex-1`} />
                    <button type="button" disabled={bekliyor} onClick={() => baslat(async () => { const s = await bayiDuzeltmeCoz(d.id, cozum[d.id] ?? ""); setMesaj(s.hata ? { hata: s.hata } : { tamam: "Talep çözüldü olarak kapatıldı." }); await yukle(); })}
                      className="min-h-10 cursor-pointer rounded-control border border-ink px-3 text-xs font-bold hover:bg-[#F4F5F0] disabled:opacity-60">Çözüldü</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Destek talepleri */}
      {v.destek.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={BASLIK}>AÇIK DESTEK TALEPLERİ</span>
          <ul className="flex flex-col divide-y divide-bg text-[13px]">
            {v.destek.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <Link href={`/destek/${t.id}`} className="font-bold hover:underline">#{t.id}</Link>
                <span className="min-w-0 flex-1">{t.baslik}</span>
                <span className="text-muted">{t.oncelik}</span>
                <Chip ton="gray">{t.durum}</Chip>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Açık RMA + havuz */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={BASLIK}>AÇIK RMA</span>
          {v.rmalar.length ? (
            <ul className="flex flex-col gap-1 text-[13px]">
              {v.rmalar.map((r) => <li key={r.id}><Link href={`/rma?kayit=${r.id}`} className="font-bold hover:underline">{r.id}</Link> <span className="font-mono text-xs">{r.seriNo}</span> <span className="text-muted">· {r.adim}</span></li>)}
            </ul>
          ) : <span className="text-[13px] text-muted">Açık RMA yok.</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={BASLIK}>LİSANS HAVUZU ({havuzToplam})</span>
          {v.havuz.length ? (
            <ul className="flex flex-col gap-1 text-[13px]">
              {v.havuz.map((k, i) => <li key={i}><b>{k.adet}× {k.paket}</b> <span className="text-muted">· {k.sureAy} ay · #{k.kaynak}</span></li>)}
            </ul>
          ) : <span className="text-[13px] text-muted">Atanmamış lisans yok.</span>}
        </div>
      </div>
    </section>
  );
}
