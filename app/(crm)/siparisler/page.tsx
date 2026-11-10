import SiparisGorunumu from "@/components/siparisler/siparis-gorunumu";
import { getIadeler, getSiparisler, getStok } from "@/components/siparisler/queries";
import { getMusteriler } from "@/components/musteriler/queries";
import { getFiyatListesi, getHavuz, getKargoFirmalari } from "@/components/operasyon/queries";

export default async function SiparislerPage() {
  const [siparisler, stok, iadeler, musteriler, havuz, kargoFirmalari, fiyatListesi] = await Promise.all([
    getSiparisler(), getStok(), getIadeler(), getMusteriler(), getHavuz(), getKargoFirmalari(), getFiyatListesi(),
  ]);
  return <SiparisGorunumu siparisler={siparisler} stok={stok} iadeler={iadeler} musteriler={musteriler} havuz={havuz} kargoFirmalari={kargoFirmalari} fiyatListesi={fiyatListesi} />;
}
