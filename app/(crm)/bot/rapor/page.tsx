import { BosSayfa, RolMesaji, botRolMesaji } from "@/components/bot/sayfa";

// İskelet: bot raporu P5.2'de gelir (gölge mod kabul oranı P2.5).
export default async function BotRaporPage() {
  const mesaj = await botRolMesaji();
  if (mesaj) return <RolMesaji baslik="Bot raporu" mesaj={mesaj} />;
  return (
    <BosSayfa
      baslik="Bot raporu"
      aciklama="Kanal bazında performans ve maliyet"
      metin="Burada kanal bazında konuşma ve dönüşüm sayıları, devretme sebepleri, model maliyeti ve gölge modda taslak kabul oranı görünecek. Veri, bot çalışmaya başladıktan sonra birikir."
      komut="P2.5 Gölge mod, P5.2 Bot raporu"
    />
  );
}
