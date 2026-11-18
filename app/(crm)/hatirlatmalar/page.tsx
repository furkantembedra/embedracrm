import HatirlatmaGorunumu from "@/components/hatirlatmalar/hatirlatma-gorunumu";
import { hatirlatmalariGetir } from "@/components/hatirlatmalar/actions";

// İlk liste sunucuda hazırlanır (sayfa geçişinde iskelet gösterilir); sonraki yenilemeler tarayıcıdan Server Action ile
export default async function HatirlatmalarPage() {
  return <HatirlatmaGorunumu ilk={await hatirlatmalariGetir()} />;
}
