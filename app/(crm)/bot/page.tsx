import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { botAyarlariOku, gunlukMaliyet } from "@/components/bot/veri";
import AcilDurdurma from "@/components/bot/acil-durdurma";
import { crmKullanicisi } from "@/lib/oturum";
import GelenKutusu from "@/components/bot/gelen-kutusu";
import { BOT_YONETICI_ROLLERI, simulasyonAcik } from "@/components/bot/erisim";
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
  const [liste, detay, ekip, ayarlar, bugun] = await Promise.all([gelenKutusu(), id ? konusmaDetayi(id) : Promise.resolve(null), getEkip(), botAyarlariOku(), gunlukMaliyet()]);
  return (
    <>
      <PageHeader title="Gelen kutusu" description="WhatsApp, Messenger ve Instagram konuşmaları tek yerde · bot konuşurken de canlı izlenir" />
      {/* Acil durdurma her zaman görünür (P2.4): Yönetici tek tıkla durdurur, diğer roller durumu görür */}
      <AcilDurdurma acik={ayarlar.acilDurdurma} duzenleyebilir={(BOT_YONETICI_ROLLERI as readonly string[]).includes(k.rol)} bicim="serit" />
      {!ayarlar.acilDurdurma && bugun >= ayarlar.gunlukMaliyetSiniriUsd && (
        <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-warn bg-warn-bg px-4 py-2 text-sm font-semibold text-warn">
          <CircleDollarSign size={16} aria-hidden="true" />
          Günlük maliyet sınırı doldu: bot bugün cevap vermiyor, konuşmalar ekibe devrediliyor.
          <Link href="/bot/ayarlar" className="font-bold underline">Bot ayarları</Link>
        </p>
      )}
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
