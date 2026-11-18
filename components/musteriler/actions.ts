"use server";
// Müşteriler: kaydetme, güncelleme ve silme (Server Actions)
import { oturumGerekli } from "@/lib/oturum";
import { revalidatePath } from "next/cache";
import {
  IZIN_KANALLARI, IZIN_KANAL_ADI, IZIN_KAYNAKLARI, musteriEkle, musteriyiGuncelle,
  type IzinKanali, type IzinKaydi, type Musteri, type Olay, type Plan, type Segment, type Yetkili,
} from "./queries";

/** Yerel tarih "2026-11-06" */
function bugunIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEGMENTLER: Segment[] = ["servis", "muhendislik", "egitim", "bayi"];
const PLANLAR: Plan[] = ["Lead", "Basic", "Pro", "Pro+"];

export type FormDurumu = { hatalar?: Record<string, string>; musteri?: Musteri };

export async function musteriKaydet(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  await oturumGerekli();
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
    yetkililer: [{ id: crypto.randomUUID(), ad: metin("yetkili") || ad, unvan: "", telefon, eposta, izinler: formIzinleri(form) }],
    vergiNo: metin("vergiNo"),
    acikTalep: 0,
    cihazlar: [],
    olaylar: [
      ...(notMetni ? [{ metin: notMetni, zaman: "Bugün · Not", tur: "not" as const }] : []),
      { metin: "Müşteri kaydı oluşturuldu", zaman: "Bugün", tur: "not" as const },
    ],
  };

  await musteriEkle(musteri);
  revalidatePath("/musteriler");

  return { musteri };
}

export type NotFormDurumu = { hata?: string; olay?: Olay; id?: string; zaman?: number };

/** Müşterinin zaman çizelgesine not ekler. */
export async function notEkle(_onceki: NotFormDurumu, form: FormData): Promise<NotFormDurumu> {
  await oturumGerekli();
  const id = String(form.get("musteriId") ?? "");
  const metin = String(form.get("not") ?? "").trim();
  if (!metin) return { hata: "Not boş olamaz." };
  if (metin.length > 2000) return { hata: "Not en fazla 2000 karakter olabilir." };

  const saat = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const olay: Olay = { metin, zaman: `Bugün ${saat} · Not`, tur: "not" };
  const m = await musteriyiGuncelle(id, (x) => {
    x.olaylar.unshift(olay);
    x.sonTemas = "Bugün";
  });
  if (!m) return { hata: "Müşteri bulunamadı." };

  musteriSayfalariniYenile(id);
  return { olay, id, zaman: Date.now() };
}

/** Müşteri bilgisinin göründüğü tüm sayfalar (müşteri penceresi destek, bayi, cihaz ve satış hattında da açılır) */
function musteriSayfalariniYenile(id: string) {
  for (const yol of ["/musteriler", `/musteriler/${id}`, "/destek", "/bayiler", "/cihaz-lisans", "/satis-hatti"]) revalidatePath(yol);
}

/* ---------- Yetkililer ---------- */

export type YetkiliFormDurumu = { hatalar?: Record<string, string>; yetkililer?: Yetkili[]; zaman?: number };

/** Yeni yetkili ekler; formda yetkiliId varsa o kişiyi günceller. */
export async function yetkiliKaydet(_onceki: YetkiliFormDurumu, form: FormData): Promise<YetkiliFormDurumu> {
  await oturumGerekli();
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const musteriId = metin("musteriId");
  const yetkiliId = metin("yetkiliId");
  const kisi: Yetkili = {
    id: yetkiliId || crypto.randomUUID(),
    izinler: {},
    ad: metin("ad"),
    unvan: metin("unvan"),
    telefon: metin("telefon"),
    eposta: metin("eposta"),
  };

  const hatalar: Record<string, string> = {};
  if (!kisi.ad) hatalar.ad = "Ad soyad zorunlu.";
  if (!kisi.telefon && !kisi.eposta) hatalar.telefon = "Telefon veya e-postadan en az biri gerekli.";
  if (kisi.telefon && kisi.telefon.replace(/\D/g, "").length < 7) hatalar.telefon = "Geçerli bir telefon girin.";
  if (kisi.eposta && !/^\S+@\S+\.\S+$/.test(kisi.eposta)) hatalar.eposta = "Geçerli bir e-posta girin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const m = await musteriyiGuncelle(musteriId, (x) => {
    const i = x.yetkililer.findIndex((y) => y.id === kisi.id);
    if (i >= 0) x.yetkililer[i] = { ...kisi, izinler: x.yetkililer[i].izinler ?? {} }; // izin kayıtları bilgi düzenlenirken korunur
    else x.yetkililer.push(kisi);
  });
  if (!m) return { hatalar: { ad: "Müşteri bulunamadı." } };

  musteriSayfalariniYenile(musteriId);
  return { yetkililer: [...m.yetkililer], zaman: Date.now() };
}

export async function yetkiliSil(musteriId: string, yetkiliId: string): Promise<Yetkili[]> {
  await oturumGerekli();
  const m = await musteriyiGuncelle(musteriId, (x) => {
    x.yetkililer = x.yetkililer.filter((y) => y.id !== yetkiliId);
  });
  musteriSayfalariniYenile(musteriId);
  return m ? [...m.yetkililer] : [];
}

/** Seçilen yetkiliyi listenin başına alır: Ara / WhatsApp / E-posta düğmeleri onu kullanır. */
export async function birincilYap(musteriId: string, yetkiliId: string): Promise<Yetkili[]> {
  await oturumGerekli();
  const m = await musteriyiGuncelle(musteriId, (x) => {
    const kisi = x.yetkililer.find((y) => y.id === yetkiliId);
    if (kisi) x.yetkililer = [kisi, ...x.yetkililer.filter((y) => y.id !== yetkiliId)];
  });
  // Sıra musteri_yetkilileri.y_sira'ya yazılır (0 = birincil)
  musteriSayfalariniYenile(musteriId);
  return m ? [...m.yetkililer] : [];
}

/* ---------- Vergi no ---------- */

export type VergiNoDurumu = { hata?: string; vergiNo?: string; zaman?: number };

export async function vergiNoKaydet(_onceki: VergiNoDurumu, form: FormData): Promise<VergiNoDurumu> {
  await oturumGerekli();
  const musteriId = String(form.get("musteriId") ?? "");
  const vergiNo = String(form.get("vergiNo") ?? "").trim().replace(/\s+/g, " ");
  if (!vergiNo) return { hata: "Vergi numarasını girin." };
  if (vergiNo.replace(/[^\p{L}\p{N}]/gu, "").length < 8 || vergiNo.length > 30) return { hata: "Geçerli bir vergi numarası girin." };

  const m = await musteriyiGuncelle(musteriId, (x) => {
    x.vergiNo = vergiNo;
  });
  if (!m) return { hata: "Müşteri bulunamadı." };
  musteriSayfalariniYenile(musteriId);
  return { vergiNo, zaman: Date.now() };
}

/* ---------- İletişim izinleri ---------- */

/** Yeni müşteri formundaki izin kutuları: izin_eposta, izin_whatsapp… + izinKaynagi */
function formIzinleri(form: FormData): Partial<Record<IzinKanali, IzinKaydi>> {
  const kaynak = String(form.get("izinKaynagi") ?? "") || "Müşteri formu";
  const tarih = bugunIso();
  return Object.fromEntries(
    IZIN_KANALLARI.filter((k) => form.get(`izin_${k}`) === "on").map((k) => [k, { verildi: true, tarih, kaynak, cekilme: null }]),
  );
}

export type IzinSonucu = { yetkililer?: Yetkili[]; hata?: string };

/** Yetkilinin kanal izinlerini günceller. Yeni verilen izne bugünün tarihi ve kaynak yazılır;
 *  kaldırılan izin silinmez, geri çekilme tarihiyle saklanır. Değişiklik müşteri geçmişine işlenir. */
export async function izinleriKaydet(musteriId: string, yetkiliId: string, secim: Record<IzinKanali, boolean>, kaynak: string): Promise<IzinSonucu> {
  await oturumGerekli();
  const tarih = bugunIso();
  const verilen: string[] = [];
  const cekilen: string[] = [];
  let hata: string | undefined;
  const m = await musteriyiGuncelle(musteriId, (x) => {
    const y = x.yetkililer.find((k) => k.id === yetkiliId);
    if (!y) return;
    const izinler = { ...(y.izinler ?? {}) };
    for (const kanal of IZIN_KANALLARI) {
      const eski = izinler[kanal];
      if (secim[kanal] && !eski?.verildi) {
        if (!(IZIN_KAYNAKLARI as readonly string[]).includes(kaynak)) {
          hata = "İznin nereden alındığını seçin.";
          return;
        }
        izinler[kanal] = { verildi: true, tarih, kaynak, cekilme: null };
        verilen.push(IZIN_KANAL_ADI[kanal]);
      } else if (!secim[kanal] && eski?.verildi) {
        izinler[kanal] = { ...eski, verildi: false, cekilme: tarih };
        cekilen.push(IZIN_KANAL_ADI[kanal]);
      }
    }
    if (hata) return;
    y.izinler = izinler;
    const parca = [verilen.length && `${verilen.join(", ")} izni verildi (${kaynak})`, cekilen.length && `${cekilen.join(", ")} izni geri çekildi`].filter(Boolean);
    if (parca.length) x.olaylar.unshift({ metin: `${y.ad}: ${parca.join("; ")}`, zaman: "Bugün · İletişim izni", tur: "not" });
  });
  if (hata) return { hata };
  if (!m) return { hata: "Müşteri bulunamadı." };
  // İzinler iletisim_izinleri'ne yazılır (musteriyiGuncelle). TODO: İYS'ye bildirim.
  musteriSayfalariniYenile(musteriId);
  revalidatePath("/pazarlama");
  return { yetkililer: structuredClone(m.yetkililer) };
}
