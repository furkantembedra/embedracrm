// Bayi portalı hesapları ve talepleri (Supabase).
// Tablolar: bayi_kullanicilari (hesap; giriş Supabase Auth ile, auth_id onaylı e-postayla bağlanır), bayi_yenileme_talepleri,
// bayi_duzeltme_talepleri. RLS: bayi yalnızca kendi satırlarını görür; CRM ekibi hepsini.
import { getBasvurular } from "@/components/bayiler/queries";
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";

// Şifre Supabase Auth'ta tutulur; burada yalnızca hesabın bayiye bağlantısı ve erişim durumu var
export type PortalHesabi = { bayiId: string; eposta: string; erisim: boolean; sonGiris: string | null };
export type YenilemeTalebi = { seriNo: string; bayiId: string; tarih: string };
/** Bayinin "Bir yanlışlık mı var?" talebi (Cihazlarım › cihaz detayı). CRM'de bayi detayındaki Portal panelinde çözülür. */
export type DuzeltmeTalebi = { id: string; bayiId: string; seriNo: string; metin: string; tarih: string; durum: "acik" | "cozuldu"; cozum?: string };

const sayiMi = (id: string) => /^\d+$/.test(id);

/* ---------- Hesaplar ---------- */

type HesapSatiri = { id: number; bayi_id: number; bk_eposta: string; bk_erisim: boolean; bk_son_giris: string | null };
const HESAP_ALANLARI = "id, bayi_id, bk_eposta, bk_erisim, bk_son_giris";
const hesapCevir = (r: HesapSatiri): PortalHesabi => ({
  bayiId: String(r.bayi_id), eposta: r.bk_eposta, erisim: r.bk_erisim, sonGiris: r.bk_son_giris ? yerelZaman(r.bk_son_giris) : null,
});

async function hesapSatiri(bayiId: string): Promise<HesapSatiri | null> {
  if (!sayiMi(bayiId)) return null;
  const s = await db();
  return sonuc(
    await s.from("bayi_kullanicilari").select(HESAP_ALANLARI).eq("bayi_id", Number(bayiId)).order("id").limit(1).maybeSingle(),
    "Portal hesabı okunuyordu",
  ) as HesapSatiri | null;
}

export async function getPortalHesabi(bayiId: string) {
  const r = await hesapSatiri(bayiId);
  return r ? hesapCevir(r) : null;
}

/** E-postayla hesap (büyük / küçük harf duyarsız). RLS: CRM ekibi her hesabı, bayi yalnızca kendi hesabını görür. */
export async function hesapBulEpostayla(eposta: string) {
  const e = eposta.trim();
  if (!e) return null;
  const s = await db();
  const desen = e.replace(/[\\%_]/g, (c) => `\\${c}`); // ilike joker karakterleri düz karakter olsun
  const r = sonuc(
    await s.from("bayi_kullanicilari").select(HESAP_ALANLARI).ilike("bk_eposta", desen).limit(1).maybeSingle(),
    "Portal hesabı aranıyordu",
  ) as HesapSatiri | null;
  return r ? hesapCevir(r) : null;
}

/** Hesabı günceller (erişim, son giriş). Hesap yoksa (sonradan lansmanı yapılan bayi) başvuru e-postasıyla, erişimi kapalı açılır.
 *  Bayi oturumunda yalnızca bk_son_giris değişebilir (bayi_hesabi_koru tetikleyicisi); bu yüzden yalnızca değişen alanlar yazılır. */
export async function portalHesabiniGuncelle(bayiId: string, f: (h: PortalHesabi) => void) {
  if (!sayiMi(bayiId)) throw new Error(`Portal hesabı güncellenemedi: geçersiz bayi kimliği (${bayiId})`);
  const s = await db();
  let r = await hesapSatiri(bayiId);
  if (!r) {
    const b = (await getBasvurular()).find((x) => x.id === bayiId);
    r = sonuc(
      await s.from("bayi_kullanicilari").insert({ bayi_id: Number(bayiId), bk_eposta: b?.eposta || `bayi-${bayiId}@bayi.embedra.com`, bk_erisim: false })
        .select(HESAP_ALANLARI).single(),
      "Portal hesabı açılıyordu",
    ) as HesapSatiri;
  }
  const h = hesapCevir(r);
  const once = { ...h };
  f(h);
  const degisen: Record<string, unknown> = {};
  if (h.erisim !== once.erisim) degisen.bk_erisim = h.erisim;
  if (h.eposta !== once.eposta) degisen.bk_eposta = h.eposta.trim();
  if (h.sonGiris !== once.sonGiris) degisen.bk_son_giris = h.sonGiris ? new Date(h.sonGiris).toISOString() : null; // yerel saat → timestamptz
  if (Object.keys(degisen).length) sonuc(await s.from("bayi_kullanicilari").update(degisen).eq("id", r.id), "Portal hesabı güncelleniyordu");
  return h;
}

/* ---------- Lisans yenileme talepleri (seri no başına bir talep) ---------- */

type YenilemeSatiri = { byt_seri_no: string; bayi_id: number; byt_tarih: string };

export async function getYenilemeTalepleri(bayiId: string): Promise<YenilemeTalebi[]> {
  if (!sayiMi(bayiId)) return [];
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_yenileme_talepleri").select("byt_seri_no, bayi_id, byt_tarih").eq("bayi_id", Number(bayiId)).order("created_at"),
    "Yenileme talepleri okunuyordu",
  ) as YenilemeSatiri[];
  return satirlar.map((r) => ({ seriNo: r.byt_seri_no, bayiId: String(r.bayi_id), tarih: r.byt_tarih }));
}

export async function yenilemeTalebiEkle(y: YenilemeTalebi) {
  const s = await db();
  // Aynı seri için talep zaten varsa dokunulmaz (returning yok: çakışan satır başka bayinin olabilir)
  sonuc(
    await s.from("bayi_yenileme_talepleri").upsert(
      { byt_seri_no: y.seriNo, bayi_id: Number(y.bayiId), byt_tarih: y.tarih.slice(0, 10) },
      { onConflict: "byt_seri_no", ignoreDuplicates: true },
    ),
    "Yenileme talebi yazılıyordu",
  );
}

/** Lisans cihaza işlenince ya da CRM kapatınca talep kalkar (portalda "Talep var" etiketi de kalkar) */
export async function yenilemeTalebiSil(seriNo: string) {
  const s = await db();
  sonuc(await s.from("bayi_yenileme_talepleri").delete().eq("byt_seri_no", seriNo), "Yenileme talebi siliniyordu");
}

/* ---------- Düzeltme talepleri ---------- */

type DuzeltmeSatiri = { id: number; bayi_id: number; bdt_seri_no: string; bdt_metin: string; bdt_tarih: string; bdt_durum: DuzeltmeTalebi["durum"]; bdt_cozum: string | null };
const DUZELTME_ALANLARI = "id, bayi_id, bdt_seri_no, bdt_metin, bdt_tarih, bdt_durum, bdt_cozum";
const duzeltmeCevir = (r: DuzeltmeSatiri): DuzeltmeTalebi => {
  const t: DuzeltmeTalebi = { id: String(r.id), bayiId: String(r.bayi_id), seriNo: r.bdt_seri_no, metin: r.bdt_metin, tarih: r.bdt_tarih, durum: r.bdt_durum };
  if (r.bdt_cozum) t.cozum = r.bdt_cozum;
  return t;
};

export async function getDuzeltmeTalepleri(bayiId: string) {
  if (!sayiMi(bayiId)) return [];
  const s = await db();
  const satirlar = sonuc(
    await s.from("bayi_duzeltme_talepleri").select(DUZELTME_ALANLARI).eq("bayi_id", Number(bayiId)).order("created_at", { ascending: false }).order("id", { ascending: false }),
    "Düzeltme talepleri okunuyordu",
  ) as DuzeltmeSatiri[];
  return satirlar.map(duzeltmeCevir);
}

/** Yeni talep; veritabanı id'si t.id'ye yazılır. bdt_tarih tarih sütunu: saat bilgisi saklanmaz. */
export async function duzeltmeTalebiEkle(t: DuzeltmeTalebi) {
  const s = await db();
  const r = sonuc(
    await s.from("bayi_duzeltme_talepleri").insert({
      bayi_id: Number(t.bayiId), bdt_seri_no: t.seriNo, bdt_metin: t.metin, bdt_tarih: t.tarih.slice(0, 10), bdt_durum: "acik",
    }).select("id").single(),
    "Düzeltme talebi yazılıyordu",
  ) as { id: number };
  t.id = String(r.id);
  t.tarih = t.tarih.slice(0, 10);
}

export async function duzeltmeTalebiCoz(id: string, cozum: string) {
  if (!sayiMi(id)) return null;
  const s = await db();
  const r = sonuc(
    await s.from("bayi_duzeltme_talepleri").update({ bdt_durum: "cozuldu", bdt_cozum: cozum }).eq("id", Number(id)).select(DUZELTME_ALANLARI).maybeSingle(),
    "Düzeltme talebi çözülüyordu",
  ) as DuzeltmeSatiri | null;
  return r ? duzeltmeCevir(r) : null;
}
