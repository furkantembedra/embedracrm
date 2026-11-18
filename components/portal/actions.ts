"use server";
// Bayi portalı (Server Actions). Bayi kimliği her zaman oturum çerezinden alınır.
import { oturumGerekli as ekipGerekli } from "@/lib/oturum";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAktifBayiler, getBasvurular, getBayiHareketleri, ULKELER } from "@/components/bayiler/queries";
import { satisBildir } from "@/components/bayiler/hareket-actions";
import { HAVUZ_PAKETLERI, bayiCihazinaLisansIsle, havuzOzeti, havuzdanDus } from "@/components/bayiler/lisans-havuzu";
import type { LisansPlani } from "@/components/cihaz-lisans/queries";
import type { CihazModeli } from "@/lib/urunler";
import { seriBilinmeyenStok, stoktakiSeriler } from "@/components/bayiler/ortak";
import { getCihaz } from "@/components/cihaz-lisans/queries";
import { musteriBulAdla } from "@/components/musteriler/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getSiparisler, getStok, siparisEkle, sonrakiSiparisNo, type Siparis } from "@/components/siparisler/queries";
import { siparisiIptalEt } from "@/components/siparisler/iptal";
import { ODEME_SECENEKLERI, bayiFiyati, enErkenTeslim, katalogOlustur, kayitliAdres, sepetToplami, sepettenKalemler, ticariKosullar, type PortalOdeme } from "./katalog";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { simdiYerel } from "@/components/rma/islemler";
import { oturumAc, oturumKapat, portalOturumu } from "./oturum";
import { duzeltmeTalebiEkle, getPortalHesabi, getYenilemeTalepleri, portalHesabiniGuncelle, yenilemeTalebiEkle } from "./queries";

export type PortalFormDurumu = { hata?: string; hatalar?: Record<string, string>; tamam?: string; zaman?: number; kayitId?: string };

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

/* ---------- Oturum (giriş: components/giris/actions.ts, Supabase Auth) ---------- */

export async function cikisYap() {
  const o = await portalOturumu();
  await oturumKapat();
  redirect(o?.mod === "yonetici" ? "/bayiler" : "/portal/giris");
}

/* ---------- Yönetici (CRM › Bayi detayı) ---------- */
// Yalnızca CRM ekibinden Yönetici ve Satış rolleri (ekipGerekli).

export async function portalDurumu(bayiId: string) {
  await ekipGerekli(["Yönetici", "Satış"]);
  const h = await getPortalHesabi(bayiId);
  return { erisim: !!h?.erisim, eposta: h?.eposta ?? null, sonGiris: h?.sonGiris ?? null };
}

export async function portalErisimiAyarla(bayiId: string, erisim: boolean) {
  await ekipGerekli(["Yönetici", "Satış"]);
  if (!(await getAktifBayiler()).some((b) => b.id === bayiId)) return { hata: "Bayi bulunamadı." };
  const h = await portalHesabiniGuncelle(bayiId, (x) => void (x.erisim = erisim));
  return { erisim: h.erisim, eposta: h.eposta, sonGiris: h.sonGiris };
}

export async function bayiGibiGoruntule(bayiId: string) {
  await ekipGerekli(["Yönetici", "Satış"]);
  if (!(await getAktifBayiler()).some((b) => b.id === bayiId)) return;
  await oturumAc(bayiId, "yonetici");
  redirect("/portal");
}

/* ---------- Sipariş ---------- */

export async function portalSiparisVer(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const basvuru = (await getBasvurular()).find((b) => b.id === bayi.id);
  const indirim = basvuru?.sozlesme.moq.indirim ?? 0;
  const [fiyat, stok] = await Promise.all([getFiyatListesi(), getStok()]);
  const katalog = katalogOlustur(fiyat, stok);
  // Sepet formdan "adet:<anahtar>" alanlarıyla gelir; fiyat her zaman sunucudaki katalogdan hesaplanır
  const sepet: Record<string, number> = {};
  for (const u of katalog) {
    const adet = Number(form.get(`adet:${u.anahtar}`) || 0);
    if (!Number.isInteger(adet) || adet < 0 || adet > 500) return { hatalar: { genel: `${u.ad}: 0–500 arası adet girin.` } };
    if (adet > 0) sepet[u.anahtar] = adet;
  }
  const kalemler = sepettenKalemler(katalog, sepet);
  if (!kalemler.length) return { hatalar: { genel: "Sepetiniz boş. En az bir ürün ekleyin." } };
  const kosul = ticariKosullar(bayi.ulkeKodu, fiyat);
  const netTl = sepetToplami(katalog, sepet, indirim, kosul.kdv).net;
  const tutar = kosul.paraBirimi === "TRY" ? netTl : Math.round(netTl / kosul.kur);

  // Teslimat ve ödeme
  const odeme = String(form.get("odeme") ?? "") as PortalOdeme;
  if (!ODEME_SECENEKLERI.some((o) => o.deger === odeme)) return { hatalar: { genel: "Ödeme şeklini seçin." } };
  const farkliAdres = form.get("teslimat") === "farkli";
  const adres = farkliAdres ? String(form.get("adres") ?? "").trim().slice(0, 200) : kayitliAdres(bayi, await getSiparisler());
  if (!adres) return { hatalar: { genel: "Teslimat adresini girin." } };
  const istenen = String(form.get("istenenTarih") ?? "");
  const bugun = simdiYerel().slice(0, 10);
  if (istenen && (!/^\d{4}-\d{2}-\d{2}$/.test(istenen) || istenen < enErkenTeslim(bugun))) return { hatalar: { genel: "İstenen teslim tarihi en erken 3 gün sonrası olabilir." } };
  const zaman = simdiYerel();
  const not = String(form.get("not") ?? "").trim().slice(0, 300);
  const siparis: Siparis = {
    id: await sonrakiSiparisNo(), tarih: zaman, musteriId: null, bayiId: bayi.id, musteri: bayi.ad, ulke: ULKELER[bayi.ulkeKodu] ?? bayi.ulkeKodu,
    adres, kalemler, tutar, paraBirimi: kosul.paraBirimi, odeme, durum: "odeme", seriNolar: [], kargo: null, teslimTarihi: null,
    faturaNo: null, lisansBaslangic: null,
    notlar: [{
      metin: `Bayi portalından verildi (bayi iskontosu %${indirim}${kosul.yurtDisi ? `, ihracat · KDV yok · kur ${kosul.kur} TL/EUR` : ""}). Ödeme: ${ODEME_SECENEKLERI.find((o) => o.deger === odeme)!.ad}. ${istenen ? `İstenen teslim: ${istenen}.` : "Teslim: en kısa sürede."}${farkliAdres ? " Farklı teslim adresi." : ""}${not ? ` Bayi notu: ${not}` : ""}`,
      zaman, sistem: true,
    }],
  };
  await siparisEkle(siparis);
  await bildir(`Bayi siparişi: #${siparis.id} · proforma gönder`, `${bayi.ad} portaldan ${kalemler.map((k) => `${k.adet}× ${k.tur === "cihaz" ? k.model : k.tur === "lisans" ? `ONESuite ${k.paket}` : k.stokKodu}`).join(", ")} sipariş etti.`, bayi.temsilciId ?? "u2", { tur: "siparis", id: siparis.id, ad: `#${siparis.id} · ${bayi.ad}`, href: `/siparisler/${siparis.id}` });
  for (const y of ["/siparisler", "/portal", "/portal/siparis", "/bayiler"]) revalidatePath(y);
  return { tamam: `Siparişiniz alındı: #${siparis.id}. Proforma fatura e-postanıza gönderilecek.`, zaman: Date.now(), kayitId: siparis.id };
}

/* ---------- Cihazlar: son müşteriye satış ---------- */

/** Stoktaki bir veya birden fazla cihazı tek müşteriye satıldı bildirir; istenirse lisansı da başlatır. */
export async function portalTopluSatis(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const seriler = [...new Set(form.getAll("seri").map(String))];
  const musteriAdi = String(form.get("musteri") ?? "").trim().slice(0, 120);
  const tarih = String(form.get("tarih") ?? "");
  // Lisans: "" (yok) · "havuz:Pro" (bayinin lisans havuzundan) · "siparis:Pro" (Embedra'ya lisans siparişi; ödeme sonrası işlenir)
  const [lisansModu, planHam] = String(form.get("lisans") ?? "").split(":");
  const plan = (planHam ?? "") as LisansPlani;
  const bugun = simdiYerel().slice(0, 10);
  // Seri numarası girilmeden sevk edilmiş stok: bayi seri numarasını yazar (model ve adet stokla sınırlı)
  const yeniSeriler = [...new Set(String(form.get("yeniSeri") ?? "").toUpperCase().split(/[\s,;]+/).filter(Boolean))];
  const yeniModel = (String(form.get("model") ?? "") === "ONE Lite" ? "ONE Lite" : "ONE") as CihazModeli;
  if (!seriler.length && !yeniSeriler.length) return { hata: "Satılan cihazları seçin." };
  if (!musteriAdi) return { hatalar: { musteri: "Müşteri adını girin." } };
  if (yeniSeriler.length) {
    const hatali = yeniSeriler.filter((x) => !/^EO1-\d{4}-\d{4}$/.test(x));
    if (hatali.length) return { hata: `Seri no EO1-YYAA-NNNN biçiminde olmalı: ${hatali.slice(0, 3).join(", ")}` };
    const hareketlerTum = await getBayiHareketleri();
    const bos = seriBilinmeyenStok(bayi.id, hareketlerTum)[yeniModel];
    if (yeniSeriler.length > bos) return { hata: `Seri numarası kayıtsız stokta ${bos} adet ${yeniModel === "ONE Lite" ? "ONE LITE" : "ONE"} var.` };
    for (const x of yeniSeriler) {
      const c = await getCihaz(x);
      if (c && (c.bayiId !== bayi.id || c.musteriId)) return { hata: `${x} başka bir kayıtta kullanılıyor. Seri numarasını kontrol edin ya da temsilcinize bildirin.` };
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || tarih > bugun) return { hatalar: { tarih: "Geçerli bir satış tarihi girin." } };
  if (lisansModu && (!["havuz", "siparis"].includes(lisansModu) || !HAVUZ_PAKETLERI.includes(plan))) return { hata: "Lisans seçimini kontrol edin." };
  const tumSeriler = [...seriler, ...yeniSeriler];
  if (lisansModu === "havuz" && (await havuzOzeti(bayi.id))[plan] < tumSeriler.length) {
    return { hata: `Lisans havuzunuzda yeterli ${plan} yok (${(await havuzOzeti(bayi.id))[plan]} adet). "Embedra'dan sipariş et" seçeneğini kullanın.` };
  }

  // Seriler bu bayinin stoğunda olmalı (formdaki değere güvenilmez)
  const stok = stoktakiSeriler(bayi.id, await getBayiHareketleri());
  const yabanci = seriler.filter((x) => !stok.some((k) => k.seriNo === x));
  if (yeniSeriler.some((x) => stok.some((k) => k.seriNo === x))) return { hata: "Listede olan cihazı yukarıdan seçin; yalnızca listede olmayan seri numaralarını yazın." };
  if (yabanci.length) return { hata: `Stoğunuzda olmayan cihaz: ${yabanci.slice(0, 3).join(", ")}` };

  // Model başına bir satış hareketi (mevcut satış bildirimi tek model alır)
  const modeller = [...new Set([...seriler.map((x) => stok.find((k) => k.seriNo === x)!.model), ...(yeniSeriler.length ? [yeniModel] : [])])];
  for (const model of modeller) {
    const mevcut = await musteriBulAdla(musteriAdi);
    const veri = new FormData();
    veri.set("bayiId", bayi.id); // formdan değil oturumdan
    veri.set("tarih", tarih);
    veri.set("model", model);
    for (const x of seriler) if (stok.find((k) => k.seriNo === x)!.model === model) veri.append("stokSeri", x);
    if (model === yeniModel && yeniSeriler.length) veri.set("seriler", yeniSeriler.join(" "));
    veri.set("musteri", mevcut ? mevcut.id : "yeni");
    if (!mevcut) veri.set("yeniMusteri", musteriAdi);
    veri.set("not", "Bayi portalından bildirildi");
    const s = await satisBildir({}, veri);
    if (s.hatalar) return { hata: Object.values(s.hatalar)[0] };
  }

  // Lisans: havuzdan hemen işlenir (satış tarihinden 12 ay) ya da Embedra'ya sipariş açılır (ödeme sonrası işlenir)
  let lisansMesaji = "";
  if (lisansModu === "havuz") {
    const sureler = await havuzdanDus(bayi.id, plan, tumSeriler.length);
    if (!sureler) return { hata: "Satış kaydedildi ama lisans havuzunuz yetmedi; lisansı Lisanslar sayfasından sipariş edin." };
    for (const [i, x] of tumSeriler.entries()) await bayiCihazinaLisansIsle(bayi.id, x, plan, sureler[i], tarih, "Lisans havuzundan");
    lisansMesaji = `, havuzunuzdan ${plan} lisansı başlatıldı`;
  } else if (lisansModu === "siparis") {
    const sip = await bayiLisansSiparisiAc(bayi, tumSeriler.map((x) => ({ seriNo: x, plan })), 12, `Yeni satış · ${musteriAdi}`);
    lisansMesaji = `; ${plan} lisansları için #${sip.id} siparişi açıldı, ödeme sonrası işlenir`;
  }
  for (const y of ["/portal/cihazlar", "/portal", "/portal/lisanslar"]) revalidatePath(y);
  return { tamam: `${tumSeriler.length} cihaz ${musteriAdi} adına satıldı olarak işlendi${lisansMesaji}.`, zaman: Date.now() };
}

/** Yanlış satış bildirimi vb. için Embedra'ya düzeltme talebi: CRM ekibine hatırlatma düşer. */
export async function portalDuzeltmeTalebi(seriNo: string, aciklama: string): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const c = await getCihaz(seriNo);
  const metin = aciklama.trim().slice(0, 300);
  if (!c || c.bayiId !== bayi.id) return { hata: "Bu cihaz bayinize ait değil." };
  if (metin.length < 5) return { hata: "Ne düzeltilmesi gerektiğini kısaca yazın." };
  await duzeltmeTalebiEkle({ id: crypto.randomUUID(), bayiId: bayi.id, seriNo, metin, tarih: simdiYerel(), durum: "acik" });
  await bildir(`Bayi düzeltme talebi: ${seriNo}`, `${bayi.ad}: ${metin}`, bayi.temsilciId ?? "u2", { tur: "cihaz", id: seriNo, ad: `${seriNo} · ${c.musteri}`, href: `/cihaz-lisans/${seriNo}` });
  return { tamam: "Talebiniz Embedra ekibine iletildi.", zaman: Date.now() };
}

/* ---------- Lisans yenileme talebi ---------- */

/** Bayi lisans siparişi: lisanslar teslimde (ödeme sonrası) atanan cihazlara işlenir. Fiyat sunucuda hesaplanır. */
async function bayiLisansSiparisiAc(bayi: { id: string; ad: string; ulkeKodu: string; temsilciId?: string | null }, atamalar: { seriNo: string; plan: LisansPlani }[], sure: number, aciklama: string) {
  const basvuru = (await getBasvurular()).find((b) => b.id === bayi.id);
  const indirim = basvuru?.sozlesme.moq.indirim ?? 0;
  const fiyat = await getFiyatListesi();
  const kosul = ticariKosullar(bayi.ulkeKodu, fiyat);
  const adetler = new Map<string, number>();
  for (const a of atamalar) adetler.set(a.plan, (adetler.get(a.plan) ?? 0) + 1);
  const kalemler: Siparis["kalemler"] = [...adetler].map(([paket, adet]) => ({ tur: "lisans", paket, adet, sureAy: sure }));
  const netTl = atamalar.reduce((t, a) => t + bayiFiyati(fiyat.lisans[a.plan].fiyat ?? 0, indirim) * (sure / 12), 0);
  const zaman = simdiYerel();
  const siparis: Siparis = {
    id: await sonrakiSiparisNo(), tarih: zaman, musteriId: null, bayiId: bayi.id, musteri: bayi.ad, ulke: ULKELER[bayi.ulkeKodu] ?? bayi.ulkeKodu,
    adres: "Dijital teslimat", kalemler, tutar: kosul.paraBirimi === "TRY" ? Math.round(netTl) : Math.round(netTl / kosul.kur), paraBirimi: kosul.paraBirimi,
    odeme: "Proforma", durum: "odeme", seriNolar: [], kargo: null, teslimTarihi: null, faturaNo: null, lisansBaslangic: null,
    lisansAtamalari: atamalar.map((a) => ({ ...a, sureAy: sure })),
    notlar: [{ metin: `Bayi portalından lisans siparişi (${sure} ay, bayi iskontosu %${indirim}). ${aciklama}. Lisans teslim edilince cihazlara otomatik işlenir.`, zaman, sistem: true }],
  };
  await siparisEkle(siparis);
  await bildir(`Bayi lisans siparişi: #${siparis.id}`, `${bayi.ad} · ${atamalar.length} lisans (${sure} ay). Proforma gönderin; ödeme sonrası "Lisansı teslim et" ile cihazlara işlenir.`, bayi.temsilciId ?? "u2", { tur: "siparis", id: siparis.id, ad: `#${siparis.id} · ${bayi.ad}`, href: `/siparisler/${siparis.id}` });
  revalidatePath("/siparisler");
  revalidatePath("/portal/siparis");
  return siparis;
}

/** Lisans havuzundan yenileme: seçilen cihazların lisansı havuzdaki paketlerle hemen uzatılır (mevcut bitişten devam). */
export async function portalHavuzdanYenile(atamalar: { seriNo: string; plan: string }[]): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  if (!atamalar.length) return { hata: "Yenilenecek lisansları seçin." };
  const gerekli: Record<string, number> = {};
  for (const a of atamalar) {
    if (!HAVUZ_PAKETLERI.includes(a.plan as LisansPlani)) return { hata: "Plan geçersiz." };
    const c = await getCihaz(a.seriNo);
    if (!c || c.bayiId !== bayi.id || !c.musteriId) return { hata: `${a.seriNo} bayinize ait bir müşteri cihazı değil.` };
    gerekli[a.plan] = (gerekli[a.plan] ?? 0) + 1;
  }
  const ozet = await havuzOzeti(bayi.id);
  const eksik = Object.entries(gerekli).filter(([p, n]) => ozet[p as LisansPlani] < n);
  if (eksik.length) return { hata: `Havuzda yeterli lisans yok: ${eksik.map(([p, n]) => `${p} ${n} gerekli, ${ozet[p as LisansPlani]} var`).join(" · ")}` };
  const bugun = simdiYerel().slice(0, 10);
  for (const [p, n] of Object.entries(gerekli)) {
    const sureler = (await havuzdanDus(bayi.id, p as LisansPlani, n))!;
    const liste = atamalar.filter((a) => a.plan === p);
    for (const [i, a] of liste.entries()) await bayiCihazinaLisansIsle(bayi.id, a.seriNo, p as LisansPlani, sureler[i], bugun, "Lisans havuzundan yenileme");
  }
  for (const y of ["/portal/lisanslar", "/portal", "/portal/cihazlar"]) revalidatePath(y);
  return { tamam: `${atamalar.length} lisans havuzunuzdan yenilendi.`, zaman: Date.now() };
}

/** Seçilen lisansları tek siparişte yeniler: her satırda plan (aynı ya da yükseltme), ortak süre. Fiyat sunucuda hesaplanır. */
export async function portalLisansYenile(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const seriler = [...new Set(form.getAll("seri").map(String))];
  const sure = Number(form.get("sure"));
  if (!seriler.length) return { hata: "Yenilenecek lisansları seçin." };
  if (![12, 24, 36].includes(sure)) return { hata: "Süre seçin." };

  const satirlar: { seriNo: string; musteri: string; eski: string; plan: "Basic" | "Pro" | "Pro+"; bitis: string | null }[] = [];
  for (const seriNo of seriler) {
    const c = await getCihaz(seriNo);
    if (!c || c.bayiId !== bayi.id || !c.musteriId) return { hata: `${seriNo} bayinize ait bir müşteri cihazı değil.` };
    const plan = String(form.get(`plan:${seriNo}`) ?? c.plan);
    if (plan !== "Basic" && plan !== "Pro" && plan !== "Pro+") return { hata: `${seriNo} için plan seçin.` };
    satirlar.push({ seriNo, musteri: c.musteri, eski: c.plan, plan, bitis: c.lisansBitis });
  }

  const zaman = simdiYerel();
  const bugun = zaman.slice(0, 10);
  const detay = satirlar.map((r) => `${r.seriNo} (${r.musteri}) ${r.eski}${r.plan !== r.eski ? ` → ${r.plan}` : ""}, ${r.bitis && r.bitis >= bugun ? `${r.bitis} bitişinden devam` : "ödeme onayından başlar"}`).join("; ");
  const siparis = await bayiLisansSiparisiAc(bayi, satirlar.map((r) => ({ seriNo: r.seriNo, plan: r.plan })), sure, `Lisans yenileme · ${detay}`);
  const mevcutTalep = new Set((await getYenilemeTalepleri(bayi.id)).map((y) => y.seriNo));
  for (const r of satirlar) if (!mevcutTalep.has(r.seriNo)) await yenilemeTalebiEkle({ seriNo: r.seriNo, bayiId: bayi.id, tarih: bugun });
  for (const y of ["/portal/lisanslar", "/portal", "/portal/siparis", "/portal/cihazlar", "/siparisler"]) revalidatePath(y);
  return { tamam: `Yenileme siparişiniz alındı: #${siparis.id}. Proforma e-postanıza gönderilecek; ödeme sonrası lisanslar uzatılır.`, zaman: Date.now(), kayitId: siparis.id };
}

export async function portalYenilemeTalebi(seriNo: string): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const c = await getCihaz(seriNo);
  if (!c || c.bayiId !== bayi.id || !c.musteriId) return { hata: "Bu cihaz bayinize ait değil." };
  if ((await getYenilemeTalepleri(bayi.id)).some((y) => y.seriNo === seriNo)) return { hata: "Bu cihaz için talep zaten gönderildi." };
  await yenilemeTalebiEkle({ seriNo, bayiId: bayi.id, tarih: simdiYerel().slice(0, 10) });
  await bildir(`Lisans yenileme talebi: ${seriNo}`, `${bayi.ad} · müşteri ${c.musteri} · ${c.plan} · bitiş ${c.lisansBitis ?? "—"}`, bayi.temsilciId ?? "u2", { tur: "cihaz", id: seriNo, ad: `${seriNo} · ${c.musteri}`, href: `/cihaz-lisans/${seriNo}` });
  revalidatePath("/portal/lisanslar");
  return { tamam: "Yenileme talebiniz Embedra'ya iletildi.", zaman: Date.now() };
}



/* ---------- Sipariş iptali ---------- */

/** Bayi, ödemesi henüz alınmamış kendi siparişini iptal eder; temsilcisine hatırlatma düşer. */
export async function portalSiparisIptal(id: string, neden: string): Promise<{ hata?: string; tamam?: string }> {
  const { bayi } = await oturumGerekli();
  const s = (await getSiparisler()).find((x) => x.id === id && x.bayiId === bayi.id);
  if (!s) return { hata: "Sipariş bulunamadı." };
  if (s.durum !== "odeme") return { hata: "Ödemesi alınmış sipariş portaldan iptal edilemez; temsilcinize yazın." };
  const r = await siparisiIptalEt(id, neden, "bayi", simdiYerel());
  if (r.hata) return { hata: r.hata };
  await bildir(`Bayi siparişi iptal etti: #${id}`, `${bayi.ad}: ${neden.trim().slice(0, 300)}`, bayi.temsilciId ?? "u2", { tur: "siparis", id, ad: `#${id} · ${bayi.ad}`, href: `/siparisler/${id}` });
  for (const y of ["/portal", "/portal/siparis", "/portal/lisanslar", "/siparisler", "/bayiler", "/operasyon"]) revalidatePath(y);
  return { tamam: `#${id} iptal edildi.` };
}
