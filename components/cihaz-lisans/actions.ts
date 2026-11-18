"use server";
// Cihaz & Lisans: kaydetme, güncelleme ve silme (Server Actions)
import { oturumGerekli } from "@/lib/oturum";
import { revalidatePath } from "next/cache";
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";
import { ayEkle, lisansUygula } from "./ortak";
import { cihazEkleDepo, cihaziGuncelle, type Cihaz, type LisansKaydi, type LisansPlani } from "./queries";
import { hareketEkle } from "@/components/bayiler/queries";
import { yenilemeTalebiSil } from "@/components/portal/queries";

/** Cihaz verisini gösteren sayfalar */
function yenile(seriNo?: string) {
  revalidatePath("/cihaz-lisans");
  revalidatePath("/genel-bakis");
  revalidatePath("/destek"); // destekteki cihaz penceresi
  revalidatePath("/musteriler"); // müşterilerin cihaz listesi cihaz kayıtlarından gelir
  revalidatePath("/bayiler/raporlama");
  if (seriNo) revalidatePath(`/cihaz-lisans/${seriNo}`);
}

const PLANLAR: LisansPlani[] = ["Basic", "Pro", "Pro+"];
const SURELER = [12, 24, 36];
const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const SERI_NO = /^EO1-\d{4}-\d{4}$/;

export type YeniLisans = LisansKaydi & { seriNo: string };
export type LisansFormDurumu = { hatalar?: Record<string, string>; lisans?: YeniLisans; zaman?: number };
export type CihazFormDurumu = { hatalar?: Record<string, string>; cihaz?: Cihaz };

const metinAl = (form: FormData) => (ad: string) => String(form.get(ad) ?? "").trim();

/** Bir cihaza yeni lisans tanımlar veya mevcut lisansı yeniler. */
export async function lisansTanimla(_onceki: LisansFormDurumu, form: FormData): Promise<LisansFormDurumu> {
  await oturumGerekli();
  const metin = metinAl(form);
  const seriNo = metin("seriNo");
  const plan = metin("plan") as LisansPlani;
  const baslangic = metin("baslangic");
  const sure = Number(metin("sure"));

  const hatalar: Record<string, string> = {};
  if (!SERI_NO.test(seriNo)) hatalar.seriNo = "Cihaz seçin.";
  if (!PLANLAR.includes(plan)) hatalar.plan = "Plan seçin.";
  if (!TARIH.test(baslangic)) hatalar.baslangic = "Başlangıç tarihi girin.";
  if (!SURELER.includes(sure)) hatalar.sure = "Süre seçin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const lisans: YeniLisans = { seriNo, plan, baslangic, bitis: ayEkle(baslangic, sure) };

  // Cihazın güncel lisansı cihazlar'a, geçmiş kaydı lisanslar'a yazılır (cihaziGuncelle)
  const cihaz = await cihaziGuncelle(seriNo, (c) => lisansUygula(c, lisans));
  if (!cihaz) return { hatalar: { seriNo: "Cihaz bulunamadı." } };
  // Bayinin müşterisindeki cihaz: portal siparişiyle gelen lisansla aynı izi bırakır (bayi yenileme oranı + açık talebin kapanması)
  if (cihaz.bayiId && cihaz.musteriId) {
    await hareketEkle({
      id: crypto.randomUUID(), bayiId: cihaz.bayiId, tur: "lisans", tarih: baslangic,
      kalemler: [{ model: cihaz.model, seriNo }], musteri: { id: cihaz.musteriId, ad: cihaz.musteri }, plan, sureAy: sure, not: "CRM › Cihaz & Lisans",
    });
    await yenilemeTalebiSil(seriNo);
    for (const y of ["/bayiler", "/portal", "/portal/lisanslar", "/portal/cihazlar"]) revalidatePath(y);
  }
  yenile(seriNo);

  return { lisans, zaman: Date.now() };
}

/** Yeni EmbedraONE cihazı kaydeder (lisanssız başlar). */
export async function cihazKaydet(_onceki: CihazFormDurumu, form: FormData): Promise<CihazFormDurumu> {
  await oturumGerekli();
  const metin = metinAl(form);
  const seriNo = metin("seriNo").toUpperCase();
  const musteri = metin("musteri"); // "id|Ad|Ülke"
  const plan = metin("plan") as LisansPlani;
  const model = metin("model") as CihazModeli;

  const hatalar: Record<string, string> = {};
  if (!CIHAZ_MODELLERI.includes(model)) hatalar.model = "Cihaz modelini seçin.";
  if (!SERI_NO.test(seriNo)) hatalar.seriNo = "Seri no EO1-YYAA-NNNN biçiminde olmalı.";
  else if (metin("mevcut").split(",").includes(seriNo)) hatalar.seriNo = "Bu seri no zaten kayıtlı.";
  if (!musteri) hatalar.musteri = "Müşteri seçin.";
  if (!PLANLAR.includes(plan)) hatalar.plan = "Plan seçin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const [musteriId, musteriAdi, ulke] = musteri.split("|");
  const cihaz: Cihaz = {
    seriNo,
    model,
    musteriId: musteriId || null,
    musteri: musteriAdi || "—",
    ulke: ulke || "—",
    plan,
    lisansBaslangic: null,
    lisansBitis: null,
    firmware: "—", // firmware takibi şimdilik kapalı
    durum: "lisanssiz",
    gecmis: [],
  };

  if (!(await cihazEkleDepo(cihaz))) return { hatalar: { seriNo: "Bu seri no zaten kayıtlı." } };
  yenile();

  return { cihaz };
}
