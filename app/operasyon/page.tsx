import OperasyonGorunumu from "@/components/operasyon/operasyon-gorunumu";
import { getBilesenler, getEkip, getIcUretim, getFiyatListesi, getHavuz, getKargoFirmalari, getPartiler, getRecete, getTedarik } from "@/components/operasyon/queries";
import { getStok } from "@/components/siparisler/queries";

export default async function OperasyonPage() {
  const [partiler, bilesenler, tedarik, havuz, recete, icUretim, fiyat, kargoFirmalari, ekip, stok] = await Promise.all([
    getPartiler(), getBilesenler(), getTedarik(), getHavuz(), getRecete(), getIcUretim(), getFiyatListesi(), getKargoFirmalari(), getEkip(), getStok(),
  ]);
  return (
    <OperasyonGorunumu
      partiler={partiler}
      bilesenler={bilesenler}
      tedarik={tedarik}
      havuz={havuz}
      recete={recete}
      icUretim={icUretim}
      fiyat={fiyat}
      aksesuarlar={stok.filter((k) => k.fiyat !== null).map((k) => ({ kod: k.kod, ad: k.ad, fiyat: k.fiyat! }))}
      kablolar={stok.filter((k) => !k.kod.endsWith("-HW")).map((k) => ({ kod: k.kod, ad: k.ad }))}
      kargoFirmalari={kargoFirmalari}
      ekip={ekip}
    />
  );
}
