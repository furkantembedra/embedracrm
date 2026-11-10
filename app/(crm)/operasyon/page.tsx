import OperasyonGorunumu from "@/components/operasyon/operasyon-gorunumu";
import { getBilesenler, getEkip, getIcUretim, getFiyatListesi, getHavuz, getKargoFirmalari, getPartiler, getRecete, getTedarik } from "@/components/operasyon/queries";
import { Suspense } from "react";
import { CIHAZ_STOK_KODU, getSiparisler, getStok } from "@/components/siparisler/queries";
import { getFirsatlar } from "@/components/satis-hatti/queries";
import { CIHAZ_MODELLERI } from "@/lib/urunler";

export default async function OperasyonPage() {
  const [partiler, bilesenler, tedarik, havuz, recete, icUretim, fiyat, kargoFirmalari, ekip, stok, siparisler, firsatlar] = await Promise.all([
    getPartiler(), getBilesenler(), getTedarik(), getHavuz(), getRecete(), getIcUretim(), getFiyatListesi(), getKargoFirmalari(), getEkip(), getStok(), getSiparisler(), getFirsatlar(),
  ]);
  const cihazStogu = Object.fromEntries(CIHAZ_MODELLERI.map((m) => [m, stok.find((k) => k.kod === CIHAZ_STOK_KODU[m])?.adet ?? 0])) as Record<(typeof CIHAZ_MODELLERI)[number], number>;
  // ?sekme=ihtiyac adresi (hatırlatmalardan gelinir) useSearchParams ile okunur; o yüzden Suspense içinde
  return (
    <Suspense>
    <OperasyonGorunumu
      siparisler={siparisler}
      firsatlar={firsatlar}
      cihazStogu={cihazStogu}
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
    </Suspense>
  );
}
