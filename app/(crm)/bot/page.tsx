import PageHeader from "@/components/layout/page-header";
import { crmKullanicisi } from "@/lib/oturum";
import GelenKutusu from "@/components/bot/gelen-kutusu";
import { simulasyonAcik } from "@/components/bot/erisim";
import { gelenKutusu, kanalBilgileri, konusmaDetayi } from "@/components/bot/queries";
import { RolMesaji, botRolMesaji } from "@/components/bot/sayfa";
import { kanalListesi } from "@/components/konusma/kanallar";
import { getEkip } from "@/components/operasyon/queries";

// Bot › Gelen kutusu. ?k=<konuşma kimliği> doğrudan o konuşmayı açar (satış hattı kartındaki "Konuşmayı aç").
export default async function BotGelenKutusuPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const [mesaj, k] = await Promise.all([botRolMesaji(), crmKullanicisi()]);
  if (mesaj || !k) return <RolMesaji baslik="Gelen kutusu" mesaj={mesaj ?? ""} />;
  const { k: secili } = await searchParams;
  const id = secili && /^\d{1,15}$/.test(secili) ? Number(secili) : null;
  const [liste, detay, ekip] = await Promise.all([gelenKutusu(), id ? konusmaDetayi(id) : Promise.resolve(null), getEkip()]);
  return (
    <>
      <PageHeader title="Gelen kutusu" description="WhatsApp, Messenger ve Instagram konuşmaları tek yerde · bot konuşurken de canlı izlenir" />
      <GelenKutusu
        ilkListe={liste}
        ilkDetay={detay}
        kanallar={kanalBilgileri()}
        ekip={ekip.filter((u) => u.aktif).map((u) => ({ id: u.id, ad: u.ad }))}
        ben={k.id}
        simulasyonKanallari={simulasyonAcik(k.rol) ? kanalListesi() : null}
      />
    </>
  );
}
