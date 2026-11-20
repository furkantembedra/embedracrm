import PageHeader from "@/components/layout/page-header";
import { crmKullanicisi } from "@/lib/oturum";
import { RolMesaji, botRolMesaji } from "@/components/bot/sayfa";
import { BOT_YONETICI_ROLLERI } from "@/components/bot/erisim";
import BotAyarlari from "@/components/bot/bot-ayarlari";
import AcilDurdurma from "@/components/bot/acil-durdurma";
import IstemAyarlari from "@/components/bot/istem-ayarlari";
import { aktifIstemAyari, botAyarlariOku, gunlukMaliyet, surumListesi } from "@/components/bot/veri";
import { claudeHazir } from "@/components/bot/claude";
import { istemSurumuEtiketi } from "@/components/bot/istem";
import { kanalBilgileri } from "@/components/bot/queries";
import { adaptorBul } from "@/components/konusma/kanallar";
import { BOT_EFFORT, BOT_MODELI } from "@/components/bot/yapilandirma";

// Bot › Ayarlar (P2.4): acil durdurma, günlük maliyet ve tur sınırı (anında), botun sabit istemine giren sürümlü
// ayarlar (Kaydet → yeni sürüm, önceki sürüme dönüş) ve "Botu dene" paneli. Düzenleme yalnızca Yönetici.
// P2.4b "Bilgi kaynağı ekle" bölümünü buraya ekler; onaylanan kaynaklar aynı sürümlere girer.
export default async function BotAyarlarPage() {
  const [mesaj, k] = await Promise.all([botRolMesaji(), crmKullanicisi()]);
  if (mesaj || !k) return <RolMesaji baslik="Bot ayarları" mesaj={mesaj ?? ""} />;
  const [a, bugun, aktif, surumler] = await Promise.all([botAyarlariOku(), gunlukMaliyet(), aktifIstemAyari(), surumListesi()]);
  const duzenleyebilir = (BOT_YONETICI_ROLLERI as readonly string[]).includes(k.rol);
  const anahtarVar = claudeHazir();
  const denemeKanallari = kanalBilgileri().map((b) => {
    const ad = adaptorBul(b.kanal);
    return {
      kanal: b.kanal, ad: b.ad, hazir: !!ad,
      sinirNotu: ad ? `${ad.sinirlar.not} Tek mesaj en çok ${ad.sinirlar.azamiUzunluk} ${ad.sinirlar.birim === "utf8_bayt" ? "bayt" : "karakter"}.` : null,
    };
  });
  return (
    <>
      <PageHeader title="Bot ayarları" description="Acil durdurma, sınırlar, kişilik ve bilgi bankası (sürümlü) · Botu dene" />
      <div className="flex flex-col gap-4">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <AcilDurdurma acik={a.acilDurdurma} duzenleyebilir={duzenleyebilir} bicim="kart" />
          <BotAyarlari
            a={{
              acilDurdurma: a.acilDurdurma, gunlukMaliyetSiniriUsd: a.gunlukMaliyetSiniriUsd, turSiniri: a.turSiniri, bugunMaliyetUsd: bugun,
              anahtarVar, model: BOT_MODELI, effort: BOT_EFFORT, istemSurumu: istemSurumuEtiketi(aktif.surumNo),
            }}
            duzenleyebilir={duzenleyebilir}
          />
        </div>
        <IstemAyarlari
          aktif={aktif.ayarlar}
          aktifNo={aktif.surumNo}
          kaynaklar={aktif.kaynaklar}
          surumler={surumler}
          duzenleyebilir={duzenleyebilir}
          denemeKanallari={denemeKanallari}
          anahtarVar={anahtarVar}
        />
      </div>
    </>
  );
}
