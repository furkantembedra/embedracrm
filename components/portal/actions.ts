"use server";
// Bayi portalı (Server Actions). Bayi kimliği her zaman oturum çerezinden alınır.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CIHAZ_MODELLERI, type CihazModeli } from "@/lib/urunler";
import { getAktifBayiler, getBasvurular, ULKELER } from "@/components/bayiler/queries";
import { satisBildir } from "@/components/bayiler/hareket-actions";
import { getCihaz } from "@/components/cihaz-lisans/queries";
import { musteriBulAdla } from "@/components/musteriler/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { siparisEkle, sonrakiSiparisNo, type Siparis } from "@/components/siparisler/queries";
import { firsatAsamasiGuncelle } from "@/components/satis-hatti/actions";
import { ASAMALAR, KAYIP_NEDENLERI, firsatiGuncelle, getFirsat, type Asama, type KayipNedeni } from "@/components/satis-hatti/queries";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { rmaOlustur, simdiYerel } from "@/components/rma/islemler";
import { oturumAc, oturumKapat, portalOturumu } from "./oturum";
import { DEMO_SIFRE, getPortalHesabi, getYenilemeTalepleri, hesapBulEpostayla, portalHesabiniGuncelle, sifreDogru, yenilemeTalebiEkle } from "./queries";

export type PortalFormDurumu = { hata?: string; hatalar?: Record<string, string>; tamam?: string; zaman?: number };

async function oturumGerekli() {
  const o = await portalOturumu();
  if (!o) redirect("/portal/giris");
  return o;
}

async function bildir(baslik: string, aciklama: string, sorumluId: string, kayit: { tur: "siparis" | "bayi" | "rma" | "cihaz" | "firsat"; id: string; ad: string; href: string }) {
  await hatirlatmaEkleDepo({
    id: crypto.randomUUID(), baslik, aciklama, kayit, sorumluId, zaman: simdiYerel(), durum: "bekliyor", otomatik: false, onem: "normal",
  });
}

/* ---------- Oturum ---------- */

// Basit kaba kuvvet koruması: e-posta başına 5 hatalı denemeden sonra 10 dk bekleme
const g = globalThis as { __embedraPortalDeneme?: Map<string, { n: number; ilk: number }> };
const DENEME = (g.__embedraPortalDeneme ??= new Map());

export async function girisYap(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const eposta = String(form.get("eposta") ?? "").trim().toLowerCase();
  const sifre = String(form.get("sifre") ?? "");
  if (!eposta || !sifre) return { hata: "E-posta ve şifreyi girin." };
  const d = DENEME.get(eposta);
  if (d && d.n >= 5 && Date.now() - d.ilk < 10 * 60_000) return { hata: "Çok fazla hatalı deneme. 10 dakika sonra tekrar deneyin." };
  const hesap = await hesapBulEpostayla(eposta);
  if (!hesap || !sifreDogru(sifre, hesap.sifreOzeti)) {
    DENEME.set(eposta, d && Date.now() - d.ilk < 10 * 60_000 ? { n: d.n + 1, ilk: d.ilk } : { n: 1, ilk: Date.now() });
    return { hata: "E-posta ya da şifre hatalı." };
  }
  if (!hesap.erisim) return { hata: "Portal erişiminiz kapalı. Embedra bayi sorumlunuzla görüşün." };
  DENEME.delete(eposta);
  await portalHesabiniGuncelle(hesap.bayiId, (h) => void (h.sonGiris = simdiYerel()));
  await oturumAc(hesap.bayiId, "bayi");
  redirect("/portal");
}

export async function cikisYap() {
  const o = await portalOturumu();
  await oturumKapat();
  redirect(o?.mod === "yonetici" ? "/bayiler" : "/portal/giris");
}

/* ---------- Yönetici (CRM › Bayi detayı) ---------- */
// TODO: admin paneline taşınınca bu iki işlem yalnızca "Yönetici" / "Satış" rolüne açılmalı.

export async function portalDurumu(bayiId: string) {
  const h = await getPortalHesabi(bayiId);
  return { erisim: !!h?.erisim, eposta: h?.eposta ?? null, sonGiris: h?.sonGiris ?? null, demoSifre: DEMO_SIFRE };
}

export async function portalErisimiAyarla(bayiId: string, erisim: boolean) {
  if (!(await getAktifBayiler()).some((b) => b.id === bayiId)) return { hata: "Bayi bulunamadı." };
  const h = await portalHesabiniGuncelle(bayiId, (x) => void (x.erisim = erisim));
  return { erisim: h.erisim, eposta: h.eposta, sonGiris: h.sonGiris, demoSifre: DEMO_SIFRE };
}

export async function bayiGibiGoruntule(bayiId: string) {
  if (!(await getAktifBayiler()).some((b) => b.id === bayiId)) return;
  await oturumAc(bayiId, "yonetici");
  redirect("/portal");
}

/* ---------- Sipariş ---------- */

export async function portalSiparisVer(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const basvuru = (await getBasvurular()).find((b) => b.id === bayi.id);
  const indirim = basvuru?.sozlesme.moq.indirim ?? 0;
  const fiyat = await getFiyatListesi();
  const kalemler: Siparis["kalemler"] = [];
  const hatalar: Record<string, string> = {};
  for (const m of CIHAZ_MODELLERI) {
    const adet = Number(form.get(`adet-${m}`) || 0);
    if (!Number.isInteger(adet) || adet < 0 || adet > 500) hatalar[m] = "0–500 arası adet girin.";
    else if (adet > 0) kalemler.push({ tur: "cihaz", model: m, adet });
  }
  if (!kalemler.length && !Object.keys(hatalar).length) hatalar.genel = "En az bir cihaz adedi girin.";
  if (Object.keys(hatalar).length) return { hatalar };
  const tutar = Math.round(kalemler.reduce((s, k) => s + (k.tur === "cihaz" ? k.adet * fiyat.cihaz[k.model] : 0), 0) * (1 - indirim / 100));
  const zaman = simdiYerel();
  const not = String(form.get("not") ?? "").trim().slice(0, 300);
  const siparis: Siparis = {
    id: await sonrakiSiparisNo(), tarih: zaman, musteriId: null, bayiId: bayi.id, musteri: bayi.ad, ulke: ULKELER[bayi.ulkeKodu] ?? bayi.ulkeKodu,
    adres: bayi.bolge, kalemler, tutar, paraBirimi: "TRY", odeme: "Proforma", durum: "odeme", seriNolar: [], kargo: null, teslimTarihi: null,
    faturaNo: null, lisansBaslangic: null,
    notlar: [{ metin: `Bayi portalından verildi (bayi iskontosu %${indirim}).${not ? ` Bayi notu: ${not}` : ""}`, zaman, sistem: true }],
  };
  await siparisEkle(siparis);
  await bildir(`Bayi siparişi: #${siparis.id} · proforma gönder`, `${bayi.ad} portaldan ${kalemler.map((k) => (k.tur === "cihaz" ? `${k.adet}× ${k.model}` : "")).join(", ")} sipariş etti.`, "u2", { tur: "siparis", id: siparis.id, ad: `#${siparis.id} · ${bayi.ad}`, href: `/siparisler/${siparis.id}` });
  for (const y of ["/siparisler", "/portal", "/portal/siparis", "/bayiler"]) revalidatePath(y);
  return { tamam: `Siparişiniz alındı: #${siparis.id}. Proforma fatura e-postanıza gönderilecek.`, zaman: Date.now() };
}

/* ---------- Cihazlar: son müşteriye satış ---------- */

export async function portalSatisBildir(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const seriNo = String(form.get("seriNo") ?? "");
  const musteriAdi = String(form.get("musteri") ?? "").trim();
  const tarih = String(form.get("tarih") ?? "");
  const cihazModel = String(form.get("model") ?? "") as CihazModeli;
  if (!musteriAdi) return { hatalar: { musteri: "Müşteri adını girin." } };
  const mevcut = await musteriBulAdla(musteriAdi);
  const veri = new FormData();
  veri.set("bayiId", bayi.id); // formdan değil oturumdan
  veri.set("tarih", tarih);
  veri.set("model", cihazModel);
  veri.append("stokSeri", seriNo);
  veri.set("musteri", mevcut ? mevcut.id : "yeni");
  if (!mevcut) veri.set("yeniMusteri", musteriAdi.slice(0, 120));
  veri.set("not", "Bayi portalından bildirildi");
  const s = await satisBildir({}, veri);
  if (s.hatalar) return { hatalar: s.hatalar };
  revalidatePath("/portal/cihazlar");
  revalidatePath("/portal");
  return { tamam: `${seriNo} ${musteriAdi} adına satıldı olarak işlendi.`, zaman: Date.now() };
}

/* ---------- Lisans yenileme talebi ---------- */

export async function portalYenilemeTalebi(seriNo: string): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const c = await getCihaz(seriNo);
  if (!c || c.bayiId !== bayi.id || !c.musteriId) return { hata: "Bu cihaz bayinize ait değil." };
  if ((await getYenilemeTalepleri(bayi.id)).some((y) => y.seriNo === seriNo)) return { hata: "Bu cihaz için talep zaten gönderildi." };
  await yenilemeTalebiEkle({ seriNo, bayiId: bayi.id, tarih: simdiYerel().slice(0, 10) });
  await bildir(`Lisans yenileme talebi: ${seriNo}`, `${bayi.ad} · müşteri ${c.musteri} · ${c.plan} · bitiş ${c.lisansBitis ?? "—"}`, "u2", { tur: "cihaz", id: seriNo, ad: `${seriNo} · ${c.musteri}`, href: `/cihaz-lisans/${seriNo}` });
  revalidatePath("/portal/lisanslar");
  return { tamam: "Yenileme talebiniz Embedra'ya iletildi.", zaman: Date.now() };
}

/* ---------- RMA ---------- */

export async function portalRmaAc(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const seriNo = String(form.get("seriNo") ?? "").toUpperCase();
  const c = await getCihaz(seriNo);
  if (!c || c.bayiId !== bayi.id) return { hatalar: { seriNo: "Bayinize ait bir cihaz seçin." } };
  const s = await rmaOlustur({
    seriNo, arizaTipi: String(form.get("arizaTipi") ?? ""), ariza: String(form.get("ariza") ?? ""), fotograflar: [], destekTalebiId: null, kaynak: "bayi-portali",
  });
  if (!s.rma) return { hatalar: s.hatalar };
  await bildir(`Bayi RMA talebi: ${s.rma.id}`, `${bayi.ad} · ${seriNo} · ${s.rma.arizaTipi}`, "u3", { tur: "rma", id: s.rma.id, ad: `${s.rma.id} · ${bayi.ad}`, href: `/rma?kayit=${s.rma.id}` });
  return { tamam: `RMA talebiniz açıldı: ${s.rma.id}. Cihazı Embedra servisine gönderebilirsiniz.`, zaman: Date.now() };
}

/* ---------- Yönlendirilen lead'ler ---------- */

const BAYI_ASAMALARI: Asama[] = ["yeni", "demo", "teklif", "muzakere", "kazanildi", "kaybedildi"];

export async function portalLeadGuncelle(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const f = await getFirsat(String(form.get("id") ?? ""));
  if (!f || f.bayiId !== bayi.id) return { hata: "Bu lead size yönlendirilmemiş." };
  if (f.asama === "kazanildi" || f.asama === "kaybedildi") return { hata: "Kapanmış lead güncellenemez." };
  const asama = String(form.get("asama") ?? "") as Asama;
  const not = String(form.get("not") ?? "").trim();
  const neden = String(form.get("neden") ?? "") as KayipNedeni;
  const hatalar: Record<string, string> = {};
  if (!ASAMALAR.includes(asama) || !BAYI_ASAMALARI.includes(asama)) hatalar.asama = "Aşama seçin.";
  if (!not) hatalar.not = "Son durumu kısaca yazın.";
  if (asama === "kaybedildi" && !KAYIP_NEDENLERI.includes(neden)) hatalar.neden = "Kayıp nedenini seçin.";
  if (Object.keys(hatalar).length) return { hatalar };
  await firsatiGuncelle(f.id, (x) => {
    x.sonrakiAdim = `Bayi: ${not.slice(0, 80)}`;
    x.sonrakiTarih = simdiYerel().slice(0, 10);
  });
  if (asama !== f.asama) await firsatAsamasiGuncelle({ ...f }, asama, asama === "kaybedildi" ? { neden, aciklama: neden === "Diğer" ? not : undefined } : undefined);
  revalidatePath("/portal/leadler");
  revalidatePath("/satis-hatti");
  return { tamam: "Lead güncellendi.", zaman: Date.now() };
}
