import PageHeader from "@/components/layout/page-header";
import { crmKullanicisi } from "@/lib/oturum";
import { RolMesaji, botRolMesaji } from "@/components/bot/sayfa";
import { BOT_YONETICI_ROLLERI } from "@/components/bot/erisim";
import BotAyarlari from "@/components/bot/bot-ayarlari";
import AcilDurdurma from "@/components/bot/acil-durdurma";
import IstemAyarlari from "@/components/bot/istem-ayarlari";
import { aktifIstemAyari, botAyarlariOku, gunlukMaliyet, istanbulGunBasi, surumListesi } from "@/components/bot/veri";
import BilgiKaynaklari from "@/components/bot/bilgi-kaynaklari";
import { bugunkuCikarimMaliyeti, kaynakListesi } from "@/components/bot/bilgi-kaynagi/veri";
import { claudeHazir } from "@/components/bot/claude";
import { istemSurumuEtiketi } from "@/components/bot/istem";
import { kanalBilgileri } from "@/components/bot/queries";
import { adaptorBul } from "@/components/konusma/kanallar";
import { BOT_EFFORT, BOT_MODELI } from "@/components/bot/yapilandirma";

// Bot › Ayarlar (P2.4): acil durdurma, günlük maliyet ve tur sınırı (anında), botun sabit istemine giren sürümlü
// ayarlar (Kaydet → yeni sürüm, önceki sürüme dönüş) ve "Botu dene" paneli. Düzenleme yalnızca Yönetici.
// P2.4b: "Bilgi kaynakları" (PDF / görsel / Excel / CSV / metin → taslak → Yönetici onayı → yeni ayar sürümü).

// PDF / görsel çıkarımı Claude ile yapılır (sunucu eylemi bu sayfanın süresiyle sınırlı; bkz. bilgi-kaynagi/cikarim.ts)
export const maxDuration = 150;

export default async function BotAyarlarPage() {
  const [mesaj, k] = await Promise.all([botRolMesaji(), crmKullanicisi()]);
  if (mesaj || !k) return <RolMesaji baslik="Bot ayarları" mesaj={mesaj ?? ""} />;
  const [a, bugun, aktif, surumler, kaynaklar, bugunCikarim] = await Promise.all([
    botAyarlariOku(), gunlukMaliyet(), aktifIstemAyari(), surumListesi(),
    // Migration (20261120200000) henüz uygulanmadıysa sayfanın geri kalanı çalışsın; bölüm uyarı gösterir
    kaynakListesi().catch((e) => (console.error(`[bot] bilgi kaynakları okunamadı: ${e instanceof Error ? e.message : e}`), null)),
    bugunkuCikarimMaliyeti(istanbulGunBasi()),
  ]);
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
      <PageHeader title="Bot ayarları" description="Acil durdurma, sınırlar, kişilik ve bilgi bankası (sürümlü) · Botu dene · Bilgi kaynakları" />
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
          surumler={surumler.map(({ kaynaklar: k, ...x }) => ({ ...x, kaynakSayisi: k.length }))}
          duzenleyebilir={duzenleyebilir}
          denemeKanallari={denemeKanallari}
          anahtarVar={anahtarVar}
        />
        <BilgiKaynaklari
          kaynaklar={kaynaklar ?? []}
          kurulumEksik={kaynaklar === null}
          ayarlar={aktif.ayarlar}
          aktifKaynaklar={aktif.kaynaklar}
          duzenleyebilir={duzenleyebilir}
          anahtarVar={anahtarVar}
          bugunCikarim={bugunCikarim}
          bugunToplam={bugun}
          gunlukSinir={a.gunlukMaliyetSiniriUsd}
        />
      </div>
    </>
  );
}
