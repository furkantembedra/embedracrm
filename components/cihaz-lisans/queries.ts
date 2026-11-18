// Cihaz & Lisans: veri okuma ve yazma (Supabase).
// Tablolar: cihazlar (güncel lisans: plan_id / c_lisans_bat / c_lisans_bit), lisanslar (lisans geçmişi),
// cihaz_surum_gecmisi (firmware değişiklikleri). Cihazın adresi ve domain kimliği seri numarasıdır (c_serino).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CihazModeli } from "@/lib/urunler";
import { CIHAZ_MODELLERI } from "@/lib/urunler";
import { db, sonuc } from "@/lib/supabase/db";
import { guncelDurum } from "./ortak";

export type LisansPlani = "Basic" | "Pro" | "Pro+";
export type CihazDurumu = "aktif" | "bitiyor" | "lisanssiz" | "stokta"; // stokta: bayiye sevk edildi, henüz müşteriye satılmadı

export type LisansKaydi = { plan: LisansPlani; baslangic: string; bitis: string };

/** Cihazın bildirdiği (veya elle girilen) sürüm değişikliği */
export type SurumKaydi = { zaman: string; eski: string; yeni: string; kaynak: "cihaz" | "elle" }; // zaman: ISO

export type Cihaz = {
  seriNo: string; // aynı zamanda adres: /cihaz-lisans/EO1-2402-0611
  model: CihazModeli;
  musteriId: string | null;
  musteri: string;
  ulke: string;
  plan: LisansPlani;
  lisansBaslangic: string | null; // "2026-03-14" (aktivasyon)
  lisansBitis: string | null; // "2027-03-14"
  firmware: string; // "v2.4.1"
  durum: CihazDurumu;
  gecmis: LisansKaydi[]; // yeniden eskiye
  sonGorulme?: string | null; // ONESuite'in son bildirim zamanı (ISO). Hiç bağlanmadıysa yok
  surumGecmisi?: SurumKaydi[]; // yeniden eskiye
  bayiId?: string | null; // bayi üzerinden satıldıysa (bayi stoğundayken de dolu)
  stogaGiris?: string | null; // bayiye sevk tarihi "2026-11-05"
};

export type CihazOzeti = {
  kayitli: number;
  ulke: number;
  aktif: number;
  bitiyor: number; // 30 gün içinde
  planlar: Record<LisansPlani, number>;
  modeller: Record<CihazModeli, number>; // kayıtlı cihazların model dağılımı
  firmware: { surum: string; adet: number; renk: string }[];
};

// İstemci bileşenlerinin de kullandığı sabitler ortak.ts'te durur (bu dosya sunucu koduna bağlı); buradan da dışa açılır.
export { DURUM_ADI, PLAN_ACIKLAMASI, GUNCEL_FIRMWARE } from "./ortak";

/* ---------- Satır ↔ domain dönüşümü ---------- */

type PlanGomulu = { l_paket: string } | null;
type CihazSatiri = {
  id: number;
  c_serino: string;
  c_model: CihazModeli;
  c_fw: string | null;
  c_durum: string;
  musteri_id: number | null;
  c_sahip_adi: string | null;
  c_ulke: string | null;
  c_lisans_bat: string | null;
  c_lisans_bit: string | null;
  c_son_gorulme: string | null;
  bayi_id: number | null;
  c_stoga_giris: string | null;
  plan: PlanGomulu;
  sahip: { m_ad: string } | null;
  bayi: { by_ad: string } | null;
  lisanslar: { id: number; l_bat: string; l_bit: string; plan: PlanGomulu }[];
  surumler: { id: number; sg_eski: string; sg_yeni: string; sg_kaynak: "cihaz" | "elle"; created_at: string }[];
};

// cihazlar ile musteri / bayiler / lisans_planlari arasında birden fazla ilişki yolu var (destek_talepleri, lisanslar…),
// bu yüzden gömmelerde yabancı anahtar adı açıkça veriliyor.
const CIHAZ_SECIMI = `id, c_serino, c_model, c_fw, c_durum, musteri_id, c_sahip_adi, c_ulke, c_lisans_bat, c_lisans_bit,
  c_son_gorulme, bayi_id, c_stoga_giris,
  plan:lisans_planlari!cihazlar_plan_id_fkey(l_paket),
  sahip:musteri!cihazlar_musteri_id_fkey(m_ad),
  bayi:bayiler!cihazlar_bayi_id_fkey(by_ad),
  lisanslar:lisanslar!lisanslar_cihaz_id_fkey(id, l_bat, l_bit, plan:lisans_planlari!lisanslar_plan_id_fkey(l_paket)),
  surumler:cihaz_surum_gecmisi!cihaz_surum_gecmisi_cihaz_id_fkey(id, sg_eski, sg_yeni, sg_kaynak, created_at)`;

const PLANLAR: LisansPlani[] = ["Basic", "Pro", "Pro+"];
const planAdi = (p: PlanGomulu): LisansPlani => (p && (PLANLAR as string[]).includes(p.l_paket) ? (p.l_paket as LisansPlani) : "Basic");
const isoZaman = (v: string | null) => (v ? new Date(v).toISOString() : null);
/** Domain'deki string kimlik → bigint (eski slug'lar gibi sayı olmayan değerler null) */
const sayiKimlik = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

/** c_durum 'serviste' domain tipinde yok: lisanssız gösterilir (ekrandaki durum zaten guncelDurum ile tarihten hesaplanır) */
function durumCevir(d: string): CihazDurumu {
  return d === "aktif" || d === "bitiyor" || d === "stokta" ? d : "lisanssiz";
}

function satirdanCihaz(r: CihazSatiri): Cihaz {
  const gecmis = [...(r.lisanslar ?? [])]
    .sort((a, b) => (a.l_bat === b.l_bat ? b.id - a.id : a.l_bat < b.l_bat ? 1 : -1))
    .map((l) => ({ plan: planAdi(l.plan), baslangic: l.l_bat, bitis: l.l_bit }));
  const surumGecmisi = [...(r.surumler ?? [])]
    .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
    .map((v) => ({ zaman: new Date(v.created_at).toISOString(), eski: v.sg_eski, yeni: v.sg_yeni, kaynak: v.sg_kaynak }));
  return {
    seriNo: r.c_serino,
    model: r.c_model,
    musteriId: r.musteri_id != null ? String(r.musteri_id) : null,
    // Müşteri kaydı varsa güncel adı oradan; yoksa son kullanıcı / bayi adı (c_sahip_adi)
    musteri: r.sahip?.m_ad ?? r.c_sahip_adi ?? r.bayi?.by_ad ?? "—",
    ulke: r.c_ulke ?? "—",
    plan: planAdi(r.plan),
    lisansBaslangic: r.c_lisans_bat,
    lisansBitis: r.c_lisans_bit,
    firmware: r.c_fw ?? "—",
    durum: durumCevir(r.c_durum),
    gecmis,
    sonGorulme: isoZaman(r.c_son_gorulme),
    surumGecmisi,
    bayiId: r.bayi_id != null ? String(r.bayi_id) : null,
    stogaGiris: r.c_stoga_giris,
  };
}

/** l_paket → lisans_planlari.id */
async function planKimlikleri(s: SupabaseClient): Promise<Map<string, number>> {
  const rows = sonuc(await s.from("lisans_planlari").select("id, l_paket"), "Lisans planları okunurken") as { id: number; l_paket: string }[];
  return new Map(rows.map((r) => [r.l_paket, r.id]));
}

const lisansAnahtari = (l: LisansKaydi) => `${l.plan}|${l.baslangic}|${l.bitis}`;
const surumAnahtari = (v: SurumKaydi) => `${new Date(v.zaman).toISOString()}|${v.eski}|${v.yeni}`;

/** b listesinde olup a'da olmayanlar (tekrarlı kayıtlar sayıca karşılaştırılır) */
function fark<T>(b: T[], a: T[], anahtar: (x: T) => string): T[] {
  const kalan = new Map<string, number>();
  for (const x of a) kalan.set(anahtar(x), (kalan.get(anahtar(x)) ?? 0) + 1);
  return b.filter((x) => {
    const n = kalan.get(anahtar(x)) ?? 0;
    if (n > 0) {
      kalan.set(anahtar(x), n - 1);
      return false;
    }
    return true;
  });
}

async function gecmisEkle(s: SupabaseClient, cihazId: number, lisanslar: LisansKaydi[], surumler: SurumKaydi[]) {
  if (lisanslar.length) {
    const planlar = await planKimlikleri(s);
    // Eskiden yeniye eklenir: aynı başlangıçlı kayıtlarda sonra eklenen (yeni id) önce görünür
    const satirlar = [...lisanslar].reverse().map((l) => ({ cihaz_id: cihazId, plan_id: planlar.get(l.plan), l_bat: l.baslangic, l_bit: l.bitis }));
    sonuc(await s.from("lisanslar").insert(satirlar), "Lisans geçmişi kaydedilirken");
  }
  if (surumler.length) {
    const satirlar = [...surumler].reverse().map((v) => ({ cihaz_id: cihazId, sg_eski: v.eski, sg_yeni: v.yeni, sg_kaynak: v.kaynak, created_at: v.zaman }));
    sonuc(await s.from("cihaz_surum_gecmisi").insert(satirlar), "Sürüm geçmişi kaydedilirken");
  }
}

async function cihazSatiri(s: SupabaseClient, seriNo: string): Promise<CihazSatiri | null> {
  return sonuc(await s.from("cihazlar").select(CIHAZ_SECIMI).eq("c_serino", seriNo).maybeSingle(), "Cihaz okunurken") as unknown as CihazSatiri | null;
}

/* ---------- Okuma ---------- */

export async function getCihazlar(): Promise<Cihaz[]> {
  const s = await db();
  const rows = sonuc(await s.from("cihazlar").select(CIHAZ_SECIMI).order("created_at", { ascending: false }).order("id"), "Cihazlar okunurken") as unknown as CihazSatiri[];
  return rows.map(satirdanCihaz);
}

export async function getCihaz(seriNo: string): Promise<Cihaz | null> {
  const r = await cihazSatiri(await db(), seriNo);
  return r ? satirdanCihaz(r) : null;
}

/** Belirli bir zamandan sonra bildirim gönderen cihazlar (açık sayfanın canlı güncellenmesi için) */
export async function getSonBildirenler(sonra: string): Promise<Cihaz[]> {
  const s = await db();
  const rows = sonuc(await s.from("cihazlar").select(CIHAZ_SECIMI).gt("c_son_gorulme", sonra), "Son bildiren cihazlar okunurken") as unknown as CihazSatiri[];
  return rows.map(satirdanCihaz);
}

/* ---------- Yazma (yalnızca actions / sunucu kodundan çağrılır) ---------- */

/** Kaydı tamamen siler (yalnızca iptal edilen siparişe atanmış, hiç kullanılmamış cihazlar için) */
export async function cihazSilDepo(seriNo: string): Promise<boolean> {
  const s = await db();
  const rows = sonuc(await s.from("cihazlar").delete().eq("c_serino", seriNo).select("id"), "Cihaz silinirken") as { id: number }[];
  return rows.length > 0;
}

/** Yeni cihaz kaydı (lisans ve sürüm geçmişiyle). Seri no zaten kayıtlıysa false. */
export async function cihazEkleDepo(c: Cihaz): Promise<boolean> {
  const s = await db();
  const planlar = c.plan ? await planKimlikleri(s) : new Map<string, number>();
  const r = await s
    .from("cihazlar")
    .insert({
      c_serino: c.seriNo,
      c_model: c.model,
      c_fw: c.firmware && c.firmware !== "—" ? c.firmware : null,
      c_durum: c.durum,
      musteri_id: sayiKimlik(c.musteriId),
      c_sahip_adi: c.musteri && c.musteri !== "—" ? c.musteri : null,
      c_ulke: c.ulke && c.ulke !== "—" ? c.ulke : null,
      plan_id: planlar.get(c.plan) ?? null,
      c_lisans_bat: c.lisansBaslangic,
      c_lisans_bit: c.lisansBitis,
      c_son_gorulme: c.sonGorulme ?? null,
      bayi_id: sayiKimlik(c.bayiId),
      c_stoga_giris: c.stogaGiris ?? null,
    })
    .select("id")
    .single();
  if (r.error?.code === "23505") return false; // c_serino unique
  const { id } = sonuc(r, "Cihaz kaydedilirken") as { id: number };
  await gecmisEkle(s, id, c.gecmis ?? [], c.surumGecmisi ?? []);
  return true;
}

/** Cihazı okur, geri çağırmayla değiştirir, farkı yazar: değişen sütunlar cihazlar'a, yeni lisans kayıtları
 *  lisanslar'a, yeni sürüm kayıtları cihaz_surum_gecmisi'ne. Geçmişten çıkarılan kayıtlar silinir. */
export async function cihaziGuncelle(seriNo: string, yeni: (c: Cihaz) => Cihaz): Promise<Cihaz | null> {
  const s = await db();
  const satir = await cihazSatiri(s, seriNo);
  if (!satir) return null;
  const eski = satirdanCihaz(satir);
  const once = structuredClone(eski);
  const g = yeni(eski);

  const d: Record<string, unknown> = {};
  if (g.seriNo !== once.seriNo) d.c_serino = g.seriNo;
  if (g.model !== once.model) d.c_model = g.model;
  if (g.firmware !== once.firmware) d.c_fw = g.firmware && g.firmware !== "—" ? g.firmware : null;
  if (g.durum !== once.durum) d.c_durum = g.durum;
  if ((g.musteriId ?? null) !== once.musteriId) d.musteri_id = sayiKimlik(g.musteriId);
  if (g.musteri !== once.musteri || "musteri_id" in d) d.c_sahip_adi = g.musteri && g.musteri !== "—" ? g.musteri : null;
  if (g.ulke !== once.ulke) d.c_ulke = g.ulke && g.ulke !== "—" ? g.ulke : null;
  if (g.plan !== once.plan) d.plan_id = (await planKimlikleri(s)).get(g.plan) ?? null;
  if (g.lisansBaslangic !== once.lisansBaslangic) d.c_lisans_bat = g.lisansBaslangic;
  if (g.lisansBitis !== once.lisansBitis) d.c_lisans_bit = g.lisansBitis;
  if ((g.sonGorulme ?? null) !== once.sonGorulme) d.c_son_gorulme = g.sonGorulme ?? null;
  if ((g.bayiId ?? null) !== once.bayiId) d.bayi_id = sayiKimlik(g.bayiId);
  if ((g.stogaGiris ?? null) !== once.stogaGiris) d.c_stoga_giris = g.stogaGiris ?? null;
  if (Object.keys(d).length) sonuc(await s.from("cihazlar").update(d).eq("id", satir.id), "Cihaz güncellenirken");

  // Lisans geçmişi: yeni kayıtlar eklenir, listeden çıkarılanlar silinir
  const gecmis = g.gecmis ?? [];
  const silinenLisans = fark(once.gecmis, gecmis, lisansAnahtari);
  if (silinenLisans.length) {
    const kimlikler = silinenLisans.map((l) => satir.lisanslar.find((x) => lisansAnahtari({ plan: planAdi(x.plan), baslangic: x.l_bat, bitis: x.l_bit }) === lisansAnahtari(l))?.id).filter((x): x is number => x != null);
    if (kimlikler.length) sonuc(await s.from("lisanslar").delete().in("id", kimlikler), "Lisans geçmişi güncellenirken");
  }
  const surumler = g.surumGecmisi ?? [];
  await gecmisEkle(s, satir.id, fark(gecmis, once.gecmis, lisansAnahtari), fark(surumler, once.surumGecmisi ?? [], surumAnahtari));
  return g;
}

/* ---------- Özet ---------- */

const FIRMWARE_GRUPLARI = [
  { surum: "v2.4.1 (güncel)", renk: "#B6DD2E" },
  { surum: "v2.4.0", renk: "#0E0F0C" },
  { surum: "v2.3.x", renk: "#E58A2B" },
  { surum: "v2.2.x ve öncesi", renk: "#D93F3F" },
] as const;

/** "v2.4.1" → 0 (güncel) … 3 (v2.2.x ve öncesi); sürümü bilinmeyen cihaz hiçbir gruba girmez */
function firmwareGrubu(fw: string | null): number | null {
  const m = fw?.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  const [buyuk, orta, kucuk] = m.slice(1).map(Number);
  const n = buyuk * 1_000_000 + orta * 1_000 + kucuk;
  if (n >= 2_004_001) return 0;
  if (n >= 2_004_000) return 1;
  if (n >= 2_003_000) return 2;
  return 3;
}

/** Filo geneli sayılar: kayıtlı cihazlardan hesaplanır (durumlar ekrandaki guncelDurum kuralıyla) */
export async function getCihazOzeti(): Promise<CihazOzeti> {
  const s = await db();
  const rows = sonuc(
    await s.from("cihazlar").select("c_model, c_fw, c_ulke, c_durum, musteri_id, bayi_id, c_lisans_bat, c_lisans_bit, plan:lisans_planlari!cihazlar_plan_id_fkey(l_paket)"),
    "Cihaz özeti okunurken",
  ) as unknown as Pick<CihazSatiri, "c_model" | "c_fw" | "c_ulke" | "c_durum" | "musteri_id" | "bayi_id" | "c_lisans_bat" | "c_lisans_bit" | "plan">[];

  const d = new Date();
  const bugun = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ozet: CihazOzeti = {
    kayitli: rows.length,
    ulke: new Set(rows.map((r) => r.c_ulke).filter(Boolean)).size,
    aktif: 0,
    bitiyor: 0,
    planlar: { Basic: 0, Pro: 0, "Pro+": 0 },
    modeller: Object.fromEntries(CIHAZ_MODELLERI.map((m) => [m, 0])) as Record<CihazModeli, number>,
    firmware: FIRMWARE_GRUPLARI.map((f) => ({ ...f, adet: 0 })),
  };
  for (const r of rows) {
    const c = {
      musteriId: r.musteri_id != null ? String(r.musteri_id) : null,
      bayiId: r.bayi_id != null ? String(r.bayi_id) : null,
      lisansBaslangic: r.c_lisans_bat,
      lisansBitis: r.c_lisans_bit,
      durum: durumCevir(r.c_durum),
    } as Cihaz;
    const durum = guncelDurum(c, bugun);
    if (durum === "aktif") ozet.aktif++;
    if (durum === "bitiyor") ozet.bitiyor++;
    // Plan dağılımı sayfadaki kanal sayımıyla aynı kural: lisanssız ve bayi stoğundakiler sayılmaz
    if (c.durum !== "lisanssiz" && !(c.bayiId && !c.musteriId)) ozet.planlar[planAdi(r.plan)]++;
    if (r.c_model in ozet.modeller) ozet.modeller[r.c_model]++;
    const grup = firmwareGrubu(r.c_fw);
    if (grup !== null) ozet.firmware[grup].adet++;
  }
  return ozet;
}
