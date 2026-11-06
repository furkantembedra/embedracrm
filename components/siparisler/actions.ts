"use server";
// Sipariş & Sevkiyat: kaydetme ve adım güncellemeleri (Server Actions).
// Seri no atanınca cihazlar Cihaz & Lisans'a eklenir; kargoya verilince depo stoğu düşer;
// lisans teslim edilince lisans cihazlara işlenir; bayi siparişi bayi hareketlerine sevkiyat olarak yazılır.
import { revalidatePath } from "next/cache";
import { CIHAZ_MODELLERI, LISANS_PAKETLERI, type CihazModeli } from "@/lib/urunler";
import { getFiyatListesi, getKargoFirmalari, havuzdanCikar } from "@/components/operasyon/queries";
import { cihazEkleDepo, cihaziGuncelle, getCihaz, type Cihaz, type LisansPlani } from "@/components/cihaz-lisans/queries";
import { ayEkle, lisansUygula } from "@/components/cihaz-lisans/ortak";
import { getMusteri, musteriEkle, musteriyiGuncelle, type Musteri, type Olay } from "@/components/musteriler/queries";
import { hareketEkle } from "@/components/bayiler/queries";
import { urunTutari, type LisansSecenegi } from "@/components/satis-hatti/urun-secimi";
import {
  CIHAZ_STOK_KODU, IADE_ADIMLARI, IADE_NEDENLERI, KUTU_ICERIGI, ODEME_YONTEMLERI,
  getSiparis, getSiparisler, getStok, iadeEkle, iadeyiGuncelle, siparisEkle, siparisiGuncelle, sonrakiIadeNo, sonrakiSiparisNo, stokGuncelle, stokKalemiEkle,
  type Iade, type IadeTuru, type Kalem, type OdemeYontemi, type Siparis, type StokKalemi,
} from "./queries";
import { SERI_NO, cihazAdedi, dijital, iadeSecenekleri, icerikOzeti, lisansVar, seriListesi, seriTamam } from "./ortak";

/** Yerel saatle "2026-11-06T11:24" */
function simdi() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const bugun = () => simdi().slice(0, 10);

function yenile(id?: string) {
  for (const yol of ["/siparisler", "/cihaz-lisans", "/musteriler", "/bayiler", "/genel-bakis"]) revalidatePath(yol);
  if (id) revalidatePath(`/siparisler/${id}`);
}

async function musteriOlayi(s: Siparis, metin: string) {
  if (!s.musteriId) return;
  const olay: Olay = { metin, zaman: "Bugün · Sipariş", tur: "siparis" };
  await musteriyiGuncelle(s.musteriId, (m) => {
    m.olaylar.unshift(olay);
    m.sonTemas = "Bugün";
  });
}

export type IslemSonucu = { siparis?: Siparis; stok?: StokKalemi[]; hata?: string };

/** Bir siparişi değiştirip sistem notu ekler */
async function guncelle(id: string, notMetni: string, f: (s: Siparis) => void): Promise<IslemSonucu> {
  const s = await siparisiGuncelle(id, (x) => {
    f(x);
    x.notlar.push({ metin: notMetni, zaman: simdi(), sistem: true });
  });
  if (!s) return { hata: "Sipariş bulunamadı." };
  yenile(id);
  return { siparis: structuredClone(s), stok: structuredClone(await getStok()) };
}

/* ---------- Manuel sipariş ---------- */

export type SiparisFormDurumu = { hatalar?: Record<string, string>; siparis?: Siparis; zaman?: number };

export async function siparisKaydet(_onceki: SiparisFormDurumu, form: FormData): Promise<SiparisFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const sayi = (ad: string) => {
    const n = parseInt(metin(ad), 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const hatalar: Record<string, string> = {};

  // Müşteri: kayıtlı ya da yeni
  const musteriId = metin("musteriId");
  let musteri: Musteri | null = musteriId && musteriId !== "yeni" ? await getMusteri(musteriId) : null;
  const yeniAd = metin("yeniMusteri");
  const ulke = metin("ulke") || musteri?.ulke || "Türkiye";
  if (!musteriId) hatalar.musteriId = "Müşteri seçin.";
  else if (musteriId === "yeni" && !yeniAd) hatalar.yeniMusteri = "Müşterinin adını yazın.";
  else if (musteriId !== "yeni" && !musteri) hatalar.musteriId = "Müşteri bulunamadı.";
  const adres = metin("adres");

  // Ürünler
  const model = metin("model") as CihazModeli;
  const cihazAdet = CIHAZ_MODELLERI.includes(model) ? sayi("adet") : 0;
  const paket = metin("lisans") as LisansSecenegi;
  const lisansVarMi = paket in LISANS_PAKETLERI;
  const lisansAdet = lisansVarMi ? sayi("lisansAdet") || 1 : 0;
  const ozelFiyat = Number(metin("ozelFiyat").replace(/\./g, "")) || 0;
  const stok = await getStok();
  const aksesuarlar = stok
    .filter((k) => k.fiyat !== null)
    .map((k) => ({ k, adet: sayi(`aks_${k.kod}`) }))
    .filter((x) => x.adet > 0);
  const lisansSeriler = form.getAll("lisansSeri").map(String);

  const kalemler: Kalem[] = [];
  if (cihazAdet) kalemler.push({ tur: "cihaz", model, adet: cihazAdet });
  if (lisansVarMi) kalemler.push({ tur: "lisans", paket, adet: lisansAdet, sureAy: 12 });
  for (const a of aksesuarlar) kalemler.push({ tur: "aksesuar", stokKodu: a.k.kod, adet: a.adet });
  if (!kalemler.length) hatalar.urun = "En az bir cihaz, lisans ya da aksesuar ekleyin.";
  const fiyatListesi = await getFiyatListesi();
  if (lisansVarMi && fiyatListesi.lisans[paket].fiyat === null && !ozelFiyat) hatalar.ozelFiyat = `${paket} için lisans ücretini girin.`;
  if (!adres && cihazAdet + aksesuarlar.length > 0) hatalar.adres = "Teslimat adresini yazın.";

  const odeme = metin("odeme") as OdemeYontemi;
  if (!ODEME_YONTEMLERI.includes(odeme)) hatalar.odeme = "Ödeme yöntemini seçin.";
  if (Object.keys(hatalar).length) return { hatalar };

  if (!musteri) {
    musteri = {
      id: crypto.randomUUID(), ad: yeniAd, sehir: adres.split(",").at(-1)?.trim() || "—", ulke, segment: "servis",
      plan: lisansVarMi && paket in { Basic: 1, Pro: 1, "Pro+": 1 } ? (paket as "Basic" | "Pro" | "Pro+") : "Lead",
      lisansBitis: null, toplamDeger: 0, sonTemas: "Bugün", durum: "Yeni müşteri", yetkililer: [], vergiNo: "", acikTalep: 0, cihazlar: [],
      olaylar: [{ metin: "Manuel siparişle müşteri olarak eklendi", zaman: "Bugün", tur: "not" }],
    };
    await musteriEkle(musteri);
  }

  const tutar =
    urunTutari({ model: cihazAdet ? model : null, adet: cihazAdet, lisans: lisansVarMi ? paket : null, lisansAdet }, ozelFiyat, fiyatListesi).tutar +
    aksesuarlar.reduce((t, a) => t + a.adet * (a.k.fiyat ?? 0), 0);
  const zaman = simdi();
  const odendi = form.get("odendi") === "on";
  const siparis: Siparis = {
    id: await sonrakiSiparisNo(),
    tarih: zaman,
    musteriId: musteri.id,
    musteri: musteri.ad,
    ulke: musteri.ulke,
    adres: adres || "Dijital teslimat",
    kalemler,
    tutar,
    paraBirimi: "TRY",
    odeme,
    durum: odendi ? "hazirlaniyor" : "odeme",
    // Yalnızca lisans: hangi cihazlara uygulanacağı baştan bellidir
    seriNolar: !cihazAdet ? lisansSeriler.filter((s) => musteri.cihazlar.some((c) => c.seriNo === s)) : [],
    kargo: null,
    teslimTarihi: null,
    faturaNo: null,
    lisansBaslangic: null,
    notlar: [{ metin: `Manuel sipariş açıldı (${odeme})${odendi ? ", ödeme alındı" : ", ödeme bekleniyor"}.`, zaman, sistem: true }],
  };
  const not = metin("not");
  if (not) siparis.notlar.push({ metin: not, zaman });
  await siparisEkle(siparis);
  await musteriyiGuncelle(musteri.id, (m) => {
    m.toplamDeger = (m.toplamDeger ?? 0) + tutar;
  });
  await musteriOlayi(siparis, `Sipariş #${siparis.id} · ${icerikOzeti(siparis, stok)}`);
  yenile();
  return { siparis: structuredClone(siparis), zaman: Date.now() };
}

/* ---------- Adımlar ---------- */

export async function odemeAlindi(id: string): Promise<IslemSonucu> {
  const s = await getSiparis(id);
  if (s?.durum !== "odeme") return { hata: "Bu sipariş ödeme beklemiyor." };
  return guncelle(id, "Ödeme alındı, hazırlığa geçti.", (x) => {
    x.durum = "hazirlaniyor";
  });
}

export async function seriAta(id: string, metin: string): Promise<IslemSonucu> {
  const s = await getSiparis(id);
  if (!s || s.durum !== "hazirlaniyor") return { hata: "Seri no yalnızca hazırlanan siparişe atanır." };
  const gerekli = cihazAdedi(s) - s.seriNolar.length;
  const seriler = seriListesi(metin);
  if (!seriler.length) return { hata: "Seri numaralarını yazın." };
  const hatali = seriler.filter((x) => !SERI_NO.test(x));
  if (hatali.length) return { hata: `Seri no EO1-YYAA-NNNN biçiminde olmalı: ${hatali.slice(0, 3).join(", ")}` };
  if (seriler.length > gerekli) return { hata: `Bu siparişe ${gerekli} seri no daha atanabilir, ${seriler.length} yazıldı.` };
  const kullanilan = new Set((await getSiparisler()).flatMap((x) => x.seriNolar));
  const cakisan: string[] = [];
  for (const x of seriler) if (kullanilan.has(x) || (await getCihaz(x))) cakisan.push(x);
  if (cakisan.length) return { hata: `Bu seri no zaten kayıtlı: ${cakisan.slice(0, 3).join(", ")}` };

  // Seriler kalem sırasıyla modellere dağıtılır (önce ONE'lar, sonra ONE Lite'lar)
  const modeller = s.kalemler.flatMap((k) => (k.tur === "cihaz" ? Array<CihazModeli>(k.adet).fill(k.model) : []));
  const lisans = s.kalemler.find((k) => k.tur === "lisans");
  const plan = (lisans && lisans.tur === "lisans" && ["Basic", "Pro", "Pro+"].includes(lisans.paket) ? lisans.paket : "Pro+") as LisansPlani;
  for (const [i, seriNo] of seriler.entries()) {
    const cihaz: Cihaz = {
      seriNo,
      model: modeller[s.seriNolar.length + i] ?? "ONE",
      musteriId: s.bayiId ? null : s.musteriId,
      musteri: s.musteri,
      ulke: s.ulke,
      plan,
      lisansBaslangic: null,
      lisansBitis: null,
      firmware: "—",
      durum: "lisanssiz",
      gecmis: [],
      bayiId: s.bayiId ?? null,
      stogaGiris: s.bayiId ? bugun() : null,
    };
    await cihazEkleDepo(cihaz);
  }
  await havuzdanCikar(seriler); // üretimden gelen seri no'lar artık bu siparişin
  revalidatePath("/operasyon");
  return guncelle(id, `Seri no atandı: ${seriler.join(", ")}`, (x) => {
    x.seriNolar.push(...seriler);
  });
}

export async function kargoyaVer(id: string, firma: string, takipNo: string): Promise<IslemSonucu> {
  const s = await getSiparis(id);
  if (!s || s.durum !== "hazirlaniyor" || dijital(s)) return { hata: "Bu sipariş kargoya verilemez." };
  if (!seriTamam(s)) return { hata: "Önce tüm cihazlara seri no atayın." };
  if (!(await getKargoFirmalari()).includes(firma)) return { hata: "Kargo firmasını seçin." };
  if (!takipNo.trim()) return { hata: "Takip numarasını yazın." };

  // Stoktan düşülecekler: cihazlar, her cihaz kutusundaki kablolar ve aksesuarlar
  const dus = new Map<string, number>();
  const ekle = (kod: string, n: number) => dus.set(kod, (dus.get(kod) ?? 0) + n);
  for (const k of s.kalemler) {
    if (k.tur === "cihaz") {
      ekle(CIHAZ_STOK_KODU[k.model], k.adet);
      for (const kod of KUTU_ICERIGI) ekle(kod, k.adet);
    }
    if (k.tur === "aksesuar") ekle(k.stokKodu, k.adet);
  }
  const stok = await getStok();
  const eksik = [...dus].filter(([kod, n]) => (stok.find((x) => x.kod === kod)?.adet ?? 0) < n);
  if (eksik.length) {
    return { hata: `Depoda yeterli stok yok: ${eksik.map(([kod, n]) => `${stok.find((x) => x.kod === kod)?.ad ?? kod} (${n} gerekli)`).join(", ")}` };
  }
  for (const [kod, n] of dus) await stokGuncelle(kod, -n);

  // Bayi siparişi: bayinin stok hareketlerine sevkiyat olarak yazılır
  if (s.bayiId) {
    const modeller = s.kalemler.flatMap((k) => (k.tur === "cihaz" ? Array<CihazModeli>(k.adet).fill(k.model) : []));
    await hareketEkle({
      id: crypto.randomUUID(), bayiId: s.bayiId, tur: "sevkiyat", tarih: bugun(),
      kalemler: s.seriNolar.map((seriNo, i) => ({ model: modeller[i] ?? "ONE", seriNo })), not: `Sipariş #${s.id}`,
    });
  }
  return guncelle(id, `${firma} ile kargoya verildi · takip no ${takipNo.trim()}`, (x) => {
    x.durum = "kargoda";
    x.kargo = { firma, takipNo: takipNo.trim() };
  });
}

export async function teslimEdildi(id: string, tarih: string): Promise<IslemSonucu> {
  const s = await getSiparis(id);
  if (s?.durum !== "kargoda") return { hata: "Sipariş kargoda değil." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { hata: "Teslim tarihini seçin." };
  return guncelle(id, `Teslim edildi (${tarih.split("-").reverse().join(".")}).`, (x) => {
    x.durum = "teslim";
    x.teslimTarihi = tarih;
  });
}

export async function lisansTeslim(id: string, baslangic: string): Promise<IslemSonucu> {
  const s = await getSiparis(id);
  const uygun = s && lisansVar(s) && (s.durum === "teslim" || (s.durum === "hazirlaniyor" && dijital(s)));
  if (!s || !uygun) return { hata: "Bu siparişte teslim edilecek lisans yok." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baslangic)) return { hata: "Lisans başlangıç tarihini seçin." };
  const l = s.kalemler.find((k) => k.tur === "lisans");
  if (!l || l.tur !== "lisans") return { hata: "Lisans kalemi bulunamadı." };
  const plan = (["Basic", "Pro", "Pro+"].includes(l.paket) ? l.paket : "Pro+") as LisansPlani;
  const bitis = ayEkle(baslangic, l.sureAy);

  // Lisans, siparişin cihazlarına işlenir (bayi siparişinde lisansı bayi aktive eder)
  if (!s.bayiId) {
    for (const seriNo of s.seriNolar) {
      if (!(await getCihaz(seriNo))) {
        await cihazEkleDepo({
          seriNo, model: "ONE", musteriId: s.musteriId, musteri: s.musteri, ulke: s.ulke, plan, lisansBaslangic: null, lisansBitis: null,
          firmware: "—", durum: "lisanssiz", gecmis: [],
        });
      }
      await cihaziGuncelle(seriNo, (c) => lisansUygula(c, { seriNo, plan, baslangic, bitis }));
    }
    if (s.musteriId) {
      await musteriyiGuncelle(s.musteriId, (m) => {
        if (m.plan === "Lead" || !m.lisansBitis || m.lisansBitis < bitis) m.lisansBitis = bitis;
        if (m.plan === "Lead" || ["Basic", "Pro", "Pro+"].includes(plan)) m.plan = plan;
      });
    }
  }
  await musteriOlayi(s, `Lisans teslim edildi · ${l.paket}, ${baslangic.split("-").reverse().join(".")} başlangıçlı`);
  const kapsam = s.seriNolar.length ? ` (${s.seriNolar.join(", ")})` : "";
  return guncelle(id, `${l.paket} lisans anahtarı müşteriye iletildi${kapsam}. Sipariş tamamlandı.`, (x) => {
    x.lisansBaslangic = baslangic;
    x.durum = "tamamlandi";
    if (!x.teslimTarihi) x.teslimTarihi = baslangic;
  });
}

export async function siparisiTamamla(id: string): Promise<IslemSonucu> {
  const s = await getSiparis(id);
  if (s?.durum !== "teslim") return { hata: "Yalnızca teslim edilen sipariş tamamlanır." };
  await musteriOlayi(s, `Sipariş #${s.id} tamamlandı`);
  return guncelle(id, "Sipariş tamamlandı.", (x) => {
    x.durum = "tamamlandi";
  });
}

export async function faturaKes(id: string, no: string): Promise<IslemSonucu> {
  const temiz = no.trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,20}$/.test(temiz)) return { hata: "Fatura numarasını yazın (ör. EMB2026000432)." };
  return guncelle(id, `Fatura kesildi: ${temiz}`, (x) => {
    x.faturaNo = temiz;
  });
}

export async function siparisNotu(id: string, metin: string): Promise<IslemSonucu> {
  const temiz = metin.trim();
  if (!temiz) return { hata: "Notu yazın." };
  const s = await siparisiGuncelle(id, (x) => {
    x.notlar.push({ metin: temiz.slice(0, 500), zaman: simdi() });
  });
  if (!s) return { hata: "Sipariş bulunamadı." };
  yenile(id);
  return { siparis: structuredClone(s) };
}

/* ---------- Depo ve iade ---------- */

export async function stokGirisi(kod: string, adet: number): Promise<IslemSonucu> {
  if (!Number.isInteger(adet) || adet < 1 || adet > 10_000) return { hata: "1–10.000 arası adet yazın." };
  if (!(await stokGuncelle(kod, adet))) return { hata: "Ürün bulunamadı." };
  yenile();
  return { stok: structuredClone(await getStok()) };
}

/** Depoya yeni ürün tanımlar (ör. yeni bir kablo ya da aksesuar). Fiyatı girilirse manuel siparişte aksesuar olarak seçilebilir. */
export async function yeniStokKalemi(veri: { kod: string; ad: string; adet: number; kritik: number; hedef: number; fiyat: number | null }): Promise<IslemSonucu & { hatalar?: Record<string, string> }> {
  const hatalar: Record<string, string> = {};
  const kod = veri.kod.trim().toUpperCase();
  const ad = veri.ad.trim();
  const tamSayi = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= 100_000;
  if (!ad) hatalar.ad = "Ürün adını yazın.";
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(kod)) hatalar.kod = "Harf, rakam ve tire; 2–24 karakter.";
  else if ((await getStok()).some((k) => k.kod === kod)) hatalar.kod = "Bu stok kodu zaten var.";
  if (!tamSayi(veri.adet, 0)) hatalar.adet = "0 veya üzeri bir adet yazın.";
  if (!tamSayi(veri.kritik, 0)) hatalar.kritik = "0 veya üzeri yazın.";
  if (!tamSayi(veri.hedef, 1)) hatalar.hedef = "En az 1 yazın.";
  else if (tamSayi(veri.kritik, 0) && veri.kritik >= veri.hedef) hatalar.hedef = "Hedef, kritik seviyeden büyük olmalı.";
  if (veri.fiyat !== null && !(Number.isFinite(veri.fiyat) && veri.fiyat > 0)) hatalar.fiyat = "Geçerli bir fiyat yazın ya da boş bırakın.";
  if (Object.keys(hatalar).length) return { hatalar };
  await stokKalemiEkle({ kod, ad, adet: veri.adet, kritik: veri.kritik, hedef: veri.hedef, fiyat: veri.fiyat });
  yenile();
  revalidatePath("/operasyon");
  return { stok: structuredClone(await getStok()) };
}

export type IadeSonucu = { iade?: Iade; hata?: string; hatalar?: Record<string, string> };

export async function iadeKaydet(veri: { siparisId: string; tur: IadeTuru; neden: string; aciklama: string; urunler: string[] }): Promise<IadeSonucu> {
  const hatalar: Record<string, string> = {};
  const s = veri.siparisId ? await getSiparis(veri.siparisId) : null;
  if (!s) hatalar.siparisId = "Siparişi seçin.";
  const secenekler = s ? iadeSecenekleri(s, await getStok()) : [];
  const urunler = secenekler.filter((x) => veri.urunler.includes(x.id)).map((x) => x.ad);
  if (s && !urunler.length) hatalar.urunler = "İade / değişim edilen cihazı veya ürünü seçin.";
  if (!["iade", "degisim"].includes(veri.tur)) hatalar.tur = "İade mi değişim mi seçin.";
  if (!(IADE_NEDENLERI as readonly string[]).includes(veri.neden)) hatalar.neden = "Nedeni seçin.";
  if (veri.neden === "Diğer" && !veri.aciklama.trim()) hatalar.aciklama = "Nedeni kısaca yazın.";
  if (Object.keys(hatalar).length || !s) return { hatalar };
  const iade: Iade = {
    id: await sonrakiIadeNo(),
    siparisId: s.id,
    musteri: s.musteri,
    tur: veri.tur,
    neden: [veri.neden, veri.aciklama.trim()].filter(Boolean).join(" · "),
    urunler,
    tarih: bugun(),
    adim: 0,
  };
  await iadeEkle(iade);
  await siparisiGuncelle(s.id, (x) => {
    x.notlar.push({ metin: `${veri.tur === "iade" ? "İade" : "Değişim"} kaydı açıldı: #${iade.id} · ${urunler.join(", ")} · ${iade.neden}`, zaman: simdi(), sistem: true });
  });
  await musteriOlayi(s, `${veri.tur === "iade" ? "İade" : "Değişim"} talebi #${iade.id} · ${urunler.join(", ")} · ${veri.neden}`);
  yenile(s.id);
  return { iade };
}

export async function iadeIlerlet(id: string): Promise<IadeSonucu> {
  const i = await iadeyiGuncelle(id, (x) => {
    if (x.adim < IADE_ADIMLARI[x.tur].length - 1) x.adim += 1;
  });
  if (!i) return { hata: "Kayıt bulunamadı." };
  yenile();
  return { iade: structuredClone(i) };
}
