import PageHeader from "@/components/layout/page-header";
import { crmKullanicisi } from "@/lib/oturum";
import { RolMesaji, botRolMesaji } from "@/components/bot/sayfa";
import { BOT_YONETICI_ROLLERI } from "@/components/bot/erisim";
import { kanalAyarlari, kanalBilgileri } from "@/components/bot/queries";
import KanalAyarlari from "@/components/bot/kanal-ayarlari";
import { kanalKurulumDurumu } from "@/components/konusma/kanallar/kurulum";

// Bot › Kanallar (P2.4): bağlantı durumu (ortam değişkenleri tanımlı mı, son webhook), bağlı hesap, bot modu ve yeni
// konuşmada bot. Ortam değişkenleri yalnızca sunucuda okunur; istemciye değer değil yalnızca var / yok gider.
export default async function BotKanallarPage() {
  const [mesaj, k] = await Promise.all([botRolMesaji(), crmKullanicisi()]);
  if (mesaj || !k) return <RolMesaji baslik="Kanallar" mesaj={mesaj ?? ""} />;
  const ayarlar = await kanalAyarlari();
  const kanallar = kanalBilgileri().map((b) => {
    const a = ayarlar.find((x) => x.kanal === b.kanal);
    return {
      kanal: b.kanal, ad: b.ad, yeniKonusmadaBot: a?.yeniKonusmadaBot ?? false, botModu: a?.botModu ?? "kapali",
      sonWebhook: a?.sonWebhook ?? null, kurulum: kanalKurulumDurumu(b.kanal),
    };
  });
  return (
    <>
      <PageHeader title="Kanallar" description="WhatsApp, Messenger ve Instagram · bağlantı durumu, kanal bazında bot modu ve yeni konuşmada bot" />
      <KanalAyarlari kanallar={kanallar} duzenleyebilir={(BOT_YONETICI_ROLLERI as readonly string[]).includes(k.rol)} />
    </>
  );
}
