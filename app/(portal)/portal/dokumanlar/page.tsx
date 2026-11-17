import { dokumanlarVerisi } from "@/components/portal/dokumanlar";
import DokumanlarGorunumu from "@/components/portal/dokumanlar-gorunumu";

export default async function PortalDokumanlarPage() {
  const v = await dokumanlarVerisi();
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Dokümanlar</h1>
        <p className="text-sm text-muted">Duyurular, sözleşmeniz, güncel fiyat listesi, ürün ve teknik dokümanlar, eğitimler ve marka kiti.</p>
      </header>
      <DokumanlarGorunumu {...v} />
    </>
  );
}
