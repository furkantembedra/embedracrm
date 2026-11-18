// Pazarlama & Bülten: veri okuma / yazma. Veri Supabase'de: kampanyalar, icerikler (+ icerik_medyalari → medya_dosyalari),
// kampanya_gonderimleri, kampanya_ulasilanlar, abonelik_engelleri, ozel_listeler (+ liste_kisileri).
// E-posta ve WhatsApp kampanyaları CRM'den toplu gönderilir (lib/ileti-gonder.ts); sağlayıcı anahtarı yoksa demo modunda çalışır.

export type IcerikKanali = (typeof ICERIK_KANALLARI)[number];

export type KampanyaKanali = (typeof KAMPANYA_KANALLARI)[number];
export type KampanyaDurumu = (typeof KAMPANYA_DURUMLARI)[number];

import type { SupabaseClient } from "@supabase/supabase-js";
import { ICERIK_KANALLARI, KAMPANYA_KANALLARI, KAMPANYA_DURUMLARI, HAZIR_LISTELER } from "./sabitler";
export { ICERIK_KANALLARI, KAMPANYA_KANALLARI, KAMPANYA_DURUMLARI, HAZIR_LISTELER };
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";

/** sonuc() + boş olmayan veri (select / insert…select sonuçları; maybeSingle için sonuc kullanılır) */
const kesin = <T,>(r: { data: T; error: { message: string; code?: string } | null }, ne?: string) => sonuc(r, ne) as NonNullable<T>;

/** İçeriğe eklenen görsel / video. Dosyanın kendisi medya deposunda durur, /api/medya/<id> adresinden okunur. */
export type Medya = { id: string; ad: string; tur: "gorsel" | "video"; boyut: number };

export type Icerik = {
  id: string;
  tarih: string; // "2026-11-04"
  kanal: IcerikKanali;
  baslik: string;
  paylasildi: boolean;
  kampanyaId: string | null;
  aciklama: string; // paylaşım metni (caption)
  hashtaglar: string[]; // "#" olmadan: ["CANFD", "otoelektrik"]
  medya: Medya[];
  bayiPaylas?: boolean; // bayi portalının Dokümanlar bölümünde görünür
};

/** E-posta ve WhatsApp kampanyalarının mesajı. {ad} ve {firma} alanları kişiye göre doldurulur. */
export type KampanyaMesaji = {
  konu: string; // e-posta konusu (WhatsApp'ta kullanılmaz)
  metin: string;
  sablon: string; // WhatsApp: Meta'da onaylı şablonun adı ({ad} → {{1}}, {firma} → {{2}})
};
/** Otomatik gönderim: "yok" yalnızca elle · "planli" belirtilen zamanda bir kez · "surekli" listeye yeni girenlere (kampanya tarihleri içinde) */
export type Otomasyon = { tur: "yok" | "planli" | "surekli"; zaman: string | null }; // zaman: "2026-11-10T10:00" (planlı)

export type Kampanya = {
  id: string;
  ad: string;
  kanal: KampanyaKanali;
  listeId: string; // hedef liste
  baslangic: string; // "2026-11-01"
  bitis: string | null; // tek günlükse null
  durum: KampanyaDurumu;
  not: string;
  mesaj?: KampanyaMesaji;
  otomasyon?: Otomasyon;
};

export type GonderimKanali = "eposta" | "whatsapp";
/** Bir toplu gönderimin özeti (kişi başı sonuçlar tutulmaz, yalnızca hatalar) */
export type Gonderim = {
  id: string;
  kampanyaId: string;
  kanal: GonderimKanali;
  zaman: string; // "2026-11-06T14:05"
  tur: "elle" | "planli" | "otomatik" | "test";
  alici: number; // denenen kişi
  basarili: number;
  hatali: number;
  atlanan: number; // izinsiz, adresi eksik, daha önce gönderilmiş ya da abonelikten çıkmış
  demo: boolean; // sağlayıcı anahtarı yoksa gerçek gönderim yapılmaz
  hatalar: string[]; // ilk birkaç hata: "ali@x.com: geçersiz adres"
};

/** Hazır listeler CRM kayıtlarından süzülür; kullanıcı ayrıca filtreli liste kaydedebilir */
export type HazirListe = "bitiyor" | "basic" | "izinli" | "bayiler" | "kayip";
import type { IzinKanali } from "@/components/musteriler/izin";
/** izin: "" fark etmez · "herhangi" en az bir kanalda izinli · kanal adı yalnızca o kanalda izinli */
export type ListeFiltresi = { segment: string; plan: string; ulke: string; izin: "" | "herhangi" | IzinKanali };
/** CSV / Excel'den içe aktarılan kişi. kanallar: içe aktarırken beyan edilen izinler */
export type AktarilanKisi = { firma: string; kisi: string; eposta: string; telefon: string; ulke: string; kanallar: IzinKanali[] };
/** Kaydedilmiş liste: ya müşteri kayıtlarından filtreyle süzülür ya da dosyadan içe aktarılmış kişilerdir (aktarim) */
export type OzelListe = {
  id: string;
  ad: string;
  filtre: ListeFiltresi;
  aktarim?: { kaynak: string; tarih: string; izinKaynagi: string; kisiler: AktarilanKisi[] };
};

/* ---------- Yardımcılar ---------- */

/** Domain kimliği → veritabanı id'si (sayı değilse null: kayıt veritabanında yok) */
const no = (id: string | null | undefined) => (id && /^\d+$/.test(id) ? Number(id) : null);

/** PostgREST satır sınırına (varsayılan 1000) takılmadan tüm satırları sayfa sayfa okur */
async function hepsiniOku<T>(sorgu: (s: SupabaseClient) => { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }> }, ne: string): Promise<T[]> {
  const s = await db();
  const SAYFA = 1000;
  const tumu: T[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const parca = sonuc(await sorgu(s).range(bas, bas + SAYFA - 1), ne) ?? [];
    tumu.push(...parca);
    if (parca.length < SAYFA) return tumu;
  }
}
/** Büyük insert'leri parçalara böler */
async function parcaParcaEkle(tablo: string, satirlar: Record<string, unknown>[], ne: string) {
  const s = await db();
  for (let i = 0; i < satirlar.length; i += 1000) sonuc(await s.from(tablo).insert(satirlar.slice(i, i + 1000)), ne);
}

/* ---------- Satır → domain dönüşümleri ---------- */

type MedyaSatiri = { id: string; md_ad: string; md_tip: string; md_boyut: number };
export const medyadan = (m: MedyaSatiri): Medya => ({ id: m.id, ad: m.md_ad, tur: m.md_tip.startsWith("video/") ? "video" : "gorsel", boyut: Number(m.md_boyut) || 0 });

const ICERIK_SECIMI = "id, ic_tarih, ic_kanal, ic_baslik, ic_paylasildi, kampanya_id, ic_aciklama, ic_hashtaglar, ic_bayi_paylas, icerik_medyalari(im_sira, medya_dosyalari(id, md_ad, md_tip, md_boyut))";
type IcerikSatiri = {
  id: number; ic_tarih: string; ic_kanal: IcerikKanali; ic_baslik: string; ic_paylasildi: boolean; kampanya_id: number | null; ic_aciklama: string;
  ic_hashtaglar: string[] | null; ic_bayi_paylas: boolean; icerik_medyalari: { im_sira: number; medya_dosyalari: MedyaSatiri | null }[] | null;
};
const icerikten = (r: IcerikSatiri): Icerik => ({
  id: String(r.id),
  tarih: r.ic_tarih,
  kanal: r.ic_kanal,
  baslik: r.ic_baslik,
  paylasildi: r.ic_paylasildi,
  kampanyaId: r.kampanya_id === null ? null : String(r.kampanya_id),
  aciklama: r.ic_aciklama,
  hashtaglar: r.ic_hashtaglar ?? [],
  medya: [...(r.icerik_medyalari ?? [])].sort((a, b) => a.im_sira - b.im_sira).flatMap((x) => (x.medya_dosyalari ? [medyadan(x.medya_dosyalari)] : [])),
  bayiPaylas: r.ic_bayi_paylas,
});
const icerikSatiri = (i: Icerik) => ({
  ic_tarih: i.tarih, ic_kanal: i.kanal, ic_baslik: i.baslik, ic_paylasildi: i.paylasildi, kampanya_id: no(i.kampanyaId),
  ic_aciklama: i.aciklama, ic_hashtaglar: i.hashtaglar, ic_bayi_paylas: !!i.bayiPaylas,
});
/** İçeriğin medya bağlantılarını verilen sırayla yeniden yazar */
async function icerikMedyasiYaz(icerikId: number, medya: Medya[], sil: boolean) {
  const s = await db();
  if (sil) sonuc(await s.from("icerik_medyalari").delete().eq("icerik_id", icerikId), "İçerik medyası temizleniyor");
  const benzersiz = medya.filter((m, i) => medya.findIndex((x) => x.id === m.id) === i);
  if (benzersiz.length) {
    sonuc(await s.from("icerik_medyalari").insert(benzersiz.map((m, i) => ({ icerik_id: icerikId, medya_id: m.id, im_sira: i }))), "İçerik medyası kaydediliyor");
  }
}

type KampanyaSatiri = {
  id: number; kp_ad: string; kp_kanal: KampanyaKanali; kp_liste: string; kp_baslangic: string; kp_bitis: string | null; kp_durum: KampanyaDurumu; kp_not: string;
  kp_mesaj_konu: string | null; kp_mesaj_metin: string | null; kp_mesaj_sablon: string | null; kp_otomasyon_tur: Otomasyon["tur"]; kp_otomasyon_zaman: string | null;
};
const kampanyadan = (r: KampanyaSatiri): Kampanya => ({
  id: String(r.id),
  ad: r.kp_ad,
  kanal: r.kp_kanal,
  listeId: r.kp_liste,
  baslangic: r.kp_baslangic,
  bitis: r.kp_bitis,
  durum: r.kp_durum,
  not: r.kp_not,
  mesaj: r.kp_mesaj_konu === null && r.kp_mesaj_metin === null && r.kp_mesaj_sablon === null
    ? undefined
    : { konu: r.kp_mesaj_konu ?? "", metin: r.kp_mesaj_metin ?? "", sablon: r.kp_mesaj_sablon ?? "" },
  otomasyon: { tur: r.kp_otomasyon_tur, zaman: r.kp_otomasyon_zaman ? yerelZaman(r.kp_otomasyon_zaman) : null },
});
const kampanyaSatiri = (k: Kampanya) => ({
  kp_ad: k.ad, kp_kanal: k.kanal, kp_liste: k.listeId, kp_baslangic: k.baslangic, kp_bitis: k.bitis, kp_durum: k.durum, kp_not: k.not,
  kp_mesaj_konu: k.mesaj?.konu ?? null, kp_mesaj_metin: k.mesaj?.metin ?? null, kp_mesaj_sablon: k.mesaj?.sablon ?? null,
  kp_otomasyon_tur: k.otomasyon?.tur ?? "yok", kp_otomasyon_zaman: k.otomasyon?.tur === "planli" ? k.otomasyon.zaman : null,
});

type GonderimSatiri = {
  id: number; kampanya_id: number; kg_kanal: GonderimKanali; kg_zaman: string; kg_tur: Gonderim["tur"]; kg_alici: number; kg_basarili: number;
  kg_hatali: number; kg_atlanan: number; kg_demo: boolean; kg_hatalar: string[] | null;
};
const gonderimden = (r: GonderimSatiri): Gonderim => ({
  id: String(r.id), kampanyaId: String(r.kampanya_id), kanal: r.kg_kanal, zaman: yerelZaman(r.kg_zaman), tur: r.kg_tur, alici: r.kg_alici,
  basarili: r.kg_basarili, hatali: r.kg_hatali, atlanan: r.kg_atlanan, demo: r.kg_demo, hatalar: r.kg_hatalar ?? [],
});

type ListeSatiri = { id: number; ol_ad: string; ol_filtre: Partial<ListeFiltresi> | null; ol_aktarim_kaynak: string | null; ol_aktarim_tarih: string | null; ol_aktarim_izin_kaynagi: string | null };
type KisiSatiri = { id: number; liste_id: number; lk_firma: string; lk_kisi: string; lk_eposta: string; lk_telefon: string; lk_ulke: string; lk_kanallar: string[] | null; lk_sira: number };
const kisiden = (r: KisiSatiri): AktarilanKisi => ({
  firma: r.lk_firma, kisi: r.lk_kisi, eposta: r.lk_eposta, telefon: r.lk_telefon, ulke: r.lk_ulke, kanallar: (r.lk_kanallar ?? []) as IzinKanali[],
});
/** Bir listenin içe aktarılmış kişileri (lk_sira sırasıyla: abonelik bağlantısındaki "a:<liste>:<sıra>" bu sıraya göre) */
async function listeKisileri(listeId?: number) {
  return hepsiniOku<KisiSatiri>((s) => {
    const q = s.from("liste_kisileri").select("*");
    return (listeId === undefined ? q : q.eq("liste_id", listeId)).order("liste_id").order("lk_sira").order("id");
  }, "Liste kişileri okunuyor");
}

/* ---------- Okuma ---------- */

export async function getIcerikler(): Promise<Icerik[]> {
  const s = await db();
  return (sonuc(await s.from("icerikler").select(ICERIK_SECIMI).order("id"), "İçerikler okunuyor") as unknown as IcerikSatiri[]).map(icerikten);
}
export async function getKampanyalar(): Promise<Kampanya[]> {
  const s = await db();
  // Yeni kampanya başta (eski depoda unshift ediliyordu)
  return (sonuc(await s.from("kampanyalar").select("*").order("id", { ascending: false }), "Kampanyalar okunuyor") as KampanyaSatiri[]).map(kampanyadan);
}
export async function getGonderimler(): Promise<Gonderim[]> {
  const s = await db();
  return (sonuc(await s.from("kampanya_gonderimleri").select("*").order("kg_zaman", { ascending: false }).order("id", { ascending: false }), "Kampanya gönderimleri okunuyor") as GonderimSatiri[]).map(gonderimden);
}
/** Kampanyanın daha önce ulaştığı kişiler (kanal anahtarı: e-posta ya da telefon). Aynı kişiye iki kez gönderilmez. */
export async function getUlasilan(kampanyaId: string): Promise<string[]> {
  const n = no(kampanyaId);
  if (n === null) return [];
  const satirlar = await hepsiniOku<{ anahtar: string }>((s) => s.from("kampanya_ulasilanlar").select("anahtar").eq("kampanya_id", n).order("anahtar"), "Ulaşılan kişiler okunuyor");
  return satirlar.map((r) => r.anahtar);
}
/** Abonelikten çıkan e-posta / telefonlar: hangi listede olursa olsun gönderilmez */
export async function getEngelli(): Promise<string[]> {
  const satirlar = await hepsiniOku<{ anahtar: string }>((s) => s.from("abonelik_engelleri").select("anahtar").order("anahtar"), "Abonelik engelleri okunuyor");
  return satirlar.map((r) => r.anahtar);
}
export async function getOzelListeler(): Promise<OzelListe[]> {
  const s = await db();
  const [listeler, kisiler] = await Promise.all([
    sonuc(await s.from("ozel_listeler").select("id, ol_ad, ol_filtre, ol_aktarim_kaynak, ol_aktarim_tarih, ol_aktarim_izin_kaynagi").order("id"), "Hedef listeler okunuyor") as ListeSatiri[],
    listeKisileri(),
  ]);
  return listeler.map((r) => {
    const f = r.ol_filtre ?? {};
    const l: OzelListe = { id: String(r.id), ad: r.ol_ad, filtre: { segment: f.segment ?? "", plan: f.plan ?? "", ulke: f.ulke ?? "", izin: f.izin ?? "" } };
    if (r.ol_aktarim_kaynak !== null) {
      l.aktarim = {
        kaynak: r.ol_aktarim_kaynak, tarih: r.ol_aktarim_tarih ?? "", izinKaynagi: r.ol_aktarim_izin_kaynagi ?? "",
        kisiler: kisiler.filter((k) => k.liste_id === r.id).map(kisiden),
      };
    }
    return l;
  });
}

/* ---------- Yazma (actions.ts ve gonderim.ts'ten çağrılır) ---------- */

/** İçeriği ekler; veritabanının verdiği id nesnenin üstüne yazılır */
export async function icerikEkle(i: Icerik) {
  const s = await db();
  const yeni = kesin(await s.from("icerikler").insert(icerikSatiri(i)).select("id").single(), "İçerik ekleniyor");
  i.id = String(yeni.id);
  await icerikMedyasiYaz(yeni.id, i.medya, false);
}
export async function icerigiGuncelle(id: string, f: (i: Icerik) => void): Promise<Icerik | null> {
  const n = no(id);
  if (n === null) return null;
  const s = await db();
  const r = sonuc(await s.from("icerikler").select(ICERIK_SECIMI).eq("id", n).maybeSingle(), "İçerik okunuyor") as unknown as IcerikSatiri | null;
  if (!r) return null;
  const i = icerikten(r);
  const eskiMedya = i.medya.map((m) => m.id).join(",");
  f(i);
  sonuc(await s.from("icerikler").update(icerikSatiri(i)).eq("id", n), "İçerik güncelleniyor");
  if (i.medya.map((m) => m.id).join(",") !== eskiMedya) await icerikMedyasiYaz(n, i.medya, true);
  return i;
}
export async function icerigiSil(id: string) {
  const n = no(id);
  if (n === null) return false;
  const s = await db();
  const silinen = kesin(await s.from("icerikler").delete().eq("id", n).select("id"), "İçerik siliniyor");
  return silinen.length > 0;
}
/** Gönderimi kaydeder (id veritabanından gelir) ve başarılı alıcıları kampanyanın "ulaşılanlar" listesine ekler */
export async function gonderimEkle(gd: Gonderim, ulasilan: string[]) {
  const kampanyaNo = no(gd.kampanyaId);
  if (kampanyaNo === null) throw new Error(`Gönderim kaydedilemedi: geçersiz kampanya (${gd.kampanyaId}).`);
  const s = await db();
  const yeni = kesin(
    await s.from("kampanya_gonderimleri").insert({
      kampanya_id: kampanyaNo, kg_kanal: gd.kanal, kg_zaman: gd.zaman, kg_tur: gd.tur, kg_alici: gd.alici, kg_basarili: gd.basarili,
      kg_hatali: gd.hatali, kg_atlanan: gd.atlanan, kg_demo: gd.demo, kg_hatalar: gd.hatalar,
    }).select("id").single(),
    "Kampanya gönderimi kaydediliyor",
  );
  gd.id = String(yeni.id);
  const anahtarlar = [...new Set(ulasilan)];
  if (gd.tur !== "test" && anahtarlar.length) {
    for (let i = 0; i < anahtarlar.length; i += 1000) {
      sonuc(
        await s.from("kampanya_ulasilanlar").upsert(anahtarlar.slice(i, i + 1000).map((anahtar) => ({ kampanya_id: kampanyaNo, anahtar })), { onConflict: "kampanya_id,anahtar", ignoreDuplicates: true }),
        "Ulaşılan kişiler kaydediliyor",
      );
    }
  }
}
export async function engelliEkle(anahtar: string) {
  const s = await db();
  sonuc(await s.from("abonelik_engelleri").upsert({ anahtar }, { onConflict: "anahtar", ignoreDuplicates: true }), "Abonelik engeli kaydediliyor");
}
/** İçe aktarılmış listenin kişilerini okur, geri çağırmayı uygular, değişen satırları yazar (yalnızca var olan satırlar; ekleme/silme yok) */
export async function aktarilanKisiGuncelle(listeId: string, f: (k: AktarilanKisi[]) => void) {
  const n = no(listeId);
  if (n === null) return;
  const satirlar = await listeKisileri(n);
  if (!satirlar.length) return;
  const kisiler = satirlar.map(kisiden);
  f(kisiler);
  const s = await db();
  for (let i = 0; i < satirlar.length; i++) {
    const eski = kisiden(satirlar[i]);
    const k = kisiler[i];
    if (!k || JSON.stringify(eski) === JSON.stringify(k)) continue;
    sonuc(
      await s.from("liste_kisileri").update({ lk_firma: k.firma, lk_kisi: k.kisi, lk_eposta: k.eposta, lk_telefon: k.telefon, lk_ulke: k.ulke, lk_kanallar: k.kanallar }).eq("id", satirlar[i].id),
      "Liste kişisi güncelleniyor",
    );
  }
}
/** Var olan kampanyayı günceller; yoksa ekler ve veritabanının verdiği id'yi nesnenin üstüne yazar */
export async function kampanyaKaydetDepo(k: Kampanya) {
  const s = await db();
  const n = no(k.id);
  if (n !== null) {
    const r = kesin(await s.from("kampanyalar").update(kampanyaSatiri(k)).eq("id", n).select("id"), "Kampanya güncelleniyor");
    if (r.length) return;
  }
  const yeni = kesin(await s.from("kampanyalar").insert(kampanyaSatiri(k)).select("id").single(), "Kampanya ekleniyor");
  k.id = String(yeni.id);
}
/** Hedef listeyi (içe aktarılmışsa kişileriyle) ekler; veritabanının verdiği id nesnenin üstüne yazılır */
export async function ozelListeEkle(l: OzelListe) {
  const s = await db();
  const yeni = kesin(
    await s.from("ozel_listeler").insert({
      ol_ad: l.ad, ol_filtre: l.filtre, ol_aktarim_kaynak: l.aktarim?.kaynak ?? null, ol_aktarim_tarih: l.aktarim?.tarih || null,
      ol_aktarim_izin_kaynagi: l.aktarim ? l.aktarim.izinKaynagi : null,
    }).select("id").single(),
    "Hedef liste ekleniyor",
  );
  l.id = String(yeni.id);
  if (l.aktarim?.kisiler.length) {
    await parcaParcaEkle(
      "liste_kisileri",
      l.aktarim.kisiler.map((k, i) => ({
        liste_id: yeni.id, lk_firma: k.firma, lk_kisi: k.kisi, lk_eposta: k.eposta, lk_telefon: k.telefon, lk_ulke: k.ulke, lk_kanallar: k.kanallar, lk_sira: i,
      })),
      "Liste kişileri ekleniyor",
    );
  }
}
export async function ozelListeSil(id: string) {
  const n = no(id);
  if (n === null) return;
  const s = await db();
  sonuc(await s.from("ozel_listeler").delete().eq("id", n), "Hedef liste siliniyor");
}
