"use server";
// Satış Hattı: kaydetme ve güncelleme (Server Actions)
import { revalidatePath } from "next/cache";
import { musteriBulAdla, musteriEkle, type Musteri, type Plan, type Segment } from "@/components/musteriler/queries";
import { ASAMALAR, KAYNAKLAR, type Asama, type Firsat, type Kaynak } from "./queries";

const ULKE_KODU: Record<string, string> = {
  TR: "Türkiye", DE: "Almanya", ES: "İspanya", FR: "Fransa", PL: "Polonya", SE: "İsveç",
  IT: "İtalya", NL: "Hollanda", AT: "Avusturya", GB: "Birleşik Krallık", BA: "Bosna-Hersek",
};

/** "Kocaeli, TR" → Kocaeli / Türkiye · "Bosna-Hersek" → — / Bosna-Hersek */
function konumAyir(konum: string) {
  const parcalar = konum.split(",").map((p) => p.trim()).filter((p) => p && p !== "—");
  if (parcalar.length === 0) return { sehir: "—", ulke: "—" };
  if (parcalar.length === 1) return { sehir: "—", ulke: ULKE_KODU[parcalar[0].toUpperCase()] ?? parcalar[0] };
  const kod = parcalar[parcalar.length - 1];
  return { sehir: parcalar.slice(0, -1).join(", "), ulke: ULKE_KODU[kod.toUpperCase()] ?? kod };
}

function planBul(icerik: string): Plan {
  if (/pro\+/i.test(icerik)) return "Pro+";
  if (/\bpro\b/i.test(icerik)) return "Pro";
  return "Basic";
}

function segmentBul(f: Firsat): Segment {
  if (f.kaynak === "Bayi" || /bayi|distribüt/i.test(f.icerik)) return "bayi";
  if (/okul|lise|üniversite|eğitim/i.test(`${f.firma} ${f.icerik}`)) return "egitim";
  return "servis";
}

// Aynı fırsat Kazanıldı'ya ikinci kez sürüklenirse müşteriye tekrar işlenmesin.
const g = globalThis as { __embedraKazanilanlar?: Set<string> };
const ISLENENLER = (g.__embedraKazanilanlar ??= new Set());

export type AsamaSonucu = { musteri?: { id: string; ad: string; yeni: boolean } };

export async function firsatAsamasiGuncelle(firsat: Firsat, asama: Asama): Promise<AsamaSonucu> {
  if (!ASAMALAR.includes(asama)) throw new Error("Geçersiz aşama");
  // TODO: Supabase bağlanınca:
  // await supabase.from("deals").update({ stage: asama }).eq("id", firsat.id);

  return asama === "kazanildi" ? kazanilinca(firsat) : {};
}

/** Kazanılan fırsatın firmasını müşterilere ekler; zaten müşteriyse kaydına işler. */
async function kazanilinca(firsat: Firsat): Promise<AsamaSonucu> {
  if (ISLENENLER.has(firsat.id)) return {};
  ISLENENLER.add(firsat.id);

  const olay = { metin: `Fırsat kazanıldı · ${firsat.icerik}`, zaman: "Bugün · Satış hattı", tur: "siparis" as const };
  const mevcut = await musteriBulAdla(firsat.firma);

  if (mevcut) {
    mevcut.olaylar.unshift(olay);
    mevcut.toplamDeger = (mevcut.toplamDeger ?? 0) + firsat.tutar;
    mevcut.sonTemas = "Bugün";
    revalidatePath("/musteriler");
    return { musteri: { id: mevcut.id, ad: mevcut.ad, yeni: false } };
  }

  const { sehir, ulke } = konumAyir(firsat.konum);
  const musteri: Musteri = {
    id: crypto.randomUUID(),
    ad: firsat.firma,
    sehir,
    ulke,
    segment: segmentBul(firsat),
    plan: planBul(firsat.icerik),
    lisansBitis: null,
    toplamDeger: firsat.tutar,
    sonTemas: "Bugün",
    durum: "Yeni müşteri",
    yetkili: "—",
    telefon: "—",
    eposta: "—",
    vergiNo: "—",
    acikTalep: 0,
    cihazlar: [],
    olaylar: [olay, { metin: `Satış hattından müşteriye dönüştü (kaynak: ${firsat.kaynak})`, zaman: "Bugün", tur: "not" }],
  };
  await musteriEkle(musteri);
  revalidatePath("/musteriler");
  return { musteri: { id: musteri.id, ad: musteri.ad, yeni: true } };
}

export type FirsatFormDurumu = { hatalar?: Record<string, string>; firsat?: Firsat } & AsamaSonucu;

export async function firsatKaydet(_onceki: FirsatFormDurumu, form: FormData): Promise<FirsatFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const firma = metin("firma");
  const tutar = Number(metin("tutar").replace(/\./g, "").replace(",", "."));
  const kaynak = metin("kaynak");
  const asama = metin("asama");
  const sonrakiTarih = metin("sonrakiTarih");

  const hatalar: Record<string, string> = {};
  if (!firma) hatalar.firma = "Firma adı zorunlu.";
  if (!Number.isFinite(tutar) || tutar <= 0) hatalar.tutar = "Tutarı TL olarak girin (ör. 184000).";
  if (!KAYNAKLAR.includes(kaynak as Kaynak)) hatalar.kaynak = "Kaynak seçin.";
  if (!ASAMALAR.includes(asama as Asama)) hatalar.asama = "Aşama seçin.";
  if (!sonrakiTarih) hatalar.sonrakiTarih = "Sonraki adım için bir tarih girin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const firsat: Firsat = {
    id: crypto.randomUUID(),
    firma,
    konum: metin("konum") || "—",
    kaynak: kaynak as Kaynak,
    icerik: metin("icerik") || "—",
    tutar,
    asama: asama as Asama,
    sonrakiAdim: metin("sonrakiAdim") || "—",
    sonrakiTarih,
  };

  // TODO: Supabase bağlanınca: await supabase.from("deals").insert({ ... }).select().single();

  return { firsat, ...(firsat.asama === "kazanildi" ? await kazanilinca(firsat) : {}) };
}
