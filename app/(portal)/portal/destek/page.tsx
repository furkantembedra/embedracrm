import { destekVerisi } from "@/components/portal/destek";
import DestekGorunumu from "@/components/portal/destek-gorunumu";

export default async function PortalDestekPage() {
  const v = await destekVerisi();
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Destek</h1>
        <p className="text-sm text-muted">Embedra destek ekibine soru ve sorunlarınızı iletin; yanıtları ve talebin durumunu buradan takip edin.</p>
      </header>
      <DestekGorunumu v={v} />
    </>
  );
}
