// Günlük maliyet sınırı (P2.4): sınır aşılınca bot çağrılmaz (dongu.ts kapısı) ve aktif Yöneticilere günde bir kez
// CRM içi bildirim (yüksek önemli, hemen zamanı gelen hatırlatma = zil bildirimi) gider. "Günde bir kez" veritabanında
// tutulur (bot_ayarlari.maliyet_bildirim_gunu; aynı anda iki işleyici çalışsa da yalnızca biri gönderir).
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { getEkip } from "@/components/operasyon/queries";
import { usd } from "./arac-gorunumu";
import { maliyetBildirimiAl } from "./veri";

function simdiYerel(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Sınır aşıldı: bugün ilk kez ise yöneticilere bildirim. Bildirim gidenlerin kimliklerini döner (gitmediyse boş). */
export async function maliyetSiniriBildir(bugunUsd: number, sinirUsd: number, simdi = new Date()): Promise<string[]> {
  if (!(await maliyetBildirimiAl(simdi))) return [];
  const yoneticiler = (await getEkip()).filter((k) => k.aktif && k.rol === "Yönetici").map((k) => k.id);
  const zaman = simdiYerel(simdi);
  await Promise.all(yoneticiler.map((sorumluId) => hatirlatmaEkleDepo({
    id: "",
    baslik: "Bot durdu: günlük maliyet sınırı doldu",
    aciklama: `Bugünkü bot maliyeti ${usd(bugunUsd)}, sınır ${usd(sinirUsd)}. Bot gün sonuna kadar cevap vermiyor; konuşmalar ekibe devrediliyor. Sınırı Bot › Ayarlar'dan değiştirebilirsiniz.`.slice(0, 500),
    kayit: { tur: "firsat", id: "", ad: "Bot ayarları", href: "/bot/ayarlar" },
    sorumluId,
    zaman,
    durum: "bekliyor",
    otomatik: false,
    onem: "yuksek",
  })));
  console.info(`[bot] günlük maliyet sınırı doldu; ${yoneticiler.length} yöneticiye bildirim`);
  return yoneticiler;
}
