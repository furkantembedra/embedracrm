import OtomasyonGorunumu from "@/components/otomasyon/otomasyon-gorunumu";
import { otomasyonVerisi } from "@/components/otomasyon/actions";

// İlk kurallar ve geçmiş sunucuda hazırlanır; ekran sonra 30 sn'de bir Server Action ile yeniler
export default async function OtomasyonPage() {
  return <OtomasyonGorunumu ilk={await otomasyonVerisi()} />;
}
