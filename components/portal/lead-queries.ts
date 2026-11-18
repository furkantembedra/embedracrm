// Bayi lead'leri (Supabase). Yalnızca portal işlemleri okur / yazar; CRM bu kayıtları göstermez.
// Tablolar: bayi_leadleri, bayi_lead_notlari, bayi_lead_teklifleri (+ bayi_lead_teklif_kalemleri). Lead id = String(id);
// teklif id = blt_no ("DP-2026-014", revizyonda "-v2"), no = blt_gorunen_no. RLS: bayi kendi lead'lerinde tam yetkili.
import { db, sonuc, yerelZaman } from "@/lib/supabase/db";
import type { TeklifDurumu, TeklifKalemi } from "@/components/teklifler/queries";
import type { BayiLead, BayiTeklif, LeadAsamasi, LeadNotu } from "./lead-ortak";

const sayiMi = (id: string) => /^\d+$/.test(id);

const LEAD_ALANLARI = [
  "id, bayi_id, bl_firma, bl_yetkili, bl_telefon, bl_eposta, bl_sehir, bl_kaynak, bl_ilgi_model, bl_ilgi_adet, bl_ilgi_plan, bl_tutar, bl_asama,",
  "bl_kayip_nedeni, bl_sonraki_adim, bl_sonraki_tarih, bl_olusturma, bl_kapanis, bl_satilan_seriler,",
  "bayi_lead_notlari(id, bln_zaman, bln_metin, bln_sistem),",
  "bayi_lead_teklifleri(id, blt_no, blt_gorunen_no, blt_versiyon, blt_iskonto, blt_kdv, blt_gecerlilik, blt_odeme_sartlari, blt_teslim_sartlari, blt_not,",
  "blt_durum, blt_olusturma, blt_gonderim, blt_sonuc, bayi_lead_teklif_kalemleri(bltk_sira, bltk_tur, bltk_model, bltk_paket, bltk_aciklama, bltk_adet, bltk_birim_fiyat, bltk_kdvli))",
].join(" ");

type KalemSatiri = {
  bltk_sira: number; bltk_tur: TeklifKalemi["tur"]; bltk_model: "ONE" | "ONE Lite" | null; bltk_paket: string | null; bltk_aciklama: string | null;
  bltk_adet: number; bltk_birim_fiyat: number | string; bltk_kdvli: boolean;
};
type TeklifSatiri = {
  id: number; blt_no: string; blt_gorunen_no: string; blt_versiyon: number; blt_iskonto: number | string; blt_kdv: number | string; blt_gecerlilik: string;
  blt_odeme_sartlari: string; blt_teslim_sartlari: string; blt_not: string; blt_durum: TeklifDurumu; blt_olusturma: string; blt_gonderim: string | null;
  blt_sonuc: string | null; bayi_lead_teklif_kalemleri: KalemSatiri[];
};
type LeadSatiri = {
  id: number; bayi_id: number; bl_firma: string; bl_yetkili: string; bl_telefon: string; bl_eposta: string; bl_sehir: string; bl_kaynak: string;
  bl_ilgi_model: "ONE" | "ONE Lite"; bl_ilgi_adet: number; bl_ilgi_plan: BayiLead["ilgi"]["plan"]; bl_tutar: number | string | null; bl_asama: LeadAsamasi;
  bl_kayip_nedeni: string | null; bl_sonraki_adim: string; bl_sonraki_tarih: string | null; bl_olusturma: string; bl_kapanis: string | null;
  bl_satilan_seriler: string[] | null;
  bayi_lead_notlari: { id: number; bln_zaman: string; bln_metin: string; bln_sistem: boolean }[];
  bayi_lead_teklifleri: TeklifSatiri[];
};

function kalemCevir(k: KalemSatiri): TeklifKalemi {
  const ortak = { adet: k.bltk_adet, birimFiyat: Number(k.bltk_birim_fiyat) };
  if (k.bltk_tur === "cihaz") return { tur: "cihaz", model: k.bltk_model ?? "ONE", ...ortak };
  if (k.bltk_tur === "lisans") return { tur: "lisans", paket: k.bltk_paket ?? "", ...ortak };
  return { tur: "ozel", aciklama: k.bltk_aciklama ?? "", kdvli: k.bltk_kdvli, ...ortak };
}

function teklifCevir(t: TeklifSatiri): BayiTeklif {
  return {
    id: t.blt_no, no: t.blt_gorunen_no, versiyon: t.blt_versiyon,
    kalemler: [...t.bayi_lead_teklif_kalemleri].sort((a, b) => a.bltk_sira - b.bltk_sira).map(kalemCevir),
    iskonto: Number(t.blt_iskonto), kdv: Number(t.blt_kdv), gecerlilik: t.blt_gecerlilik, odemeSartlari: t.blt_odeme_sartlari,
    teslimSartlari: t.blt_teslim_sartlari, not: t.blt_not, durum: t.blt_durum, olusturma: t.blt_olusturma, gonderim: t.blt_gonderim, sonuc: t.blt_sonuc,
  };
}

function leadCevir(r: LeadSatiri): BayiLead {
  return {
    id: String(r.id), bayiId: String(r.bayi_id), firma: r.bl_firma, yetkili: r.bl_yetkili, telefon: r.bl_telefon, eposta: r.bl_eposta,
    sehir: r.bl_sehir, kaynak: r.bl_kaynak, ilgi: { model: r.bl_ilgi_model, adet: r.bl_ilgi_adet, plan: r.bl_ilgi_plan },
    tutar: r.bl_tutar == null ? null : Number(r.bl_tutar), asama: r.bl_asama, kayipNedeni: r.bl_kayip_nedeni, sonrakiAdim: r.bl_sonraki_adim,
    sonrakiTarih: r.bl_sonraki_tarih, olusturma: r.bl_olusturma, kapanis: r.bl_kapanis, satilanSeriler: r.bl_satilan_seriler ?? [],
    notlar: [...r.bayi_lead_notlari]
      .sort((a, b) => a.bln_zaman.localeCompare(b.bln_zaman) || a.id - b.id)
      .map((n): LeadNotu => ({ zaman: yerelZaman(n.bln_zaman), metin: n.bln_metin, ...(n.bln_sistem ? { sistem: true } : {}), _id: n.id })),
    teklifler: [...r.bayi_lead_teklifleri].sort((a, b) => a.blt_versiyon - b.blt_versiyon || a.id - b.id).map(teklifCevir),
  };
}

const leadSatiri = (l: BayiLead) => ({
  bl_firma: l.firma, bl_yetkili: l.yetkili, bl_telefon: l.telefon, bl_eposta: l.eposta, bl_sehir: l.sehir, bl_kaynak: l.kaynak,
  bl_ilgi_model: l.ilgi.model, bl_ilgi_adet: l.ilgi.adet, bl_ilgi_plan: l.ilgi.plan, bl_tutar: l.tutar, bl_asama: l.asama,
  bl_kayip_nedeni: l.kayipNedeni, bl_sonraki_adim: l.sonrakiAdim, bl_sonraki_tarih: l.sonrakiTarih, bl_olusturma: l.olusturma,
  bl_kapanis: l.kapanis, bl_satilan_seriler: l.satilanSeriler,
});

const teklifSatiri = (t: BayiTeklif) => ({
  blt_no: t.id, blt_gorunen_no: t.no, blt_versiyon: t.versiyon, blt_iskonto: t.iskonto, blt_kdv: t.kdv, blt_gecerlilik: t.gecerlilik,
  blt_odeme_sartlari: t.odemeSartlari, blt_teslim_sartlari: t.teslimSartlari, blt_not: t.not, blt_durum: t.durum, blt_olusturma: t.olusturma,
  blt_gonderim: t.gonderim, blt_sonuc: t.sonuc,
});

const kalemSatirlari = (teklifId: number, kalemler: TeklifKalemi[]) =>
  kalemler.map((k, i) => ({
    teklif_id: teklifId, bltk_sira: i, bltk_tur: k.tur, bltk_adet: k.adet, bltk_birim_fiyat: k.birimFiyat,
    bltk_model: k.tur === "cihaz" ? k.model : null, bltk_paket: k.tur === "lisans" ? k.paket : null,
    bltk_aciklama: k.tur === "ozel" ? k.aciklama : null, bltk_kdvli: k.tur === "ozel" ? k.kdvli : true,
  }));

const notSatiri = (leadId: number, n: LeadNotu) => ({ lead_id: leadId, bln_zaman: n.zaman, bln_metin: n.metin, bln_sistem: !!n.sistem });

/** Teklif satırını ve kalemlerini yazar, veritabanı id'sini döner */
async function teklifEkle(leadId: number, t: BayiTeklif) {
  const s = await db();
  const r = sonuc(await s.from("bayi_lead_teklifleri").insert({ lead_id: leadId, ...teklifSatiri(t) }).select("id").single(), "Teklif yazılıyordu") as { id: number };
  if (t.kalemler.length) sonuc(await s.from("bayi_lead_teklif_kalemleri").insert(kalemSatirlari(r.id, t.kalemler)), "Teklif kalemleri yazılıyordu");
  return r.id;
}

export async function getBayiLeadleri(bayiId: string) {
  if (!sayiMi(bayiId)) return [];
  const s = await db();
  const satirlar = sonuc(await s.from("bayi_leadleri").select(LEAD_ALANLARI).eq("bayi_id", Number(bayiId)).order("id"), "Bayi lead'leri okunuyordu") as unknown as LeadSatiri[];
  return satirlar.map(leadCevir);
}

async function leadOku(bayiId: string, id: string) {
  if (!sayiMi(bayiId) || !sayiMi(id)) return null;
  const s = await db();
  const r = sonuc(
    await s.from("bayi_leadleri").select(LEAD_ALANLARI).eq("id", Number(id)).eq("bayi_id", Number(bayiId)).maybeSingle(),
    "Bayi lead'i okunuyordu",
  ) as unknown as LeadSatiri | null;
  return r && { lead: leadCevir(r), teklifIdleri: new Map(r.bayi_lead_teklifleri.map((t) => [t.blt_no, t.id])) };
}

export async function getBayiLead(bayiId: string, id: string) {
  return (await leadOku(bayiId, id))?.lead ?? null;
}

/** Yeni lead (notları ve varsa teklifleriyle). Veritabanı id'si l.id'ye yazılır. */
export async function bayiLeadEkle(l: BayiLead) {
  const s = await db();
  const r = sonuc(
    await s.from("bayi_leadleri").insert({ bayi_id: Number(l.bayiId), ...leadSatiri(l) }).select("id").single(),
    "Bayi lead'i kaydediliyordu",
  ) as { id: number };
  l.id = String(r.id);
  if (l.notlar.length) sonuc(await s.from("bayi_lead_notlari").insert(l.notlar.map((n) => notSatiri(r.id, n))), "Lead notları yazılıyordu");
  for (const t of l.teklifler) await teklifEkle(r.id, t);
}

/** Lead'i okur, değişikliği uygular, farkı yazar: skaler alanlar tek update; yeni notlar insert (silinen notlar silinir);
 *  teklifler blt_no ile eşlenir (yeni → insert, değişen → update + kalemler yeniden yazılır, kaldırılan → delete). */
export async function bayiLeadGuncelle(bayiId: string, id: string, f: (l: BayiLead) => void) {
  const okunan = await leadOku(bayiId, id);
  if (!okunan) return null;
  const { lead: l, teklifIdleri } = okunan;
  const no = Number(l.id);
  const onceLead = JSON.stringify(leadSatiri(l));
  const onceNotlar = new Set(l.notlar.map((n) => n._id!));
  const onceTeklifler = new Map(l.teklifler.map((t) => [t.id, JSON.stringify(t)]));
  f(l);
  const s = await db();

  const yeniLead = leadSatiri(l);
  if (JSON.stringify(yeniLead) !== onceLead) sonuc(await s.from("bayi_leadleri").update(yeniLead).eq("id", no), "Bayi lead'i güncelleniyordu");

  const kalanNotlar = new Set(l.notlar.flatMap((n) => (n._id ? [n._id] : [])));
  const silinenNotlar = [...onceNotlar].filter((x) => !kalanNotlar.has(x));
  if (silinenNotlar.length) sonuc(await s.from("bayi_lead_notlari").delete().in("id", silinenNotlar), "Lead notları siliniyordu");
  const yeniNotlar = l.notlar.filter((n) => !n._id);
  if (yeniNotlar.length) {
    const eklenen = sonuc(await s.from("bayi_lead_notlari").insert(yeniNotlar.map((n) => notSatiri(no, n))).select("id"), "Lead notları yazılıyordu") as { id: number }[];
    yeniNotlar.forEach((n, i) => (n._id = eklenen[i]?.id));
  }

  const simdikiler = new Set(l.teklifler.map((t) => t.id));
  for (const [blt, dbId] of teklifIdleri) {
    if (!simdikiler.has(blt)) sonuc(await s.from("bayi_lead_teklifleri").delete().eq("id", dbId), "Teklif siliniyordu");
  }
  for (const t of l.teklifler) {
    const dbId = teklifIdleri.get(t.id);
    if (dbId === undefined) {
      await teklifEkle(no, t);
      continue;
    }
    const once = onceTeklifler.get(t.id);
    if (once === JSON.stringify(t)) continue;
    sonuc(await s.from("bayi_lead_teklifleri").update(teklifSatiri(t)).eq("id", dbId), "Teklif güncelleniyordu");
    if (JSON.stringify((JSON.parse(once!) as BayiTeklif).kalemler) !== JSON.stringify(t.kalemler)) {
      sonuc(await s.from("bayi_lead_teklif_kalemleri").delete().eq("teklif_id", dbId), "Teklif kalemleri siliniyordu");
      if (t.kalemler.length) sonuc(await s.from("bayi_lead_teklif_kalemleri").insert(kalemSatirlari(dbId, t.kalemler)), "Teklif kalemleri yazılıyordu");
    }
  }
  return l;
}

/** Bayinin sıradaki teklif numarası: "DP-2026-015" (bayi adının baş harfleri). Yalnızca bu bayinin teklifleri sayılır. */
export async function sonrakiTeklifNo(bayiId: string, bayiAd: string, yil: string) {
  const onek = bayiAd.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toLocaleUpperCase("en")).join("").replace(/[^A-Z]/g, "X");
  let n: number[] = [];
  if (sayiMi(bayiId)) {
    const s = await db();
    const satirlar = sonuc(
      await s.from("bayi_lead_teklifleri").select("blt_no, bayi_leadleri!inner(bayi_id)").eq("bayi_leadleri.bayi_id", Number(bayiId)).like("blt_no", `%-${yil}-%`),
      "Teklif numaraları okunuyordu",
    ) as { blt_no: string }[];
    n = satirlar.map((t) => Number(t.blt_no.split("-")[2])).filter(Number.isFinite);
  }
  return `${onek}-${yil}-${String(Math.max(13, ...n) + 1).padStart(3, "0")}`;
}
