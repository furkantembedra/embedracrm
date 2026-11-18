// Operasyon: üretim, tedarik, seri no havuzu ve uygulama ayarları (fiyat listesi, kargo firmaları, ekip).
// Veri Supabase'de: bilesenler, urun_receteleri, ic_uretim_emirleri / ic_uretim_girisleri, uretim_partileri,
// tedarik_siparisleri, seri_havuzu, ayarlar ve kullanicilar tabloları.
import { VARSAYILAN_FIYAT, type CihazModeli, type FiyatListesi } from "@/lib/urunler";
import { db, kullaniciKimligi, kullaniciNo, sonuc } from "@/lib/supabase/db";

/** sonuc() + boş olmayan veri (select / insert…select sonuçları; maybeSingle için sonuc kullanılır) */
const kesin = <T,>(r: { data: T; error: { message: string; code?: string } | null }, ne?: string) => sonuc(r, ne) as NonNullable<T>;

/* ---------- Üretim ---------- */

/** dis: tedarikçiden satın alınır · ic: atölyede kendimiz üretiriz (iç üretim emriyle stoğa girer) */
export type BilesenKaynagi = "dis" | "ic";
export type BilesenKalemi = { kod: string; ad: string; adet: number; kritik: number; hedef: number; kaynak: BilesenKaynagi };
/** Model başına bir cihazda harcanan bileşen kodları */
export type Recete = Record<CihazModeli, string[]>;

export { RECETE, ROLLER } from "./ortak";
import { RECETE } from "./ortak";

/** planlandi → uretimde (bileşen düşer) → kalite → depoda (sağlam cihazlar depo stoğuna, seri no'lar havuza) */
export type PartiDurumu = "planlandi" | "uretimde" | "kalite" | "depoda";
export type UretimPartisi = {
  id: string; // "P-2611-01"
  model: CihazModeli;
  adet: number;
  hedefTarih: string; // "2026-11-14"
  durum: PartiDurumu;
  saglam: number | null; // kalite kontrolden geçen (depoda)
  hatali: number | null;
  seriler: string[]; // depoya alınırken üretilen seri numaraları
  not: string;
  // Hatalı cihazların akıbeti (kalite kontrolde karar verilir; tamirdekiler sonra "Tamir sonucu" ile kapanır)
  tamirde?: number; // tamirde bekleyen
  onarilan?: number; // tamirden dönüp depoya giren (saglam'a dahil)
  sokulen?: number; // sökülüp parçaları geri alınan
  hurda?: number;
  geriAlinan?: Record<string, number>; // sökülen cihazlardan bileşen stoğuna dönen parçalar
};

/** Atölyede ürettiğimiz bileşen için iş emri: X günde Y adet. Personel her gün ürettiğini girer, adet bileşen stoğuna eklenir. */
export type IcUretimGirisi = { id: string; tarih: string; adet: number; personel: string; not: string }; // id = String(ic_uretim_girisleri.id)
export type IcUretimEmri = {
  id: string; // "IU-0003"
  kalemKodu: string;
  kalemAdi: string;
  hedef: number;
  baslangic: string;
  gun: number; // süre (gün); bitiş = başlangıç + gün - 1
  girisler: IcUretimGirisi[];
  not: string;
};

/** siparis → yolda → teslim (teslim alınınca stoğa girer) */
export type TedarikDurumu = "siparis" | "yolda" | "teslim";
export type TedarikSiparisi = {
  id: string; // "T-0031"
  tedarikci: string;
  kalemKodu: string; // bileşen kodu ya da sipariş deposundaki kablo kodu (EO1-CBL-…)
  kalemAdi: string;
  adet: number;
  tarih: string; // sipariş tarihi
  beklenen: string; // beklenen teslim
  durum: TedarikDurumu;
};

/** Üretilmiş, depoda bekleyen, henüz bir siparişe atanmamış seri numaraları */
export type HavuzSeri = { seriNo: string; model: CihazModeli; partiId: string };

/* ---------- Ayarlar ---------- */

import type { ROLLER } from "./ortak";
export type Rol = (typeof ROLLER)[number];
export type Kullanici = { id: string; ad: string; eposta: string; rol: Rol; aktif: boolean; telefon?: string };
/** RMA'da bayilerin cihaz göndereceği servis adresi (bayi portalında gösterilir) */
export type ServisAdresi = { ad: string; adres: string; telefon: string };

/* ---------- Satır → domain dönüşümleri ---------- */

type BilesenSatiri = { id: number; bs_kod: string; bs_ad: string; bs_adet: number; bs_kritik: number; bs_hedef: number; bs_kaynak: BilesenKaynagi };
const bilesenden = (r: BilesenSatiri): BilesenKalemi => ({ kod: r.bs_kod, ad: r.bs_ad, adet: r.bs_adet, kritik: r.bs_kritik, hedef: r.bs_hedef, kaynak: r.bs_kaynak });

type PartiSatiri = {
  up_no: string; up_model: CihazModeli; up_adet: number; up_hedef_tarih: string; up_durum: PartiDurumu; up_saglam: number | null; up_hatali: number | null;
  up_seriler: string[]; up_not: string; up_tamirde: number | null; up_onarilan: number | null; up_sokulen: number | null; up_hurda: number | null;
  up_geri_alinan: Record<string, number> | null;
};
function partiden(r: PartiSatiri): UretimPartisi {
  const p: UretimPartisi = {
    id: r.up_no, model: r.up_model, adet: r.up_adet, hedefTarih: r.up_hedef_tarih, durum: r.up_durum, saglam: r.up_saglam, hatali: r.up_hatali,
    seriler: r.up_seriler ?? [], not: r.up_not,
  };
  // İsteğe bağlı alanlar yalnızca doluysa eklenir (eski nesne biçimiyle aynı)
  if (r.up_tamirde !== null) p.tamirde = r.up_tamirde;
  if (r.up_onarilan !== null) p.onarilan = r.up_onarilan;
  if (r.up_sokulen !== null) p.sokulen = r.up_sokulen;
  if (r.up_hurda !== null) p.hurda = r.up_hurda;
  if (r.up_geri_alinan) p.geriAlinan = r.up_geri_alinan;
  return p;
}
const partiSatiri = (p: UretimPartisi) => ({
  up_no: p.id, up_model: p.model, up_adet: p.adet, up_hedef_tarih: p.hedefTarih, up_durum: p.durum, up_saglam: p.saglam, up_hatali: p.hatali,
  up_seriler: p.seriler, up_not: p.not, up_tamirde: p.tamirde ?? null, up_onarilan: p.onarilan ?? null, up_sokulen: p.sokulen ?? null,
  up_hurda: p.hurda ?? null, up_geri_alinan: p.geriAlinan ?? null,
});

type TedarikSatiri = { ts_no: string; ts_tedarikci: string; ts_kalem_kodu: string; ts_kalem_adi: string; ts_adet: number; ts_tarih: string; ts_beklenen: string; ts_durum: TedarikDurumu };
const tedariktan = (r: TedarikSatiri): TedarikSiparisi => ({
  id: r.ts_no, tedarikci: r.ts_tedarikci, kalemKodu: r.ts_kalem_kodu, kalemAdi: r.ts_kalem_adi, adet: r.ts_adet, tarih: r.ts_tarih, beklenen: r.ts_beklenen, durum: r.ts_durum,
});
const tedarikSatiri = (t: TedarikSiparisi) => ({
  ts_no: t.id, ts_tedarikci: t.tedarikci, ts_kalem_kodu: t.kalemKodu, ts_kalem_adi: t.kalemAdi, ts_adet: t.adet, ts_tarih: t.tarih, ts_beklenen: t.beklenen, ts_durum: t.durum,
});

type KullaniciSatiri = { id: number; k_ad: string; k_eposta: string; k_rol: Rol; k_aktif: boolean; k_tel: string | null };
function kullanicidan(r: KullaniciSatiri): Kullanici {
  const k: Kullanici = { id: kullaniciKimligi(r.id), ad: r.k_ad, eposta: r.k_eposta, rol: r.k_rol, aktif: r.k_aktif };
  if (r.k_tel) k.telefon = r.k_tel;
  return k;
}

const IC_URETIM_SECIMI = "id, iu_no, iu_hedef, iu_baslangic, iu_gun, iu_not, bilesenler(bs_kod, bs_ad), ic_uretim_girisleri(id, iug_tarih, iug_adet, iug_personel, iug_not)";
type IcUretimSatiri = {
  id: number; iu_no: string; iu_hedef: number; iu_baslangic: string; iu_gun: number; iu_not: string;
  bilesenler: { bs_kod: string; bs_ad: string } | null;
  ic_uretim_girisleri: { id: number; iug_tarih: string; iug_adet: number; iug_personel: string; iug_not: string }[];
};
const icUretimden = (r: IcUretimSatiri): IcUretimEmri => ({
  id: r.iu_no, kalemKodu: r.bilesenler?.bs_kod ?? "", kalemAdi: r.bilesenler?.bs_ad ?? "", hedef: r.iu_hedef, baslangic: r.iu_baslangic, gun: r.iu_gun, not: r.iu_not,
  girisler: [...(r.ic_uretim_girisleri ?? [])]
    .sort((a, b) => a.iug_tarih.localeCompare(b.iug_tarih) || a.id - b.id)
    .map((g) => ({ id: String(g.id), tarih: g.iug_tarih, adet: g.iug_adet, personel: g.iug_personel, not: g.iug_not })),
});

async function bilesenIdsi(kod: string): Promise<number | null> {
  const s = await db();
  const r = sonuc(await s.from("bilesenler").select("id").eq("bs_kod", kod).maybeSingle(), "Bileşen aranıyor");
  return r?.id ?? null;
}

/* ---------- Ayarlar tablosu ---------- */

const SERVIS_VARSAYILAN: ServisAdresi = { ad: "Embedra Teknik Servis", adres: "Dudullu OSB, 1. Cadde No:12, 34776 Ümraniye / İstanbul, Türkiye", telefon: "+90 216 555 0150" };

async function ayarOku<T>(anahtar: string): Promise<T | null> {
  const s = await db();
  const r = sonuc(await s.from("ayarlar").select("deger").eq("anahtar", anahtar).maybeSingle(), `Ayar okunuyor (${anahtar})`);
  return (r?.deger as T) ?? null;
}
async function ayarYaz(anahtar: string, deger: unknown) {
  const s = await db();
  sonuc(await s.from("ayarlar").upsert({ anahtar, deger, updated_at: new Date().toISOString() }), `Ayar kaydediliyor (${anahtar})`);
}

/* ---------- Okuma ---------- */

export async function getBilesenler(): Promise<BilesenKalemi[]> {
  const s = await db();
  return kesin(await s.from("bilesenler").select("id, bs_kod, bs_ad, bs_adet, bs_kritik, bs_hedef, bs_kaynak").order("id"), "Bileşenler okunuyor").map(bilesenden);
}
export async function getRecete(): Promise<Recete> {
  const s = await db();
  const satirlar = sonuc(
    await s.from("urun_receteleri").select("ur_model, ur_sira, bilesenler(bs_kod)").order("ur_model").order("ur_sira"),
    "Ürün reçeteleri okunuyor",
  ) as unknown as { ur_model: CihazModeli; ur_sira: number; bilesenler: { bs_kod: string } | null }[];
  const recete: Recete = { ONE: [], "ONE Lite": [] };
  for (const r of satirlar) if (r.bilesenler) (recete[r.ur_model] ??= []).push(r.bilesenler.bs_kod);
  return recete;
}
export async function getIcUretim(): Promise<IcUretimEmri[]> {
  const s = await db();
  const satirlar = sonuc(await s.from("ic_uretim_emirleri").select(IC_URETIM_SECIMI).order("iu_no", { ascending: false }), "İç üretim emirleri okunuyor");
  return (satirlar as unknown as IcUretimSatiri[]).map(icUretimden);
}
export async function getPartiler(): Promise<UretimPartisi[]> {
  const s = await db();
  // Yeni parti başta (eski depoda unshift ediliyordu); numara "P-YYAA-NN" olduğu için ters sıralama aynı sonucu verir
  return (sonuc(await s.from("uretim_partileri").select("*").order("up_no", { ascending: false }), "Üretim partileri okunuyor") as PartiSatiri[]).map(partiden);
}
export async function getTedarik(): Promise<TedarikSiparisi[]> {
  const s = await db();
  return (sonuc(await s.from("tedarik_siparisleri").select("*").order("ts_no", { ascending: false }), "Tedarik siparişleri okunuyor") as TedarikSatiri[]).map(tedariktan);
}
export async function getHavuz(): Promise<HavuzSeri[]> {
  const s = await db();
  const satirlar = kesin(await s.from("seri_havuzu").select("sh_seri_no, sh_model, sh_parti_no").order("sh_sira"), "Seri no havuzu okunuyor");
  return satirlar.map((r) => ({ seriNo: r.sh_seri_no as string, model: r.sh_model as CihazModeli, partiId: r.sh_parti_no as string }));
}
export async function getFiyatListesi(): Promise<FiyatListesi> {
  const f = await ayarOku<FiyatListesi>("fiyat_listesi");
  if (!f) return structuredClone(VARSAYILAN_FIYAT);
  f.eurKur ??= VARSAYILAN_FIYAT.eurKur;
  return f;
}
export async function getKargoFirmalari(): Promise<string[]> { return (await ayarOku<string[]>("kargo_firmalari")) ?? []; }
export async function getEkip(): Promise<Kullanici[]> {
  const s = await db();
  return (sonuc(await s.from("kullanicilar").select("id, k_ad, k_eposta, k_rol, k_aktif, k_tel").order("id"), "Ekip okunuyor") as KullaniciSatiri[]).map(kullanicidan);
}
export async function getServisAdresi(): Promise<ServisAdresi> { return (await ayarOku<ServisAdresi>("servis_adresi")) ?? { ...SERVIS_VARSAYILAN }; }
export async function servisAdresiKaydetDepo(sa: ServisAdresi) { await ayarYaz("servis_adresi", sa); }

/* ---------- Yazma (yalnızca action dosyalarından çağrılır) ---------- */

/** Bileşen stoğunu fark kadar değiştirir (0'ın altına inmez). Bileşen yoksa null (çağıran sipariş deposunu dener). */
export async function bilesenGuncelle(kod: string, fark: number): Promise<BilesenKalemi | null> {
  const s = await db();
  const b = sonuc(await s.from("bilesenler").select("id, bs_kod, bs_ad, bs_adet, bs_kritik, bs_hedef, bs_kaynak").eq("bs_kod", kod).maybeSingle(), "Bileşen okunuyor") as BilesenSatiri | null;
  if (!b) return null;
  const adet = Math.max(0, b.bs_adet + fark);
  sonuc(await s.from("bilesenler").update({ bs_adet: adet }).eq("id", b.id), "Bileşen stoğu güncelleniyor");
  return bilesenden({ ...b, bs_adet: adet });
}
/** Bir parçayı artık kendimiz mi üretiyoruz, dışarıdan mı alıyoruz */
export async function bilesenKaynagiGuncelle(kod: string, kaynak: BilesenKaynagi) {
  const s = await db();
  sonuc(await s.from("bilesenler").update({ bs_kaynak: kaynak }).eq("bs_kod", kod), "Bileşen kaynağı güncelleniyor");
}
export async function bilesenEkle(b: BilesenKalemi, modeller: CihazModeli[]) {
  const s = await db();
  const yeni = kesin(
    await s.from("bilesenler").insert({ bs_kod: b.kod, bs_ad: b.ad, bs_adet: Math.max(0, b.adet), bs_kritik: b.kritik, bs_hedef: b.hedef, bs_kaynak: b.kaynak }).select("id").single(),
    "Bileşen ekleniyor",
  );
  // Seçilen modellerin reçetesinin sonuna eklenir
  for (const m of modeller) {
    const son = kesin(await s.from("urun_receteleri").select("ur_sira").eq("ur_model", m).order("ur_sira", { ascending: false }).limit(1), "Reçete okunuyor");
    sonuc(await s.from("urun_receteleri").insert({ ur_model: m, bilesen_id: yeni.id, ur_sira: (son[0]?.ur_sira ?? -1) + 1 }), "Reçeteye bileşen ekleniyor");
  }
}

export async function icUretimEkle(e: IcUretimEmri) {
  const bilesenId = await bilesenIdsi(e.kalemKodu);
  if (bilesenId === null) throw new Error(`İç üretim emri açılamadı: ${e.kalemKodu} bileşeni yok.`);
  const s = await db();
  const yeni = kesin(
    await s.from("ic_uretim_emirleri").insert({ iu_no: e.id, bilesen_id: bilesenId, iu_hedef: e.hedef, iu_baslangic: e.baslangic, iu_gun: e.gun, iu_not: e.not }).select("id").single(),
    "İç üretim emri ekleniyor",
  );
  if (e.girisler.length) await girisleriEkle(yeni.id, e.girisler);
}
async function girisleriEkle(emirId: number, girisler: IcUretimGirisi[]) {
  const s = await db();
  const satirlar = kesin(
    await s.from("ic_uretim_girisleri")
      .insert(girisler.map((g) => ({ emir_id: emirId, iug_tarih: g.tarih, iug_adet: g.adet, iug_personel: g.personel, iug_not: g.not })))
      .select("id"),
    "Üretim girişi ekleniyor",
  );
  // Kodun verdiği geçici id'nin yerine veritabanı id'si
  satirlar.forEach((r, i) => (girisler[i].id = String(r.id)));
}
/** Emri (girişleriyle) okur, geri çağırmayı uygular, farkı yazar: skaler alanlar update, yeni girişler insert, çıkarılanlar delete */
export async function icUretimiGuncelle(id: string, f: (e: IcUretimEmri) => void): Promise<IcUretimEmri | null> {
  const s = await db();
  const satir = sonuc(await s.from("ic_uretim_emirleri").select(IC_URETIM_SECIMI).eq("iu_no", id).maybeSingle(), "İç üretim emri okunuyor") as unknown as IcUretimSatiri | null;
  if (!satir) return null;
  const e = icUretimden(satir);
  const eskiIdler = new Set(e.girisler.map((g) => g.id));
  f(e);
  const guncelleme: Record<string, unknown> = { iu_hedef: e.hedef, iu_baslangic: e.baslangic, iu_gun: e.gun, iu_not: e.not };
  if (e.kalemKodu !== satir.bilesenler?.bs_kod) {
    const bilesenId = await bilesenIdsi(e.kalemKodu);
    if (bilesenId !== null) guncelleme.bilesen_id = bilesenId;
  }
  sonuc(await s.from("ic_uretim_emirleri").update(guncelleme).eq("id", satir.id), "İç üretim emri güncelleniyor");
  const kalanIdler = new Set(e.girisler.map((g) => g.id));
  const silinen = [...eskiIdler].filter((x) => !kalanIdler.has(x)).map(Number);
  if (silinen.length) sonuc(await s.from("ic_uretim_girisleri").delete().in("id", silinen), "Üretim girişi siliniyor");
  // Mevcut girişlerdeki değişiklikler
  for (const g of e.girisler) {
    if (!eskiIdler.has(g.id)) continue;
    const eski = satir.ic_uretim_girisleri.find((x) => String(x.id) === g.id)!;
    if (eski.iug_tarih !== g.tarih || eski.iug_adet !== g.adet || eski.iug_personel !== g.personel || eski.iug_not !== g.not) {
      sonuc(await s.from("ic_uretim_girisleri").update({ iug_tarih: g.tarih, iug_adet: g.adet, iug_personel: g.personel, iug_not: g.not }).eq("id", Number(g.id)), "Üretim girişi güncelleniyor");
    }
  }
  const yeniler = e.girisler.filter((g) => !eskiIdler.has(g.id));
  if (yeniler.length) await girisleriEkle(satir.id, yeniler);
  return e;
}

export async function partiEkle(p: UretimPartisi) {
  const s = await db();
  sonuc(await s.from("uretim_partileri").insert(partiSatiri(p)), "Üretim partisi ekleniyor");
}
export async function partiyiGuncelle(id: string, f: (p: UretimPartisi) => void): Promise<UretimPartisi | null> {
  const s = await db();
  const r = sonuc(await s.from("uretim_partileri").select("*").eq("up_no", id).maybeSingle(), "Üretim partisi okunuyor") as PartiSatiri | null;
  if (!r) return null;
  const p = partiden(r);
  f(p);
  const { up_no: _no, ...alanlar } = partiSatiri(p);
  sonuc(await s.from("uretim_partileri").update(alanlar).eq("up_no", id), "Üretim partisi güncelleniyor");
  return p;
}

export async function tedarikEkle(t: TedarikSiparisi) {
  const s = await db();
  sonuc(await s.from("tedarik_siparisleri").insert(tedarikSatiri(t)), "Tedarik siparişi ekleniyor");
}
export async function tedarikiGuncelle(id: string, f: (t: TedarikSiparisi) => void): Promise<TedarikSiparisi | null> {
  const s = await db();
  const r = sonuc(await s.from("tedarik_siparisleri").select("*").eq("ts_no", id).maybeSingle(), "Tedarik siparişi okunuyor") as TedarikSatiri | null;
  if (!r) return null;
  const t = tedariktan(r);
  f(t);
  const { ts_no: _no, ...alanlar } = tedarikSatiri(t);
  sonuc(await s.from("tedarik_siparisleri").update(alanlar).eq("ts_no", id), "Tedarik siparişi güncelleniyor");
  return t;
}

export async function havuzaEkle(seriler: HavuzSeri[]) {
  if (!seriler.length) return;
  const s = await db();
  sonuc(
    await s.from("seri_havuzu").upsert(seriler.map((h) => ({ sh_seri_no: h.seriNo, sh_model: h.model, sh_parti_no: h.partiId })), { onConflict: "sh_seri_no", ignoreDuplicates: true }),
    "Seri no havuzuna ekleniyor",
  );
}
/**
 * İptal edilen siparişin seri numaraları depodaki seri no havuzuna geri döner.
 * Not: eski depo bunları listenin başına koyuyordu; sh_sira "generated always" olduğu için burada sona eklenir.
 * Havuz yalnızca seri no ile aranıyor (sıra iş mantığını etkilemiyor), bu yüzden fark yalnızca listedeki görünüm sırası.
 */
export async function havuzaGeriKoy(seriler: { seriNo: string; model: HavuzSeri["model"] }[]) {
  await havuzaEkle(seriler.map((x) => ({ seriNo: x.seriNo, model: x.model, partiId: "iptal" })));
}
/** Siparişe atanan seri numaraları havuzdan çıkar (sipariş tarafı çağırır) */
export async function havuzdanCikar(seriler: string[]) {
  if (!seriler.length) return;
  const s = await db();
  sonuc(await s.from("seri_havuzu").delete().in("sh_seri_no", seriler), "Seri no havuzdan çıkarılıyor");
}
export async function fiyatKaydet(f: FiyatListesi) { await ayarYaz("fiyat_listesi", f); }
export async function kargoFirmalariKaydet(l: string[]) { await ayarYaz("kargo_firmalari", l); }
/** Yeni kullanıcıda (id boş ya da veritabanında olmayan) id veritabanından gelir ve nesnenin üstüne yazılır */
export async function kullaniciKaydet(k: Kullanici) {
  const s = await db();
  // Telefon formda yok: verilmediyse mevcut değer korunur
  const alanlar: Record<string, unknown> = { k_ad: k.ad, k_eposta: k.eposta, k_rol: k.rol, k_aktif: k.aktif };
  if (k.telefon !== undefined) alanlar.k_tel = k.telefon || null;
  const no = /^u\d+$/.test(k.id ?? "") ? kullaniciNo(k.id) : null;
  if (no !== null) {
    const r = kesin(await s.from("kullanicilar").update(alanlar).eq("id", no).select("id"), "Kullanıcı güncelleniyor");
    if (r.length) return;
  }
  const yeni = kesin(await s.from("kullanicilar").insert(alanlar).select("id").single(), "Kullanıcı ekleniyor");
  k.id = kullaniciKimligi(yeni.id);
}
