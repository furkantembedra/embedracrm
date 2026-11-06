"use server";
// Aktif bayi hareketleri (Server Actions): bayiye cihaz sevki, bayinin bildirdiği satış, bayinin sattığı lisans.
// Lisans modeli: bayi lisansı Embedra'dan alıp müşterisine satar; satışları bayi bildirir.
import { revalidatePath } from "next/cache";
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";
import { cihazEkleDepo, cihaziGuncelle, getCihaz, type Cihaz, type LisansPlani } from "@/components/cihaz-lisans/queries";
import { ayEkle, lisansUygula } from "@/components/cihaz-lisans/ortak";
import { getMusteri, musteriEkle, musteriyiGuncelle, type Musteri } from "@/components/musteriler/queries";
import { ULKELER, aktifBayiyiGuncelle, getAktifBayiler, getBayiHareketleri, hareketEkle, type BayiHareketi } from "./queries";

const SERI_NO = /^EO1-\d{4}-\d{4}$/;
const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const PLANLAR: LisansPlani[] = ["Basic", "Pro", "Pro+"];
const SURELER = [12, 24, 36];

export type HareketDurumu = { hatalar?: Record<string, string>; hareket?: BayiHareketi; cihazlar?: Cihaz[]; musteri?: Musteri; zaman?: number };

const metinAl = (form: FormData) => (ad: string) => String(form.get(ad) ?? "").trim();
/** Satır, virgül veya boşlukla ayrılmış seri numaraları */
const seriListesi = (metin: string) => [...new Set(metin.toUpperCase().split(/[\s,;]+/).filter(Boolean))];

function yenile() {
  for (const yol of ["/bayiler", "/bayiler/raporlama", "/cihaz-lisans", "/musteriler", "/genel-bakis"]) revalidatePath(yol);
}

async function bayiBul(id: string) {
  return (await getAktifBayiler()).find((b) => b.id === id) ?? null;
}

/** Embedra'dan bayiye cihaz sevki: stok ve MOQ'nun gerçekleşen kısmı artar. */
export async function cihazSevkEt(_o: HareketDurumu, form: FormData): Promise<HareketDurumu> {
  const metin = metinAl(form);
  const bayi = await bayiBul(metin("bayiId"));
  const tarih = metin("tarih");
  const model = metin("model") as CihazModeli;
  const seriler = seriListesi(metin("seriler"));
  const adet = seriler.length || Number(metin("adet"));

  const hatalar: Record<string, string> = {};
  if (!bayi) hatalar.genel = "Bayi bulunamadı.";
  if (!TARIH.test(tarih)) hatalar.tarih = "Tarih girin.";
  if (!CIHAZ_MODELLERI.includes(model)) hatalar.model = "Model seçin.";
  const hatali = seriler.filter((s) => !SERI_NO.test(s));
  if (hatali.length) hatalar.seriler = `Seri no EO1-YYAA-NNNN biçiminde olmalı: ${hatali.slice(0, 3).join(", ")}`;
  else {
    const kayitli = [];
    for (const s of seriler) if (await getCihaz(s)) kayitli.push(s);
    if (kayitli.length) hatalar.seriler = `Bu seri no zaten kayıtlı: ${kayitli.slice(0, 3).join(", ")}`;
  }
  if (!seriler.length && (!Number.isInteger(adet) || adet < 1 || adet > 500)) hatalar.adet = "Seri no girin veya 1–500 arası adet yazın.";
  if (Object.keys(hatalar).length || !bayi) return { hatalar };

  const cihazlar: Cihaz[] = [];
  for (const seriNo of seriler) {
    const c: Cihaz = {
      seriNo, model, musteriId: null, musteri: bayi.ad, stogaGiris: tarih, ulke: ULKELER[bayi.ulkeKodu] ?? bayi.ulkeKodu,
      plan: "Basic", lisansBaslangic: null, lisansBitis: null, firmware: "—", durum: "lisanssiz", gecmis: [], bayiId: bayi.id,
    };
    await cihazEkleDepo(c);
    cihazlar.push(c);
  }
  const hareket: BayiHareketi = {
    id: crypto.randomUUID(), bayiId: bayi.id, tur: "sevkiyat", tarih,
    kalemler: seriler.length ? seriler.map((seriNo) => ({ model, seriNo })) : Array.from({ length: adet }, () => ({ model, seriNo: null })),
    not: metin("not") || undefined,
  };
  await hareketEkle(hareket);
  await aktifBayiyiGuncelle(bayi.id, (b) => {
    b.stok += adet;
    b.moqGerceklesen += adet;
  });
  // TODO: Supabase: insert into dealer_movements (+ devices with owner_dealer_id)
  yenile();
  return { hareket, cihazlar, zaman: Date.now() };
}

/** Bayinin bildirdiği müşteriye satış: cihaz müşteriye geçer, stok düşer. Müşteri yoksa oluşturulur. */
export async function satisBildir(_o: HareketDurumu, form: FormData): Promise<HareketDurumu> {
  const metin = metinAl(form);
  const bayi = await bayiBul(metin("bayiId"));
  const tarih = metin("tarih");
  const model = metin("model") as CihazModeli;
  const stoktan = form.getAll("stokSeri").map(String);
  const yeniSeriler = seriListesi(metin("seriler"));
  const seriler = [...new Set([...stoktan, ...yeniSeriler])];
  const musteriSecim = metin("musteri");
  const yeniMusteriAdi = metin("yeniMusteri");

  const hatalar: Record<string, string> = {};
  if (!bayi) return { hatalar: { genel: "Bayi bulunamadı." } };
  if (!TARIH.test(tarih)) hatalar.tarih = "Tarih girin.";
  if (!CIHAZ_MODELLERI.includes(model)) hatalar.model = "Model seçin.";
  if (!seriler.length) hatalar.seriler = "Satılan cihazları seçin veya seri numarasını yazın.";
  const hatali = yeniSeriler.filter((s) => !SERI_NO.test(s));
  if (hatali.length) hatalar.seriler = `Seri no EO1-YYAA-NNNN biçiminde olmalı: ${hatali.slice(0, 3).join(", ")}`;
  if (!musteriSecim) hatalar.musteri = "Müşteri seçin.";
  if (musteriSecim === "yeni" && !yeniMusteriAdi) hatalar.yeniMusteri = "Müşteri adını girin.";

  // Stok kontrolü (modele göre). Seri numarası stokta bilinen cihazlar zaten sayılır.
  const hareketler = await getBayiHareketleri();
  const kendi = hareketler.filter((h) => h.bayiId === bayi.id);
  const sevk = kendi.filter((h) => h.tur === "sevkiyat").flatMap((h) => h.kalemler).filter((k) => k.model === model).length;
  const satilan = kendi.filter((h) => h.tur === "satis").flatMap((h) => h.kalemler).filter((k) => k.model === model).length;
  if (!hatalar.seriler && seriler.length > sevk - satilan) {
    hatalar.seriler = `Bayinin stoğunda ${Math.max(0, sevk - satilan)} adet ${model === "ONE" ? "ONE" : "ONE LITE"} var; önce sevkiyat girin.`;
  }
  const dahaOnceSatilan = new Set(kendi.filter((h) => h.tur === "satis").flatMap((h) => h.kalemler.map((k) => k.seriNo)));
  const tekrar = seriler.filter((s) => dahaOnceSatilan.has(s));
  if (tekrar.length) hatalar.seriler = `Bu cihaz zaten satılmış: ${tekrar.slice(0, 3).join(", ")}`;
  if (Object.keys(hatalar).length) return { hatalar };

  // Müşteri
  let musteri: Musteri | null = null;
  let yeni = false;
  const olay = { metin: `${bayi.ad} üzerinden ${seriler.length} cihaz satıldı`, zaman: `${tarih.split("-").reverse().join(".")} · Bayi`, tur: "siparis" as const };
  if (musteriSecim === "yeni") {
    musteri = {
      id: crypto.randomUUID(), ad: yeniMusteriAdi, sehir: "—", ulke: ULKELER[bayi.ulkeKodu] ?? bayi.ulkeKodu, segment: "servis", plan: "Basic",
      lisansBitis: null, toplamDeger: null, sonTemas: "Bugün", durum: "Yeni müşteri", yetkililer: [], vergiNo: "", acikTalep: 0, cihazlar: [],
      olaylar: [olay, { metin: `Bayi müşterisi · ${bayi.ad}`, zaman: "Bugün", tur: "not" }],
    };
    await musteriEkle(musteri);
    yeni = true;
  } else {
    musteri = await musteriyiGuncelle(musteriSecim, (m) => m.olaylar.unshift(olay));
    if (!musteri) return { hatalar: { musteri: "Müşteri bulunamadı." } };
  }

  // Cihazlar: kayıtlıysa müşteriye devret, değilse oluştur
  const cihazlar: Cihaz[] = [];
  for (const seriNo of seriler) {
    const sahip = { musteriId: musteri.id, musteri: musteri.ad, ulke: musteri.ulke, bayiId: bayi.id };
    const guncel = await cihaziGuncelle(seriNo, (c) => ({ ...c, ...sahip }));
    if (guncel) cihazlar.push(guncel);
    else {
      const c: Cihaz = { seriNo, model, ...sahip, plan: "Basic", lisansBaslangic: null, lisansBitis: null, firmware: "—", durum: "lisanssiz", gecmis: [] };
      await cihazEkleDepo(c);
      cihazlar.push(c);
    }
  }

  const hareket: BayiHareketi = {
    id: crypto.randomUUID(), bayiId: bayi.id, tur: "satis", tarih,
    kalemler: cihazlar.map((c) => ({ model: c.model, seriNo: c.seriNo })),
    musteri: { id: musteri.id, ad: musteri.ad },
    not: metin("not") || undefined,
  };
  await hareketEkle(hareket);
  await aktifBayiyiGuncelle(bayi.id, (b) => {
    b.stok -= seriler.length;
    b.satilan += seriler.length;
  });
  yenile();
  return { hareket, cihazlar, musteri: yeni ? musteri : undefined, zaman: Date.now() };
}

/** Bayinin müşterisine sattığı lisans: cihaza lisans tanımlanır ve hareket olarak kaydedilir. */
export async function lisansSat(_o: HareketDurumu, form: FormData): Promise<HareketDurumu> {
  const metin = metinAl(form);
  const bayi = await bayiBul(metin("bayiId"));
  const seriNo = metin("seriNo");
  const plan = metin("plan") as LisansPlani;
  const sure = Number(metin("sure"));
  const baslangic = metin("baslangic");

  const hatalar: Record<string, string> = {};
  if (!bayi) return { hatalar: { genel: "Bayi bulunamadı." } };
  const cihaz = seriNo ? await getCihaz(seriNo) : null;
  if (!cihaz || cihaz.bayiId !== bayi.id || !cihaz.musteriId) hatalar.seriNo = "Bayinin müşterisine sattığı bir cihaz seçin.";
  if (!PLANLAR.includes(plan)) hatalar.plan = "Plan seçin.";
  if (!SURELER.includes(sure)) hatalar.sure = "Süre seçin.";
  if (!TARIH.test(baslangic)) hatalar.baslangic = "Başlangıç tarihi girin.";
  if (Object.keys(hatalar).length || !cihaz) return { hatalar };

  const lisans = { seriNo, plan, baslangic, bitis: ayEkle(baslangic, sure) };
  const guncel = await cihaziGuncelle(seriNo, (c) => lisansUygula(c, lisans));
  if (!guncel) return { hatalar: { seriNo: "Cihaz bulunamadı." } };
  if (cihaz.musteriId) {
    const m = await getMusteri(cihaz.musteriId);
    if (m) await musteriyiGuncelle(m.id, (x) => x.olaylar.unshift({ metin: `${plan} lisansı (${sure} ay) · ${bayi.ad} üzerinden`, zaman: "Bugün · Bayi", tur: "siparis" }));
  }
  const hareket: BayiHareketi = {
    id: crypto.randomUUID(), bayiId: bayi.id, tur: "lisans", tarih: baslangic,
    kalemler: [{ model: cihaz.model, seriNo }], musteri: { id: cihaz.musteriId, ad: cihaz.musteri }, plan, sureAy: sure,
  };
  await hareketEkle(hareket);
  yenile();
  return { hareket, cihazlar: [guncel], zaman: Date.now() };
}
