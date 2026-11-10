import SatisHattiGorunumu from "@/components/satis-hatti/satis-hatti-gorunumu";
import { getFirsatlar } from "@/components/satis-hatti/queries";
import { getMusteriler } from "@/components/musteriler/queries";
import { getKampanyalar } from "@/components/pazarlama/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getAktifBayiler } from "@/components/bayiler/queries";

export default async function SatisHattiPage() {
  const [firsatlar, musteriler, kampanyalar, fiyatListesi, bayiler] = await Promise.all([getFirsatlar(), getMusteriler(), getKampanyalar(), getFiyatListesi(), getAktifBayiler()]);
  return (
    <SatisHattiGorunumu
      firsatlar={firsatlar}
      musteriler={musteriler}
      kampanyalar={kampanyalar.map((k) => ({ id: k.id, ad: k.ad, durum: k.durum }))}
      fiyatListesi={fiyatListesi}
      bayiler={bayiler.map((b) => ({ id: b.id, ad: b.ad }))}
    />
  );
}
