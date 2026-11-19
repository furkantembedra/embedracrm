import { BosSayfa, RolMesaji, botRolMesaji } from "@/components/bot/sayfa";

// İskelet: kanal kartları (bağlantı durumu, son webhook, bot modu) P2.4'te gelir.
export default async function BotKanallarPage() {
  const mesaj = await botRolMesaji();
  if (mesaj) return <RolMesaji baslik="Kanallar" mesaj={mesaj} />;
  return (
    <BosSayfa
      baslik="Kanallar"
      aciklama="WhatsApp, Messenger ve Instagram bağlantıları"
      metin="Burada her kanalın bağlantı durumu (ortam değişkeni ve son webhook zamanı), bağlı numara / sayfa / hesap, bot modu (kapalı / gölge / otomatik) ve yeni konuşmada botun açık olup olmayacağı görünecek. Değişikliği yalnızca Yönetici yapar. Şimdilik kurulum adımları docs/BOT_KURULUM.md'de."
      komut="P2.4 Bot › Kanallar ve Ayarlar"
    />
  );
}
