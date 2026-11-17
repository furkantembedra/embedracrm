"use server";
// Bayi portalı RMA işlemleri. Her işlemde kaydın oturumdaki bayiye ait olduğu kontrol edilir;
// CRM'in RMA işlemleri (yetki kontrolü yok) buradan çağrılmaz, kayıt doğrudan güncellenir.
import { revalidatePath } from "next/cache";
import { getCihaz } from "@/components/cihaz-lisans/queries";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { getRma, rmayiGuncelle, ONCELIKLER, type RmaKaydi } from "@/components/rma/queries";
import { ekleriOku, rmaOlustur, simdiYerel } from "@/components/rma/islemler";
import { portalOturumu } from "./oturum";
import type { PortalFormDurumu } from "./actions";

async function bayiGerekli() {
  const o = await portalOturumu();
  if (!o) throw new Error("Oturum yok");
  return o.bayi;
}

/** Kayıt bu bayinin mi? (bayi sahibi ya da bayinin sattığı cihaz) */
async function bayiRmasi(id: string): Promise<{ bayi: { id: string; ad: string }; rma: RmaKaydi } | { hata: string }> {
  const bayi = await bayiGerekli();
  const rma = await getRma(id);
  if (!rma) return { hata: "Kayıt bulunamadı." };
  const cihaz = await getCihaz(rma.seriNo);
  if (rma.sahip.id !== bayi.id && cihaz?.bayiId !== bayi.id) return { hata: "Bu kayıt bayinize ait değil." };
  return { bayi, rma };
}

const gecmis = (r: RmaKaydi, metin: string, yazan: string) => r.gecmis.push({ zaman: simdiYerel(), metin, tur: "gorusme", yazan });

async function bildir(baslik: string, aciklama: string, r: RmaKaydi, bayiAd: string) {
  await hatirlatmaEkleDepo({
    id: crypto.randomUUID(), baslik, aciklama, sorumluId: "u3", zaman: simdiYerel(), durum: "bekliyor", otomatik: false, onem: "normal",
    kayit: { tur: "rma", id: r.id, ad: `${r.id} · ${bayiAd}`, href: `/rma?kayit=${r.id}` },
  });
}

function yenile() {
  revalidatePath("/portal/rma");
  revalidatePath("/portal");
  revalidatePath("/rma");
}

/** Yeni RMA talebi: cihaz, arıza, öncelik, iletişim kişisi ve fotoğraf / belge */
export async function portalRmaAc(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const bayi = await bayiGerekli();
  const seriNo = String(form.get("seriNo") ?? "").toUpperCase();
  const c = await getCihaz(seriNo);
  if (!c || c.bayiId !== bayi.id) return { hatalar: { seriNo: "Bayinize ait bir cihaz seçin." } };
  const oncelik = String(form.get("oncelik") ?? "Normal");
  if (!(ONCELIKLER as readonly string[]).includes(oncelik)) return { hatalar: { genel: "Öncelik seçin." } };
  const iletisim = String(form.get("iletisim") ?? "").trim().slice(0, 120);
  const dosya = await ekleriOku(form.getAll("dosyalar").filter((f): f is File => f instanceof File));
  if (dosya.hata) return { hatalar: { dosyalar: dosya.hata } };

  const s = await rmaOlustur({
    seriNo, arizaTipi: String(form.get("arizaTipi") ?? ""), ariza: String(form.get("ariza") ?? ""), fotograflar: [], destekTalebiId: null,
    kaynak: "bayi-portali", oncelik, ekler: dosya.ekler,
  });
  if (!s.rma) return { hatalar: s.hatalar };
  if (iletisim) await rmayiGuncelle(s.rma.id, (r) => gecmis(r, `İletişim kişisi: ${iletisim}`, bayi.ad));
  await bildir(`Bayi RMA talebi: ${s.rma.id}${oncelik === "Acil" ? " · ACİL" : ""}`, `${bayi.ad} · ${seriNo} · ${s.rma.arizaTipi}${dosya.ekler?.length ? ` · ${dosya.ekler.length} ek` : ""}`, s.rma, bayi.ad);
  yenile();
  return { tamam: `RMA talebiniz açıldı: ${s.rma.id}. Cihazı aşağıdaki adrese gönderip takip numarasını girin.`, zaman: Date.now(), kayitId: s.rma.id };
}

/** Garanti dışı servis ücretini onaylar ya da reddeder */
export async function portalRmaUcretOnay(id: string, onay: boolean): Promise<PortalFormDurumu> {
  const k = await bayiRmasi(id);
  if ("hata" in k) return { hata: k.hata };
  if (!k.rma.ucret) return { hata: "Bu kayıtta onay bekleyen ücret yok." };
  if (k.rma.ucretOnay) return { hata: "Ücret zaten onaylandı." };
  const ucret = `₺${k.rma.ucret.toLocaleString("tr-TR")}`;
  const r = await rmayiGuncelle(id, (x) => {
    if (onay) x.ucretOnay = true;
    gecmis(x, onay ? `Bayi servis ücretini onayladı (${ucret}).` : `Bayi servis ücretini reddetti (${ucret}). Cihazın işlem yapılmadan iadesi isteniyor.`, k.bayi.ad);
  });
  await bildir(`${id}: servis ücreti ${onay ? "onaylandı" : "reddedildi"}`, `${k.bayi.ad} · ${ucret}`, r!, k.bayi.ad);
  yenile();
  return { tamam: onay ? "Ücret onaylandı. Servis işleme başlayabilir." : "Ret bildiriminiz iletildi. Cihaz işlem yapılmadan size gönderilecek.", zaman: Date.now() };
}

/** Bayi cihazı servise gönderdiğini bildirir (kargo firması + takip numarası) */
export async function portalRmaKargo(id: string, firma: string, takipNo: string): Promise<PortalFormDurumu> {
  const k = await bayiRmasi(id);
  if ("hata" in k) return { hata: k.hata };
  if (k.rma.adim !== "talep") return { hata: "Cihaz zaten servise ulaşmış." };
  const f = firma.trim().slice(0, 60), t = takipNo.trim().slice(0, 60);
  if (f.length < 2 || t.length < 4) return { hata: "Kargo firması ve takip numarasını girin." };
  const r = await rmayiGuncelle(id, (x) => {
    x.gelis = { kanal: "Bayi üzerinden", takipNo: `${f} · ${t}` };
    gecmis(x, `Bayi cihazı kargoya verdi: ${f} · ${t}.`, k.bayi.ad);
  });
  await bildir(`${id}: cihaz yolda`, `${k.bayi.ad} · ${f} · ${t}`, r!, k.bayi.ad);
  yenile();
  return { tamam: "Gönderim bilgisi iletildi.", zaman: Date.now() };
}

/** Talebe bayi notu (servis ekibine görünür) */
export async function portalRmaNot(id: string, metin: string): Promise<PortalFormDurumu> {
  const k = await bayiRmasi(id);
  if ("hata" in k) return { hata: k.hata };
  const m = metin.trim();
  if (m.length < 2) return { hata: "Notu yazın." };
  const r = await rmayiGuncelle(id, (x) => gecmis(x, m.slice(0, 600), k.bayi.ad));
  await bildir(`${id}: bayi notu`, `${k.bayi.ad}: ${m.slice(0, 120)}`, r!, k.bayi.ad);
  yenile();
  return { tamam: "Notunuz eklendi.", zaman: Date.now() };
}

/** Talebe sonradan fotoğraf / belge ekler */
export async function portalRmaEkEkle(id: string, form: FormData): Promise<PortalFormDurumu> {
  const k = await bayiRmasi(id);
  if ("hata" in k) return { hata: k.hata };
  const dosya = await ekleriOku(form.getAll("dosyalar").filter((f): f is File => f instanceof File), k.rma.ekler);
  if (dosya.hata) return { hata: dosya.hata };
  if (!dosya.ekler?.length) return { hata: "Dosya seçin." };
  await rmayiGuncelle(id, (x) => {
    x.ekler.push(...dosya.ekler!);
    gecmis(x, `${dosya.ekler!.length} dosya eklendi: ${dosya.ekler!.map((e) => e.ad).join(", ")}.`, k.bayi.ad);
  });
  yenile();
  return { tamam: `${dosya.ekler.length} dosya eklendi.`, zaman: Date.now() };
}
