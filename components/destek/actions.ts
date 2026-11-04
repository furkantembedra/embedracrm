"use server";
// Destek: kaydetme ve güncelleme (Server Actions)
import { revalidatePath } from "next/cache";
import { KANALLAR, ONCELIKLER } from "@/lib/constants";
import { getMusteri, musteriyiGuncelle } from "@/components/musteriler/queries";
import { KONULAR, talebiGuncelle, talepEkle, type Kanal, type Konu, type Oncelik, type Talep, type TalepDurumu, type TalepNotu } from "./queries";
import { simdiIso } from "./ortak";

const metinAl = (form: FormData) => (ad: string) => String(form.get(ad) ?? "").trim();

/** Dosya şimdilik yalnızca adıyla kaydedilir. TODO: Supabase Storage'a yükle, yolunu sakla. */
function dosyaAdi(form: FormData, alan = "dosya") {
  const f = form.get(alan);
  return f instanceof File && f.size > 0 ? f.name : null;
}

function yenile(id?: string) {
  revalidatePath("/bayiler/raporlama"); // hazır raporlar bu kayıtları okur
  revalidatePath("/destek");
  if (id) revalidatePath(`/destek/${id}`);
}

export type TalepFormDurumu = { hatalar?: Record<string, string>; talep?: Talep };

export async function talepKaydet(_onceki: TalepFormDurumu, form: FormData): Promise<TalepFormDurumu> {
  const metin = metinAl(form);
  const musteriId = metin("musteriId");
  const seriNo = metin("seriNo");
  const kanal = metin("kanal") as Kanal;
  const konu = metin("konu") as Konu;
  const oncelik = metin("oncelik") as Oncelik;
  const baslik = metin("baslik");
  const aciklama = metin("aciklama");

  const musteri = musteriId ? await getMusteri(musteriId) : null;
  const hatalar: Record<string, string> = {};
  if (!musteri) hatalar.musteriId = "Müşteri seçin.";
  if (!KANALLAR.includes(kanal)) hatalar.kanal = "Talebin nereden geldiğini seçin.";
  if (!KONULAR.includes(konu)) hatalar.konu = "Konu seçin.";
  if (!ONCELIKLER.includes(oncelik)) hatalar.oncelik = "Öncelik seçin.";
  if (!baslik) hatalar.baslik = "Kısa bir başlık yazın.";
  if (!aciklama) hatalar.aciklama = "Sorunu kısaca anlatın.";
  if (Object.keys(hatalar).length || !musteri) return { hatalar };

  const cihaz = musteri.cihazlar.find((c) => c.seriNo === seriNo);
  const zaman = simdiIso();
  const dosya = dosyaAdi(form);

  const talep = await talepEkle({
    durum: "acik",
    baslik,
    aciklama,
    oncelik,
    konu,
    kanal,
    acilis: zaman,
    dosya,
    musteriId: musteri.id,
    musteri: musteri.ad,
    // Talep birincil yetkiliyle açılır
    yetkili: musteri.yetkililer[0]?.ad || "—",
    telefon: musteri.yetkililer[0]?.telefon || "—",
    eposta: musteri.yetkililer[0]?.eposta || "—",
    seriNo: cihaz?.seriNo ?? null,
    plan: musteri.plan,
    firmware: cihaz?.firmware ?? "—",
    arac: metin("arac") || "—",
    notlar: [{ tur: "acilis", metin: `${kanal} ile gelen talep kaydedildi${dosya ? ", dosya eklendi" : ""}.`, zaman }],
  });
  await musteriyiGuncelle(musteri.id, (m) => {
    m.acikTalep += 1;
  });

  yenile();
  revalidatePath("/musteriler");
  return { talep };
}

export type NotFormDurumu = { hata?: string; not?: TalepNotu; durum?: TalepDurumu; id?: string };

/** Not kaydeder; "islem" alanı beklemede / cozuldu / yeniden ise talebin durumunu da değiştirir. */
export async function notKaydet(_onceki: NotFormDurumu, form: FormData): Promise<NotFormDurumu> {
  const metin = metinAl(form);
  const id = metin("talepId");
  const islem = metin("islem") as "not" | "beklemede" | "cozuldu" | "yeniden";
  const yazi = metin("metin");
  const dosya = dosyaAdi(form);

  if (islem === "not" && !yazi && !dosya) return { hata: "Not yazın veya dosya ekleyin." };

  const varsayilan = { beklemede: "Talep beklemeye alındı.", cozuldu: "Talep çözüldü olarak kapatıldı.", yeniden: "Talep yeniden açıldı." };
  const not: TalepNotu = {
    tur: islem === "not" ? "not" : islem,
    metin: yazi || (islem === "not" ? "Dosya eklendi." : varsayilan[islem]),
    zaman: simdiIso(),
    ...(dosya ? { dosya } : {}),
  };
  const durum: TalepDurumu | undefined =
    islem === "beklemede" ? "beklemede" : islem === "cozuldu" ? "cozuldu" : islem === "yeniden" ? "acik" : undefined;

  const talep = await talebiGuncelle(id, (t) => {
    t.notlar.push(not);
    if (durum) t.durum = durum;
  });
  if (!talep) return { hata: "Talep bulunamadı." };

  yenile(id);
  return { not, durum, id };
}

export async function aracKapsamiIstegi(id: string): Promise<TalepNotu | null> {
  const not: TalepNotu = { tur: "not", metin: "Araç kapsamı isteği olarak işaretlendi; ürün ekibine iletilecek.", zaman: simdiIso() };
  const talep = await talebiGuncelle(id, (t) => {
    t.konu = "Araç kapsamı isteği";
    t.notlar.push(not);
  });
  if (!talep) return null;
  yenile(id);
  return not;
}
