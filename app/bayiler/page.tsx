import BayiGorunumu from "@/components/bayiler/bayi-gorunumu";
import { getAktifBayiler, getBasvurular, getBayiHareketleri } from "@/components/bayiler/queries";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function BayilerPage() {
  const [basvurular, bayiler, musteriler, hareketler, cihazlar] = await Promise.all([
    getBasvurular(),
    getAktifBayiler(),
    getMusteriler(),
    getBayiHareketleri(),
    getCihazlar(),
  ]);
  return (
    <BayiGorunumu
      basvurular={basvurular}
      bayiler={bayiler}
      musteriler={musteriler}
      hareketler={hareketler}
      bayiCihazlari={cihazlar.filter((c) => c.bayiId)}
    />
  );
}
