// Teklifler: satış hattındaki fırsattan hazırlanan fiyat teklifleri (Supabase: teklifler + teklif_kalemleri).
// Domain id = tk_no ("TKL-2026-0001", revizyonda "TKL-2026-0001-v2"); firsatId = String(satis_hatti_id).
import type { CihazModeli } from "@/lib/urunler";
import { DURUM_ADI } from "./sabitler";
export { DURUM_ADI };
import { db, sonuc } from "@/lib/supabase/db";

/** taslak → gonderildi → kabul | red. Yeni revizyon açılınca eskisi "revize" olur. Süresi dolma, gecerlilik tarihinden hesaplanır. */
export type TeklifDurumu = "taslak" | "gonderildi" | "kabul" | "red" | "revize";

export type TeklifKalemi =
  | { tur: "cihaz"; model: CihazModeli; adet: number; birimFiyat: number }
  | { tur: "lisans"; paket: string; adet: number; birimFiyat: number }
  | { tur: "ozel"; aciklama: string; adet: number; birimFiyat: number; kdvli: boolean };

export type Teklif = {
  id: string; // "TKL-2026-0001"
  no: string; // "TKL-2026-0001 v2" (ekranda)
  kok: string; // ilk sürümün id'si; revizyonlar aynı kökü paylaşır
  versiyon: number;
  firsatId: string;
  firma: string;
  konum: string;
  kalemler: TeklifKalemi[];
  iskonto: number; // % (ara toplamdan)
  kdv: number; // 0.2 (cihaz ve KDV'li özel kalemlere)
  gecerlilik: string; // "2026-11-25"
  odemeSartlari: string;
  teslimSartlari: string;
  not: string;
  durum: TeklifDurumu;
  olusturma: string; // "2026-11-06"
  gonderim: string | null;
  sonuc: string | null; // kabul / red tarihi
  siparisNo?: string | null; // kabul edilince açılan sipariş
};

// ─────────────────────────────────────────────────────────────
// Satır ↔ domain dönüşümleri
// ─────────────────────────────────────────────────────────────

const TEKLIF_SEC =
  "id, tk_no, tk_gorunen_no, tk_kok, tk_versiyon, satis_hatti_id, tk_firma, tk_konum, tk_iskonto, tk_kdv, tk_gecerlilik, " +
  "tk_odeme_sartlari, tk_teslim_sartlari, tk_not, tk_durum, tk_olusturma, tk_gonderim, tk_sonuc, tk_siparis_no, " +
  "teklif_kalemleri(tkk_sira, tkk_tur, tkk_model, tkk_paket, tkk_aciklama, tkk_adet, tkk_birim_fiyat, tkk_kdvli)";

type KalemSatiri = {
  tkk_sira: number; tkk_tur: TeklifKalemi["tur"]; tkk_model: CihazModeli | null; tkk_paket: string | null; tkk_aciklama: string | null;
  tkk_adet: number; tkk_birim_fiyat: number | string; tkk_kdvli: boolean;
};
type TeklifSatiri = {
  id: number; tk_no: string; tk_gorunen_no: string; tk_kok: string; tk_versiyon: number; satis_hatti_id: number | null; tk_firma: string;
  tk_konum: string; tk_iskonto: number | string; tk_kdv: number | string; tk_gecerlilik: string; tk_odeme_sartlari: string;
  tk_teslim_sartlari: string; tk_not: string; tk_durum: TeklifDurumu; tk_olusturma: string; tk_gonderim: string | null;
  tk_sonuc: string | null; tk_siparis_no: string | null; teklif_kalemleri: KalemSatiri[] | null;
};

const sayiNo = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

function kalemCevir(k: KalemSatiri): TeklifKalemi {
  const birimFiyat = Number(k.tkk_birim_fiyat);
  if (k.tkk_tur === "cihaz") return { tur: "cihaz", model: k.tkk_model ?? "ONE", adet: k.tkk_adet, birimFiyat };
  if (k.tkk_tur === "lisans") return { tur: "lisans", paket: k.tkk_paket ?? "", adet: k.tkk_adet, birimFiyat };
  return { tur: "ozel", aciklama: k.tkk_aciklama ?? "", adet: k.tkk_adet, birimFiyat, kdvli: k.tkk_kdvli };
}

function teklifCevir(r: TeklifSatiri): Teklif {
  return {
    id: r.tk_no,
    no: r.tk_gorunen_no,
    kok: r.tk_kok,
    versiyon: r.tk_versiyon,
    firsatId: r.satis_hatti_id != null ? String(r.satis_hatti_id) : "",
    firma: r.tk_firma,
    konum: r.tk_konum,
    kalemler: [...(r.teklif_kalemleri ?? [])].sort((a, b) => a.tkk_sira - b.tkk_sira).map(kalemCevir),
    iskonto: Number(r.tk_iskonto),
    kdv: Number(r.tk_kdv),
    gecerlilik: r.tk_gecerlilik,
    odemeSartlari: r.tk_odeme_sartlari,
    teslimSartlari: r.tk_teslim_sartlari,
    not: r.tk_not,
    durum: r.tk_durum,
    olusturma: r.tk_olusturma,
    gonderim: r.tk_gonderim,
    sonuc: r.tk_sonuc,
    siparisNo: r.tk_siparis_no,
  };
}

/** Teklifin skaler alanları → teklifler sütunları (tk_no hariç) */
const teklifSutunlari = (t: Teklif) => ({
  tk_gorunen_no: t.no,
  tk_kok: t.kok,
  tk_versiyon: t.versiyon,
  satis_hatti_id: sayiNo(t.firsatId),
  tk_firma: t.firma,
  tk_konum: t.konum,
  tk_iskonto: t.iskonto,
  tk_kdv: t.kdv,
  tk_gecerlilik: t.gecerlilik,
  tk_odeme_sartlari: t.odemeSartlari,
  tk_teslim_sartlari: t.teslimSartlari,
  tk_not: t.not,
  tk_durum: t.durum,
  tk_olusturma: t.olusturma,
  tk_gonderim: t.gonderim,
  tk_sonuc: t.sonuc,
  tk_siparis_no: t.siparisNo ?? null,
});

const kalemSatiri = (teklifId: number, k: TeklifKalemi, sira: number) => ({
  teklif_id: teklifId,
  tkk_sira: sira,
  tkk_tur: k.tur,
  tkk_model: k.tur === "cihaz" ? k.model : null,
  tkk_paket: k.tur === "lisans" ? k.paket : null,
  tkk_aciklama: k.tur === "ozel" ? k.aciklama : null,
  tkk_adet: k.adet,
  tkk_birim_fiyat: k.birimFiyat,
  tkk_kdvli: k.tur === "ozel" ? k.kdvli : true,
});

// ─────────────────────────────────────────────────────────────
// Okuma
// ─────────────────────────────────────────────────────────────

/** En yeni teklif başta */
export async function getTeklifler(): Promise<Teklif[]> {
  const s = await db();
  const r = sonuc(await s.from("teklifler").select(TEKLIF_SEC).order("id", { ascending: false }), "Teklifler okunurken");
  return (r as unknown as TeklifSatiri[]).map(teklifCevir);
}

export async function getTeklif(id: string): Promise<Teklif | null> {
  const s = await db();
  const r = sonuc(await s.from("teklifler").select(TEKLIF_SEC).eq("tk_no", id).maybeSingle(), "Teklif okunurken");
  return r ? teklifCevir(r as unknown as TeklifSatiri) : null;
}

export async function sonrakiTeklifNo(yil: number): Promise<string> {
  const onek = `TKL-${yil}-`;
  const s = await db();
  const r = sonuc(await s.from("teklifler").select("tk_no").like("tk_no", `${onek}%`), "Teklif numarası okunurken") as { tk_no: string }[];
  const en = Math.max(0, ...r.map((t) => Number(t.tk_no.slice(onek.length).split("-")[0]) || 0));
  return `${onek}${String(en + 1).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Yazma (yalnızca actions.ts'ten çağrılır)
// ─────────────────────────────────────────────────────────────

export async function teklifEkle(t: Teklif) {
  const s = await db();
  const satir = sonuc(
    await s.from("teklifler").insert({ ...teklifSutunlari(t), tk_no: t.id }).select("id").single(),
    "Teklif kaydedilirken",
  ) as { id: number };
  if (t.kalemler.length) sonuc(await s.from("teklif_kalemleri").insert(t.kalemler.map((k, i) => kalemSatiri(satir.id, k, i))), "Teklif kalemleri kaydedilirken");
}

/** Teklifi okur, geri çağırmayla değiştirir, farkı yazar (kalemler değiştiyse yeniden yazılır) ve güncel teklifi döner. */
export async function teklifiGuncelle(id: string, f: (t: Teklif) => void): Promise<Teklif | null> {
  const s = await db();
  const ham = sonuc(await s.from("teklifler").select("id").eq("tk_no", id).maybeSingle(), "Teklif aranırken") as { id: number } | null;
  const eski = ham ? await getTeklif(id) : null;
  if (!ham || !eski) return null;
  const t = structuredClone(eski);
  f(t);
  const sutunlar: Record<string, unknown> = teklifSutunlari(t);
  if (t.id !== eski.id) sutunlar.tk_no = t.id;
  sonuc(await s.from("teklifler").update(sutunlar).eq("id", ham.id), "Teklif güncellenirken");
  if (JSON.stringify(t.kalemler) !== JSON.stringify(eski.kalemler)) {
    sonuc(await s.from("teklif_kalemleri").delete().eq("teklif_id", ham.id), "Teklif kalemleri silinirken");
    if (t.kalemler.length) sonuc(await s.from("teklif_kalemleri").insert(t.kalemler.map((k, i) => kalemSatiri(ham.id, k, i))), "Teklif kalemleri kaydedilirken");
  }
  return getTeklif(t.id);
}
