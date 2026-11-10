import PageHeader from "@/components/layout/page-header";
import TalepFormu from "@/components/destek/talep-formu";
import { sonrakiTalepNo } from "@/components/destek/queries";
import { getMusteriler } from "@/components/musteriler/queries";

export default async function YeniTalepPage() {
  const [musteriler, sonrakiNo] = await Promise.all([getMusteriler(), sonrakiTalepNo()]);
  return (
    <>
      <PageHeader title="Yeni destek talebi" />
      <TalepFormu
        sonrakiNo={sonrakiNo}
        musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, cihazlar: m.cihazlar.map((c) => ({ seriNo: c.seriNo, firmware: c.firmware })) }))}
      />
    </>
  );
}
