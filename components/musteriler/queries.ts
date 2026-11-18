// Müşteriler: veri okuma ve yazma (Supabase).
// Tablolar: musteri, musteri_yetkilileri (y_sira 0 = birincil), iletisim_izinleri (yetkili + kanal),
// musteri_olaylari (zaman çizelgesi). Plan / lisans bitişi / cihazlar cihazlar tablosundan, açık talep sayısı
// destek_talepleri'nden türetilir.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CihazModeli } from "@/lib/urunler";
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";

export type Segment = "servis" | "muhendislik" | "egitim" | "bayi";
export type Plan = "Basic" | "Pro" | "Pro+" | "Lead";
export type CihazDurumu = "Lisans aktif" | "Süresi doluyor" | "Serviste" | "Lisanssız";
export type OlayTuru = "siparis" | "destek" | "demo" | "teklif" | "arama" | "not";

export type Cihaz = { seriNo: string; model: CihazModeli; firmware: string; durum: CihazDurumu };
/** zaman: "Bugün 11:24 · Sipariş" / "28 Eki · Online" / "6 Kas 2025". _id: musteri_olaylari.id (veritabanından gelenlerde dolu) */
export type Olay = { metin: string; zaman: string; tur: OlayTuru; _id?: number };

import { type IzinKanali, type IzinKaydi } from "./izin";
export * from "./izin";
// İstemci bileşenlerinin de kullandığı sabit ortak.ts'te durur (bu dosya sunucu koduna bağlı); buradan da dışa açılır.
export { SEGMENT_ADI } from "./ortak";

/** Firmadaki iletişim kişisi. Boş alanlar "" olarak tutulur. İlk sıradaki birincil yetkilidir.
 *  id: musteri_yetkilileri.id (yeni eklenen kişide kod geçici bir id verir, kayıttan sonra gerçek id yazılır) */
export type Yetkili = { id: string; ad: string; unvan: string; telefon: string; eposta: string; izinler?: Partial<Record<IzinKanali, IzinKaydi>> };

export type Musteri = {
  id: string;
  ad: string;
  sehir: string;
  ulke: string;
  segment: Segment;
  plan: Plan; // türetilir: cihazların en geç bitişli geçerli lisansı (cihazı yoksa Lead)
  lisansBitis: string | null; // "2027-03-14" (türetilir)
  toplamDeger: number | null; // TL
  sonTemas: string; // "Bugün" / "30 Eki"
  durum: string;
  yetkililer: Yetkili[]; // ilk sıradaki birincil yetkili (Ara / WhatsApp / E-posta düğmeleri)
  vergiNo: string; // boşsa ""
  acikTalep: number; // türetilir: çözülmemiş destek talepleri
  /** @deprecated izinler artık yetkili ve kanal bazında: Yetkili.izinler */
  duyuruIzni?: boolean;
  cihazlar: Cihaz[]; // türetilir: cihazlar.musteri_id
  olaylar: Olay[]; // yeniden eskiye
};

/* ---------- Tarih yardımcıları (sunucunun yerel saati, yerelZaman ile aynı) ---------- */

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const iki = (n: number) => String(n).padStart(2, "0");

/** Yerel tarih "2026-11-06" */
function bugunIso() {
  const d = new Date();
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

/** "2026-10-28" → "28 Eki" (başka yılsa "6 Kas 2025") */
function gunAyYaz(tarih: string) {
  const [y, a, g] = tarih.split("-").map(Number);
  return `${g} ${AYLAR[a - 1]}${String(y) === bugunIso().slice(0, 4) ? "" : ` ${y}`}`;
}

/** created_at + o_kaynak → "Bugün 11:24 · Sipariş" / "28 Eki · Online" / "6 Kas 2025" */
function olayZamani(createdAt: string, kaynak: string | null) {
  const yerel = yerelZaman(createdAt); // "2026-11-04T09:02"
  const gun = yerel.slice(0, 10);
  const bas = gun === bugunIso() ? `Bugün ${yerel.slice(11, 16)}` : gunAyYaz(gun);
  return kaynak ? `${bas} · ${kaynak}` : bas;
}

/** Kodun yazdığı zaman dizesi → created_at + o_kaynak.
 *  "Bugün", "Bugün · X", "Bugün 11:24 · X" → şimdi; "06.11.2026 · X" → o günün öğlesi. */
function olayZamaniCoz(zaman: string): { created_at: string; o_kaynak: string | null } {
  const i = zaman.indexOf(" · ");
  const bas = (i >= 0 ? zaman.slice(0, i) : zaman).trim();
  const kaynak = i >= 0 ? zaman.slice(i + 3).trim() || null : null;
  const t = bas.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) ?? bas.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (t && bas.includes(".")) return { created_at: new Date(Number(t[3]), Number(t[2]) - 1, Number(t[1]), 12).toISOString(), o_kaynak: kaynak };
  if (t) return { created_at: new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3]), 12).toISOString(), o_kaynak: kaynak };
  return { created_at: new Date().toISOString(), o_kaynak: kaynak };
}

/** m_son_temas → "Bugün" / "30 Eki" */
const sonTemasYaz = (tarih: string | null) => (!tarih ? "—" : tarih === bugunIso() ? "Bugün" : gunAyYaz(tarih));
/** "Bugün" / "2026-11-06" → date; tanınmayan biçim undefined (yazılmaz) */
const sonTemasCoz = (v: string) => (v === "Bugün" ? bugunIso() : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/* ---------- Satır ↔ domain ---------- */

type IzinSatiri = { i_kanal: IzinKanali; i_verildi: boolean; i_tarih: string; i_kaynak: string; i_cekilme: string | null };
type YetkiliSatiri = { id: number; y_ad: string; y_unvan: string; y_tel: string; y_eposta: string; y_sira: number; izinler: IzinSatiri[] };
type OlaySatiri = { id: number; o_tur: OlayTuru; o_metin: string; o_kaynak: string | null; created_at: string };
type MusteriCihazSatiri = { c_serino: string; c_model: CihazModeli; c_fw: string | null; c_durum: string; c_lisans_bit: string | null; plan: { l_paket: string } | null };
type MusteriSatiri = {
  id: number;
  m_ad: string;
  m_segment: Segment | null;
  m_sehir: string | null;
  m_ulke: string | null;
  m_vergino: string | null;
  m_durum: string;
  m_toplam_deger: number | string | null;
  m_son_temas: string | null;
  yetkililer: YetkiliSatiri[];
  olaylar: OlaySatiri[];
  cihazlar: MusteriCihazSatiri[];
};

// musteri ↔ cihazlar arasında destek_talepleri üzerinden ikinci bir yol olduğu için yabancı anahtar adı açıkça veriliyor
const MUSTERI_SECIMI = `id, m_ad, m_segment, m_sehir, m_ulke, m_vergino, m_durum, m_toplam_deger, m_son_temas,
  yetkililer:musteri_yetkilileri!musteri_yetkilileri_musteri_id_fkey(id, y_ad, y_unvan, y_tel, y_eposta, y_sira,
    izinler:iletisim_izinleri!iletisim_izinleri_yetkili_id_fkey(i_kanal, i_verildi, i_tarih, i_kaynak, i_cekilme)),
  olaylar:musteri_olaylari!musteri_olaylari_musteri_id_fkey(id, o_tur, o_metin, o_kaynak, created_at),
  cihazlar:cihazlar!cihazlar_musteri_id_fkey(c_serino, c_model, c_fw, c_durum, c_lisans_bit, plan:lisans_planlari!cihazlar_plan_id_fkey(l_paket))`;

const CIHAZ_DURUMU: Record<string, CihazDurumu> = { aktif: "Lisans aktif", bitiyor: "Süresi doluyor", serviste: "Serviste", lisanssiz: "Lisanssız", stokta: "Lisanssız" };
const LISANS_PLANLARI = ["Basic", "Pro", "Pro+"];

/** En geç bitişli geçerli lisansın planı; geçerli lisans yoksa en son bitenin planı; cihazı yoksa Lead */
function planVeBitis(cihazlar: MusteriCihazSatiri[]): { plan: Plan; lisansBitis: string | null } {
  if (!cihazlar.length) return { plan: "Lead", lisansBitis: null };
  const bugun = bugunIso();
  const lisansli = cihazlar
    .filter((c) => c.plan && LISANS_PLANLARI.includes(c.plan.l_paket) && c.c_lisans_bit)
    .sort((a, b) => (a.c_lisans_bit! < b.c_lisans_bit! ? 1 : -1));
  const secilen = lisansli.find((c) => c.c_lisans_bit! >= bugun) ?? lisansli[0];
  if (secilen) return { plan: secilen.plan!.l_paket as Plan, lisansBitis: secilen.c_lisans_bit };
  const planli = cihazlar.find((c) => c.plan && LISANS_PLANLARI.includes(c.plan.l_paket));
  return { plan: (planli?.plan?.l_paket as Plan) ?? "Basic", lisansBitis: null };
}

function satirdanMusteri(r: MusteriSatiri, acikTalep: number): Musteri {
  const yetkililer = [...(r.yetkililer ?? [])]
    .sort((a, b) => a.y_sira - b.y_sira || a.id - b.id)
    .map((y) => ({
      id: String(y.id),
      ad: y.y_ad,
      unvan: y.y_unvan,
      telefon: y.y_tel,
      eposta: y.y_eposta,
      izinler: Object.fromEntries(
        (y.izinler ?? []).map((i) => [i.i_kanal, { verildi: i.i_verildi, tarih: i.i_tarih, kaynak: i.i_kaynak, cekilme: i.i_cekilme }]),
      ) as Partial<Record<IzinKanali, IzinKaydi>>,
    }));
  const olaylar = [...(r.olaylar ?? [])]
    .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
    .map((o) => ({ metin: o.o_metin, zaman: olayZamani(o.created_at, o.o_kaynak), tur: o.o_tur, _id: o.id }));
  const cihazlar = [...(r.cihazlar ?? [])]
    .sort((a, b) => a.c_serino.localeCompare(b.c_serino))
    .map((c) => ({ seriNo: c.c_serino, model: c.c_model, firmware: c.c_fw ?? "—", durum: CIHAZ_DURUMU[c.c_durum] ?? "Lisanssız" }));
  return {
    id: String(r.id),
    ad: r.m_ad,
    sehir: r.m_sehir ?? "—",
    ulke: r.m_ulke ?? "—",
    segment: r.m_segment ?? "servis",
    ...planVeBitis(r.cihazlar ?? []),
    toplamDeger: r.m_toplam_deger == null ? null : Number(r.m_toplam_deger),
    sonTemas: sonTemasYaz(r.m_son_temas),
    durum: r.m_durum,
    yetkililer,
    vergiNo: r.m_vergino ?? "",
    acikTalep,
    cihazlar,
    olaylar,
  };
}

/** musteri_id → çözülmemiş destek talebi sayısı */
async function acikTalepSayilari(s: SupabaseClient, musteriId?: number): Promise<Map<number, number>> {
  let q = s.from("destek_talepleri").select("musteri_id").neq("t_durum", "cozuldu").not("musteri_id", "is", null);
  if (musteriId != null) q = q.eq("musteri_id", musteriId);
  const rows = sonuc(await q, "Açık destek talepleri okunurken") as { musteri_id: number }[];
  const say = new Map<number, number>();
  for (const r of rows) say.set(r.musteri_id, (say.get(r.musteri_id) ?? 0) + 1);
  return say;
}

const sayiKimlik = (id: string) => (/^\d+$/.test(id) ? Number(id) : null);

async function musteriOku(s: SupabaseClient, id: string): Promise<Musteri | null> {
  const no = sayiKimlik(id);
  if (no == null) return null;
  const [r, talepler] = await Promise.all([
    s.from("musteri").select(MUSTERI_SECIMI).eq("id", no).maybeSingle(),
    acikTalepSayilari(s, no),
  ]);
  const satir = sonuc(r, "Müşteri okunurken") as unknown as MusteriSatiri | null;
  return satir ? satirdanMusteri(satir, talepler.get(satir.id) ?? 0) : null;
}

/* ---------- Okuma ---------- */

export async function getMusteriler(): Promise<Musteri[]> {
  const s = await db();
  const [r, talepler] = await Promise.all([
    // Yeni eklenen önde; aynı anda eklenenler (seed) id sırasıyla
    s.from("musteri").select(MUSTERI_SECIMI).order("created_at", { ascending: false }).order("id"),
    acikTalepSayilari(s),
  ]);
  const rows = sonuc(r, "Müşteriler okunurken") as unknown as MusteriSatiri[];
  return rows.map((m) => satirdanMusteri(m, talepler.get(m.id) ?? 0));
}

export async function getMusteri(id: string): Promise<Musteri | null> {
  return musteriOku(await db(), id);
}

/** "Volant Lenkung Service" ile "Volant Lenkung Service GmbH" aynı firma sayılır. */
export async function musteriBulAdla(ad: string): Promise<Musteri | null> {
  const n = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const aranan = n(ad);
  if (!aranan) return null;
  const s = await db();
  const rows = sonuc(await s.from("musteri").select("id, m_ad").order("created_at", { ascending: false }).order("id"), "Müşteri adları okunurken") as { id: number; m_ad: string }[];
  const bulunan = rows.find((m) => n(m.m_ad) === aranan || n(m.m_ad).startsWith(aranan + " ") || aranan.startsWith(n(m.m_ad) + " "));
  return bulunan ? musteriOku(s, String(bulunan.id)) : null;
}

/* ---------- Yazma (yalnızca actions / sunucu kodundan çağrılır) ---------- */

const yetkiliSatiri = (y: Yetkili, musteriId: number, sira: number) => ({
  musteri_id: musteriId, y_ad: y.ad, y_unvan: y.unvan ?? "", y_tel: y.telefon ?? "", y_eposta: y.eposta ?? "", y_sira: sira,
});

const izinSatiri = (yetkiliId: number, kanal: string, i: IzinKaydi) => ({
  yetkili_id: yetkiliId, i_kanal: kanal, i_verildi: i.verildi, i_tarih: i.tarih, i_kaynak: i.kaynak, i_cekilme: i.cekilme,
});

/** Yeni yetkilileri ekler; gerçek id'yi geçirilen nesnenin üstüne yazar ve izinlerini kaydeder */
async function yetkiliEkle(s: SupabaseClient, musteriId: number, y: Yetkili, sira: number) {
  const { id } = sonuc(await s.from("musteri_yetkilileri").insert(yetkiliSatiri(y, musteriId, sira)).select("id").single(), "Yetkili kaydedilirken") as { id: number };
  y.id = String(id);
  const izinler = Object.entries(y.izinler ?? {}).filter(([, i]) => i).map(([k, i]) => izinSatiri(id, k, i!));
  if (izinler.length) sonuc(await s.from("iletisim_izinleri").insert(izinler), "İletişim izinleri kaydedilirken");
}

/** Kodun eklediği (_id'siz) olayları ekler. Liste yeniden eskiye olduğu için sondan başa eklenir. */
async function olaylariEkle(s: SupabaseClient, musteriId: number, olaylar: Olay[]) {
  const yeni = olaylar.filter((o) => o._id == null).reverse();
  for (const o of yeni) {
    const satir = { musteri_id: musteriId, o_tur: o.tur, o_metin: o.metin, ...olayZamaniCoz(o.zaman) };
    const r = await s.from("musteri_olaylari").insert(satir).select("id").single();
    // Bayi oturumu olayı yazabilir ama okuyamaz (RLS): returning'li insert reddedilir, id'siz yeniden yazılır
    if (r.error?.code === "42501") sonuc(await s.from("musteri_olaylari").insert(satir), "Müşteri olayı kaydedilirken");
    else o._id = (sonuc(r, "Müşteri olayı kaydedilirken") as { id: number }).id;
  }
}

/** Kaydı okur, geri çağırmayla değiştirir, farkı yazar ve güncel nesneyi döner.
 *  Yazılanlar: ad, şehir, ülke, segment, durum, vergi no, toplam değer, son temas; yetkililer (ekleme / silme / sıra /
 *  bilgi), iletişim izinleri, yeni olaylar. Türetilen alanlar (plan, lisansBitis, acikTalep, cihazlar) yazılmaz:
 *  onlar cihaz ve destek kayıtlarından gelir. */
export async function musteriyiGuncelle(id: string, degisiklik: (m: Musteri) => void): Promise<Musteri | null> {
  const s = await db();
  const m = await musteriOku(s, id);
  if (!m) return null;
  const once = structuredClone(m);
  degisiklik(m);
  const no = Number(once.id);

  const d: Record<string, unknown> = {};
  if (m.ad !== once.ad) d.m_ad = m.ad;
  if (m.sehir !== once.sehir) d.m_sehir = m.sehir;
  if (m.ulke !== once.ulke) d.m_ulke = m.ulke;
  if (m.segment !== once.segment) d.m_segment = m.segment;
  if (m.durum !== once.durum) d.m_durum = m.durum;
  if (m.vergiNo !== once.vergiNo) d.m_vergino = m.vergiNo || null;
  if (m.toplamDeger !== once.toplamDeger) d.m_toplam_deger = m.toplamDeger;
  const sonTemas = sonTemasCoz(m.sonTemas); // "Bugün" → bugünün tarihi
  if (sonTemas && sonTemasYaz(sonTemas) !== once.sonTemas) d.m_son_temas = sonTemas;
  if (Object.keys(d).length) sonuc(await s.from("musteri").update(d).eq("id", no), "Müşteri güncellenirken");

  // Yetkililer
  const eskiler = new Map(once.yetkililer.map((y) => [y.id, y]));
  const kalanlar = new Set(m.yetkililer.map((y) => y.id));
  const silinen = once.yetkililer.filter((y) => !kalanlar.has(y.id)).map((y) => Number(y.id));
  if (silinen.length) sonuc(await s.from("musteri_yetkilileri").delete().in("id", silinen), "Yetkili silinirken");
  for (const [sira, y] of m.yetkililer.entries()) {
    const eski = eskiler.get(y.id);
    if (!eski) {
      await yetkiliEkle(s, no, y, sira);
      continue;
    }
    const eskiSira = once.yetkililer.indexOf(eski);
    if (eski.ad !== y.ad || eski.unvan !== y.unvan || eski.telefon !== y.telefon || eski.eposta !== y.eposta || eskiSira !== sira) {
      sonuc(await s.from("musteri_yetkilileri").update(yetkiliSatiri(y, no, sira)).eq("id", Number(y.id)), "Yetkili güncellenirken");
    }
    // İzinler: değişen kanallar upsert (yetkili + kanal unique); kayıt silinmez, geri çekilme tarihiyle kalır
    const degisen = Object.entries(y.izinler ?? {})
      .filter(([k, i]) => i && JSON.stringify(i) !== JSON.stringify(eski.izinler?.[k as IzinKanali]))
      .map(([k, i]) => izinSatiri(Number(y.id), k, i!));
    if (degisen.length) sonuc(await s.from("iletisim_izinleri").upsert(degisen, { onConflict: "yetkili_id,i_kanal" }), "İletişim izinleri kaydedilirken");
  }

  // Olaylar: yeniler eklenir, listeden çıkarılanlar silinir
  const kalanOlay = new Set(m.olaylar.map((o) => o._id).filter((x) => x != null));
  const silinenOlay = once.olaylar.map((o) => o._id!).filter((x) => !kalanOlay.has(x));
  if (silinenOlay.length) sonuc(await s.from("musteri_olaylari").delete().in("id", silinenOlay), "Müşteri olayı silinirken");
  await olaylariEkle(s, no, m.olaylar);

  m.id = once.id;
  if (d.m_son_temas) m.sonTemas = sonTemasYaz(d.m_son_temas as string);
  return m;
}

/** Yeni müşteri: kayıt + yetkililer + izinler + olaylar. Veritabanının verdiği id'ler geçirilen nesnenin üstüne yazılır.
 *  Not: plan / lisansBitis / cihazlar saklanmaz; müşterinin cihazı olunca cihaz kayıtlarından türetilir. */
export async function musteriEkle(m: Musteri) {
  const s = await db();
  const { id } = sonuc(
    await s
      .from("musteri")
      .insert({
        m_ad: m.ad,
        m_segment: m.segment,
        m_sehir: m.sehir,
        m_ulke: m.ulke,
        m_vergino: m.vergiNo || null,
        m_durum: m.durum,
        m_toplam_deger: m.toplamDeger,
        m_son_temas: sonTemasCoz(m.sonTemas) ?? null,
      })
      .select("id")
      .single(),
    "Müşteri kaydedilirken",
  ) as { id: number };
  m.id = String(id);
  for (const [sira, y] of (m.yetkililer ?? []).entries()) await yetkiliEkle(s, id, y, sira);
  await olaylariEkle(s, id, m.olaylar ?? []);
}
