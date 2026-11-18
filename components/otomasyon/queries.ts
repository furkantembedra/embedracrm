// Otomasyon: kullanıcının yönetim panelinden tanımladığı "şu olursa şunu yap" kuralları ve çalışma geçmişi.
// Veri Supabase'de: otomasyon_kurallari, otomasyon_calismalari, otomasyon_islenenler (kural_id + anahtar birincil anahtar:
// aynı kayıt için iki kez çalışmayı önler) ve kilitler (aynı anda iki çalıştırmayı önler).
import { db, kullaniciKimligi, kullaniciNo, sonuc } from "@/lib/supabase/db";

/** sonuc() + boş olmayan veri (select / insert…select sonuçları; maybeSingle için sonuc kullanılır) */
const kesin = <T,>(r: { data: T; error: { message: string; code?: string } | null }, ne?: string) => sonuc(r, ne) as NonNullable<T>;

export type TetikleyiciId =
  | "lisans-bitiyor"
  | "teklif-yanitsiz"
  | "rma-gecikti"
  | "siparis-kargolanmadi"
  | "firsat-hareketsiz"
  | "stok-kritik"
  | "destek-yanitsiz"
  | "cihaz-sessiz";

/** İsteğe bağlı daraltma: boş alan "hepsi" demektir. Hangi alanların işe yaradığı tetikleyiciye göre değişir (ortak.ts › FILTRE_ALANLARI). */
export type KuralFiltresi = { ulke?: string; plan?: string; model?: string };

export type Kural = {
  id: string;
  ad: string;
  aktif: boolean;
  tetikleyici: TetikleyiciId;
  gun: number; // tetikleyicinin gün eşiği (stok-kritik'te kullanılmaz)
  filtre: KuralFiltresi;
  /** Otomatik çalışma güvenlik sınırına takıldıysa nedeni. Kuralı elle "Çalıştır"mak onay sayılır ve bunu temizler. */
  engel: string | null;
  hatirlatma: { sorumluId: string; onem: "normal" | "yuksek" } | null;
  /** Müşteriye e-posta: yalnızca kayıt bir müşteriye bağlıysa ve yetkilinin e-posta izni varsa gönderilir. {firma} {detay} yazılabilir. */
  eposta: { konu: string; metin: string } | null;
  olusturma: string; // ISO
  sonCalisma: string | null; // ISO
};

export type EylemSonucu = { eylem: "hatirlatma" | "eposta"; durum: "yapildi" | "atlandi" | "hata"; ayrinti: string };
export type CalismaKaydi = {
  id: string;
  zaman: string; // ISO
  kuralId: string;
  kuralAd: string;
  kayitAd: string;
  href: string;
  sonuclar: EylemSonucu[];
};

/* ---------- Satır → domain dönüşümleri ---------- */

type KuralSatiri = {
  id: number; ok_ad: string; ok_aktif: boolean; ok_tetikleyici: TetikleyiciId; ok_gun: number; ok_filtre: KuralFiltresi | null; ok_engel: string | null;
  hatirlatma_sorumlu_id: number | null; ok_hatirlatma_onem: "normal" | "yuksek" | null; ok_eposta_konu: string | null; ok_eposta_metin: string | null;
  ok_son_calisma: string | null; created_at: string;
};
const iso = (v: string) => new Date(v).toISOString();
const kuraldan = (r: KuralSatiri): Kural => ({
  id: String(r.id),
  ad: r.ok_ad,
  aktif: r.ok_aktif,
  tetikleyici: r.ok_tetikleyici,
  gun: r.ok_gun,
  filtre: r.ok_filtre ?? {},
  engel: r.ok_engel,
  hatirlatma: r.hatirlatma_sorumlu_id !== null ? { sorumluId: kullaniciKimligi(r.hatirlatma_sorumlu_id), onem: r.ok_hatirlatma_onem ?? "normal" } : null,
  eposta: r.ok_eposta_konu !== null ? { konu: r.ok_eposta_konu, metin: r.ok_eposta_metin ?? "" } : null,
  olusturma: iso(r.created_at),
  sonCalisma: r.ok_son_calisma ? iso(r.ok_son_calisma) : null,
});
const kuralSatiri = (k: Kural) => ({
  ok_ad: k.ad,
  ok_aktif: k.aktif,
  ok_tetikleyici: k.tetikleyici,
  ok_gun: k.gun,
  ok_filtre: k.filtre ?? {},
  ok_engel: k.engel,
  hatirlatma_sorumlu_id: k.hatirlatma ? kullaniciNo(k.hatirlatma.sorumluId) : null,
  ok_hatirlatma_onem: k.hatirlatma?.onem ?? null,
  ok_eposta_konu: k.eposta?.konu ?? null,
  ok_eposta_metin: k.eposta?.metin ?? null,
  ok_son_calisma: k.sonCalisma,
});
/** Domain kimliği → veritabanı id'si (sayı değilse null: o kural veritabanında yok) */
const kuralNo = (id: string) => (/^\d+$/.test(id) ? Number(id) : null);

/* ---------- Okuma ---------- */

export async function getKurallar(): Promise<Kural[]> {
  const s = await db();
  // Yeni kural başta (eski depoda unshift ediliyordu)
  return (sonuc(await s.from("otomasyon_kurallari").select("*").order("id", { ascending: false }), "Otomasyon kuralları okunuyor") as KuralSatiri[]).map(kuraldan);
}
export async function getCalismaKayitlari(): Promise<CalismaKaydi[]> {
  const s = await db();
  const satirlar = kesin(
    await s.from("otomasyon_calismalari").select("id, kural_id, oc_kural_ad, oc_kayit_ad, oc_href, oc_sonuclar, oc_zaman").order("oc_zaman", { ascending: false }).order("id", { ascending: false }).limit(200),
    "Otomasyon geçmişi okunuyor",
  );
  return satirlar.map((r) => ({
    id: String(r.id), zaman: iso(r.oc_zaman), kuralId: r.kural_id === null ? "" : String(r.kural_id), kuralAd: r.oc_kural_ad, kayitAd: r.oc_kayit_ad, href: r.oc_href,
    sonuclar: (r.oc_sonuclar ?? []) as EylemSonucu[],
  }));
}
export async function islendiMi(kuralId: string, anahtar: string) {
  const no = kuralNo(kuralId);
  if (no === null) return false;
  const s = await db();
  const r = sonuc(await s.from("otomasyon_islenenler").select("kural_id").eq("kural_id", no).eq("anahtar", anahtar).maybeSingle(), "İşlenen kayıt kontrol ediliyor");
  return !!r;
}

/** Verilen anahtarlardan bu kural için daha önce işlenmiş olanlar (tek sorgu; kayıt başına sorgu atmamak için) */
export async function islenmisAnahtarlar(kuralId: string, anahtarlar: string[]): Promise<Set<string>> {
  const no = kuralNo(kuralId);
  if (no === null || !anahtarlar.length) return new Set();
  const s = await db();
  const satirlar = sonuc(
    await s.from("otomasyon_islenenler").select("anahtar").eq("kural_id", no).in("anahtar", anahtarlar),
    "İşlenen kayıtlar okunuyor",
  ) as { anahtar: string }[];
  return new Set(satirlar.map((r) => r.anahtar));
}

/* ---------- Yazma (yalnızca actions.ts ve motor.ts'ten çağrılır) ---------- */

/** Var olan kuralı günceller; yoksa ekler ve veritabanının verdiği id / oluşturma zamanını nesnenin üstüne yazar */
export async function kuralKaydet(k: Kural) {
  const s = await db();
  const no = kuralNo(k.id);
  if (no !== null) {
    const r = kesin(await s.from("otomasyon_kurallari").update(kuralSatiri(k)).eq("id", no).select("id"), "Otomasyon kuralı güncelleniyor");
    if (r.length) return;
  }
  const yeni = kesin(await s.from("otomasyon_kurallari").insert(kuralSatiri(k)).select("id, created_at").single(), "Otomasyon kuralı ekleniyor");
  k.id = String(yeni.id);
  k.olusturma = iso(yeni.created_at);
}
export async function kuralGuncelle(id: string, f: (k: Kural) => void): Promise<Kural | null> {
  const no = kuralNo(id);
  if (no === null) return null;
  const s = await db();
  const r = sonuc(await s.from("otomasyon_kurallari").select("*").eq("id", no).maybeSingle(), "Otomasyon kuralı okunuyor") as KuralSatiri | null;
  if (!r) return null;
  const k = kuraldan(r);
  f(k);
  sonuc(await s.from("otomasyon_kurallari").update(kuralSatiri(k)).eq("id", no), "Otomasyon kuralı güncelleniyor");
  return k;
}
/** İşlenen kayıt işaretleri cascade ile silinir; geçmiş kayıtları kalır (kural_id null olur) */
export async function kuralSil(id: string) {
  const no = kuralNo(id);
  if (no === null) return;
  const s = await db();
  sonuc(await s.from("otomasyon_kurallari").delete().eq("id", no), "Otomasyon kuralı siliniyor");
}
export async function islendiIsaretle(kuralId: string, anahtar: string) {
  const no = kuralNo(kuralId);
  if (no === null) return;
  const s = await db();
  sonuc(
    await s.from("otomasyon_islenenler").upsert({ kural_id: no, anahtar }, { onConflict: "kural_id,anahtar", ignoreDuplicates: true }),
    "İşlenen kayıt işaretleniyor",
  );
}
/** Çalışma kaydı ekler (id veritabanından gelir). Geçmiş en yeni 200 kayıtla sınırlı tutulur. */
export async function kayitEkle(k: CalismaKaydi) {
  const s = await db();
  const yeni = kesin(
    await s.from("otomasyon_calismalari")
      .insert({ kural_id: kuralNo(k.kuralId), oc_kural_ad: k.kuralAd, oc_kayit_ad: k.kayitAd, oc_href: k.href, oc_sonuclar: k.sonuclar, oc_zaman: k.zaman })
      .select("id").single(),
    "Otomasyon çalışma kaydı ekleniyor",
  );
  k.id = String(yeni.id);
  // 200'ü aşan eski kayıtları sil
  const sinir = kesin(await s.from("otomasyon_calismalari").select("oc_zaman").order("oc_zaman", { ascending: false }).range(199, 199), "Otomasyon geçmişi okunuyor");
  if (sinir.length) sonuc(await s.from("otomasyon_calismalari").delete().lt("oc_zaman", sinir[0].oc_zaman), "Eski otomasyon kayıtları siliniyor");
}

/* ---------- Kilit ---------- */

const KILIT = "otomasyon";
const KILIT_SURESI_MS = 5 * 60_000; // çöken bir çalıştırma kilidi en fazla 5 dk tutar

/** Aynı anda iki çalıştırma (zamanlayıcı + elle) aynı kaydı ikilemesin. Alındıysa true. */
export async function kilitAl() {
  const s = await db();
  // Süresi geçmiş (yarım kalmış çalıştırmadan kalan) kilidi temizle
  sonuc(await s.from("kilitler").delete().eq("anahtar", KILIT).lt("bitis", new Date().toISOString()), "Eski kilit temizleniyor");
  const r = await s.from("kilitler").insert({ anahtar: KILIT, bitis: new Date(Date.now() + KILIT_SURESI_MS).toISOString() });
  if (r.error?.code === "23505") return false; // birincil anahtar ihlali: başka bir çalıştırma sürüyor
  sonuc(r, "Kilit alınıyor");
  return true;
}
export async function kilitBirak() {
  const s = await db();
  sonuc(await s.from("kilitler").delete().eq("anahtar", KILIT), "Kilit bırakılıyor");
}
