import Link from "next/link";
import { bayiFiyatListesi } from "@/components/portal/dokumanlar";
import YazdirButonu from "@/components/portal/yazdir-butonu";
import { gunler, tarihTr } from "@/components/portal/veri";

// Bayinin adıyla yazdırılabilir fiyat listesi (tarayıcıdan "PDF olarak kaydet")
export default async function FiyatListesiPage() {
  const f = await bayiFiyatListesi();
  const para = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: f.paraBirimi, maximumFractionDigits: 0 }).format(n);
  const gruplar = [...new Set(f.satirlar.map((s) => s.grup))];
  return (
    <>
      <div className="flex items-center gap-2 print:hidden">
        <Link href="/portal/dokumanlar" className="text-sm font-bold text-info hover:underline">← Dokümanlar</Link>
        <span className="ml-auto"><YazdirButonu /></span>
      </div>
      <article className="mx-auto flex w-full max-w-[794px] flex-col gap-6 rounded-card border border-line bg-white p-6 text-ink sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-ink text-xl font-extrabold text-lime">e</div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight">embedra</span>
              <span className="text-xs text-muted">Bayi fiyat listesi · {f.v.bayi.ad}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-sm">
            <h1 className="text-2xl font-extrabold">FİYAT LİSTESİ</h1>
            <span className="text-muted">Tarih: {tarihTr(gunler().bugun)}</span>
            <span className="text-muted">Bayi iskontosu: %{f.indirim}</span>
          </div>
        </header>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink text-left text-xs font-bold"><th className="py-2 pr-2">Ürün</th><th className="py-2 pr-2 text-right">Liste</th><th className="py-2 pr-2 text-right">Bayi fiyatı</th><th className="py-2 text-right">Önerilen satış</th></tr></thead>
          {gruplar.map((g) => (
            <tbody key={g}>
              <tr><td colSpan={4} className="pb-1 pt-4 text-[11px] font-bold tracking-[0.08em] text-muted">{g.toLocaleUpperCase("tr")}</td></tr>
              {f.satirlar.filter((s) => s.grup === g).map((s) => (
                <tr key={s.ad} className="border-b border-line">
                  <td className="py-2 pr-2"><b>{s.ad}</b><span className="block text-xs text-muted">{s.aciklama}</span></td>
                  <td className="py-2 pr-2 text-right tabular-nums">{para(s.liste)}</td>
                  <td className="py-2 pr-2 text-right font-extrabold tabular-nums">{para(s.bayi)}</td>
                  <td className="py-2 text-right tabular-nums">{para(s.liste)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <footer className="border-t border-line pt-4 text-xs text-muted">
          Fiyatlar {f.paraBirimi}, KDV hariç{f.yurtDisi ? ` (1 € = ${f.kur} TL; ihracat faturasında KDV uygulanmaz)` : ` (cihaz ve aksesuara %${Math.round(f.kdv * 100)} KDV eklenir; lisanslar KDV'siz)`}.
          Her iki cihaz da ONESuite lisansı olmadan çalışmaz. Fiyatlar önceden haber verilerek değişebilir; güncel liste her zaman bayi portalındadır.
        </footer>
      </article>
    </>
  );
}
