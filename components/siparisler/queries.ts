// Sipariş & Sevkiyat: veri okuma ve yazma (Supabase: siparisler, siparis_kalemleri, siparis_notlari,
// siparis_lisans_atamalari, stok_kalemleri, iadeler). Domain id = belge numarası (sp_no, ia_no), stok kodu = st_kod.
import type { CihazModeli } from "@/lib/urunler";
import { ODEME_YONTEMLERI, IADE_NEDENLERI, IADE_ADIMLARI, KUTU_ICERIGI, CIHAZ_STOK_KODU } from "./sabitler";
export { ODEME_YONTEMLERI, IADE_NEDENLERI, IADE_ADIMLARI, KUTU_ICERIGI, CIHAZ_STOK_KODU };
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";

/** odeme → hazirlaniyor → kargoda → teslim → tamamlandi. Yalnızca lisans içeren siparişte kargo adımları atlanır.
 *  iptal: kargodan önce (ödeme bekliyor / hazırlanıyor) iptal edilen sipariş; gelir ve stok hesaplarına girmez. */
export type SiparisDurumu = "odeme" | "hazirlaniyor" | "kargoda" | "teslim" | "tamamlandi" | "iptal";
export type OdemeYontemi = "Kart" | "Havale/EFT" | "Proforma";
export type ParaBirimi = "TRY" | "EUR";

export type Kalem =
  | { tur: "cihaz"; model: CihazModeli; adet: number }
  | { tur: "lisans"; paket: string; adet: number; sureAy: number }
  | { tur: "aksesuar"; stokKodu: string; adet: number };

// _id: siparis_notlari.id (veritabanından gelen notta dolu; kodun yeni eklediği notta boş → kaydedilirken insert edilir)
export type SiparisNotu = { metin: string; zaman: string; sistem?: boolean; _id?: number }; // zaman: "2026-11-06T11:24"

export type Siparis = {
  id: string; // "S-26-1184" (adres: /siparisler/S-26-1184)
  tarih: string; // "2026-11-06T11:24"
  musteriId: string | null;
  musteri: string;
  ulke: string;
  adres: string;
  bayiId?: string | null; // bayi stoğu siparişi
  teklifNo?: string | null; // siparişin açıldığı kabul edilmiş teklif ("TKL-2026-0001")
  kalemler: Kalem[];
  tutar: number; // KDV hariç
  paraBirimi: ParaBirimi;
  odeme: OdemeYontemi;
  durum: SiparisDurumu;
  seriNolar: string[]; // atanan cihaz seri numaraları
  kargo: { firma: string; takipNo: string } | null;
  teslimTarihi: string | null; // "2026-11-04"
  faturaNo: string | null;
  lisansBaslangic: string | null; // lisans teslim edilince
  /** Bayi lisans siparişinde lisansların gideceği cihazlar (yenileme / satışta sipariş edilen lisans).
   *  Teslimde bu cihazlara işlenir; atanmamış lisans adetleri bayinin lisans havuzuna eklenir. */
  lisansAtamalari?: { seriNo: string; plan: string; sureAy: number }[];
  notlar: SiparisNotu[]; // eskiden yeniye
  iptal?: { tarih: string; neden: string; kim: "embedra" | "bayi"; odemeIadesi: boolean }; // durum "iptal" ise
};

export type StokKalemi = { kod: string; ad: string; adet: number; kritik: number; hedef: number; fiyat: number | null };

export type IadeTuru = "iade" | "degisim";
export type Iade = {
  id: string; // "R-0042"
  siparisId: string;
  musteri: string;
  tur: IadeTuru;
  neden: string;
  urunler?: string[]; // iade edilen cihaz seri no'ları ve diğer kalemler ("EO1-2610-0661", "1× Ana teşhis kablosu")
  tarih: string; // "2026-11-03"
  adim: number; // IADE_ADIMLARI[tur] içindeki sıra
};

// ─────────────────────────────────────────────────────────────
// Satır ↔ domain dönüşümleri
// ─────────────────────────────────────────────────────────────

const SIPARIS_SEC =
  "id, sp_no, sp_tarih, musteri_id, bayi_id, sp_musteri_adi, sp_ulke, sp_adres, sp_tutar, sp_para_birimi, sp_odeme, sp_durum, " +
  "sp_seri_nolar, sp_kargo_firma, sp_kargo_takip, sp_teslim_tarihi, sp_fatura_no, sp_lisans_bat, " +
  "sp_iptal_tarihi, sp_iptal_neden, sp_iptal_kim, sp_iptal_odeme_iadesi, teklif:teklifler(tk_no), " +
  "siparis_kalemleri(sk_sira, sk_tur, sk_model, sk_paket, sk_sure_ay, sk_stok_kodu, sk_adet), " +
  "siparis_notlari(id, sn_metin, sn_sistem, sn_zaman), siparis_lisans_atamalari(id, sla_seri_no, sla_plan, sla_sure_ay)";

type KalemSatiri = { sk_sira: number; sk_tur: Kalem["tur"]; sk_model: CihazModeli | null; sk_paket: string | null; sk_sure_ay: number | null; sk_stok_kodu: string | null; sk_adet: number };
type SiparisSatiri = {
  id: number; sp_no: string; sp_tarih: string; musteri_id: number | null; bayi_id: number | null; sp_musteri_adi: string; sp_ulke: string;
  sp_adres: string; sp_tutar: number | string; sp_para_birimi: ParaBirimi; sp_odeme: OdemeYontemi; sp_durum: SiparisDurumu;
  sp_seri_nolar: string[] | null; sp_kargo_firma: string | null; sp_kargo_takip: string | null; sp_teslim_tarihi: string | null;
  sp_fatura_no: string | null; sp_lisans_bat: string | null; sp_iptal_tarihi: string | null; sp_iptal_neden: string | null;
  sp_iptal_kim: "embedra" | "bayi" | null; sp_iptal_odeme_iadesi: boolean | null; teklif: { tk_no: string } | null;
  siparis_kalemleri: KalemSatiri[] | null;
  siparis_notlari: { id: number; sn_metin: string; sn_sistem: boolean; sn_zaman: string }[] | null;
  siparis_lisans_atamalari: { id: number; sla_seri_no: string; sla_plan: string; sla_sure_ay: number }[] | null;
};
type StokSatiri = { st_kod: string; st_ad: string; st_adet: number; st_kritik: number; st_hedef: number; st_fiyat: number | string | null };
type IadeSatiri = { ia_no: string; ia_siparis_no: string; ia_musteri_adi: string; ia_tur: IadeTuru; ia_neden: string; ia_urunler: string[] | null; ia_tarih: string; ia_adim: number };

/** "6" → 6; sayı olmayan kimlik (boş, eski slug, uuid) → null */
const sayiNo = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
const benzersizIhlali = (e: unknown) => e instanceof Error && /\(23505\)/.test(e.message);

function kalemCevir(k: KalemSatiri): Kalem {
  if (k.sk_tur === "cihaz") return { tur: "cihaz", model: k.sk_model ?? "ONE", adet: k.sk_adet };
  if (k.sk_tur === "lisans") return { tur: "lisans", paket: k.sk_paket ?? "", adet: k.sk_adet, sureAy: k.sk_sure_ay ?? 12 };
  return { tur: "aksesuar", stokKodu: k.sk_stok_kodu ?? "", adet: k.sk_adet };
}

function siparisCevir(r: SiparisSatiri): Siparis {
  const atamalar = r.siparis_lisans_atamalari ?? [];
  const s: Siparis = {
    id: r.sp_no,
    tarih: yerelZaman(r.sp_tarih),
    musteriId: r.musteri_id != null ? String(r.musteri_id) : null,
    musteri: r.sp_musteri_adi,
    ulke: r.sp_ulke,
    adres: r.sp_adres,
    bayiId: r.bayi_id != null ? String(r.bayi_id) : null,
    teklifNo: r.teklif?.tk_no ?? null,
    kalemler: [...(r.siparis_kalemleri ?? [])].sort((a, b) => a.sk_sira - b.sk_sira).map(kalemCevir),
    tutar: Number(r.sp_tutar),
    paraBirimi: r.sp_para_birimi,
    odeme: r.sp_odeme,
    durum: r.sp_durum,
    seriNolar: r.sp_seri_nolar ?? [],
    kargo: r.sp_kargo_firma ? { firma: r.sp_kargo_firma, takipNo: r.sp_kargo_takip ?? "" } : null,
    teslimTarihi: r.sp_teslim_tarihi,
    faturaNo: r.sp_fatura_no,
    lisansBaslangic: r.sp_lisans_bat,
    notlar: [...(r.siparis_notlari ?? [])]
      .sort((a, b) => a.sn_zaman.localeCompare(b.sn_zaman) || a.id - b.id)
      .map((n) => ({ metin: n.sn_metin, zaman: yerelZaman(n.sn_zaman), ...(n.sn_sistem ? { sistem: true } : {}), _id: n.id })),
  };
  if (atamalar.length) {
    s.lisansAtamalari = [...atamalar].sort((a, b) => a.id - b.id).map((a) => ({ seriNo: a.sla_seri_no, plan: a.sla_plan, sureAy: a.sla_sure_ay }));
  }
  if (r.sp_durum === "iptal" || r.sp_iptal_tarihi) {
    s.iptal = { tarih: r.sp_iptal_tarihi ?? "", neden: r.sp_iptal_neden ?? "", kim: r.sp_iptal_kim ?? "embedra", odemeIadesi: !!r.sp_iptal_odeme_iadesi };
  }
  return s;
}

const stokCevir = (r: StokSatiri): StokKalemi => ({
  kod: r.st_kod, ad: r.st_ad, adet: r.st_adet, kritik: r.st_kritik, hedef: r.st_hedef, fiyat: r.st_fiyat == null ? null : Number(r.st_fiyat),
});

const iadeCevir = (r: IadeSatiri): Iade => ({
  id: r.ia_no, siparisId: r.ia_siparis_no, musteri: r.ia_musteri_adi, tur: r.ia_tur, neden: r.ia_neden, urunler: r.ia_urunler ?? [], tarih: r.ia_tarih, adim: r.ia_adim,
});

/** Teklif numarası (tk_no) → teklifler.id */
async function teklifNo(no: string | null | undefined): Promise<number | null> {
  if (!no) return null;
  const s = await db();
  const r = sonuc(await s.from("teklifler").select("id").eq("tk_no", no).maybeSingle(), "Teklif aranırken") as { id: number } | null;
  return r?.id ?? null;
}

/** Siparişin skaler alanları → siparisler sütunları (sp_no ve teklif_id hariç) */
function siparisSutunlari(s: Siparis) {
  return {
    sp_tarih: s.tarih,
    musteri_id: sayiNo(s.musteriId),
    bayi_id: sayiNo(s.bayiId ?? null),
    sp_musteri_adi: s.musteri,
    sp_ulke: s.ulke,
    sp_adres: s.adres,
    sp_tutar: s.tutar,
    sp_para_birimi: s.paraBirimi,
    sp_odeme: s.odeme,
    sp_durum: s.durum,
    sp_seri_nolar: s.seriNolar,
    sp_kargo_firma: s.kargo?.firma ?? null,
    sp_kargo_takip: s.kargo?.takipNo ?? null,
    sp_teslim_tarihi: s.teslimTarihi,
    sp_fatura_no: s.faturaNo,
    sp_lisans_bat: s.lisansBaslangic,
    // iptal.tarih sütunu date: "2026-11-06T11:24" gelirse gün kısmı saklanır
    sp_iptal_tarihi: s.iptal?.tarih ? s.iptal.tarih.slice(0, 10) : null,
    sp_iptal_neden: s.iptal?.neden ?? null,
    sp_iptal_kim: s.iptal?.kim ?? null,
    sp_iptal_odeme_iadesi: s.iptal ? s.iptal.odemeIadesi : null,
  };
}

const kalemSatiri = (siparisId: number, k: Kalem, sira: number) => ({
  siparis_id: siparisId,
  sk_sira: sira,
  sk_tur: k.tur,
  sk_model: k.tur === "cihaz" ? k.model : null,
  sk_paket: k.tur === "lisans" ? k.paket : null,
  sk_sure_ay: k.tur === "lisans" ? k.sureAy : null,
  sk_stok_kodu: k.tur === "aksesuar" ? k.stokKodu : null,
  sk_adet: k.adet,
});
const notSatiri = (siparisId: number, n: SiparisNotu) => ({ siparis_id: siparisId, sn_metin: n.metin, sn_sistem: !!n.sistem, sn_zaman: n.zaman });
const atamaSatiri = (siparisId: number, a: { seriNo: string; plan: string; sureAy: number }) => ({
  siparis_id: siparisId, sla_seri_no: a.seriNo, sla_plan: a.plan, sla_sure_ay: a.sureAy,
});

/** Belge numarasındaki sayı: "S-26-1184" → 1184, "R-0042" → 42 */

// ─────────────────────────────────────────────────────────────
// Okuma
// ─────────────────────────────────────────────────────────────

/** En yeni sipariş başta. Bayi oturumunda RLS yalnızca bayinin siparişlerini döner. */
export async function getSiparisler(): Promise<Siparis[]> {
  const s = await db();
  const r = sonuc(
    await s.from("siparisler").select(SIPARIS_SEC).order("sp_tarih", { ascending: false }).order("id", { ascending: false }),
    "Siparişler okunurken",
  );
  return (r as unknown as SiparisSatiri[]).map(siparisCevir);
}

export async function getSiparis(id: string): Promise<Siparis | null> {
  const s = await db();
  const r = sonuc(await s.from("siparisler").select(SIPARIS_SEC).eq("sp_no", id).maybeSingle(), "Sipariş okunurken");
  return r ? siparisCevir(r as unknown as SiparisSatiri) : null;
}

export async function getStok(): Promise<StokKalemi[]> {
  const s = await db();
  const r = sonuc(await s.from("stok_kalemleri").select("st_kod, st_ad, st_adet, st_kritik, st_hedef, st_fiyat").order("id"), "Depo stoğu okunurken");
  return (r as StokSatiri[]).map(stokCevir);
}

export async function getIadeler(): Promise<Iade[]> {
  const s = await db();
  const r = sonuc(
    await s.from("iadeler").select("ia_no, ia_siparis_no, ia_musteri_adi, ia_tur, ia_neden, ia_urunler, ia_tarih, ia_adim").order("ia_tarih", { ascending: false }).order("id", { ascending: false }),
    "İadeler okunurken",
  );
  return (r as IadeSatiri[]).map(iadeCevir);
}

/** Sıradaki sipariş numarası: "S-26-1185" (çakışmada siparisEkle yeniden numara alır) */
/** Sıradaki belge numarası. Bayi oturumu yalnızca kendi kayıtlarını gördüğü için tüm tablodan veritabanında hesaplanır. */
export async function sonrakiSiparisNo(): Promise<string> {
  const s = await db();
  return sonuc(await s.rpc("sonraki_belge_no", { p_tur: "siparis" }), "Belge numarası alınırken") as string;
}

// ─────────────────────────────────────────────────────────────
// Yazma (actions.ts ve diğer modüllerin action dosyalarından çağrılır)
// ─────────────────────────────────────────────────────────────

/** Siparişi alt kayıtlarıyla kaydeder. Numara başka bir kayıtla çakışırsa yeni numara alır ve s.id'ye yazar. */
export async function siparisEkle(s: Siparis) {
  const c = await db();
  const teklifId = await teklifNo(s.teklifNo);
  let satir: { id: number } | null = null;
  for (let deneme = 0; !satir; deneme++) {
    try {
      satir = sonuc(
        await c.from("siparisler").insert({ ...siparisSutunlari(s), sp_no: s.id, teklif_id: teklifId }).select("id").single(),
        "Sipariş kaydedilirken",
      ) as { id: number };
    } catch (e) {
      if (!benzersizIhlali(e) || deneme >= 2) throw e;
      s.id = await sonrakiSiparisNo();
    }
  }
  const no = satir.id;
  if (s.kalemler.length) sonuc(await c.from("siparis_kalemleri").insert(s.kalemler.map((k, i) => kalemSatiri(no, k, i))), "Sipariş kalemleri kaydedilirken");
  if (s.notlar.length) sonuc(await c.from("siparis_notlari").insert(s.notlar.map((n) => notSatiri(no, n))), "Sipariş notları kaydedilirken");
  if (s.lisansAtamalari?.length) {
    sonuc(await c.from("siparis_lisans_atamalari").insert(s.lisansAtamalari.map((a) => atamaSatiri(no, a))), "Lisans atamaları kaydedilirken");
  }
}

/** Siparişi okur, geri çağırmayla değiştirir, farkı yazar ve güncel siparişi döner.
 *  Skaler alanlar tek update; notlarda _id'siz olanlar eklenir, çıkarılanlar silinir; kalemler / lisans atamaları değiştiyse yeniden yazılır. */
export async function siparisiGuncelle(id: string, f: (s: Siparis) => void): Promise<Siparis | null> {
  const c = await db();
  const ham = sonuc(await c.from("siparisler").select("id").eq("sp_no", id).maybeSingle(), "Sipariş aranırken") as { id: number } | null;
  const eski = ham ? await getSiparis(id) : null;
  if (!ham || !eski) return null;
  const no = ham.id;
  const s = structuredClone(eski);
  f(s);

  const sutunlar: Record<string, unknown> = siparisSutunlari(s);
  if ((s.teklifNo ?? null) !== (eski.teklifNo ?? null)) sutunlar.teklif_id = await teklifNo(s.teklifNo);
  if (s.id !== eski.id) sutunlar.sp_no = s.id;
  sonuc(await c.from("siparisler").update(sutunlar).eq("id", no), "Sipariş güncellenirken");

  if (JSON.stringify(s.kalemler) !== JSON.stringify(eski.kalemler)) {
    sonuc(await c.from("siparis_kalemleri").delete().eq("siparis_id", no), "Sipariş kalemleri silinirken");
    if (s.kalemler.length) sonuc(await c.from("siparis_kalemleri").insert(s.kalemler.map((k, i) => kalemSatiri(no, k, i))), "Sipariş kalemleri kaydedilirken");
  }
  if (JSON.stringify(s.lisansAtamalari ?? []) !== JSON.stringify(eski.lisansAtamalari ?? [])) {
    sonuc(await c.from("siparis_lisans_atamalari").delete().eq("siparis_id", no), "Lisans atamaları silinirken");
    if (s.lisansAtamalari?.length) {
      sonuc(await c.from("siparis_lisans_atamalari").insert(s.lisansAtamalari.map((a) => atamaSatiri(no, a))), "Lisans atamaları kaydedilirken");
    }
  }

  const kalan = new Set(s.notlar.flatMap((n) => (n._id ? [n._id] : [])));
  const silinen = eski.notlar.filter((n) => n._id && !kalan.has(n._id)).map((n) => n._id!);
  if (silinen.length) sonuc(await c.from("siparis_notlari").delete().in("id", silinen), "Sipariş notları silinirken");
  for (const n of s.notlar) {
    const o = n._id ? eski.notlar.find((x) => x._id === n._id) : undefined;
    if (o && (o.metin !== n.metin || o.zaman !== n.zaman || !!o.sistem !== !!n.sistem)) {
      const { siparis_id: _, ...degisen } = notSatiri(no, n);
      sonuc(await c.from("siparis_notlari").update(degisen).eq("id", n._id!), "Sipariş notu güncellenirken");
    }
  }
  const yeni = s.notlar.filter((n) => !n._id);
  if (yeni.length) sonuc(await c.from("siparis_notlari").insert(yeni.map((n) => notSatiri(no, n))), "Sipariş notları kaydedilirken");

  return getSiparis(s.id);
}

/** Depo stoğunu fark kadar değiştirir (0'ın altına inmez). Eş zamanlı yazımlara karşı karşılaştır-yaz:
 *  okunan adet değişmemişse güncellenir, değişmişse yeniden denenir. Bulunamazsa null. */
export async function stokGuncelle(kod: string, fark: number): Promise<StokKalemi | null> {
  const s = await db();
  for (let deneme = 0; deneme < 5; deneme++) {
    const k = sonuc(await s.from("stok_kalemleri").select("st_adet").eq("st_kod", kod).maybeSingle(), "Stok okunurken") as { st_adet: number } | null;
    if (!k) return null;
    const r = sonuc(
      await s
        .from("stok_kalemleri")
        .update({ st_adet: Math.max(0, k.st_adet + fark) })
        .eq("st_kod", kod)
        .eq("st_adet", k.st_adet)
        .select("st_kod, st_ad, st_adet, st_kritik, st_hedef, st_fiyat"),
      "Stok güncellenirken",
    ) as StokSatiri[];
    if (r.length) return stokCevir(r[0]);
  }
  throw new Error("Stok güncellenemedi: kayıt aynı anda başka bir işlemle değişiyor, tekrar deneyin.");
}

export async function stokKalemiEkle(k: StokKalemi) {
  const s = await db();
  sonuc(
    await s.from("stok_kalemleri").insert({ st_kod: k.kod, st_ad: k.ad, st_adet: k.adet, st_kritik: k.kritik, st_hedef: k.hedef, st_fiyat: k.fiyat }),
    "Stok kalemi kaydedilirken",
  );
}

/** Siparişe bağlı iade / değişim kaydı. siparis_id, sipariş hâlâ varsa doldurulur. Numara çakışırsa yeni numara alır ve i.id'ye yazar. */
export async function iadeEkle(i: Iade) {
  const s = await db();
  const sp = sonuc(await s.from("siparisler").select("id").eq("sp_no", i.siparisId).maybeSingle(), "Sipariş aranırken") as { id: number } | null;
  for (let deneme = 0; ; deneme++) {
    try {
      sonuc(
        await s.from("iadeler").insert({
          ia_no: i.id, ia_siparis_no: i.siparisId, siparis_id: sp?.id ?? null, ia_musteri_adi: i.musteri, ia_tur: i.tur,
          ia_neden: i.neden, ia_urunler: i.urunler ?? [], ia_tarih: i.tarih, ia_adim: i.adim,
        }),
        "İade kaydedilirken",
      );
      return;
    } catch (e) {
      if (!benzersizIhlali(e) || deneme >= 2) throw e;
      i.id = await sonrakiIadeNo();
    }
  }
}

export async function iadeyiGuncelle(id: string, f: (i: Iade) => void): Promise<Iade | null> {
  const s = await db();
  const r = sonuc(
    await s.from("iadeler").select("ia_no, ia_siparis_no, ia_musteri_adi, ia_tur, ia_neden, ia_urunler, ia_tarih, ia_adim").eq("ia_no", id).maybeSingle(),
    "İade okunurken",
  ) as IadeSatiri | null;
  if (!r) return null;
  const i = iadeCevir(r);
  f(i);
  const guncel = sonuc(
    await s
      .from("iadeler")
      .update({ ia_musteri_adi: i.musteri, ia_tur: i.tur, ia_neden: i.neden, ia_urunler: i.urunler ?? [], ia_tarih: i.tarih, ia_adim: i.adim })
      .eq("ia_no", id)
      .select("ia_no, ia_siparis_no, ia_musteri_adi, ia_tur, ia_neden, ia_urunler, ia_tarih, ia_adim")
      .single(),
    "İade güncellenirken",
  ) as IadeSatiri;
  return iadeCevir(guncel);
}

/** Sıradaki belge numarası. Bayi oturumu yalnızca kendi kayıtlarını gördüğü için tüm tablodan veritabanında hesaplanır. */
export async function sonrakiIadeNo(): Promise<string> {
  const s = await db();
  return sonuc(await s.rpc("sonraki_belge_no", { p_tur: "iade" }), "Belge numarası alınırken") as string;
}

/** Satış hattında kazanılan fırsattan "ödeme bekliyor" sipariş açar (satis-hatti/actions.ts çağırır) */
export async function firsattanSiparisAc(f: { firma: string; musteriId: string; ulke: string; konum: string; icerik: string; tutar: number }, kalemler: Kalem[]) {
  if (!kalemler.length) return null;
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const zaman = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  const siparis: Siparis = {
    id: await sonrakiSiparisNo(), tarih: zaman, musteriId: f.musteriId || null, musteri: f.firma, ulke: f.ulke, adres: f.konum,
    kalemler, tutar: f.tutar, paraBirimi: "TRY", odeme: "Havale/EFT", durum: "odeme", seriNolar: [], kargo: null,
    teslimTarihi: null, faturaNo: null, lisansBaslangic: null,
    notlar: [{ metin: `Satış hattında kazanılan fırsattan açıldı: ${f.icerik}`, zaman, sistem: true }],
  };
  await siparisEkle(siparis);
  return siparis;
}
