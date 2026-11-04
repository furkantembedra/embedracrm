import DestekGorunumu from "@/components/destek/destek-gorunumu";
import { getTalepler, sonrakiTalepNo } from "@/components/destek/queries";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function DestekPage() {
  const [talepler, musteriler, sonrakiNo] = await Promise.all([getTalepler(), getMusteriler(), sonrakiTalepNo()]);
  return (
    <DestekGorunumu
      talepler={talepler}
      sonrakiNo={sonrakiNo}
      musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, cihazlar: m.cihazlar.map((c) => ({ seriNo: c.seriNo, firmware: c.firmware })) }))}
    />
  );
}
