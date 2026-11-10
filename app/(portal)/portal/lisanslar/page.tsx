import Chip from "@/components/ui/chip";
import { getYenilemeTalepleri } from "@/components/portal/queries";
import YenilemeButonu from "@/components/portal/yenileme-butonu";
import { bayiVerisi, gunler, tarihTr } from "@/components/portal/veri";

export default async function PortalLisanslarPage() {
  const v = await bayiVerisi();
  const talepler = await getYenilemeTalepleri(v.bayi.id);
  const { bugun, ileri: sinir } = gunler(60);
  const liste = v.cihazlar
    .filter((c) => c.musteriId && c.lisansBitis && c.lisansBitis <= sinir)
    .sort((a, b) => a.lisansBitis!.localeCompare(b.lisansBitis!));
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Lisanslar</h1>
        <p className="text-sm text-muted">Müşterilerinizde süresi 60 gün içinde dolan ya da dolmuş lisanslar. Yenileme talebi Embedra satış ekibine iletilir.</p>
      </header>
      <section className="rounded-card border border-line bg-card p-5">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs font-bold text-muted"><th className="py-2 pr-3">Cihaz</th><th className="py-2 pr-3">Müşteri</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Bitiş</th><th className="py-2 text-right">İşlem</th></tr></thead>
            <tbody>
              {liste.map((c) => {
                const doldu = c.lisansBitis! < bugun;
                return (
                  <tr key={c.seriNo} className="border-b border-bg last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-xs">{c.seriNo}</td>
                    <td className="py-2.5 pr-3">{c.musteri}</td>
                    <td className="py-2.5 pr-3">{c.plan}</td>
                    <td className="py-2.5 pr-3">{tarihTr(c.lisansBitis!)} {doldu && <Chip ton="err">Doldu</Chip>}</td>
                    <td className="py-2.5 text-right"><YenilemeButonu seriNo={c.seriNo} gonderildi={talepler.some((t) => t.seriNo === c.seriNo)} /></td>
                  </tr>
                );
              })}
              {!liste.length && <tr><td colSpan={5} className="py-8 text-center text-muted">Yakında süresi dolacak lisans yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
