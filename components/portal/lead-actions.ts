"use server";
// Bayinin kendi lead'leri (Server Actions). Bayi kimliği oturumdan; kayıtlar yalnızca o bayiye aittir.
import { revalidatePath } from "next/cache";
import { simdiYerel } from "@/components/rma/islemler";
import { portalTopluSatis, type PortalFormDurumu } from "./actions";
import { bayiLeadEkle, bayiLeadGuncelle, getBayiLead, sonrakiTeklifNo } from "./lead-queries";
import { teklifToplami } from "@/components/teklifler/ortak";
import type { TeklifKalemi } from "@/components/teklifler/queries";
import { ASAMA_AD, KAYIP_NEDENLERI, LEAD_ASAMALARI, LEAD_KAYNAKLARI, type BayiLead, type BayiTeklif, type LeadAsamasi } from "./lead-ortak";
import { portalOturumu } from "./oturum";

async function bayiGerekli() {
  const o = await portalOturumu();
  if (!o) throw new Error("Oturum yok");
  return o.bayi;
}
const yenile = () => { revalidatePath("/portal/leadler", "layout"); revalidatePath("/portal"); };
const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const kirp = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);

/** Yeni lead ya da düzenleme */
export async function portalLeadKaydet(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  const id = kirp(form.get("id"), 60);
  const firma = kirp(form.get("firma"), 120);
  const kaynak = kirp(form.get("kaynak"), 40);
  const model = kirp(form.get("model"), 10) === "ONE Lite" ? "ONE Lite" : "ONE";
  const adet = Number(form.get("adet") || 1);
  const plan = kirp(form.get("plan"), 6) as BayiLead["ilgi"]["plan"];
  const tutarMetin = kirp(form.get("tutar"), 12).replace(/\./g, "").replace(",", ".");
  const tutar = tutarMetin ? Number(tutarMetin) : null;
  const sonrakiTarih = kirp(form.get("sonrakiTarih"), 10);
  const eposta = kirp(form.get("eposta"), 120);

  const hatalar: Record<string, string> = {};
  if (firma.length < 2) hatalar.firma = "Firma adını girin.";
  if (!(LEAD_KAYNAKLARI as readonly string[]).includes(kaynak)) hatalar.kaynak = "Kaynak seçin.";
  if (!Number.isInteger(adet) || adet < 1 || adet > 500) hatalar.adet = "1–500 arası adet.";
  if (plan && !["Basic", "Pro", "Pro+"].includes(plan)) hatalar.plan = "Plan seçin.";
  if (tutar !== null && (!Number.isFinite(tutar) || tutar < 0)) hatalar.tutar = "Tutar geçersiz.";
  if (sonrakiTarih && !TARIH.test(sonrakiTarih)) hatalar.sonrakiTarih = "Tarih geçersiz.";
  if (eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) hatalar.eposta = "E-posta geçersiz.";
  if (Object.keys(hatalar).length) return { hatalar };

  const alanlar = {
    firma, kaynak, eposta, yetkili: kirp(form.get("yetkili"), 80), telefon: kirp(form.get("telefon"), 30), sehir: kirp(form.get("sehir"), 60),
    ilgi: { model, adet, plan } as BayiLead["ilgi"], tutar: tutar === null ? null : Math.round(tutar),
    sonrakiAdim: kirp(form.get("sonrakiAdim"), 120), sonrakiTarih: sonrakiTarih || null,
  };
  const zaman = simdiYerel();
  if (id) {
    const l = await bayiLeadGuncelle(bayi.id, id, (x) => Object.assign(x, alanlar));
    if (!l) return { hata: "Lead bulunamadı." };
    yenile();
    return { tamam: "Lead güncellendi.", zaman: Date.now(), kayitId: l.id };
  }
  const not = kirp(form.get("not"), 600);
  // "+" ile sütundan eklenen lead o aşamada başlar (yalnızca açık aşamalar)
  const istenen = kirp(form.get("asama"), 12) as LeadAsamasi;
  const baslangic: LeadAsamasi = ["yeni", "gorusuldu", "demo", "teklif"].includes(istenen) ? istenen : "yeni";
  const lead: BayiLead = {
    id: crypto.randomUUID(), bayiId: bayi.id, ...alanlar, asama: baslangic, kayipNedeni: null, olusturma: zaman.slice(0, 10), kapanis: null,
    notlar: [{ zaman, metin: `Lead eklendi (${kaynak}).`, sistem: true }, ...(not ? [{ zaman, metin: not }] : [])], teklifler: [], satilanSeriler: [],
  };
  await bayiLeadEkle(lead);
  yenile();
  return { tamam: `${firma} eklendi.`, zaman: Date.now(), kayitId: lead.id };
}

/** Aşama değiştir (kanban sürükle-bırak ve detaydan). Kazanıldı için satış portalLeadKazan ile yapılır. */
export async function portalLeadAsama(id: string, asama: LeadAsamasi, kayipNedeni?: string): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  if (!LEAD_ASAMALARI.includes(asama)) return { hata: "Aşama geçersiz." };
  if (asama === "kaybedildi" && !(KAYIP_NEDENLERI as readonly string[]).includes(kayipNedeni ?? "")) return { hata: "Kayıp nedenini seçin." };
  const zaman = simdiYerel();
  const l = await bayiLeadGuncelle(bayi.id, id, (x) => {
    if (x.asama === asama) return;
    x.asama = asama;
    x.kayipNedeni = asama === "kaybedildi" ? kayipNedeni! : null;
    x.kapanis = asama === "kazanildi" || asama === "kaybedildi" ? zaman.slice(0, 10) : null;
    x.notlar.push({ zaman, metin: `Aşama: ${ASAMA_AD[asama]}${asama === "kaybedildi" ? ` · ${kayipNedeni}` : ""}`, sistem: true });
  });
  if (!l) return { hata: "Lead bulunamadı." };
  yenile();
  return { tamam: `${l.firma}: ${ASAMA_AD[asama]}`, zaman: Date.now() };
}

export async function portalLeadNot(id: string, metin: string): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  const m = metin.trim();
  if (m.length < 2) return { hata: "Notu yazın." };
  const l = await bayiLeadGuncelle(bayi.id, id, (x) => x.notlar.push({ zaman: simdiYerel(), metin: m.slice(0, 600) }));
  if (!l) return { hata: "Lead bulunamadı." };
  yenile();
  return { tamam: "Not eklendi.", zaman: Date.now() };
}

export async function portalLeadTakip(id: string, adim: string, tarih: string): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  if (tarih && !TARIH.test(tarih)) return { hata: "Tarih geçersiz." };
  const l = await bayiLeadGuncelle(bayi.id, id, (x) => {
    x.sonrakiAdim = adim.trim().slice(0, 120);
    x.sonrakiTarih = tarih || null;
  });
  if (!l) return { hata: "Lead bulunamadı." };
  yenile();
  return { tamam: "Sonraki adım kaydedildi.", zaman: Date.now() };
}

export type BayiTeklifDurumu = { hatalar?: Record<string, string>; teklif?: BayiTeklif; leadId?: string; zaman?: number };

/** CRM teklif formuyla aynı alanlar: kalemler (JSON), iskonto, KDV, geçerlilik, şartlar, not; "taslak" ya da "gonder".
 *  oncekiId verilirse revizyon açılır (önceki sürüm "revize edildi" olur). */
export async function portalTeklifKaydet(_o: BayiTeklifDurumu, form: FormData): Promise<BayiTeklifDurumu> {
  const bayi = await bayiGerekli();
  const leadId = kirp(form.get("leadId"), 60);
  const oncekiId = kirp(form.get("oncekiId"), 40);
  const islem = kirp(form.get("islem"), 10) === "gonder" ? "gonder" : "taslak";
  const lead = await getBayiLead(bayi.id, leadId);
  if (!lead) return { hatalar: { genel: "Lead bulunamadı." } };

  const hatalar: Record<string, string> = {};
  let kalemler: TeklifKalemi[] = [];
  try {
    const ham = JSON.parse(String(form.get("kalemler") ?? "[]")) as TeklifKalemi[];
    kalemler = ham.slice(0, 30).flatMap((k): TeklifKalemi[] => {
      const adet = Math.round(Number(k.adet)), birimFiyat = Math.round(Number(k.birimFiyat));
      if (!(adet >= 1 && adet <= 500) || !(birimFiyat >= 0)) { hatalar.kalemler = "Adet 1–500, fiyat 0 veya üzeri olmalı."; return []; }
      if (k.tur === "cihaz" && (k.model === "ONE" || k.model === "ONE Lite")) return [{ tur: "cihaz", model: k.model, adet, birimFiyat }];
      if (k.tur === "lisans" && ["Basic", "Pro", "Pro+", "Premium", "Enterprise"].includes(k.paket)) return [{ tur: "lisans", paket: k.paket, adet, birimFiyat }];
      if (k.tur === "ozel") {
        const aciklama = String(k.aciklama ?? "").trim().slice(0, 80);
        if (!aciklama) { hatalar.kalemler = "Özel kalemin açıklamasını yazın."; return []; }
        return [{ tur: "ozel", aciklama, adet, birimFiyat, kdvli: !!k.kdvli }];
      }
      return [];
    });
  } catch { hatalar.kalemler = "Kalemler okunamadı."; }
  if (!kalemler.length && !hatalar.kalemler) hatalar.kalemler = "En az bir kalem ekleyin.";
  const iskonto = Number(String(form.get("iskonto") ?? "0").replace(",", "."));
  if (!(iskonto >= 0 && iskonto <= 50)) hatalar.iskonto = "İskonto %0–50 arası olmalı.";
  const kdvYuzde = Number(String(form.get("kdv") ?? "0").replace(",", "."));
  if (!(kdvYuzde >= 0 && kdvYuzde <= 30)) hatalar.kdv = "KDV / VAT %0–30 arası olmalı.";
  const gecerlilik = kirp(form.get("gecerlilik"), 10);
  const bugun = simdiYerel().slice(0, 10);
  if (!TARIH.test(gecerlilik) || gecerlilik < bugun) hatalar.gecerlilik = "Bugün ya da sonrası bir tarih girin.";
  const odemeSartlari = kirp(form.get("odemeSartlari"), 160), teslimSartlari = kirp(form.get("teslimSartlari"), 160);
  if (!odemeSartlari) hatalar.odemeSartlari = "Ödeme şartlarını yazın.";
  if (!teslimSartlari) hatalar.teslimSartlari = "Teslim şartlarını yazın.";
  const onceki = oncekiId ? lead.teklifler.find((t) => t.id === oncekiId) : null;
  if (oncekiId && !onceki) hatalar.genel = "Revize edilecek teklif bulunamadı.";
  if (Object.keys(hatalar).length) return { hatalar };

  const kokId = onceki ? onceki.id.replace(/-v\d+$/, "") : await sonrakiTeklifNo(bayi.id, bayi.ad, bugun.slice(0, 4));
  const versiyon = onceki ? Math.max(...lead.teklifler.map((t) => t.versiyon)) + 1 : 1;
  const teklif: BayiTeklif = {
    id: versiyon > 1 ? `${kokId}-v${versiyon}` : kokId, no: versiyon > 1 ? `${kokId} v${versiyon}` : kokId, versiyon,
    kalemler, iskonto, kdv: kdvYuzde / 100, gecerlilik, odemeSartlari, teslimSartlari, not: kirp(form.get("not"), 500),
    durum: islem === "gonder" ? "gonderildi" : "taslak", olusturma: bugun, gonderim: islem === "gonder" ? bugun : null, sonuc: null,
  };
  const net = teklifToplami(teklif).net;
  await bayiLeadGuncelle(bayi.id, lead.id, (x) => {
    if (onceki) for (const t of x.teklifler) if (t.durum === "taslak" || t.durum === "gonderildi" || t.durum === "red") t.durum = "revize";
    x.teklifler.push(teklif);
    x.tutar = net;
    if (islem === "gonder" && (x.asama === "yeni" || x.asama === "gorusuldu" || x.asama === "demo")) x.asama = "teklif";
    x.notlar.push({ zaman: simdiYerel(), metin: `Teklif ${teklif.no} ${onceki ? "revize edildi" : "hazırlandı"}${islem === "gonder" ? " ve gönderildi" : " (taslak)"}.`, sistem: true });
  });
  yenile();
  return { teklif, leadId: lead.id, zaman: Date.now() };
}

/** Teklif durumu: gönderildi / kabul / red. Kabulde lead kazanılmaz; satış, cihaz seçilerek portalLeadKazan ile yapılır. */
export async function portalTeklifDurum(leadId: string, teklifId: string, durum: "gonderildi" | "kabul" | "red"): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  const lead = await getBayiLead(bayi.id, leadId);
  const t = lead?.teklifler.find((x) => x.id === teklifId);
  if (!lead || !t) return { hata: "Teklif bulunamadı." };
  const izinli = { gonderildi: ["taslak"], kabul: ["taslak", "gonderildi"], red: ["gonderildi"] }[durum];
  if (!izinli.includes(t.durum)) return { hata: "Bu teklifin durumu değiştirilemez." };
  const bugun = simdiYerel().slice(0, 10);
  await bayiLeadGuncelle(bayi.id, leadId, (x) => {
    const y = x.teklifler.find((k) => k.id === teklifId)!;
    if (durum === "gonderildi" || y.durum === "taslak") y.gonderim = bugun;
    y.durum = durum;
    if (durum !== "gonderildi") y.sonuc = bugun;
    if (durum === "gonderildi" && ["yeni", "gorusuldu", "demo"].includes(x.asama)) x.asama = "teklif";
    x.notlar.push({ zaman: simdiYerel(), metin: `Teklif ${y.no}: ${durum === "gonderildi" ? "gönderildi" : durum === "kabul" ? "müşteri kabul etti" : "müşteri reddetti"}.`, sistem: true });
  });
  yenile();
  return { tamam: durum === "kabul" ? "Teklif kabul edildi. Satılan cihazları seçip satışı bildirin." : durum === "red" ? "Teklif reddedildi olarak işaretlendi." : "Teklif gönderildi olarak işaretlendi.", zaman: Date.now() };
}

/** Kazanıldı: stoktan seçilen cihazlar lead firması adına satıldı bildirilir, lead kapanır */
/** v.lisans: "" · "havuz:Pro" · "siparis:Pro" (portalTopluSatis ile aynı) */
export async function portalLeadKazan(id: string, v: { seriler: string[]; lisans: string; tarih: string }): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  const l = await getBayiLead(bayi.id, id);
  if (!l) return { hata: "Lead bulunamadı." };
  if (l.asama === "kazanildi") return { hata: "Bu lead zaten kazanıldı." };
  if (v.seriler.length) {
    const f = new FormData();
    for (const s of v.seriler) f.append("seri", s);
    f.set("musteri", l.firma);
    f.set("tarih", v.tarih);
    f.set("lisans", v.lisans);
    const s = await portalTopluSatis({}, f);
    if (!s.tamam) return { hata: s.hata ?? Object.values(s.hatalar ?? {})[0] ?? "Satış bildirilemedi." };
  }
  const zaman = simdiYerel();
  await bayiLeadGuncelle(bayi.id, id, (x) => {
    x.asama = "kazanildi";
    x.kayipNedeni = null;
    x.kapanis = zaman.slice(0, 10);
    x.satilanSeriler = v.seriler;
    x.sonrakiAdim = "";
    x.sonrakiTarih = null;
    x.notlar.push({ zaman, metin: v.seriler.length ? `Kazanıldı · ${v.seriler.length} cihaz satıldı bildirildi (${v.seriler.join(", ")})${v.lisans ? ` · lisans: ${v.lisans.startsWith("havuz") ? "havuzdan" : "sipariş edildi"} ${v.lisans.split(":")[1]}` : ""}.` : "Kazanıldı (cihaz bildirimi yapılmadı).", sistem: true });
  });
  yenile();
  revalidatePath("/portal/cihazlar");
  return { tamam: v.seriler.length ? `${l.firma} kazanıldı, ${v.seriler.length} cihaz müşteriye işlendi.` : `${l.firma} kazanıldı.`, zaman: Date.now() };
}
