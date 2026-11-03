import PageHeader from "@/components/layout/page-header";
import TalepDetay from "@/components/destek/talep-detay";
import NotFormu from "@/components/destek/not-formu";
import MusteriBilgiPaneli from "@/components/destek/musteri-bilgi-paneli";

export default async function TalepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void id; // detay verisini id ile çekin
  return (
    <>
      <PageHeader title="Talep" />
      <TalepDetay />
      <NotFormu />
      <MusteriBilgiPaneli />
    </>
  );
}
