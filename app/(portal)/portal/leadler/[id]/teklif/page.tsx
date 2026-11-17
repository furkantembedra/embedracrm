import { havuzOzeti } from "@/components/bayiler/lisans-havuzu";
import { notFound } from "next/navigation";
import BayiTeklifDetay from "@/components/portal/bayi-teklif-detay";
import { bayiTeklifAyarlari } from "@/components/portal/lead-fiyat";
import { guncelTeklif } from "@/components/portal/lead-ortak";
import { getBayiLead } from "@/components/portal/lead-queries";
import { bayiVerisi, gunler } from "@/components/portal/veri";

// Bayinin teklifi (CRM teklif sayfasıyla aynı düzen). ?v=2 ile eski sürüm açılır.
export default async function LeadTeklifPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const [v, { id }, { v: surum }] = await Promise.all([bayiVerisi(), params, searchParams]);
  const [lead, ayar] = await Promise.all([getBayiLead(v.bayi.id, id), bayiTeklifAyarlari(v.bayi.ulkeKodu)]);
  const teklif = lead ? (surum ? lead.teklifler.find((t) => t.versiyon === Number(surum)) : guncelTeklif(lead)) : null;
  if (!lead || !teklif) notFound();
  return (
    <BayiTeklifDetay
      lead={lead} teklif={teklif}
      bayi={{ ad: v.bayi.ad, bolge: v.bayi.bolge, telefon: v.basvuru?.telefon ?? "", eposta: v.basvuru?.eposta ?? "" }}
      paraBirimi={ayar.paraBirimi} fiyat={ayar.oneriFiyat} varsayilanKdv={ayar.varsayilanKdv}
      stok={v.stokSeriler.map((s) => ({ seriNo: s.seriNo, model: s.model }))} bugun={gunler().bugun} havuz={await havuzOzeti(v.bayi.id)}
    />
  );
}
