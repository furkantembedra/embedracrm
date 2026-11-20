import PageHeader from "@/components/layout/page-header";
import { crmKullanicisi } from "@/lib/oturum";
import { RolMesaji, botRolMesaji } from "@/components/bot/sayfa";
import { BOT_YONETICI_ROLLERI } from "@/components/bot/erisim";
import { kanalAyarlari, kanalBilgileri } from "@/components/bot/queries";
import KanalAyarlari from "@/components/bot/kanal-ayarlari";

// Bot › Kanallar. P1.3: kanal başına "yeni konuşmada bot"; P2.1: bot modu. Bağlantı durumu, son webhook P2.4'te.
export default async function BotKanallarPage() {
  const [mesaj, k] = await Promise.all([botRolMesaji(), crmKullanicisi()]);
  if (mesaj || !k) return <RolMesaji baslik="Kanallar" mesaj={mesaj ?? ""} />;
  const ayarlar = await kanalAyarlari();
  const kanallar = kanalBilgileri().map((b) => ({
    kanal: b.kanal, ad: b.ad, bagli: b.bagli, yeniKonusmadaBot: ayarlar.find((a) => a.kanal === b.kanal)?.yeniKonusmadaBot ?? false,
    botModu: ayarlar.find((a) => a.kanal === b.kanal)?.botModu ?? "kapali",
  }));
  return (
    <>
      <PageHeader title="Kanallar" description="WhatsApp, Messenger ve Instagram · kanal bazında bot modu ve yeni konuşmada bot" />
      <KanalAyarlari kanallar={kanallar} duzenleyebilir={(BOT_YONETICI_ROLLERI as readonly string[]).includes(k.rol)} />
    </>
  );
}
