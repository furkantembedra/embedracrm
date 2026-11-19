// Devral, bota geri ver ve botun insana devretmesi (P1.3). Kanal bilmez (değişmez kural 13): durum geçişleri SQL'de
// tek işlemde (20261119160000_devral_devret.sql), sistem satırlarını da SQL yazar. Burası devretmenin yan etkilerini
// ekler: fırsata not, sorumluya (yoksa Satış rolüne) CRM içi bildirim + hatırlatma.
//
// Değişmez kural 4: her zaman insana devretme yolu vardır; temsilci yazdığı ya da Devral'a bastığı anda bot susar
// (yazma yolu: queries.ts temsilciYazdi; gonder.ts CRM'den, isle.ts CRM dışından / echo).
import { revalidatePath } from "next/cache";
import { konusmaBotaVer, konusmaBotDevretti, konusmaDevral, devirBilgisi } from "@/components/konusma/queries";
import { firsatNotuEkle } from "@/components/satis-hatti/queries";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { getEkip, type Kullanici } from "@/components/operasyon/queries";
import { devirSebebiAdi, devirSebebiMi, type DevirSebebi } from "./devir-sebepleri";

/** Bota not üst sınırı (konusmalar.bot_notu kısıtıyla aynı) */
export const BOT_NOTU_SINIRI = 1000;
const ACIKLAMA_SINIRI = 300;

function yenile() {
  for (const y of ["/bot", "/satis-hatti"]) {
    try {
      revalidatePath(y);
    } catch {
      /* istek bağlamı yok (işleyici) */
    }
  }
}

/** Devral düğmesi: bot susar, konuşma bu kişide. Değişiklik olduysa true. */
export async function devral(konusmaId: number, kullaniciId: number): Promise<boolean> {
  const degisti = await konusmaDevral(konusmaId, "dugme", kullaniciId);
  if (degisti) yenile();
  return degisti;
}

/** Bota geri ver: bot sıradaki müşteri mesajından itibaren devam eder; not botun bir sonraki turuna gider. */
export async function botaGeriVer(konusmaId: number, not: string | null, kullaniciId: number): Promise<boolean> {
  const temiz = (not ?? "").trim().slice(0, BOT_NOTU_SINIRI) || null;
  const degisti = await konusmaBotaVer(konusmaId, temiz, kullaniciId);
  if (degisti) yenile();
  return degisti;
}

/**
 * Bildirim kimlere gider: fırsatın sorumlusu (aktifse); yoksa aktif Satış rolündekiler; o da yoksa aktif Yöneticiler
 * (bildirimsiz kalmasın). Saf işlev.
 */
export function devirAlicilari(sorumluId: string | null, ekip: Pick<Kullanici, "id" | "rol" | "aktif">[]): string[] {
  const aktif = ekip.filter((k) => k.aktif);
  if (sorumluId && aktif.some((k) => k.id === sorumluId)) return [sorumluId];
  const satis = aktif.filter((k) => k.rol === "Satış").map((k) => k.id);
  if (satis.length) return satis;
  return aktif.filter((k) => k.rol === "Yönetici").map((k) => k.id);
}

/** "2026-11-19T14:05" (sunucunun yerel saati; hatırlatmalar bu biçimde tutulur) */
function simdiYerel(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type DevirSonucu = { devredildi: false } | { devredildi: true; firsatId: number | null; alicilar: string[] };

/**
 * Bot konuşmayı insana devreder (P2.2 insana_devret aracı, P2.1 hata / tur sınırı). Bot kapanır, konuşma
 * "Cevap bekliyor"a düşer, sistem satırı yazılır; fırsata "Bot devretti: [sebep]" notu ve sorumluya (yoksa Satış
 * rolündekilere) hemen zamanı gelen yüksek önemli hatırlatma açılır (zil bildirimi). Bot zaten kapalıysa hiçbir şey
 * yapmaz (tekrar / yarış: bildirim bir kez gider). aciklama botun kısa gerekçesidir; müşteri mesajı kopyalanmaz.
 */
export async function botDevretti(konusmaId: number, sebep: DevirSebebi, aciklama?: string | null): Promise<DevirSonucu> {
  const kod: DevirSebebi = devirSebebiMi(sebep) ? sebep : "diger";
  const kisa = (aciklama ?? "").replace(/\s+/g, " ").trim().slice(0, ACIKLAMA_SINIRI) || null;
  if (!(await konusmaBotDevretti(konusmaId, kod, kisa))) return { devredildi: false };

  const [bilgi, ekip] = await Promise.all([devirBilgisi(konusmaId), getEkip()]);
  const sebepAdi = devirSebebiAdi(kod);
  const firsatId = bilgi?.satisHattiId ?? null;
  const firma = bilgi?.firma ?? "Konuşma";
  if (firsatId != null) {
    await firsatNotuEkle(firsatId, `Bot devretti: ${sebepAdi}${kisa ? ` · ${kisa}` : ""}`, "bot_devretti");
  }
  const alicilar = devirAlicilari(bilgi?.sorumluId != null ? `u${bilgi.sorumluId}` : null, ekip);
  const zaman = simdiYerel();
  await Promise.all(alicilar.map((sorumluId) => hatirlatmaEkleDepo({
    id: "",
    baslik: `Bot devretti: ${firma} · ${sebepAdi}`.slice(0, 140),
    aciklama: `${kisa ? `${kisa} · ` : ""}Konuşmayı Bot › Gelen kutusu'nda açıp cevaplayın ya da bota geri verin.`.slice(0, 500),
    kayit: { tur: "firsat", id: firsatId != null ? String(firsatId) : "", ad: firma, href: `/bot?k=${konusmaId}` },
    sorumluId,
    zaman,
    durum: "bekliyor",
    otomatik: false,
    onem: "yuksek",
  })));
  yenile();
  return { devredildi: true, firsatId, alicilar };
}
