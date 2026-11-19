"use server";
// Bot › Gelen kutusu Server Action'ları. Hepsi Yönetici / Satış / Pazarlama'ya açık (BOT_ROLLERI); simülasyon yalnızca
// geliştirmede ve Yönetici için. Gönderim konuşmanın kanal adaptörüyle (components/konusma/gonder.ts): pencere sunucuda
// adaptöre sorulur, arayüzün gösterdiği durum yalnızca yol göstericidir.
import { revalidatePath } from "next/cache";
import { oturumGerekli } from "@/lib/oturum";
import { kullaniciNo } from "@/lib/supabase/db";
import { mesajGonder, sablonGonder } from "@/components/konusma/gonder";
import { adaptorBul } from "@/components/konusma/kanallar";
import { kuyrugaYaz, kuyruguIsle } from "@/components/konusma/kuyruk";
import { getEkip } from "@/components/operasyon/queries";
import { getFirsat } from "@/components/satis-hatti/queries";
import { BOT_ROLLERI, BOT_YONETICI_ROLLERI } from "./erisim";
import { firsatSorumlusuYaz, gelenKutusu, konusmaDetayi, okunduYaz, type GelenKutusuSatiri, type KonusmaDetayi } from "./queries";

const kimlikMi = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;

/** Liste (canlı yenileme ve sekme sayıları için) */
export async function gelenKutusuGetir(): Promise<GelenKutusuSatiri[]> {
  await oturumGerekli(BOT_ROLLERI);
  return gelenKutusu();
}

/** Sohbet ve sağ panel */
export async function konusmaGetir(konusmaId: number): Promise<KonusmaDetayi | null> {
  await oturumGerekli(BOT_ROLLERI);
  if (!kimlikMi(konusmaId)) return null;
  return konusmaDetayi(konusmaId);
}

/** Kullanıcının bu konuşmada okuduğu son mesaj */
export async function okunduIsaretle(konusmaId: number, mesajId: number): Promise<void> {
  await oturumGerekli(BOT_ROLLERI);
  if (!kimlikMi(konusmaId) || !kimlikMi(mesajId)) return;
  await okunduYaz(konusmaId, mesajId);
}

export type GonderimDurumu = { ok: true; demo: boolean } | { ok: false; hata: string; gonderilen: number };

const AZAMI_METIN = 20_000; // adaptör kanal sınırına böler; bu yalnızca kötüye kullanıma karşı üst sınır

/** Temsilci cevabı: gönderen temsilci + gönderen kullanıcı; temsilci yazınca bot susar (değişmez kural 4) */
export async function cevapGonder(konusmaId: number, metin: string): Promise<GonderimDurumu> {
  const k = await oturumGerekli(BOT_ROLLERI);
  if (!kimlikMi(konusmaId)) return { ok: false, hata: "Konuşma bulunamadı.", gonderilen: 0 };
  const temiz = typeof metin === "string" ? metin.trim() : "";
  if (!temiz) return { ok: false, hata: "Mesajı yazın.", gonderilen: 0 };
  if (temiz.length > AZAMI_METIN) return { ok: false, hata: "Mesaj çok uzun.", gonderilen: 0 };
  const r = await mesajGonder(konusmaId, temiz, "temsilci", k ? kullaniciNo(k.id) : null);
  revalidatePath("/satis-hatti");
  return r.ok ? { ok: true, demo: r.demo } : { ok: false, hata: r.hata, gonderilen: r.gonderilen };
}

/** Onaylı şablon (pencere kapalıyken WhatsApp'ta tek yol). Bot şablon kullanmaz; bu yalnızca temsilci içindir. */
export async function sablonlaGonder(
  konusmaId: number,
  sablon: { ad: string; dil: string; parametreler: string[] },
): Promise<GonderimDurumu> {
  const k = await oturumGerekli(BOT_ROLLERI);
  if (!kimlikMi(konusmaId)) return { ok: false, hata: "Konuşma bulunamadı.", gonderilen: 0 };
  const ad = String(sablon?.ad ?? "").trim();
  const dil = String(sablon?.dil ?? "").trim() || "tr";
  const parametreler = (Array.isArray(sablon?.parametreler) ? sablon.parametreler : [])
    .map((p) => String(p ?? "").trim().slice(0, 1000)).filter(Boolean).slice(0, 20);
  if (!ad) return { ok: false, hata: "Şablon adını yazın.", gonderilen: 0 };
  const r = await sablonGonder(konusmaId, { ad, dil, parametreler }, k ? kullaniciNo(k.id) : null);
  revalidatePath("/satis-hatti");
  return r.ok ? { ok: true, demo: r.demo } : { ok: false, hata: r.hata, gonderilen: 0 };
}

/** Fırsatın sorumlusu = konuşmanın atanmış kişisi ("Bana atanan"). Boş: sorumlu yok. */
export async function sorumluDegistir(firsatId: string, kullaniciId: string): Promise<{ hata?: string }> {
  await oturumGerekli(BOT_ROLLERI);
  const no = /^\d+$/.test(firsatId) ? Number(firsatId) : null;
  if (no == null) return { hata: "Fırsat bulunamadı." };
  if (!kullaniciId) {
    await firsatSorumlusuYaz(no, null);
  } else {
    const ekip = await getEkip();
    const kisi = ekip.find((u) => u.id === kullaniciId && u.aktif);
    if (!kisi) return { hata: "Bu kişi ekipte değil ya da pasif." };
    await firsatSorumlusuYaz(no, kullaniciNo(kisi.id));
  }
  revalidatePath("/satis-hatti");
  return {};
}

export type SimulasyonDurumu = { hatalar?: Record<string, string>; duyuru?: string; konusmaId?: number; zaman?: number };

/**
 * Demo (yalnızca geliştirmede, yalnızca Yönetici): Meta webhook'u gelmiş gibi mesaj işler, webhook'la aynı yoldan:
 * mesaj kaydedilir + kuyruğa yazılır, sonra işleyici bu konuşma için hemen çalıştırılır.
 * "İşletmeden" seçilirse CRM dışından yazılmış temsilci mesajı (echo) gibi işlenir.
 */
export async function konusmaSimuleEt(_o: SimulasyonDurumu, form: FormData): Promise<SimulasyonDurumu> {
  await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (process.env.NODE_ENV === "production") return { hatalar: { kanal: "Simülasyon yalnızca geliştirme ortamında çalışır." } };
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const a = adaptorBul(metin("kanal"));
  if (!a) return { hatalar: { kanal: "Bu kanalın adaptörü henüz yok (Faz 4)." } };
  const kimlik = a.kimlikCoz(metin("kimlik"));
  const mesaj = metin("mesaj").slice(0, 4096);
  const echo = metin("gonderen") === "isletme";
  const hatalar: Record<string, string> = {};
  if (!kimlik) hatalar.kimlik = `${a.kimlikAlani.etiket} geçersiz (örn. ${a.kimlikAlani.ornek}).`;
  if (!mesaj) hatalar.mesaj = "Mesajı yazın.";
  if (Object.keys(hatalar).length) return { hatalar };
  const [kayit] = await kuyrugaYaz([{
    kanal: a.kanal, kanalHesapId: a.varsayilanHesap(), disKullaniciId: kimlik!, disMesajId: `sim-${crypto.randomUUID()}`,
    tur: "metin", metin: mesaj, ek: {}, zaman: new Date().toISOString(), echo, profilAdi: metin("ad").slice(0, 200) || undefined,
  }]);
  if (!kayit) return { hatalar: { mesaj: "Mesaj kaydedilemedi." } };
  const isleyici = await kuyruguIsle({ konusmaId: kayit.konusmaId, sureMs: 10_000 });
  const sonuc = isleyici.sonuclar.find((x) => x.mesajId === kayit.mesajId);
  revalidatePath("/satis-hatti");
  if (!sonuc) return { duyuru: "Mesaj kuyruğa alındı; işleyici birazdan işleyecek.", konusmaId: kayit.konusmaId, zaman: Date.now() };
  const firsat = sonuc.firsatId ? await getFirsat(sonuc.firsatId) : null;
  const duyuru = echo
    ? `İşletmeden yazılmış ${a.ad} mesajı temsilci mesajı olarak kaydedildi; bu konuşmada bot kapatıldı.`
    : !firsat ? `${a.ad} mesajı işlendi.`
    : sonuc.yeni ? `${a.ad} üzerinden yeni lead: ${firsat.firma}` : `${firsat.firma} fırsatına ${a.ad} mesajı eklendi.`;
  return { duyuru, konusmaId: kayit.konusmaId, zaman: Date.now() };
}
