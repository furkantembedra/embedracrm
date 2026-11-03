"use server";
// Müşteriler: kaydetme, güncelleme ve silme (Server Actions)
import type { Musteri, Plan, Segment } from "./queries";

const SEGMENTLER: Segment[] = ["servis", "muhendislik", "egitim", "bayi"];
const PLANLAR: Plan[] = ["Lead", "Basic", "Pro", "Pro+"];

export type FormDurumu = { hatalar?: Record<string, string>; musteri?: Musteri };

export async function musteriKaydet(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const ad = metin("ad");
  const telefon = metin("telefon");
  const eposta = metin("eposta");
  const segment = metin("segment") as Segment;
  const plan = metin("plan") as Plan;

  const hatalar: Record<string, string> = {};
  if (!ad) hatalar.ad = "Firma adı zorunlu.";
  if (!telefon && !eposta) hatalar.telefon = "Telefon veya e-postadan en az biri gerekli.";
  if (eposta && !/^\S+@\S+\.\S+$/.test(eposta)) hatalar.eposta = "Geçerli bir e-posta girin.";
  if (!SEGMENTLER.includes(segment)) hatalar.segment = "Segment seçin.";
  if (!PLANLAR.includes(plan)) hatalar.plan = "Plan seçin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const notMetni = metin("not");
  const musteri: Musteri = {
    id: crypto.randomUUID(),
    ad,
    sehir: metin("sehir") || "—",
    ulke: metin("ulke") || "—",
    segment,
    plan,
    lisansBitis: null,
    toplamDeger: null,
    sonTemas: "Bugün",
    durum: plan === "Lead" ? "Yeni lead" : "Yeni müşteri",
    yetkili: metin("yetkili") || "—",
    telefon: telefon || "—",
    eposta: eposta || "—",
    vergiNo: metin("vergiNo") || "—",
    acikTalep: 0,
    cihazlar: [],
    olaylar: [
      ...(notMetni ? [{ metin: notMetni, zaman: "Bugün · Not", tur: "not" as const }] : []),
      { metin: "Müşteri kaydı oluşturuldu", zaman: "Bugün", tur: "not" as const },
    ],
  };

  // TODO: Supabase bağlanınca: await supabase.from("customers").insert({ ... }).select().single();

  return { musteri };
}
