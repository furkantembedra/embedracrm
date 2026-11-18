// Destek: veri okuma ve yazma (Supabase: destek_talepleri + talep_notlari).
// Talep numarası = destek_talepleri.id (identity). Müşteri / yetkili / plan / firmware açılış anındaki anlık kopyadır.
import { KANALLAR, ONCELIKLER } from "@/lib/constants";
import { KONULAR, DURUM_ADI, NOT_BILGI } from "./sabitler";
export { KONULAR, DURUM_ADI, NOT_BILGI };
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";

export type TalepDurumu = "yeni" | "islemde" | "beklemede" | "cozuldu";
export type Oncelik = (typeof ONCELIKLER)[number];
export type Kanal = (typeof KANALLAR)[number] | "Bayi portalı"; // bayi portalı yalnızca portaldan açılan talepte

export type Konu = (typeof KONULAR)[number];

// bayi: bayinin portaldan yazdığı mesaj · bayiye: Embedra'nın bayiye görünen yanıtı (diğer notlar iç nottur, bayi görmez)
export type NotTuru = "acilis" | "not" | "gorusme" | "yapilacak" | "beklemede" | "cozuldu" | "islemde" | "yeniden" | "bayi" | "bayiye";
// _id: talep_notlari.id (veritabanından gelen notlarda dolu; kodun yeni eklediği notta boş → kaydedilirken insert edilir)
export type TalepNotu = { tur: NotTuru; metin: string; zaman: string; dosya?: string; _id?: number }; // zaman: "2026-11-04T09:35"

export type Talep = {
  id: string; // "4821"
  durum: TalepDurumu;
  baslik: string;
  aciklama: string;
  oncelik: Oncelik;
  konu: Konu;
  kanal: Kanal;
  acilis: string; // "2026-11-04T09:02"
  dosya: string | null;
  musteriId: string | null;
  musteri: string;
  yetkili: string;
  telefon: string;
  eposta: string;
  seriNo: string | null;
  plan: string;
  firmware: string;
  arac: string;
  notlar: TalepNotu[]; // eskiden yeniye
  bayiId?: string | null; // bayi portalından açılan talep: bayi durumu ve "bayiye yanıt" notlarını portalda görür
};

// ─────────────────────────────────────────────────────────────
// Satır ↔ domain dönüşümleri
// ─────────────────────────────────────────────────────────────

const TALEP_SEC =
  "id, musteri_id, bayi_id, t_kanal, t_konu, t_oncelik, t_baslik, t_aciklama, t_arac, t_durum, t_dosya, created_at, " +
  "t_musteri_adi, t_yetkili, t_telefon, t_eposta, t_plan, t_firmware, cihaz:cihazlar(c_serino), " +
  "talep_notlari(id, n_tur, n_metin, n_dosya, created_at)";

type NotSatiri = { id: number; n_tur: NotTuru; n_metin: string; n_dosya: string | null; created_at: string };
type TalepSatiri = {
  id: number; musteri_id: number | null; bayi_id: number | null; t_kanal: Kanal; t_konu: Konu; t_oncelik: Oncelik;
  t_baslik: string; t_aciklama: string; t_arac: string | null; t_durum: TalepDurumu; t_dosya: string | null; created_at: string;
  t_musteri_adi: string; t_yetkili: string; t_telefon: string; t_eposta: string; t_plan: string; t_firmware: string;
  cihaz: { c_serino: string } | null; talep_notlari: NotSatiri[] | null;
};

/** "4821" / "6" → 4821; sayı olmayan kimlik (eski slug, uuid) → null */
const sayiNo = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

/** Uygulamanın yerel saat dizesi ("2026-11-04T09:02") → timestamptz için ISO (sunucunun saat dilimiyle; yerelZaman'ın tersi) */
function yereldenIso(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function notCevir(n: NotSatiri): TalepNotu {
  return { tur: n.n_tur, metin: n.n_metin, zaman: yerelZaman(n.created_at), ...(n.n_dosya ? { dosya: n.n_dosya } : {}), _id: n.id };
}

function talepCevir(r: TalepSatiri): Talep {
  const notlar = [...(r.talep_notlari ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id).map(notCevir);
  return {
    id: String(r.id),
    durum: r.t_durum,
    baslik: r.t_baslik,
    aciklama: r.t_aciklama,
    oncelik: r.t_oncelik,
    konu: r.t_konu,
    kanal: r.t_kanal,
    acilis: yerelZaman(r.created_at),
    dosya: r.t_dosya,
    musteriId: r.musteri_id != null ? String(r.musteri_id) : null,
    musteri: r.t_musteri_adi,
    yetkili: r.t_yetkili,
    telefon: r.t_telefon,
    eposta: r.t_eposta,
    seriNo: r.cihaz?.c_serino ?? null,
    plan: r.t_plan,
    firmware: r.t_firmware,
    arac: r.t_arac ?? "—",
    notlar,
    bayiId: r.bayi_id != null ? String(r.bayi_id) : null,
  };
}

/** Seri no → cihazlar.id (kayıtlı değilse null) */
async function cihazNo(seriNo: string | null): Promise<number | null> {
  if (!seriNo) return null;
  const s = await db();
  const r = sonuc(await s.from("cihazlar").select("id").eq("c_serino", seriNo).maybeSingle(), "Cihaz aranırken");
  return (r as { id: number } | null)?.id ?? null;
}

/** Talebin skaler alanları → destek_talepleri sütunları (id, açılış ve cihaz hariç) */
function talepSutunlari(t: Omit<Talep, "id">) {
  return {
    musteri_id: sayiNo(t.musteriId),
    bayi_id: sayiNo(t.bayiId ?? null),
    t_kanal: t.kanal,
    t_konu: t.konu,
    t_oncelik: t.oncelik,
    t_baslik: t.baslik,
    t_aciklama: t.aciklama,
    t_arac: t.arac,
    t_durum: t.durum,
    t_dosya: t.dosya,
    t_musteri_adi: t.musteri,
    t_yetkili: t.yetkili,
    t_telefon: t.telefon,
    t_eposta: t.eposta,
    t_plan: t.plan,
    t_firmware: t.firmware,
  };
}

const notSatiri = (talepId: number, n: TalepNotu) => ({
  talep_id: talepId, n_tur: n.tur, n_metin: n.metin, n_dosya: n.dosya ?? null, created_at: yereldenIso(n.zaman),
});

// ─────────────────────────────────────────────────────────────
// Okuma
// ─────────────────────────────────────────────────────────────

/** En yeni talep başta. Bayi oturumunda RLS yalnızca bayinin taleplerini ve bayiye açık notları döner. */
export async function getTalepler(): Promise<Talep[]> {
  const s = await db();
  const r = sonuc(await s.from("destek_talepleri").select(TALEP_SEC).order("id", { ascending: false }), "Destek talepleri okunurken");
  return (r as unknown as TalepSatiri[]).map(talepCevir);
}

export async function getTalep(id: string): Promise<Talep | null> {
  const no = sayiNo(id);
  if (no === null) return null;
  const s = await db();
  const r = sonuc(await s.from("destek_talepleri").select(TALEP_SEC).eq("id", no).maybeSingle(), "Destek talebi okunurken");
  return r ? talepCevir(r as unknown as TalepSatiri) : null;
}

// ─────────────────────────────────────────────────────────────
// Yazma (yalnızca action dosyalarından çağrılır)
// ─────────────────────────────────────────────────────────────

/** Talebi ve notlarını kaydeder; talep numarası veritabanının verdiği id'dir. */
export async function talepEkle(t: Omit<Talep, "id">): Promise<Talep> {
  const s = await db();
  const satir = sonuc(
    await s
      .from("destek_talepleri")
      .insert({ ...talepSutunlari(t), cihaz_id: await cihazNo(t.seriNo), created_at: yereldenIso(t.acilis) })
      .select("id")
      .single(),
    "Destek talebi kaydedilirken",
  ) as { id: number };
  if (t.notlar.length) {
    sonuc(await s.from("talep_notlari").insert(t.notlar.map((n) => notSatiri(satir.id, n))), "Talep notları kaydedilirken");
  }
  return (await getTalep(String(satir.id))) ?? { ...t, id: String(satir.id) };
}

/** Talebi okur, geri çağırmayla değiştirir, farkı yazar (skaler alanlar tek update; notlarda eklenen/silinen/değişen) ve güncel talebi döner. */
export async function talebiGuncelle(id: string, degisiklik: (t: Talep) => void): Promise<Talep | null> {
  const eski = await getTalep(id);
  if (!eski) return null;
  const t = structuredClone(eski);
  degisiklik(t);
  const no = Number(eski.id);
  const s = await db();

  const sutunlar: Record<string, unknown> = talepSutunlari(t);
  if (t.seriNo !== eski.seriNo) sutunlar.cihaz_id = await cihazNo(t.seriNo);
  if (t.acilis !== eski.acilis) sutunlar.created_at = yereldenIso(t.acilis);
  sonuc(await s.from("destek_talepleri").update(sutunlar).eq("id", no), "Destek talebi güncellenirken");

  // Notlar: kalanlar (_id'li) korunur / güncellenir, çıkarılanlar silinir, _id'siz olanlar eklenir
  const kalan = new Set(t.notlar.flatMap((n) => (n._id ? [n._id] : [])));
  const silinen = eski.notlar.filter((n) => n._id && !kalan.has(n._id)).map((n) => n._id!);
  if (silinen.length) sonuc(await s.from("talep_notlari").delete().in("id", silinen), "Talep notları silinirken");
  for (const n of t.notlar) {
    if (!n._id) continue;
    const o = eski.notlar.find((x) => x._id === n._id);
    if (o && (o.tur !== n.tur || o.metin !== n.metin || o.zaman !== n.zaman || (o.dosya ?? null) !== (n.dosya ?? null))) {
      const { talep_id: _, ...degisen } = notSatiri(no, n);
      sonuc(await s.from("talep_notlari").update(degisen).eq("id", n._id), "Talep notu güncellenirken");
    }
  }
  const yeni = t.notlar.filter((n) => !n._id);
  if (yeni.length) sonuc(await s.from("talep_notlari").insert(yeni.map((n) => notSatiri(no, n))), "Talep notları kaydedilirken");

  return getTalep(id);
}

/** Yalnızca ekranda öneri: max(id) + 1. Gerçek numara kayıtta veritabanının verdiği id'dir (talepEkle dönüşü). */
export async function sonrakiTalepNo(): Promise<string> {
  const s = await db();
  const r = sonuc(await s.from("destek_talepleri").select("id").order("id", { ascending: false }).limit(1), "Talep numarası okunurken");
  return String(((r as { id: number }[])[0]?.id ?? 0) + 1);
}
