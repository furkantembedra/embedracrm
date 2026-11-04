import DestekGorunumu from "@/components/destek/destek-gorunumu";
import { getTalepler, sonrakiTalepNo } from "@/components/destek/queries";
import { getMusteriler } from "@/components/musteriler/queries";
import { getCihazlar } from "@/components/cihaz-lisans/queries";

export default async function DestekPage() {
  const [talepler, musteriler, sonrakiNo, cihazlar] = await Promise.all([getTalepler(), getMusteriler(), sonrakiTalepNo(), getCihazlar()]);
  return (
    <DestekGorunumu
      talepler={talepler}
      sonrakiNo={sonrakiNo}
      musteriler={musteriler}
      cihazlar={cihazlar}
    />
  );
}
