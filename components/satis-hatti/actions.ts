"use server";
// Satış Hattı: kaydetme ve güncelleme (Server Actions)
import { oturumGerekli } from "@/lib/oturum";
import { revalidatePath } from "next/cache";
import { musteriBulAdla, musteriEkle, musteriyiGuncelle, type Musteri, type Plan, type Segment } from "@/components/musteriler/queries";
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";
import { LISANS_SECENEKLERI, icerikCoz, icerikYaz, type LisansSecenegi } from "./urun-secimi";
import { firsattanSiparisAc, type Kalem } from "@/components/siparisler/queries";
import { telefonNormalize } from "@/components/whatsapp/telefon";
import {
  ASAMALAR, KAYIP_NEDENLERI, KAYNAKLAR, firsatAsamasiDepo, firsatKaydetDepo, firsatKazanciIsaretle, firsatMusteriBagla, firsatSirasiDepo,
  type Asama, type Firsat, type KayipBilgisi, type Kaynak,
} from "./queries";

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

export type AsamaSonucu = { musteri?: { id: string; ad: string; yeni: boolean; siparisNo?: string } };

/** kalemler: teklif kabulünde siparişe teklifteki kalemler aynen aktarılır (verilmezse kart içeriğinden okunur) */
export async function firsatAsamasiGuncelle(firsat: Firsat, asama: Asama, kayip?: KayipBilgisi, kalemler?: Kalem[]): Promise<AsamaSonucu> {
  await oturumGerekli();
  if (!ASAMALAR.includes(asama)) throw new Error("Geçersiz aşama");
  if (asama === "kaybedildi") {
    if (!kayip || !KAYIP_NEDENLERI.includes(kayip.neden)) throw new Error("Kayıp nedeni seçin");
    if (kayip.neden === "Diğer" && !kayip.aciklama?.trim()) throw new Error("Diğer seçildiyse sebebi yazın");
  }
  await firsatAsamasiDepo(firsat.id, asama, kayip);
  revalidatePath("/pazarlama"); // kampanya başına "satışa dönen" sayısı
  revalidatePath("/satis-hatti");
  return asama === "kazanildi" ? kazanilinca(firsat, kalemler) : {};
}

/** Kazanılan fırsattan "ödeme bekliyor" sipariş açar (ürünler kart içeriğinden okunur) */
async function siparisAc(firsat: Firsat, musteri: { id: string; ulke: string }, verilen?: Kalem[]) {
  const u = icerikCoz(firsat.icerik);
  const kalemler: Kalem[] = verilen ? [...verilen] : [];
  if (!verilen && u.model) kalemler.push({ tur: "cihaz", model: u.model, adet: u.adet });
  if (!verilen && u.lisans) kalemler.push({ tur: "lisans", paket: u.lisans, adet: u.lisansAdet, sureAy: 12 });
  const s = await firsattanSiparisAc({ firma: firsat.firma, musteriId: musteri.id, ulke: musteri.ulke, konum: firsat.konum, icerik: firsat.icerik, tutar: firsat.tutar }, kalemler);
  if (s) revalidatePath("/siparisler");
  return s?.id;
}

/** Kazanılan fırsatın firmasını müşterilere ekler; zaten müşteriyse kaydına işler. Ürünleri belliyse sipariş açar. */
async function kazanilinca(firsat: Firsat, kalemler?: Kalem[]): Promise<AsamaSonucu> {
  // Aynı fırsat Kazanıldı'ya ikinci kez sürüklenirse müşteriye tekrar işlenmesin (satis_hatti.f_kazanc_islendi)
  if (!(await firsatKazanciIsaretle(firsat.id))) return {};

  const olay = { metin: `Fırsat kazanıldı · ${firsat.icerik}`, zaman: "Bugün · Satış hattı", tur: "siparis" as const };
  const mevcut = await musteriBulAdla(firsat.firma);

  if (mevcut) {
    await musteriyiGuncelle(mevcut.id, (m) => {
      m.olaylar.unshift(olay);
      m.toplamDeger = (m.toplamDeger ?? 0) + firsat.tutar;
      m.sonTemas = "Bugün";
    });
    await firsatMusteriBagla(firsat.id, mevcut.id);
    revalidatePath("/musteriler");
    revalidatePath("/satis-hatti"); // toast'taki "Müşteriyi aç" penceresi yeni kaydı görsün
    return { musteri: { id: mevcut.id, ad: mevcut.ad, yeni: false, siparisNo: await siparisAc(firsat, mevcut, kalemler) } };
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
    yetkililer: [], // müşteri panelinden "Yetkili ekle" ile girilir
    vergiNo: "",
    acikTalep: 0,
    cihazlar: [],
    olaylar: [olay, { metin: `Satış hattından müşteriye dönüştü (kaynak: ${firsat.kaynak})`, zaman: "Bugün", tur: "not" }],
  };
  await musteriEkle(musteri);
  await firsatMusteriBagla(firsat.id, musteri.id);
  revalidatePath("/musteriler");
  revalidatePath("/satis-hatti"); // toast'taki "Müşteriyi aç" penceresi yeni kaydı görsün
  return { musteri: { id: musteri.id, ad: musteri.ad, yeni: true, siparisNo: await siparisAc(firsat, musteri, kalemler) } };
}

export type FirsatFormDurumu = { hatalar?: Record<string, string>; firsat?: Firsat; zaman?: number } & AsamaSonucu;

export async function firsatKaydet(_onceki: FirsatFormDurumu, form: FormData): Promise<FirsatFormDurumu> {
  await oturumGerekli();
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const firma = metin("firma");
  const tutarMetni = metin("tutar");
  const tutar = Number(tutarMetni.replace(/\./g, "").replace(",", "."));
  const konum = metin("konum");
  const model = metin("model");
  const lisans = metin("lisans");
  const adet = Number(metin("adet") || 1);
  const lisansAdet = Number(metin("lisansAdet") || 1);
  const icerik = icerikYaz({
    model: CIHAZ_MODELLERI.includes(model as CihazModeli) ? (model as CihazModeli) : null,
    adet: Number.isInteger(adet) && adet > 0 ? adet : 1,
    lisans: LISANS_SECENEKLERI.includes(lisans as LisansSecenegi) ? (lisans as LisansSecenegi) : null,
    lisansAdet: Number.isInteger(lisansAdet) && lisansAdet > 0 ? lisansAdet : 1,
  });
  const id = metin("id"); // doluysa düzenleme
  const kaynak = metin("kaynak");
  const asama = metin("asama");
  const sonrakiAdim = metin("sonrakiAdim");
  const sonrakiTarih = metin("sonrakiTarih");
  const telefonMetni = metin("telefon");
  const telefon = telefonMetni ? telefonNormalize(telefonMetni) : "";

  // Tüm alanlar zorunlu; eksik olanların hepsi aynı anda bildirilir
  const hatalar: Record<string, string> = {};
  if (!firma) hatalar.firma = "Firma adını girin.";
  if (!konum) hatalar.konum = "Konumu girin (şehir, ülke).";
  if (!KAYNAKLAR.includes(kaynak as Kaynak)) hatalar.kaynak = "Kaynak seçin.";
  if (!icerik) hatalar.icerik = "En az bir cihaz ya da lisans seçin.";
  if (!tutarMetni) hatalar.tutar = "Ürün seçin.";
  else if (!Number.isFinite(tutar) || tutar <= 0) hatalar.tutar = "Tutar hesaplanamadı; özel paketse lisans ücretini girin.";
  if (!ASAMALAR.includes(asama as Asama) || (asama === "kaybedildi" && !id)) hatalar.asama = "Aşama seçin.";
  if (!sonrakiAdim) hatalar.sonrakiAdim = "Sonraki adımı girin (ör. Demo planla).";
  if (!sonrakiTarih) hatalar.sonrakiTarih = "Sonraki adım için bir tarih girin.";
  if (telefonMetni && !telefon) hatalar.telefon = "Telefonu ülke koduyla girin (+90…).";
  if (Object.keys(hatalar).length) return { hatalar };

  const firsat: Firsat = {
    id: id || crypto.randomUUID(),
    firma,
    konum,
    kaynak: kaynak as Kaynak,
    kampanyaId: metin("kampanyaId") || null,
    icerik,
    tutar,
    asama: asama as Asama,
    sonrakiAdim,
    sonrakiTarih,
    telefon: telefon || undefined,
  };

  // Yeni ise eklenir (gerçek id firsat.id'ye yazılır), id varsa güncellenir (aşama ve kayıp nedeni değişmez)
  await firsatKaydetDepo(firsat);
  revalidatePath("/satis-hatti");
  revalidatePath("/pazarlama");
  if (id) return { firsat, zaman: Date.now() };
  return { firsat, zaman: Date.now(), ...(firsat.asama === "kazanildi" ? await kazanilinca(firsat) : {}) };
}

/** Kanban'da aynı sütun içinde sürükleme / klavyeyle kaydırma: sütunun yeni sırası (satis_hatti.f_sira) */
export async function firsatSirasiKaydet(idler: string[]) {
  await oturumGerekli();
  await firsatSirasiDepo(idler.filter((id) => typeof id === "string").slice(0, 500));
  revalidatePath("/satis-hatti");
}
