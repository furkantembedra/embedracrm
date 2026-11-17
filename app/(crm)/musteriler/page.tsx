import MusteriGorunumu from "@/components/musteriler/musteri-gorunumu";
import { getMusteriler } from "@/components/musteriler/queries";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getAktifBayiler } from "@/components/bayiler/queries";

export default async function MusterilerPage() {
  const [musteriler, cihazlar, bayiler] = await Promise.all([getMusteriler(), getCihazlar(), getAktifBayiler()]);
  // Bayi üzerinden satış yapılan müşteriler: müşteri id → bayi adı (listede "Bayi" etiketi)
  const bayiKanali: Record<string, string> = {};
  for (const c of cihazlar) {
    if (c.musteriId && c.bayiId) bayiKanali[c.musteriId] ??= bayiler.find((b) => b.id === c.bayiId)?.ad ?? c.bayiId;
  }
  return <MusteriGorunumu musteriler={musteriler} bayiKanali={bayiKanali} />;
}
