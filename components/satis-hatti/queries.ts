// Satış Hattı: veri okuma ve yazma (Supabase).
// Tablolar: satis_hatti (aşama: asama.kod, kaynak: kaynak.f_kaynak, sıra: f_sira, sorumlu: kullanicilar), konusmalar +
// konusma_mesajlari (salt okunur özet; yazışma Bot › Gelen kutusu'nda, yalnızca components/konusma üzerinden yazılır).
import type { SupabaseClient } from "@supabase/supabase-js";
import { db, sonuc } from "@/lib/supabase/db";
import { ASAMALAR, KAYNAKLAR, type Asama, type KayipBilgisi, type KayipNedeni, type Kaynak } from "./sabitler";

export * from "./sabitler";

/** Fırsata bağlı en son konuşmanın özeti (kart: son mesaj, kanal, bot durumu, "Konuşmayı aç") */
export type FirsatKonusmasi = {
  id: number;
  kanal: string;
  botAktif: boolean;
  sonMesaj: { metin: string; zaman: string; yon: "gelen" | "giden"; gonderen: "musteri" | "bot" | "temsilci" } | null; // zaman: ISO
};

export type Firsat = {
  id: string;
  firma: string;
  konum: string;
  kaynak: Kaynak;
  icerik: string; // "2× ONE + Pro+ lisans"
  tutar: number; // TL
  asama: Asama;
  sonrakiAdim: string;
  sonrakiTarih: string; // "2026-11-05"
  kayipNedeni?: KayipNedeni; // yalnızca Kaybedildi aşamasında
  kayipAciklama?: string; // "Diğer" seçilince yazılan sebep
  kampanyaId?: string | null; // lead hangi pazarlama kampanyasından geldi
  telefon?: string; // "+905321234567" (WhatsApp lead'lerinde otomatik dolar)
  konusma?: FirsatKonusmasi | null; // salt okunur (konuşmalar Bot › Gelen kutusu'nda)
  sorumluId?: string | null; // "u2"; konuşmanın atanmış kişisi
  sorumluAd?: string | null;
  sonHareket?: string; // "2026-11-06" son aşama / bilgi değişikliği (hatırlatmalardaki "hareketsiz" kuralı)
};


/* ---------- Satır ↔ domain ---------- */

type KonusmaSatiri = {
  id: number; kanal: string; bot_aktif: boolean;
  son: { metin: string; zaman: string; yon: "gelen" | "giden"; gonderen: "musteri" | "bot" | "temsilci" }[];
};
type FirsatSatiri = {
  id: number;
  f_firma: string;
  f_konum: string | null;
  f_icerik: string | null;
  f_tutar: number | string | null;
  f_sonraki_adim: string | null;
  f_sonraki_tarih: string | null;
  f_kayip_nedeni: KayipNedeni | null;
  f_kayip_aciklama: string | null;
  kampanya_id: number | null;
  f_telefon: string | null;
  f_son_hareket: string;
  f_sira: number;
  asama: { kod: Asama } | null;
  kaynak: { f_kaynak: string } | null;
  sorumlu_id: number | null;
  sorumlu: { k_ad: string } | null;
  konusmalar: KonusmaSatiri[];
};

const FIRSAT_SECIMI = `id, f_firma, f_konum, f_icerik, f_tutar, f_sonraki_adim, f_sonraki_tarih, f_kayip_nedeni, f_kayip_aciklama,
  kampanya_id, f_telefon, f_son_hareket, f_sira, sorumlu_id,
  asama:asama!satis_hatti_asama_id_fkey(kod),
  kaynak:kaynak!satis_hatti_kaynak_id_fkey(f_kaynak),
  sorumlu:kullanicilar!satis_hatti_sorumlu_id_fkey(k_ad),
  konusmalar:konusmalar!konusmalar_satis_hatti_id_fkey(id, kanal, bot_aktif,
    son:konusma_mesajlari!konusma_mesajlari_konusma_id_fkey(metin, zaman, yon, gonderen))`;

/** Her konuşmadan yalnızca son mesaj (gömülü kaynakta sıralama + limit; PostgREST ebeveyn başına uygular) */
const SON_MESAJ = "konusmalar.son";

function firsatKonusmasi(l: KonusmaSatiri[] | null | undefined): FirsatKonusmasi | null {
  const ozet = (l ?? []).map((k) => ({
    id: Number(k.id), kanal: k.kanal, botAktif: k.bot_aktif,
    sonMesaj: k.son?.[0] ? { ...k.son[0], metin: k.son[0].metin.slice(0, 160), zaman: new Date(k.son[0].zaman).toISOString() } : null,
  }));
  // Birden çok konuşma bağlıysa (ör. iki kanaldan yazan aynı kişi) en son mesajı olanı
  ozet.sort((a, b) => (b.sonMesaj?.zaman ?? "").localeCompare(a.sonMesaj?.zaman ?? ""));
  return ozet[0] ?? null;
}

function satirdanFirsat(r: FirsatSatiri): Firsat {
  return {
    id: String(r.id),
    firma: r.f_firma,
    konum: r.f_konum ?? "—",
    kaynak: (KAYNAKLAR as readonly string[]).includes(r.kaynak?.f_kaynak ?? "") ? (r.kaynak!.f_kaynak as Kaynak) : "Web sitesi",
    icerik: r.f_icerik ?? "",
    tutar: Number(r.f_tutar ?? 0),
    asama: r.asama && (ASAMALAR as readonly string[]).includes(r.asama.kod) ? r.asama.kod : "yeni",
    sonrakiAdim: r.f_sonraki_adim ?? "",
    sonrakiTarih: r.f_sonraki_tarih ?? "",
    kayipNedeni: r.f_kayip_nedeni ?? undefined,
    kayipAciklama: r.f_kayip_aciklama ?? undefined,
    kampanyaId: r.kampanya_id != null ? String(r.kampanya_id) : null,
    telefon: r.f_telefon ?? undefined,
    konusma: firsatKonusmasi(r.konusmalar),
    sorumluId: r.sorumlu_id != null ? `u${r.sorumlu_id}` : null,
    sorumluAd: r.sorumlu?.k_ad ?? null,
    sonHareket: r.f_son_hareket,
  };
}

/** Yerel tarih "2026-11-06" */
function bugunIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sayiKimlik = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

async function asamaKimligi(s: SupabaseClient, kod: Asama): Promise<number> {
  const r = sonuc(await s.from("asama").select("id").eq("kod", kod).single(), "Aşama okunurken") as { id: number };
  return r.id;
}

async function kaynakKimligi(s: SupabaseClient, ad: Kaynak): Promise<number | null> {
  const r = sonuc(await s.from("kaynak").select("id").eq("f_kaynak", ad).maybeSingle(), "Kaynak okunurken") as { id: number } | null;
  return r?.id ?? null;
}

/** Sütunun sonuna eklenecek kartın sırası */
async function sonrakiSira(s: SupabaseClient, asamaId: number): Promise<number> {
  const r = sonuc(
    await s.from("satis_hatti").select("f_sira").eq("asama_id", asamaId).order("f_sira", { ascending: false }).limit(1).maybeSingle(),
    "Satış hattı sırası okunurken",
  ) as { f_sira: number } | null;
  return (r?.f_sira ?? -1) + 1;
}

async function firsatOku(s: SupabaseClient, id: string): Promise<Firsat | null> {
  const no = sayiKimlik(id);
  if (no == null) return null;
  const r = sonuc(await s.from("satis_hatti").select(FIRSAT_SECIMI).eq("id", no)
    .order("zaman", { ascending: false, referencedTable: SON_MESAJ }).limit(1, { referencedTable: SON_MESAJ }).maybeSingle(), "Fırsat okunurken") as unknown as FirsatSatiri | null;
  return r ? satirdanFirsat(r) : null;
}

/** Yeni fırsat satırı; veritabanının verdiği id geçirilen nesnenin üstüne yazılır */
async function firsatYaz(s: SupabaseClient, f: Firsat, sonHareket: string) {
  const asamaId = await asamaKimligi(s, f.asama);
  const { id } = sonuc(
    await s
      .from("satis_hatti")
      .insert({
        f_firma: f.firma,
        f_konum: f.konum,
        kaynak_id: await kaynakKimligi(s, f.kaynak),
        f_icerik: f.icerik,
        f_tutar: f.tutar,
        asama_id: asamaId,
        f_sonraki_adim: f.sonrakiAdim,
        f_sonraki_tarih: f.sonrakiTarih || null,
        f_kayip_nedeni: f.kayipNedeni ?? null,
        f_kayip_aciklama: f.kayipAciklama ?? null,
        kampanya_id: sayiKimlik(f.kampanyaId),
        f_telefon: f.telefon ?? null,
        f_son_hareket: sonHareket,
        f_sira: await sonrakiSira(s, asamaId),
      })
      .select("id")
      .single(),
    "Fırsat kaydedilirken",
  ) as { id: number };
  f.id = String(id);
  f.sonHareket = sonHareket;
}

/* ---------- Okuma ---------- */

/** Tüm fırsatlar; sütun içi sıra f_sira'dan (sayfa aşamaya göre süzer, sıra korunur) */
export async function getFirsatlar(): Promise<Firsat[]> {
  const s = await db();
  const rows = sonuc(await s.from("satis_hatti").select(FIRSAT_SECIMI).order("f_sira").order("id")
    .order("zaman", { ascending: false, referencedTable: SON_MESAJ }).limit(1, { referencedTable: SON_MESAJ }), "Satış hattı okunurken") as unknown as FirsatSatiri[];
  return rows.map(satirdanFirsat);
}

export async function getFirsat(id: string): Promise<Firsat | null> {
  return firsatOku(await db(), id);
}

/* ---------- Yazma (yalnızca actions / sunucu kodundan çağrılır) ---------- */

/** Formdan kayıt: id veritabanında varsa bilgileri günceller (aşama, kayıp nedeni ve mesajlar değişmez), yoksa ekler. */
export async function firsatKaydetDepo(f: Firsat) {
  const s = await db();
  const sonHareket = bugunIso();
  const mevcut = await firsatOku(s, f.id);
  if (!mevcut) return firsatYaz(s, f, sonHareket);
  sonuc(
    await s
      .from("satis_hatti")
      .update({
        f_firma: f.firma,
        f_konum: f.konum,
        kaynak_id: await kaynakKimligi(s, f.kaynak),
        f_icerik: f.icerik,
        f_tutar: f.tutar,
        f_sonraki_adim: f.sonrakiAdim,
        f_sonraki_tarih: f.sonrakiTarih || null,
        kampanya_id: sayiKimlik(f.kampanyaId),
        f_telefon: f.telefon ?? mevcut.telefon ?? null,
        f_son_hareket: sonHareket,
      })
      .eq("id", Number(f.id)),
    "Fırsat güncellenirken",
  );
}

/** Aşama değişikliği: kart yeni sütunun sonuna gider; kayıp nedeni yalnızca Kaybedildi'de dolu */
export async function firsatAsamasiDepo(id: string, asama: Asama, kayip?: KayipBilgisi) {
  const no = sayiKimlik(id);
  if (no == null) return;
  const s = await db();
  const asamaId = await asamaKimligi(s, asama);
  sonuc(
    await s
      .from("satis_hatti")
      .update({
        asama_id: asamaId,
        f_sira: await sonrakiSira(s, asamaId),
        f_son_hareket: bugunIso(),
        f_kayip_nedeni: kayip?.neden ?? null,
        f_kayip_aciklama: kayip?.aciklama ?? null,
      })
      .eq("id", no),
    "Fırsat aşaması güncellenirken",
  );
}

/** Aşama dışındaki alanları günceller (teklif tutarı, WhatsApp mesajı, bayi yönlendirmesi).
 *  Kaydı okur, geri çağırmayı uygular, değişen sütunları ve yeni mesajları yazar. */
export async function firsatiGuncelle(id: string, f: (x: Firsat) => void): Promise<Firsat | null> {
  const s = await db();
  const x = await firsatOku(s, id);
  if (!x) return null;
  const once = structuredClone(x);
  f(x);
  x.sonHareket = bugunIso();

  const d: Record<string, unknown> = { f_son_hareket: x.sonHareket };
  if (x.firma !== once.firma) d.f_firma = x.firma;
  if (x.konum !== once.konum) d.f_konum = x.konum;
  if (x.kaynak !== once.kaynak) d.kaynak_id = await kaynakKimligi(s, x.kaynak);
  if (x.icerik !== once.icerik) d.f_icerik = x.icerik;
  if (x.tutar !== once.tutar) d.f_tutar = x.tutar;
  if (x.asama !== once.asama) {
    d.asama_id = await asamaKimligi(s, x.asama);
    d.f_sira = await sonrakiSira(s, d.asama_id as number);
  }
  if (x.sonrakiAdim !== once.sonrakiAdim) d.f_sonraki_adim = x.sonrakiAdim;
  if (x.sonrakiTarih !== once.sonrakiTarih) d.f_sonraki_tarih = x.sonrakiTarih || null;
  if (x.kayipNedeni !== once.kayipNedeni) d.f_kayip_nedeni = x.kayipNedeni ?? null;
  if (x.kayipAciklama !== once.kayipAciklama) d.f_kayip_aciklama = x.kayipAciklama ?? null;
  if ((x.kampanyaId ?? null) !== (once.kampanyaId ?? null)) d.kampanya_id = sayiKimlik(x.kampanyaId);
  if (x.telefon !== once.telefon) d.f_telefon = x.telefon ?? null;
  sonuc(await s.from("satis_hatti").update(d).eq("id", Number(once.id)), "Fırsat güncellenirken");

  x.id = once.id;
  return x;
}

/** Yeni fırsat (WhatsApp lead'i vb.). Gerçek id geçirilen nesnenin üstüne yazılır. */
export async function firsatEkleDepo(f: Firsat) {
  await firsatYaz(await db(), f, f.sonHareket ?? bugunIso());
}

/** Kazanılan fırsat müşteriye bir kez işlenir: işaret yoksa koyar ve true döner (ikinci sürüklemede false). */
export async function firsatKazanciIsaretle(id: string): Promise<boolean> {
  const no = sayiKimlik(id);
  if (no == null) return false;
  const s = await db();
  const rows = sonuc(
    await s.from("satis_hatti").update({ f_kazanc_islendi: true }).eq("id", no).eq("f_kazanc_islendi", false).select("id"),
    "Fırsat kazancı işaretlenirken",
  ) as { id: number }[];
  return rows.length > 0;
}

/** Kazanılan fırsatı müşteri kaydına bağlar */
export async function firsatMusteriBagla(id: string, musteriId: string) {
  const no = sayiKimlik(id);
  const m = sayiKimlik(musteriId);
  if (no == null || m == null) return;
  const s = await db();
  sonuc(await s.from("satis_hatti").update({ musteri_id: m }).eq("id", no), "Fırsat müşteriye bağlanırken");
}

/** Sütun içi sıra: verilen sırayla f_sira = 0, 1, 2… */
export async function firsatSirasiDepo(idler: string[]) {
  const s = await db();
  await Promise.all(
    idler.map(async (id, sira) => {
      const no = sayiKimlik(id);
      if (no != null) sonuc(await s.from("satis_hatti").update({ f_sira: sira }).eq("id", no), "Satış hattı sırası kaydedilirken");
    }),
  );
}
