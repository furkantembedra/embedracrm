"use server";
// Pazarlama & Bülten: içerik, kampanya ve hedef liste kayıtları (Server Actions)
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { IZIN_KANALLARI, IZIN_KAYNAKLARI, type IzinKanali } from "@/components/musteriler/izin";
import { EPOSTA_GECERLI, saglayicilar } from "@/lib/ileti-gonder";
import { medyaGetir } from "./medya-deposu";
import { gonderimKanali, kampanyaGonder, kampanyaKitlesi, testGonder, type GonderSonucu } from "./gonderim";
import { hashtagTemizle, telefonRakam } from "./ortak";
import {
  ICERIK_KANALLARI, KAMPANYA_DURUMLARI, KAMPANYA_KANALLARI, HAZIR_LISTELER,
  getIcerikler, getKampanyalar, getOzelListeler, icerigiGuncelle, icerigiSil, icerikEkle, kampanyaKaydetDepo, ozelListeEkle, ozelListeSil,
  type AktarilanKisi, type Icerik, type IcerikKanali, type Kampanya, type KampanyaDurumu, type KampanyaKanali, type ListeFiltresi, type Medya, type OzelListe,
} from "./queries";

const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const yenile = () => {
  revalidatePath("/pazarlama");
  revalidatePath("/satis-hatti"); // fırsat formundaki kampanya listesi
};

export type IcerikSonucu = { icerik?: Icerik; hatalar?: Record<string, string> };

export async function icerikKaydet(v: {
  id?: string;
  tarih: string;
  kanal: string;
  baslik: string;
  kampanyaId: string;
  aciklama: string;
  hashtaglar: string[];
  medya: Medya[];
  bayiPaylas?: boolean;
}): Promise<IcerikSonucu> {
  const hatalar: Record<string, string> = {};
  if (!TARIH.test(v.tarih)) hatalar.tarih = "Tarih seçin.";
  if (!ICERIK_KANALLARI.includes(v.kanal as IcerikKanali)) hatalar.kanal = "Kanal seçin.";
  if (!v.baslik.trim()) hatalar.baslik = "İçeriğin başlığını yazın.";
  if (v.aciklama.length > 3000) hatalar.aciklama = "Açıklama en fazla 3000 karakter olabilir.";
  const hashtaglar = [...new Set(v.hashtaglar.map(hashtagTemizle).filter(Boolean))];
  if (hashtaglar.length > 30) hatalar.hashtaglar = "En fazla 30 hashtag (Instagram sınırı).";
  // Yalnızca gerçekten yüklenmiş dosyalar kabul edilir
  const medya = v.medya.filter((m) => medyaGetir(m.id)).slice(0, 10).map((m) => ({ id: m.id, ad: String(m.ad).slice(0, 120), tur: m.tur === "video" ? "video" : "gorsel", boyut: Number(m.boyut) || 0 }) as Medya);
  if (Object.keys(hatalar).length) return { hatalar };
  const kampanyaVar = v.kampanyaId && (await getKampanyalar()).some((k) => k.id === v.kampanyaId);
  const alanlar = {
    tarih: v.tarih, kanal: v.kanal as IcerikKanali, baslik: v.baslik.trim().slice(0, 120), kampanyaId: kampanyaVar ? v.kampanyaId : null,
    aciklama: v.aciklama.trim(), hashtaglar, medya, bayiPaylas: !!v.bayiPaylas,
  };
  if (v.id && (await getIcerikler()).some((x) => x.id === v.id)) {
    const icerik = await icerigiGuncelle(v.id, (x) => Object.assign(x, alanlar));
    yenile();
    return { icerik: icerik ? structuredClone(icerik) : undefined };
  }
  const icerik: Icerik = { id: crypto.randomUUID(), paylasildi: false, ...alanlar };
  await icerikEkle(icerik);
  yenile();
  return { icerik };
}

export async function icerikPaylasildi(id: string, deger: boolean) {
  const i = await icerigiGuncelle(id, (x) => {
    x.paylasildi = deger;
  });
  yenile();
  return !!i;
}

/** Takvimde sürükleyip başka güne bırakılan içeriğin tarihini değiştirir */
export async function icerikTasi(id: string, tarih: string) {
  if (!TARIH.test(tarih)) return false;
  const i = await icerigiGuncelle(id, (x) => {
    x.tarih = tarih;
  });
  yenile();
  return !!i;
}

export async function icerikSil(id: string) {
  const ok = await icerigiSil(id);
  yenile();
  return ok;
}

export type KampanyaSonucu = { kampanya?: Kampanya; hatalar?: Record<string, string> };

export async function kampanyaKaydet(v: Omit<Kampanya, "id"> & { id?: string }): Promise<KampanyaSonucu> {
  const mesajli = v.kanal === "E-posta" || v.kanal === "WhatsApp";
  const hatalar: Record<string, string> = {};
  const listeler = [...HAZIR_LISTELER.map((l) => l.id as string), ...(await getOzelListeler()).map((l) => l.id)];
  if (!v.ad.trim()) hatalar.ad = "Kampanyanın adını yazın.";
  if (!KAMPANYA_KANALLARI.includes(v.kanal as KampanyaKanali)) hatalar.kanal = "Kanal seçin.";
  if (!KAMPANYA_DURUMLARI.includes(v.durum as KampanyaDurumu)) hatalar.durum = "Durum seçin.";
  if (!listeler.includes(v.listeId)) hatalar.listeId = "Hedef listeyi seçin.";
  if (!TARIH.test(v.baslangic)) hatalar.baslangic = "Başlangıç tarihini seçin.";
  if (v.bitis && (!TARIH.test(v.bitis) || v.bitis < v.baslangic)) hatalar.bitis = "Bitiş, başlangıçtan önce olamaz.";
  const mesaj = mesajli && v.mesaj ? { konu: v.mesaj.konu.trim().slice(0, 150), metin: v.mesaj.metin.trim().slice(0, 4000), sablon: v.mesaj.sablon.trim().slice(0, 100) } : undefined;
  const oto = mesajli && v.otomasyon && ["yok", "planli", "surekli"].includes(v.otomasyon.tur) ? v.otomasyon : { tur: "yok" as const, zaman: null };
  if (oto.tur !== "yok") {
    if (!mesaj?.metin) hatalar.metin = "Otomatik gönderim için mesajı yazın.";
    if (v.kanal === "E-posta" && !mesaj?.konu) hatalar.konu = "E-posta konusunu yazın.";
    if (v.durum !== "Aktif") hatalar.otomasyon = "Otomatik gönderim yalnızca Aktif kampanyada çalışır.";
  }
  if (oto.tur === "planli" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(oto.zaman ?? "")) hatalar.zaman = "Gönderim tarih ve saatini seçin.";
  if (Object.keys(hatalar).length) return { hatalar };
  const kampanya: Kampanya = {
    id: v.id && (await getKampanyalar()).some((k) => k.id === v.id) ? v.id : crypto.randomUUID(),
    ad: v.ad.trim().slice(0, 100), kanal: v.kanal, listeId: v.listeId, baslangic: v.baslangic, bitis: v.bitis || null,
    durum: v.durum, not: v.not.trim().slice(0, 200),
    mesaj, otomasyon: oto.tur === "planli" ? { tur: "planli", zaman: oto.zaman } : { tur: oto.tur, zaman: null },
  };
  await kampanyaKaydetDepo(kampanya);
  yenile();
  return { kampanya };
}

export type ListeSonucu = { liste?: OzelListe; hata?: string };

export async function listeKaydet(ad: string, filtre: ListeFiltresi): Promise<ListeSonucu> {
  if (!ad.trim()) return { hata: "Listeye bir ad verin." };
  const liste: OzelListe = {
    id: crypto.randomUUID(),
    ad: ad.trim().slice(0, 60),
    filtre: { segment: filtre.segment, plan: filtre.plan, ulke: filtre.ulke, izin: ["", "herhangi", ...IZIN_KANALLARI].includes(filtre.izin) ? filtre.izin : "" },
  };
  await ozelListeEkle(liste);
  yenile();
  return { liste };
}

export async function listeSil(id: string): Promise<{ hata?: string }> {
  if ((await getKampanyalar()).some((k) => k.listeId === id)) return { hata: "Bu liste bir kampanyada kullanılıyor; önce kampanyanın listesini değiştirin." };
  await ozelListeSil(id);
  yenile();
  return {};
}

/* ---------- İçe aktarma ---------- */

const AKTARIM_SINIRI = 5000;

/** CSV / Excel'den okunan kişileri yeni hedef liste olarak kaydeder. İzin beyanı tüm satırlara uygulanır. */
export async function listeIceAktar(v: {
  ad: string;
  kaynak: string; // dosya adı
  izinler: IzinKanali[];
  izinKaynagi: string;
  kisiler: AktarilanKisi[];
}): Promise<ListeSonucu & { hatalar?: Record<string, string> }> {
  const hatalar: Record<string, string> = {};
  if (!v.ad.trim()) hatalar.ad = "Listeye bir ad verin.";
  const izinler = v.izinler.filter((k) => (IZIN_KANALLARI as readonly string[]).includes(k));
  if (izinler.length && !(IZIN_KAYNAKLARI as readonly string[]).includes(v.izinKaynagi)) hatalar.izinKaynagi = "İznin nereden alındığını seçin.";
  const gorulen = new Set<string>();
  const kisiler: AktarilanKisi[] = [];
  for (const k of v.kisiler.slice(0, AKTARIM_SINIRI)) {
    const eposta = String(k.eposta ?? "").trim().toLocaleLowerCase("en");
    const telefon = String(k.telefon ?? "").trim();
    const anahtar = eposta || telefonRakam(telefon);
    if (!anahtar || gorulen.has(anahtar)) continue;
    if (eposta && !EPOSTA_GECERLI.test(eposta) && !telefon) continue;
    gorulen.add(anahtar);
    const temiz = (x: unknown, n: number) => String(x ?? "").trim().slice(0, n);
    kisiler.push({
      firma: temiz(k.firma, 120), kisi: temiz(k.kisi, 80), eposta: EPOSTA_GECERLI.test(eposta) ? eposta : "", telefon: temiz(telefon, 30), ulke: temiz(k.ulke, 60),
      kanallar: izinler,
    });
  }
  if (!kisiler.length) hatalar.kisiler = "E-posta ya da telefonu olan geçerli satır bulunamadı.";
  if (Object.keys(hatalar).length) return { hatalar };
  const liste: OzelListe = {
    id: crypto.randomUUID(),
    ad: v.ad.trim().slice(0, 60),
    filtre: { segment: "", plan: "", ulke: "", izin: "" },
    aktarim: { kaynak: v.kaynak.slice(0, 120), tarih: new Date().toISOString().slice(0, 10), izinKaynagi: izinler.length ? v.izinKaynagi : "", kisiler },
  };
  await ozelListeEkle(liste);
  yenile();
  return { liste };
}

/* ---------- Toplu gönderim ---------- */

async function tabanUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

async function kampanyaBul(id: string) {
  return (await getKampanyalar()).find((k) => k.id === id) ?? null;
}

export type KitleOnizleme = {
  hata?: string;
  gonderilecek?: number;
  toplam?: number;
  atlanan?: { neden: string; sayi: number }[];
  ornek?: { ad: string; kisi: string }[];
  demo?: boolean;
  saglayici?: string | null;
};

/** Gönder penceresi: kaç kişiye gidecek, kaçı neden atlanacak, gerçek mi demo mu */
export async function kitleOnizleme(kampanyaId: string): Promise<KitleOnizleme> {
  const k = await kampanyaBul(kampanyaId);
  const kanal = k && gonderimKanali(k);
  if (!k || !kanal) return { hata: "Bu kampanyadan toplu mesaj gönderilmez." };
  const kitle = await kampanyaKitlesi(k);
  if (!kitle) return { hata: "Liste bulunamadı." };
  const saglayici = saglayicilar()[kanal];
  return {
    gonderilecek: kitle.gonderilecek.length, toplam: kitle.toplam, atlanan: kitle.atlanan,
    ornek: kitle.gonderilecek.slice(0, 3).map((u) => ({ ad: u.ad, kisi: u.kisi })), demo: !saglayici, saglayici,
  };
}

export async function kampanyayiGonder(kampanyaId: string): Promise<GonderSonucu> {
  const k = await kampanyaBul(kampanyaId);
  if (!k) return { hata: "Kampanya bulunamadı." };
  if (k.durum === "Tamamlandı") return { hata: "Tamamlanan kampanyadan gönderim yapılmaz." };
  const s = await kampanyaGonder(k, "elle", await tabanUrl());
  if (s.gonderim && k.durum === "Taslak") await kampanyaKaydetDepo({ ...k, durum: "Aktif" });
  yenile();
  return s;
}

export async function denemeGonder(kampanyaId: string, kime: string): Promise<GonderSonucu> {
  const k = await kampanyaBul(kampanyaId);
  if (!k) return { hata: "Kampanya bulunamadı." };
  const kanal = gonderimKanali(k);
  const adres = kanal === "whatsapp" ? telefonRakam(kime) : kime.trim();
  if (!adres) return { hata: kanal === "whatsapp" ? "Telefon numarasını ülke koduyla yazın." : "E-posta adresini yazın." };
  const s = await testGonder(k, adres, await tabanUrl());
  yenile();
  return s;
}
