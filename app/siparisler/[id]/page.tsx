import PageHeader from "@/components/layout/page-header";
import SiparisDetay from "@/components/siparisler/siparis-detay";
import SiparisAdimlari from "@/components/siparisler/siparis-adimlari";

export default async function SiparisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void id; // detay verisini id ile çekin
  return (
    <>
      <PageHeader title="Sipariş" />
      <SiparisDetay />
      <SiparisAdimlari />
    </>
  );
}
