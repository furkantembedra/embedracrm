import { tl } from "@/lib/format";
import { CIHAZ_MODELLERI } from "@/lib/urunler";
import { cihazTamAdi } from "@/components/teklifler/ortak";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getIcerikler } from "@/components/pazarlama/queries";
import { bayiVerisi, tarihTr } from "@/components/portal/veri";

export default async function PortalDokumanlarPage() {
  const [v, fiyat, icerikler] = await Promise.all([bayiVerisi(), getFiyatListesi(), getIcerikler()]);
  const s = v.basvuru?.sozlesme;
  const indirim = s?.moq.indirim ?? 0;
  const paylasilan = icerikler.filter((i) => i.bayiPaylas).sort((a, b) => b.tarih.localeCompare(a.tarih));
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Dokümanlar</h1>
        <p className="text-sm text-muted">Sözleşme özeti, güncel bayi fiyat listesi ve Embedra&apos;nın sizinle paylaştığı pazarlama içerikleri.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Sözleşme" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
          <h2 className="text-[17px] font-extrabold">Bayilik sözleşmesi</h2>
          {s ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Bölge</dt><dd className="font-semibold">{s.bolge.kapsam}{s.bolge.munhasir ? " · münhasır" : ""}</dd>
              <dt className="text-muted">Yıllık hedef</dt><dd className="font-semibold">{s.moq.yillik ?? "—"} cihaz</dd>
              <dt className="text-muted">Çeyreklik MOQ</dt><dd className="font-semibold">{v.bayi.moqHedef} cihaz</dd>
              <dt className="text-muted">Bayi iskontosu</dt><dd className="font-semibold">%{indirim}</dd>
              <dt className="text-muted">Bayinin destek kapsamı</dt><dd className="font-semibold">{s.destek.bayi.length ? s.destek.bayi.join(", ") : "—"}</dd>
            </dl>
          ) : <p className="text-sm text-muted">Sözleşme bilgisi bulunamadı.</p>}
        </section>
        <section aria-label="Fiyat listesi" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
          <h2 className="text-[17px] font-extrabold">Bayi fiyat listesi</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2">Ürün</th><th className="py-2 text-right">Liste</th><th className="py-2 text-right">Bayi (%{indirim})</th></tr></thead>
            <tbody>
              {CIHAZ_MODELLERI.map((m) => (
                <tr key={m} className="border-b border-bg"><td className="py-2">{cihazTamAdi(m)}</td><td className="py-2 text-right tabular-nums">{tl(fiyat.cihaz[m])}</td><td className="py-2 text-right font-bold tabular-nums">{tl(Math.round(fiyat.cihaz[m] * (1 - indirim / 100)))}</td></tr>
              ))}
              {Object.entries(fiyat.lisans).map(([p, l]) => (
                <tr key={p} className="border-b border-bg last:border-0"><td className="py-2">ONESuite {p} · 12 ay</td><td className="py-2 text-right tabular-nums">{l.fiyat ? tl(l.fiyat) : "Özel"}</td><td className="py-2 text-right font-bold tabular-nums">{l.fiyat ? tl(Math.round(l.fiyat * (1 - indirim / 100))) : "Özel"}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted">KDV hariç. Cihazlara KDV eklenir, lisanslar KDV&apos;siz.</p>
        </section>
      </div>
      <section aria-label="Pazarlama içerikleri" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
        <h2 className="text-[17px] font-extrabold">Pazarlama içerikleri</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {paylasilan.map((i) => (
            <li key={i.id} className="flex flex-col gap-1.5 rounded-xl border border-line p-3">
              <span className="text-xs font-bold text-muted">{i.kanal} · {tarihTr(i.tarih)}</span>
              <b className="text-sm">{i.baslik}</b>
              {i.aciklama && <p className="line-clamp-3 whitespace-pre-line text-[13px] text-[#474A42]">{i.aciklama}</p>}
              {i.medya.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {i.medya.map((m) => <a key={m.id} href={`/api/medya/${m.id}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-info hover:underline">{m.ad} ↓</a>)}
                </div>
              )}
            </li>
          ))}
          {!paylasilan.length && <li className="text-sm text-muted">Henüz paylaşılan içerik yok.</li>}
        </ul>
      </section>
    </>
  );
}
