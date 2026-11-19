import { BosSayfa, RolMesaji, botRolMesaji } from "@/components/bot/sayfa";

// İskelet: bot ayarları P2.4'te gelir.
export default async function BotAyarlarPage() {
  const mesaj = await botRolMesaji();
  if (mesaj) return <RolMesaji baslik="Bot ayarları" mesaj={mesaj} />;
  return (
    <BosSayfa
      baslik="Bot ayarları"
      aciklama="Kişilik, bilgi bankası ve güvenlik sınırları"
      metin="Burada botun kişiliği ve tonu, açılış mesajı, bilgi bankası, itirazlar, örnek konuşmalar, mesai dışı davranışı, tur sınırı, istem sürümleri, Botu dene paneli, acil durdurma ve günlük maliyet sınırı yönetilecek. Değişikliği yalnızca Yönetici yapar; diğer roller salt okunur görür."
      komut="P2.4 Bot › Kanallar ve Ayarlar"
    />
  );
}
