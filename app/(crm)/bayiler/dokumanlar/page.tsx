import { getAktifBayiler } from "@/components/bayiler/queries";
import { getDokumanlar, getDuyurular, getTumEgitimler } from "@/components/bayi-dokumanlar/queries";
import DokumanYonetimi from "@/components/bayi-dokumanlar/yonetim";

export default async function BayiDokumanlariPage() {
  const [dokumanlar, duyurular, bayiler, egitim] = await Promise.all([getDokumanlar(), getDuyurular(), getAktifBayiler(), getTumEgitimler()]);
  return (
    <DokumanYonetimi
      dokumanlar={dokumanlar} duyurular={duyurular}
      bayiler={bayiler.map((b) => ({ id: b.id, ad: b.ad }))}
      egitim={Object.fromEntries(egitim)}
    />
  );
}
