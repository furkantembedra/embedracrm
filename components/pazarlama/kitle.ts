// Hedef listelerin ham verisi: müşteri yetkilileri (izinleriyle), aktif bayiler ve satış hattı fırsatları.
// Sayfa ve toplu gönderim (sunucu) aynı veriyi kullanır. Yalnızca sunucuda import edin.
import { getMusteriler } from "@/components/musteriler/queries";
import { izinliKanallar } from "@/components/musteriler/ortak";
import { getFirsatlar } from "@/components/satis-hatti/queries";
import { getAktifBayiler, getBasvurular } from "@/components/bayiler/queries";
import type { ListeVerisi } from "./ortak";

export async function getListeVerisi(): Promise<ListeVerisi> {
  const [musteriler, firsatlar, bayiler, basvurular] = await Promise.all([getMusteriler(), getFirsatlar(), getAktifBayiler(), getBasvurular()]);
  // Yalnızca iletişim için gereken alanlar (bu veri tarayıcıya da gönderilir)
  return {
    musteriler: musteriler.map((m) => ({
      id: m.id, ad: m.ad, ulke: m.ulke, segment: m.segment, plan: m.plan, lisansBitis: m.lisansBitis,
      yetkililer: m.yetkililer.map((y) => ({ id: y.id, ad: y.ad, telefon: y.telefon, eposta: y.eposta, kanallar: izinliKanallar(y) })),
    })),
    bayiler: bayiler.map((b) => {
      const bs = basvurular.find((x) => x.id === b.id);
      return { id: b.id, ad: b.ad, bolge: b.bolge, yetkili: bs?.yetkili ?? "", telefon: bs?.telefon ?? "", eposta: bs?.eposta ?? "" };
    }),
    firsatlar: firsatlar.map((f) => ({ firma: f.firma, konum: f.konum, asama: f.asama, kayipNedeni: f.kayipNedeni })),
  };
}
