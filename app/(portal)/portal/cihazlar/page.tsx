import { cihazlarimVerisi } from "@/components/portal/cihazlar";
import CihazlarimGorunumu from "@/components/portal/cihazlarim-gorunumu";
import SatisBildirDugmesi from "@/components/portal/satis-bildir";
import { satisFormVerisi } from "@/components/portal/satis-ortak";

export default async function PortalCihazlarPage() {
  const [v, satisVeri] = await Promise.all([cihazlarimVerisi(), satisFormVerisi()]);
  return (
    <>
      <header className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1 className="text-[28px] font-extrabold">Cihazlarım</h1>
          <p className="text-sm text-muted">Stoğunuzdaki ve müşterilerinize sattığınız cihazlar. Sattığınız cihazı &quot;Satıldı&quot; olarak bildirin; lisans ve garanti müşteri adına başlar.</p>
        </div>
        <SatisBildirDugmesi veri={satisVeri} />
      </header>
      <CihazlarimGorunumu seriBilinmeyen={satisVeri.seriBilinmeyen.ONE + satisVeri.seriBilinmeyen["ONE Lite"]} havuz={satisVeri.havuz} musteriSecenekleri={satisVeri.musteriler} bugun={v.bugun} stok={v.stok} cihazlar={v.cihazlar} ozet={v.ozet} guncelFirmware={v.guncelFirmware} />
    </>
  );
}
