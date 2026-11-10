"use server";
// Teklifler: kaydetme, revizyon ve durum değişikliği (Server Actions).
// Gönderilen teklif fırsatı "Teklif gönderildi" aşamasına taşır ve tutarını günceller;
// kabul edilen teklif fırsatı kazandırır (müşteri + sipariş satış hattının akışıyla açılır).
import { revalidatePath } from "next/cache";
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";
import { LISANS_SECENEKLERI } from "@/components/satis-hatti/urun-secimi";
import { firsatAsamasiDepo, firsatiGuncelle, getFirsat, KAPALI_ASAMALAR } from "@/components/satis-hatti/queries";
import { firsatAsamasiGuncelle } from "@/components/satis-hatti/actions";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { musteriBulAdla, musteriyiGuncelle } from "@/components/musteriler/queries";
import type { Kalem } from "@/components/siparisler/queries";
import { getTeklif, getTeklifler, sonrakiTeklifNo, teklifEkle, teklifiGuncelle, type Teklif, type TeklifKalemi } from "./queries";
import { teklifIcerigi, teklifToplami } from "./ortak";

const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const bugun = () => new Date().toISOString().slice(0, 10);

function yenile(id?: string) {
  for (const y of ["/teklifler", "/satis-hatti", "/musteriler", "/siparisler", "/genel-bakis"]) revalidatePath(y);
  if (id) revalidatePath(`/teklifler/${id}`);
}

function kalemleriOku(json: string): TeklifKalemi[] | null {
  let ham: unknown;
  try {
    ham = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(ham)) return null;
  const sonuc: TeklifKalemi[] = [];
  for (const k of ham as Record<string, unknown>[]) {
    const adet = Number(k.adet);
    const birimFiyat = Number(k.birimFiyat);
    if (!Number.isInteger(adet) || adet < 1 || adet > 9999 || !Number.isFinite(birimFiyat)) return null;
    if (k.tur === "cihaz" && CIHAZ_MODELLERI.includes(k.model as CihazModeli)) sonuc.push({ tur: "cihaz", model: k.model as CihazModeli, adet, birimFiyat });
    else if (k.tur === "lisans" && LISANS_SECENEKLERI.includes(k.paket as never)) sonuc.push({ tur: "lisans", paket: String(k.paket), adet, birimFiyat });
    else if (k.tur === "ozel" && String(k.aciklama ?? "").trim()) sonuc.push({ tur: "ozel", aciklama: String(k.aciklama).trim().slice(0, 120), adet, birimFiyat, kdvli: !!k.kdvli });
    else return null;
  }
  return sonuc;
}

export type TeklifFormDurumu = { hatalar?: Record<string, string>; teklif?: Teklif; zaman?: number };

export async function teklifKaydet(_o: TeklifFormDurumu, form: FormData): Promise<TeklifFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const firsat = await getFirsat(metin("firsatId"));
  const onceki = metin("oncekiId") ? await getTeklif(metin("oncekiId")) : null;
  const kalemler = kalemleriOku(metin("kalemler") || "[]");
  const iskonto = Number(metin("iskonto").replace(",", ".") || 0);
  const gecerlilik = metin("gecerlilik");
  const gonder = metin("islem") === "gonder";

  const hatalar: Record<string, string> = {};
  if (!firsat) hatalar.firsatId = "Fırsat seçin.";
  else if (KAPALI_ASAMALAR.includes(firsat.asama)) hatalar.firsatId = "Kapanmış fırsata teklif hazırlanamaz.";
  if (!kalemler) hatalar.kalemler = "Kalemleri kontrol edin (adet 1+, özel kalemde açıklama).";
  else if (!kalemler.length) hatalar.kalemler = "En az bir kalem ekleyin.";
  if (!Number.isFinite(iskonto) || iskonto < 0 || iskonto > 50) hatalar.iskonto = "İskonto %0–50 arası olmalı.";
  if (!TARIH.test(gecerlilik)) hatalar.gecerlilik = "Geçerlilik tarihi girin.";
  else if (gecerlilik < bugun()) hatalar.gecerlilik = "Geçerlilik bugünden önce olamaz.";
  if (!metin("odemeSartlari")) hatalar.odemeSartlari = "Ödeme şartlarını yazın.";
  if (!metin("teslimSartlari")) hatalar.teslimSartlari = "Teslim şartlarını yazın.";
  if (onceki && (onceki.firsatId !== firsat?.id || ["kabul", "revize"].includes(onceki.durum))) hatalar.genel = "Bu teklif revize edilemez.";
  if (Object.keys(hatalar).length || !firsat || !kalemler) return { hatalar };

  const fiyat = await getFiyatListesi();
  const id = onceki ? `${onceki.kok}-v${onceki.versiyon + 1}` : await sonrakiTeklifNo(new Date().getFullYear());
  const teklif: Teklif = {
    id,
    no: onceki ? `${onceki.kok} v${onceki.versiyon + 1}` : id,
    kok: onceki?.kok ?? id,
    versiyon: onceki ? onceki.versiyon + 1 : 1,
    firsatId: firsat.id,
    firma: firsat.firma,
    konum: firsat.konum,
    kalemler,
    iskonto,
    kdv: fiyat.kdv,
    gecerlilik,
    odemeSartlari: metin("odemeSartlari").slice(0, 200),
    teslimSartlari: metin("teslimSartlari").slice(0, 200),
    not: metin("not").slice(0, 500),
    durum: "taslak",
    olusturma: bugun(),
    gonderim: null,
    sonuc: null,
  };
  // Aynı fırsatın açık (taslak / gönderilmiş) eski sürümleri revize sayılır
  for (const t of await getTeklifler()) {
    if (t.kok === teklif.kok && ["taslak", "gonderildi", "red"].includes(t.durum)) t.durum = "revize";
  }
  await teklifEkle(teklif);
  if (gonder) await gonderildiIsle(teklif);
  yenile(teklif.id);
  return { teklif, zaman: Date.now() };
}

async function musteriyeIsle(t: Teklif, metin: string) {
  const m = await musteriBulAdla(t.firma);
  if (m) await musteriyiGuncelle(m.id, (x) => x.olaylar.unshift({ metin, zaman: "Bugün · Teklif", tur: "teklif" }));
}

async function gonderildiIsle(t: Teklif) {
  const { net } = teklifToplami(t);
  await teklifiGuncelle(t.id, (x) => {
    x.durum = "gonderildi";
    x.gonderim = bugun();
  });
  const f = await firsatiGuncelle(t.firsatId, (x) => {
    x.tutar = net;
    x.icerik = teklifIcerigi(t.kalemler);
    x.sonrakiAdim = `Teklif ${t.no} takibi`;
    x.sonrakiTarih = t.gecerlilik;
  });
  if (f && (f.asama === "yeni" || f.asama === "demo")) await firsatAsamasiDepo(f.id, "teklif");
  await musteriyeIsle(t, `Teklif gönderildi · ${t.no}`);
}

export type TeklifIslemSonucu = { teklif?: Teklif; hata?: string; musteri?: { id: string; ad: string; yeni: boolean; siparisNo?: string } };

export async function teklifDurumuDegistir(id: string, durum: "gonderildi" | "kabul" | "red"): Promise<TeklifIslemSonucu> {
  const t = await getTeklif(id);
  if (!t) return { hata: "Teklif bulunamadı." };
  const izinli: Record<typeof durum, Teklif["durum"][]> = { gonderildi: ["taslak"], kabul: ["gonderildi"], red: ["gonderildi"] };
  if (!izinli[durum].includes(t.durum)) return { hata: "Bu teklifin durumu değiştirilemez." };
  if (durum === "kabul" && t.gecerlilik < bugun()) return { hata: "Teklifin süresi dolmuş; revize edip yeniden gönderin." };

  if (durum === "gonderildi") {
    await gonderildiIsle(t);
    yenile(id);
    return { teklif: (await getTeklif(id))! };
  }

  if (durum === "red") {
    await teklifiGuncelle(id, (x) => {
      x.durum = "red";
      x.sonuc = bugun();
    });
    await firsatiGuncelle(t.firsatId, (x) => {
      x.sonrakiAdim = `Teklif ${t.no} reddedildi · revize et`;
      x.sonrakiTarih = bugun();
    });
    await musteriyeIsle(t, `Teklif reddedildi · ${t.no}`);
    yenile(id);
    return { teklif: (await getTeklif(id))! };
  }

  // Kabul: fırsat teklifteki içerik ve tutarla kazanılır, sipariş teklif kalemleriyle açılır
  const { net } = teklifToplami(t);
  const firsat = await firsatiGuncelle(t.firsatId, (x) => {
    x.tutar = net;
    x.icerik = teklifIcerigi(t.kalemler);
    x.sonrakiAdim = "Sipariş hazırlanıyor";
    x.sonrakiTarih = bugun();
  });
  if (!firsat) return { hata: "Fırsat bulunamadı." };
  const kalemler: Kalem[] = t.kalemler.flatMap((k): Kalem[] =>
    k.tur === "cihaz" ? [{ tur: "cihaz", model: k.model, adet: k.adet }] : k.tur === "lisans" ? [{ tur: "lisans", paket: k.paket, adet: k.adet, sureAy: 12 }] : [],
  );
  const sonuc = firsat.asama === "kazanildi" ? {} : await firsatAsamasiGuncelle({ ...firsat }, "kazanildi", undefined, kalemler);
  await teklifiGuncelle(id, (x) => {
    x.durum = "kabul";
    x.sonuc = bugun();
    x.siparisNo = sonuc.musteri?.siparisNo ?? null;
  });
  await musteriyeIsle(t, `Teklif kabul edildi · ${t.no}`);
  yenile(id);
  return { teklif: (await getTeklif(id))!, musteri: sonuc.musteri };
}
