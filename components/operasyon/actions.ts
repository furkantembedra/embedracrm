"use server";
// Operasyon: üretim partileri, tedarik siparişleri ve ayarlar (Server Actions).
// Depoya alınan sağlam cihazlar sipariş deposuna (stok) ve seri no havuzuna girer;
// teslim alınan tedarik bileşen stoğuna ya da (kablo ise) sipariş deposuna eklenir.
import { revalidatePath } from "next/cache";
import { CIHAZ_MODELLERI, type CihazModeli, type FiyatListesi, type LisansPaketi } from "@/lib/urunler";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { CIHAZ_STOK_KODU, getSiparisler, getStok, stokGuncelle, stokKalemiEkle } from "@/components/siparisler/queries";
import { SERI_DESENI, isoFark, seriAyikla } from "./ortak";
import {
  ROLLER,
  bilesenEkle, bilesenGuncelle, fiyatKaydet, getBilesenler, getEkip, getHavuz, getIcUretim, getKargoFirmalari, getPartiler, getRecete, getTedarik, havuzaEkle,
  icUretimEkle, icUretimiGuncelle, kargoFirmalariKaydet, kullaniciKaydet as kullaniciKaydetDepo, partiEkle, partiyiGuncelle, tedarikEkle, tedarikiGuncelle,
  type BilesenKalemi, type BilesenKaynagi, type HavuzSeri, type IcUretimEmri, type Kullanici, type Recete, type Rol, type TedarikSiparisi, type UretimPartisi,
} from "./queries";

const TARIH = /^\d{4}-\d{2}-\d{2}$/;
function bugun() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yenile() {
  for (const yol of ["/operasyon", "/siparisler", "/satis-hatti", "/cihaz-lisans"]) revalidatePath(yol);
}

export type UretimSonucu = {
  hata?: string;
  hatalar?: Record<string, string>;
  partiler?: UretimPartisi[];
  bilesenler?: BilesenKalemi[];
  tedarik?: TedarikSiparisi[];
  havuz?: HavuzSeri[];
  recete?: Recete;
  icUretim?: IcUretimEmri[];
};
export type UretimVerisi = Required<Omit<UretimSonucu, "hata" | "hatalar">>;
/** İşlem sonrası güncel üretim verisinin kopyası (istemci bununla yenilenir) */
async function durum(): Promise<UretimSonucu> {
  return structuredClone({
    partiler: await getPartiler(), bilesenler: await getBilesenler(), tedarik: await getTedarik(), havuz: await getHavuz(),
    recete: await getRecete(), icUretim: await getIcUretim(),
  });
}

/* ---------- Üretim partileri ---------- */

export async function partiPlanla(v: { model: string; adet: number; hedefTarih: string; not: string }): Promise<UretimSonucu> {
  const hatalar: Record<string, string> = {};
  if (!CIHAZ_MODELLERI.includes(v.model as CihazModeli)) hatalar.model = "Model seçin.";
  if (!Number.isInteger(v.adet) || v.adet < 1 || v.adet > 1000) hatalar.adet = "1–1000 arası adet yazın.";
  if (!TARIH.test(v.hedefTarih)) hatalar.hedefTarih = "Hedef tarihi seçin.";
  if (Object.keys(hatalar).length) return { hatalar };
  const ay = bugun().slice(2, 4) + bugun().slice(5, 7);
  const sira = (await getPartiler()).filter((p) => p.id.startsWith(`P-${ay}-`)).length + 1;
  await partiEkle({
    id: `P-${ay}-${String(sira).padStart(2, "0")}`, model: v.model as CihazModeli, adet: v.adet, hedefTarih: v.hedefTarih,
    durum: "planlandi", saglam: null, hatali: null, seriler: [], not: v.not.trim().slice(0, 200),
  });
  yenile();
  return durum();
}

export async function uretimeAl(id: string): Promise<UretimSonucu> {
  const p = (await getPartiler()).find((x) => x.id === id);
  if (p?.durum !== "planlandi") return { hata: "Yalnızca planlanan parti üretime alınır." };
  const bilesenler = await getBilesenler();
  const recete = (await getRecete())[p.model];
  const eksik = recete.filter((kod) => (bilesenler.find((b) => b.kod === kod)?.adet ?? 0) < p.adet);
  if (eksik.length) {
    return { hata: `Bileşen yetmiyor: ${eksik.map((kod) => `${bilesenler.find((b) => b.kod === kod)?.ad ?? kod} (${bilesenler.find((b) => b.kod === kod)?.adet ?? 0}/${p.adet})`).join(", ")}` };
  }
  for (const kod of recete) await bilesenGuncelle(kod, -p.adet);
  await partiyiGuncelle(id, (x) => {
    x.durum = "uretimde";
  });
  yenile();
  return durum();
}

export async function kaliteyeGonder(id: string): Promise<UretimSonucu> {
  const p = await partiyiGuncelle(id, (x) => {
    if (x.durum === "uretimde") x.durum = "kalite";
  });
  if (p?.durum !== "kalite") return { hata: "Parti üretimde değil." };
  yenile();
  return durum();
}

async function bilinenSeriler() {
  return new Set([
    ...(await getCihazlar()).map((c) => c.seriNo),
    ...(await getSiparisler()).flatMap((s) => s.seriNolar),
    ...(await getPartiler()).flatMap((p) => p.seriler),
    ...(await getHavuz()).map((h) => h.seriNo),
  ]);
}

/** Bu ay için sıradaki seri numaraları: EO1-YYAA-NNNN, bilinen tüm seri numaralarının devamı */
async function yeniSeriler(adet: number) {
  const onek = `EO1-${bugun().slice(2, 4)}${bugun().slice(5, 7)}-`;
  const bilinen = [...(await bilinenSeriler())];
  let son = Math.max(0, ...bilinen.filter((s) => s.startsWith(onek)).map((s) => Number(s.slice(onek.length)) || 0));
  return Array.from({ length: adet }, () => `${onek}${String(++son).padStart(4, "0")}`);
}

/** Elle girilen seri numaraları: adet tutmalı, biçim doğru olmalı, tekrar ve daha önce kullanılmış numara olmamalı */
async function elleSeriler(metin: string, adet: number): Promise<{ seriler?: string[]; hata?: string }> {
  const liste = seriAyikla(metin);
  if (liste.length !== adet) return { hata: `${adet} seri no gerekli, ${liste.length} yazıldı.` };
  const bozuk = liste.filter((x) => !SERI_DESENI.test(x));
  if (bozuk.length) return { hata: `Geçersiz seri no: ${bozuk.slice(0, 3).join(", ")} (harf, rakam, tire; 4–32 karakter).` };
  const tekrar = liste.filter((x, i) => liste.indexOf(x) !== i);
  if (tekrar.length) return { hata: `Listede iki kez yazılmış: ${[...new Set(tekrar)].slice(0, 3).join(", ")}` };
  const bilinen = await bilinenSeriler();
  const kullanilmis = liste.filter((x) => bilinen.has(x));
  if (kullanilmis.length) return { hata: `Bu seri no zaten kullanılıyor: ${kullanilmis.slice(0, 3).join(", ")}` };
  return { seriler: liste };
}

/** Hatalı cihazların akıbeti. tamir: tamire ayrılır (sonra "Tamir sonucu"), sok: sökülür, çalışan parçalar stoğa döner, hurda: tamamen ayrılır. */
export type HataliKarar = { tamir: number; sok: number; hurda: number; geriAlinan: Record<string, number> };
/** seri: null → otomatik (sıradaki numara), metin → elle girilen liste */
export type KaliteGirdisi = { saglam: number; karar: HataliKarar; seri: string | null };

const tamSayi = (n: unknown, en: number, cok: number) => Number.isInteger(n) && (n as number) >= en && (n as number) <= cok;

async function kaliteIsle(id: string, asama: "kalite" | "tamir", v: KaliteGirdisi): Promise<UretimSonucu> {
  const p = (await getPartiler()).find((x) => x.id === id);
  const toplam = asama === "kalite" ? p?.durum === "kalite" && p.adet : p?.durum === "depoda" && (p.tamirde ?? 0);
  if (!p || !toplam) return { hata: asama === "kalite" ? "Yalnızca kalite kontrolündeki parti depoya alınır." : "Bu partide tamirde cihaz yok." };
  const k = v.karar;
  if (!tamSayi(v.saglam, 0, toplam)) return { hatalar: { saglam: `0–${toplam} arası bir sayı yazın.` } };
  if (asama === "tamir" && k.tamir) return { hata: "Tamirdeki cihaz yeniden tamire ayrılamaz." };
  if (![k.tamir, k.sok, k.hurda].every((n) => tamSayi(n, 0, toplam))) return { hatalar: { karar: "Adetler 0 veya üzeri olmalı." } };
  const hatali = k.tamir + k.sok + k.hurda;
  if (asama === "kalite" && v.saglam + hatali !== toplam) return { hatalar: { karar: `${toplam - v.saglam} hatalı cihazın hepsine karar verin (şu an ${hatali}).` } };
  if (asama === "tamir" && v.saglam + hatali > toplam) return { hatalar: { karar: `Tamirde ${toplam} cihaz var; toplam ${v.saglam + hatali} yazıldı.` } };
  if (asama === "tamir" && v.saglam + hatali === 0) return { hatalar: { saglam: "En az bir cihaz için sonuç girin." } };
  const recete = (await getRecete())[p.model];
  const geri: Record<string, number> = {};
  for (const kod of recete) {
    const n = k.geriAlinan[kod] ?? 0;
    if (!tamSayi(n, 0, k.sok)) return { hatalar: { karar: `Geri alınan parça 0–${k.sok} arası olmalı.` } };
    if (n) geri[kod] = n;
  }

  let seriler: string[] = [];
  if (v.saglam) {
    if (v.seri === null) seriler = await yeniSeriler(v.saglam);
    else {
      const e = await elleSeriler(v.seri, v.saglam);
      if (e.hata) return { hatalar: { seri: e.hata } };
      seriler = e.seriler!;
    }
    await stokGuncelle(CIHAZ_STOK_KODU[p.model], v.saglam);
    await havuzaEkle(seriler.map((seriNo) => ({ seriNo, model: p.model, partiId: p.id })));
  }
  for (const [kod, n] of Object.entries(geri)) await bilesenGuncelle(kod, n);

  await partiyiGuncelle(id, (x) => {
    if (asama === "kalite") {
      x.durum = "depoda";
      x.saglam = v.saglam;
      x.hatali = hatali;
      x.seriler = seriler;
      x.tamirde = k.tamir;
    } else {
      x.saglam = (x.saglam ?? 0) + v.saglam;
      x.onarilan = (x.onarilan ?? 0) + v.saglam;
      x.seriler = [...x.seriler, ...seriler];
      x.tamirde = (x.tamirde ?? 0) - v.saglam - hatali;
    }
    x.sokulen = (x.sokulen ?? 0) + k.sok;
    x.hurda = (x.hurda ?? 0) + k.hurda;
    const g = (x.geriAlinan ??= {});
    for (const [kod, n] of Object.entries(geri)) g[kod] = (g[kod] ?? 0) + n;
  });
  yenile();
  return durum();
}

/** Kalite kontrol sonucu: sağlamlar depoya (seri no otomatik ya da elle), hatalılar tamir / sök / hurda */
export async function depoyaAl(id: string, v: KaliteGirdisi): Promise<UretimSonucu> {
  return kaliteIsle(id, "kalite", v);
}

/** Tamirdeki cihazların sonucu: onarılanlar depoya, onarılamayanlar sök / hurda, kalanlar tamirde bekler */
export async function tamirSonucu(id: string, v: KaliteGirdisi): Promise<UretimSonucu> {
  return kaliteIsle(id, "tamir", v);
}

/* ---------- Yeni kalem (tedarik / iç üretim formlarından) ---------- */

/** tur: bilesen → üretim bileşeni (reçeteye eklenebilir), kablo → sipariş deposunda satılan/kutuya giren kalem */
export type YeniKalem = { ad: string; kod: string; tur: "bilesen" | "kablo"; kritik: number; hedef: number; modeller: string[] };

async function yeniKalemiKur(y: YeniKalem, kaynak: BilesenKaynagi): Promise<{ kalem?: { kod: string; ad: string }; hatalar?: Record<string, string> }> {
  const hatalar: Record<string, string> = {};
  const kod = y.kod.trim().toUpperCase();
  const ad = y.ad.trim().slice(0, 80);
  if (!ad) hatalar.yeniAd = "Kalem adını yazın.";
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(kod)) hatalar.yeniKod = "Harf, rakam ve tire; 2–24 karakter.";
  else if ((await getBilesenler()).some((b) => b.kod === kod) || (await getStok()).some((k) => k.kod === kod)) hatalar.yeniKod = "Bu kod zaten var.";
  if (!["bilesen", "kablo"].includes(y.tur) || (kaynak === "ic" && y.tur !== "bilesen")) hatalar.yeniTur = "Türü seçin.";
  if (!tamSayi(y.kritik, 0, 100_000)) hatalar.yeniKritik = "0 veya üzeri yazın.";
  if (!tamSayi(y.hedef, 1, 100_000)) hatalar.yeniHedef = "En az 1 yazın.";
  else if (y.kritik >= y.hedef) hatalar.yeniHedef = "Hedef, kritik seviyeden büyük olmalı.";
  const modeller = CIHAZ_MODELLERI.filter((m) => y.modeller.includes(m));
  if (Object.keys(hatalar).length) return { hatalar };
  if (y.tur === "bilesen") await bilesenEkle({ kod, ad, adet: 0, kritik: y.kritik, hedef: y.hedef, kaynak }, modeller);
  else await stokKalemiEkle({ kod, ad, adet: 0, kritik: y.kritik, hedef: y.hedef, fiyat: null });
  return { kalem: { kod, ad } };
}

/* ---------- Tedarik ---------- */

export async function tedarikVer(v: { tedarikci: string; kalemKodu: string; adet: number; beklenen: string; yeni: YeniKalem | null }): Promise<UretimSonucu> {
  const hatalar: Record<string, string> = {};
  const bilesen = (await getBilesenler()).find((b) => b.kod === v.kalemKodu);
  const kablo = (await getStok()).find((k) => k.kod === v.kalemKodu && !k.kod.endsWith("-HW")); // cihazlar tedarikle değil üretimle gelir
  if (!v.tedarikci.trim()) hatalar.tedarikci = "Tedarikçiyi yazın.";
  if (!v.yeni && !bilesen && !kablo) hatalar.kalemKodu = "Kalemi seçin.";
  if (!Number.isInteger(v.adet) || v.adet < 1 || v.adet > 100_000) hatalar.adet = "Adet yazın.";
  if (!TARIH.test(v.beklenen)) hatalar.beklenen = "Beklenen teslim tarihini seçin.";
  if (Object.keys(hatalar).length) return { hatalar };
  let kalem = (bilesen ?? kablo)!;
  if (v.yeni) {
    const y = await yeniKalemiKur(v.yeni, "dis");
    if (y.hatalar) return { hatalar: y.hatalar };
    kalem = { ...kalem, ...y.kalem! };
  }
  const en = Math.max(0, ...(await getTedarik()).map((t) => Number(t.id.slice(2)) || 0));
  await tedarikEkle({
    id: `T-${String(en + 1).padStart(4, "0")}`, tedarikci: v.tedarikci.trim().slice(0, 80), kalemKodu: kalem.kod,
    kalemAdi: kalem.ad, adet: v.adet, tarih: bugun(), beklenen: v.beklenen, durum: "siparis",
  });
  yenile();
  return durum();
}

export async function tedarikYolda(id: string): Promise<UretimSonucu> {
  const t = await tedarikiGuncelle(id, (x) => {
    if (x.durum === "siparis") x.durum = "yolda";
  });
  if (t?.durum !== "yolda") return { hata: "Sipariş yola çıkarılamadı." };
  yenile();
  return durum();
}

export async function tedarikTeslimAl(id: string): Promise<UretimSonucu> {
  const t = (await getTedarik()).find((x) => x.id === id);
  if (!t || t.durum === "teslim") return { hata: "Bu sipariş zaten teslim alındı." };
  if (t.durum !== "yolda") return { hata: "Sipariş yola çıkmadan teslim alınamaz; önce “Yola çıktı” olarak işaretleyin." };
  if (!(await bilesenGuncelle(t.kalemKodu, t.adet))) await stokGuncelle(t.kalemKodu, t.adet);
  await tedarikiGuncelle(id, (x) => {
    x.durum = "teslim";
  });
  yenile();
  return durum();
}

/* ---------- İç üretim ---------- */

export async function icUretimBaslat(v: { kalemKodu: string; hedef: number; baslangic: string; gun: number; not: string; yeni: YeniKalem | null }): Promise<UretimSonucu> {
  const hatalar: Record<string, string> = {};
  const bilesen = (await getBilesenler()).find((b) => b.kod === v.kalemKodu);
  if (!v.yeni && !bilesen) hatalar.kalemKodu = "Üretilecek bileşeni seçin.";
  if (!tamSayi(v.hedef, 1, 100_000)) hatalar.hedef = "Hedef adet yazın.";
  if (!tamSayi(v.gun, 1, 365)) hatalar.gun = "1–365 gün.";
  if (!TARIH.test(v.baslangic)) hatalar.baslangic = "Başlangıç tarihini seçin.";
  if (Object.keys(hatalar).length) return { hatalar };
  let kalem = bilesen ? { kod: bilesen.kod, ad: bilesen.ad } : null;
  if (v.yeni) {
    const y = await yeniKalemiKur({ ...v.yeni, tur: "bilesen" }, "ic");
    if (y.hatalar) return { hatalar: y.hatalar };
    kalem = y.kalem!;
  } else if (bilesen && bilesen.kaynak !== "ic") bilesen.kaynak = "ic"; // dışarıdan alınan bir parçayı artık kendimiz üretiyoruz
  const en = Math.max(0, ...(await getIcUretim()).map((e) => Number(e.id.slice(3)) || 0));
  await icUretimEkle({
    id: `IU-${String(en + 1).padStart(4, "0")}`, kalemKodu: kalem!.kod, kalemAdi: kalem!.ad, hedef: v.hedef,
    baslangic: v.baslangic, gun: v.gun, girisler: [], not: v.not.trim().slice(0, 200),
  });
  yenile();
  return durum();
}

/** Personelin gün sonu girişi: üretilen adet bileşen stoğuna eklenir */
export async function icUretimGir(emirId: string, v: { tarih: string; adet: number; personel: string; not: string }): Promise<UretimSonucu> {
  const e = (await getIcUretim()).find((x) => x.id === emirId);
  if (!e) return { hata: "Üretim emri bulunamadı." };
  const hatalar: Record<string, string> = {};
  if (!TARIH.test(v.tarih)) hatalar.tarih = "Tarihi seçin.";
  else if (isoFark(v.tarih, e.baslangic) < 0) hatalar.tarih = "Emrin başlangıcından önce olamaz.";
  else if (isoFark(v.tarih, bugun()) > 0) hatalar.tarih = "İleri tarihli giriş yapılamaz.";
  if (!tamSayi(v.adet, 1, 100_000)) hatalar.adet = "Üretilen adedi yazın.";
  const ekip = await getEkip();
  if (!ekip.some((k) => k.ad === v.personel)) hatalar.personel = "Personeli seçin.";
  if (Object.keys(hatalar).length) return { hatalar };
  await bilesenGuncelle(e.kalemKodu, v.adet);
  await icUretimiGuncelle(emirId, (x) => {
    x.girisler.push({ id: crypto.randomUUID(), tarih: v.tarih, adet: v.adet, personel: v.personel, not: v.not.trim().slice(0, 200) });
    x.girisler.sort((a, b) => a.tarih.localeCompare(b.tarih));
  });
  yenile();
  return durum();
}

/** Yanlış girişi geri al: adet bileşen stoğundan düşer */
export async function icUretimGirisiSil(emirId: string, girisId: string): Promise<UretimSonucu> {
  const e = (await getIcUretim()).find((x) => x.id === emirId);
  const g = e?.girisler.find((x) => x.id === girisId);
  if (!e || !g) return { hata: "Giriş bulunamadı." };
  await bilesenGuncelle(e.kalemKodu, -g.adet);
  await icUretimiGuncelle(emirId, (x) => {
    x.girisler = x.girisler.filter((y) => y.id !== girisId);
  });
  yenile();
  return durum();
}

/* ---------- Ayarlar ---------- */

export type AyarSonucu = { hata?: string; fiyat?: FiyatListesi; kargo?: string[]; ekip?: Kullanici[] };

export async function fiyatListesiKaydet(f: FiyatListesi, aksesuar: Record<string, number>): Promise<AyarSonucu> {
  const tamSayi = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 100_000_000;
  if (!CIHAZ_MODELLERI.every((m) => tamSayi(f.cihaz[m]))) return { hata: "Cihaz fiyatları sıfırdan büyük olmalı." };
  for (const [ad, p] of Object.entries(f.lisans) as [LisansPaketi, { fiyat: number | null; cihaz: number | null }][]) {
    if (p.fiyat !== null && !tamSayi(p.fiyat)) return { hata: `${ad} fiyatı geçersiz (özel fiyat için boş bırakın).` };
    if (p.cihaz !== null && !(Number.isInteger(p.cihaz) && p.cihaz >= 1 && p.cihaz <= 1000)) return { hata: `${ad} cihaz kapsamı 1–1000 arası olmalı.` };
  }
  if (!(f.kdv >= 0 && f.kdv <= 0.5)) return { hata: "KDV oranı %0–50 arası olmalı." };
  const stok = await getStok();
  for (const [kod, fiyat] of Object.entries(aksesuar)) {
    const k = stok.find((x) => x.kod === kod && x.fiyat !== null);
    if (!k) continue;
    if (!tamSayi(fiyat)) return { hata: `${k.ad} fiyatı sıfırdan büyük olmalı.` };
    k.fiyat = fiyat; // TODO: Supabase'de stock_items.price güncellenir
  }
  const temiz: FiyatListesi = {
    cihaz: { ONE: Math.round(f.cihaz.ONE), "ONE Lite": Math.round(f.cihaz["ONE Lite"]) },
    lisans: Object.fromEntries(Object.entries(f.lisans).map(([k, v]) => [k, { fiyat: v.fiyat === null ? null : Math.round(v.fiyat), cihaz: v.cihaz }])) as FiyatListesi["lisans"],
    kdv: Math.round(f.kdv * 1000) / 1000,
  };
  await fiyatKaydet(temiz);
  yenile();
  return { fiyat: temiz };
}

export async function kargoFirmalariniKaydet(liste: string[]): Promise<AyarSonucu> {
  const temiz = [...new Set(liste.map((x) => x.trim()).filter(Boolean))].slice(0, 30);
  if (!temiz.length) return { hata: "En az bir kargo firması kalmalı." };
  await kargoFirmalariKaydet(temiz);
  yenile();
  return { kargo: await getKargoFirmalari() };
}

export async function kullaniciKaydet(k: { id?: string; ad: string; eposta: string; rol: string; aktif: boolean }): Promise<AyarSonucu> {
  const ekip = await getEkip();
  if (!k.ad.trim()) return { hata: "Ad soyad yazın." };
  if (!/^\S+@\S+\.\S+$/.test(k.eposta.trim())) return { hata: "Geçerli bir e-posta yazın." };
  if (!ROLLER.includes(k.rol as Rol)) return { hata: "Rol seçin." };
  if (ekip.some((x) => x.id !== k.id && x.eposta.toLowerCase() === k.eposta.trim().toLowerCase())) return { hata: "Bu e-posta başka bir kullanıcıda kayıtlı." };
  const yoneticiKalir = ekip.some((x) => x.id !== k.id && x.rol === "Yönetici" && x.aktif) || (k.rol === "Yönetici" && k.aktif);
  if (!yoneticiKalir) return { hata: "En az bir aktif yönetici kalmalı." };
  await kullaniciKaydetDepo({ id: k.id || crypto.randomUUID(), ad: k.ad.trim(), eposta: k.eposta.trim().toLowerCase(), rol: k.rol as Rol, aktif: k.aktif });
  revalidatePath("/operasyon");
  return { ekip: structuredClone(await getEkip()) };
}
