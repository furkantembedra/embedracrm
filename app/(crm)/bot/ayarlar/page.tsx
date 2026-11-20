import PageHeader from "@/components/layout/page-header";
import { crmKullanicisi } from "@/lib/oturum";
import { RolMesaji, botRolMesaji } from "@/components/bot/sayfa";
import { BOT_YONETICI_ROLLERI } from "@/components/bot/erisim";
import BotAyarlari from "@/components/bot/bot-ayarlari";
import { botAyarlariOku, gunlukMaliyet } from "@/components/bot/veri";
import { claudeHazir } from "@/components/bot/claude";
import { ISTEM_SURUMU } from "@/components/bot/istem";
import { BOT_EFFORT, BOT_MODELI } from "@/components/bot/yapilandirma";

// Bot › Ayarlar. P2.1: acil durdurma, günlük maliyet sınırı, tur sınırı. Kişilik, bilgi bankası, sürümler, Botu dene P2.4'te.
export default async function BotAyarlarPage() {
  const [mesaj, k] = await Promise.all([botRolMesaji(), crmKullanicisi()]);
  if (mesaj || !k) return <RolMesaji baslik="Bot ayarları" mesaj={mesaj ?? ""} />;
  const [a, bugun] = await Promise.all([botAyarlariOku(), gunlukMaliyet()]);
  return (
    <>
      <PageHeader title="Bot ayarları" description="Acil durdurma, günlük maliyet ve tur sınırı · kişilik ve bilgi bankası P2.4'te" />
      <BotAyarlari
        a={{
          acilDurdurma: a.acilDurdurma, gunlukMaliyetSiniriUsd: a.gunlukMaliyetSiniriUsd, turSiniri: a.turSiniri, bugunMaliyetUsd: bugun,
          anahtarVar: claudeHazir(), model: BOT_MODELI, effort: BOT_EFFORT, istemSurumu: ISTEM_SURUMU,
        }}
        duzenleyebilir={(BOT_YONETICI_ROLLERI as readonly string[]).includes(k.rol)}
      />
    </>
  );
}
