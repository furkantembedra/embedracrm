import { havuzOzeti } from "@/components/bayiler/lisans-havuzu";
import { bayiTeklifAyarlari } from "@/components/portal/lead-fiyat";
import { getBayiLeadleri } from "@/components/portal/lead-queries";
import LeadlerGorunumu from "@/components/portal/leadler-gorunumu";
import { bayiVerisi, gunler } from "@/components/portal/veri";

export default async function PortalLeadlerPage() {
  const v = await bayiVerisi();
  const [leadler, ayar] = await Promise.all([getBayiLeadleri(v.bayi.id), bayiTeklifAyarlari(v.bayi.ulkeKodu)]);
  return (
    <LeadlerGorunumu
      bugun={gunler().bugun} leadler={leadler} stok={v.stokSeriler.map((s) => ({ seriNo: s.seriNo, model: s.model }))}
      paraBirimi={ayar.paraBirimi} oneriFiyat={ayar.oneriFiyat} varsayilanKdv={ayar.varsayilanKdv} havuz={await havuzOzeti(v.bayi.id)}
    />
  );
}
