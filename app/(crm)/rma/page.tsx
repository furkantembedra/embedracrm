import { Suspense } from "react";
import RmaGorunumu from "@/components/rma/rma-gorunumu";
import { getGarantiAy, getRmalar } from "@/components/rma/queries";
import { getBilesenler, getHavuz, getKargoFirmalari } from "@/components/operasyon/queries";
import { getTalepler } from "@/components/destek/queries";

export default async function RmaPage() {
  const [rmalar, garantiAy, bilesenler, havuz, talepler, kargoFirmalari] = await Promise.all([getRmalar(), getGarantiAy(), getBilesenler(), getHavuz(), getTalepler(), getKargoFirmalari()]);
  // ?kayit=RMA-0006 (hatırlatmalardan gelinir) useSearchParams ile okunur; o yüzden Suspense içinde
  return (
    <Suspense>
      <RmaGorunumu
        rmalar={rmalar}
        garantiAy={garantiAy}
        kargoFirmalari={kargoFirmalari}
        bilesenler={bilesenler.map(({ kod, ad, adet }) => ({ kod, ad, adet }))}
        havuz={havuz.map(({ seriNo, model }) => ({ seriNo, model }))}
        talepler={talepler.map((t) => ({ id: t.id, baslik: t.baslik, seriNo: t.seriNo, musteri: t.musteri }))}
      />
    </Suspense>
  );
}
