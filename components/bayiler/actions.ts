"use server";
// Bayi & Distribütör: kaydetme ve güncelleme (Server Actions)
import { revalidatePath } from "next/cache";
import { musteriBulAdla, musteriEkle } from "@/components/musteriler/queries";
import {
  KONTROL_LISTESI,
  ULKELER,
  aktifBayiEkle,
  basvuruEkle,
  basvuruyuGuncelle,
  type Basvuru,
} from "./queries";
import { sonrakiAsama } from "./ortak";

const metinAl = (form: FormData) => (ad: string) => String(form.get(ad) ?? "").trim();

function yenile(id?: string) {
  revalidatePath("/bayiler/raporlama"); // hazır raporlar bu kayıtları okur
  revalidatePath("/bayiler");
  if (id) revalidatePath(`/bayiler/${id}`);
}

const bugunIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type BasvuruFormDurumu = { hatalar?: Record<string, string>; basvuru?: Basvuru };

export async function basvuruKaydet(_onceki: BasvuruFormDurumu, form: FormData): Promise<BasvuruFormDurumu> {
  const metin = metinAl(form);
  const sirket = metin("sirket");
  const yetkili = metin("yetkili");
  const eposta = metin("eposta");
  const telefon = metin("telefon");
  const ulkeKodu = metin("ulkeKodu");
  const vergiNo = metin("vergiNo");
  const ilkSiparis = Number(metin("ilkSiparis") || "0");

  const hatalar: Record<string, string> = {};
  if (!sirket) hatalar.sirket = "Şirket adı zorunlu.";
  if (!yetkili) hatalar.yetkili = "Yetkili kişinin adını girin.";
  if (!/^\S+@\S+\.\S+$/.test(eposta)) hatalar.eposta = "Geçerli bir e-posta girin.";
  if (!telefon) hatalar.telefon = "Telefon zorunlu.";
  if (!ULKELER[ulkeKodu]) hatalar.ulkeKodu = "Ülke seçin.";
  if (!vergiNo) hatalar.vergiNo = "Vergi no zorunlu.";
  if (!Number.isInteger(ilkSiparis) || ilkSiparis < 0) hatalar.ilkSiparis = "Cihaz adedini tam sayı olarak girin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const basvuru: Basvuru = {
    id: crypto.randomUUID(),
    sirket,
    yetkili,
    ulkeKodu,
    bolge: metin("bolge") || ULKELER[ulkeKodu],
    asama: "basvuru",
    puan: null,
    ilkSiparis,
    tarih: bugunIso(),
    eposta,
    telefon,
    vergiNo,
    kontroller: KONTROL_LISTESI.map(() => false),
    gorusme: null,
  };
  await basvuruEkle(basvuru);
  yenile();
  return { basvuru };
}

export async function kontrolDegistir(id: string, sira: number, deger: boolean) {
  if (sira < 0 || sira >= KONTROL_LISTESI.length) throw new Error("Geçersiz madde");
  await basvuruyuGuncelle(id, (b) => {
    b.kontroller[sira] = deger;
  });
  yenile(id);
}

export async function puanKaydet(id: string, puan: number): Promise<{ hata?: string }> {
  if (!Number.isInteger(puan) || puan < 0 || puan > 100) return { hata: "Puan 0–100 arası tam sayı olmalı." };
  await basvuruyuGuncelle(id, (b) => {
    b.puan = puan;
  });
  yenile(id);
  return {};
}

export type IlerletmeSonucu = { hata?: string; basvuru?: Basvuru; musteri?: { id: string; ad: string; yeni: boolean } };

/** Başvuruyu bir sonraki aşamaya taşır. Lansmanda bayi aktif bayilere ve müşterilere eklenir. */
export async function asamaIlerlet(id: string): Promise<IlerletmeSonucu> {
  const b = await basvuruyuGuncelle(id, () => {});
  if (!b) return { hata: "Başvuru bulunamadı." };
  const hedef = sonrakiAsama(b.asama);
  if (!hedef) return { hata: "Başvuru zaten lansman aşamasında." };
  if (hedef === "sozlesme" && b.puan === null) return { hata: "Sözleşmeye geçmeden önce uygunluk puanı verin." };
  if (hedef === "lansman" && b.kontroller.some((k) => !k)) {
    const eksik = KONTROL_LISTESI.filter((_, i) => !b.kontroller[i]).map((k) => k.baslik);
    return { hata: `Lansman için kontrol listesi tamamlanmalı: ${eksik.join(", ")}.` };
  }

  b.asama = hedef;
  // TODO: Supabase bağlanınca: await supabase.from("partner_applications").update({ stage: hedef }).eq("id", id);

  let musteri: IlerletmeSonucu["musteri"];
  if (hedef === "lansman") {
    await aktifBayiEkle({
      id: b.id,
      ad: b.sirket,
      bolge: b.bolge,
      ulkeKodu: b.ulkeKodu,
      satilan: 0,
      stok: b.ilkSiparis,
      moqHedef: Math.max(b.ilkSiparis, 1) * 2,
      moqGerceklesen: 0,
    });

    const olay = { metin: `Bayi lansmanı · ${b.bolge}`, zaman: "Bugün · Bayi ağı", tur: "siparis" as const };
    const mevcut = await musteriBulAdla(b.sirket);
    if (mevcut) {
      mevcut.segment = "bayi";
      mevcut.durum = "Aktif bayi";
      mevcut.olaylar.unshift(olay);
      musteri = { id: mevcut.id, ad: mevcut.ad, yeni: false };
    } else {
      const yeni = {
        id: crypto.randomUUID(),
        ad: b.sirket,
        sehir: "—",
        ulke: ULKELER[b.ulkeKodu] ?? b.ulkeKodu,
        segment: "bayi" as const,
        plan: "Pro+" as const,
        lisansBitis: null,
        toplamDeger: null,
        sonTemas: "Bugün",
        durum: "Aktif bayi",
        yetkili: b.yetkili,
        telefon: b.telefon,
        eposta: b.eposta,
        vergiNo: b.vergiNo,
        acikTalep: 0,
        cihazlar: [],
        olaylar: [olay, { metin: "Bayi başvurusundan müşteriye dönüştü", zaman: "Bugün", tur: "not" as const }],
      };
      await musteriEkle(yeni);
      musteri = { id: yeni.id, ad: yeni.ad, yeni: true };
    }
    revalidatePath("/musteriler");
  }

  yenile(id);
  return { basvuru: structuredClone(b), musteri };
}

export type GorusmeFormDurumu = { hata?: string; gorusme?: Basvuru["gorusme"]; id?: string; zaman?: number };

export async function gorusmeKaydet(_onceki: GorusmeFormDurumu, form: FormData): Promise<GorusmeFormDurumu> {
  const metin = metinAl(form);
  const id = metin("id");
  const tarih = metin("tarih");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tarih)) return { hata: "Görüşme tarihi ve saatini seçin." };
  const gorusme = { tarih, not: metin("not") };
  const b = await basvuruyuGuncelle(id, (x) => {
    x.gorusme = gorusme;
  });
  if (!b) return { hata: "Başvuru bulunamadı." };
  yenile(id);
  return { gorusme, id, zaman: Date.now() };
}
