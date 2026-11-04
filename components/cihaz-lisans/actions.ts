"use server";
// Cihaz & Lisans: kaydetme, güncelleme ve silme (Server Actions)
import { ayEkle } from "./ortak";
import type { Cihaz, LisansKaydi, LisansPlani } from "./queries";

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

  // TODO: Supabase bağlanınca:
  // await supabase.from("licenses").insert({ device_serial: seriNo, plan, starts_at: baslangic, ends_at: lisans.bitis });

  return { lisans, zaman: Date.now() };
}

/** Yeni EmbedraONE cihazı kaydeder (lisanssız başlar). */
export async function cihazKaydet(_onceki: CihazFormDurumu, form: FormData): Promise<CihazFormDurumu> {
  const metin = metinAl(form);
  const seriNo = metin("seriNo").toUpperCase();
  const musteri = metin("musteri"); // "id|Ad|Ülke"
  const firmware = metin("firmware");
  const plan = metin("plan") as LisansPlani;

  const hatalar: Record<string, string> = {};
  if (!SERI_NO.test(seriNo)) hatalar.seriNo = "Seri no EO1-YYAA-NNNN biçiminde olmalı.";
  else if (metin("mevcut").split(",").includes(seriNo)) hatalar.seriNo = "Bu seri no zaten kayıtlı.";
  if (!musteri) hatalar.musteri = "Müşteri seçin.";
  if (!/^v\d+\.\d+\.\d+$/.test(firmware)) hatalar.firmware = "Örn: v2.4.1";
  if (!PLANLAR.includes(plan)) hatalar.plan = "Plan seçin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const [musteriId, musteriAdi, ulke] = musteri.split("|");
  const cihaz: Cihaz = {
    seriNo,
    musteriId: musteriId || null,
    musteri: musteriAdi || "—",
    ulke: ulke || "—",
    plan,
    lisansBaslangic: null,
    lisansBitis: null,
    firmware,
    durum: "lisanssiz",
    gecmis: [],
  };

  // TODO: Supabase bağlanınca: await supabase.from("devices").insert({ ... }).select().single();

  return { cihaz };
}
