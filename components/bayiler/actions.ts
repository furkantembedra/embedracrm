"use server";
// Bayi & Distribütör: kaydetme ve güncelleme (Server Actions)
import { revalidatePath } from "next/cache";
import { musteriBulAdla, musteriEkle } from "@/components/musteriler/queries";
import {
  KONTROL_LISTESI,
  ULKELER,
  aktifBayiEkle,
  hareketEkle,
  basvuruEkle,
  basvuruyuGuncelle,
  basvuruyuSil,
  bosSozlesme,
  DESTEK_KALEMLERI,
  type Basvuru,
  type SozlesmeDetayi,
} from "./queries";
import { maddeTamam, sonrakiAsama } from "./ortak";

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
    sozlesme: bosSozlesme(metin("bolge") || ULKELER[ulkeKodu]),
    gorusme: null,
  };
  await basvuruEkle(basvuru);
  yenile();
  return { basvuru };
}

/** Başvuruyu listeden kaldırır. Lansmanı yapılmış bayinin aktif bayi ve müşteri kaydı silinmez. */
export async function basvuruSil(id: string): Promise<{ hata?: string }> {
  if (!(await basvuruyuSil(id))) return { hata: "Başvuru bulunamadı." };
  // TODO: Supabase bağlanınca: await supabase.from("dealer_applications").delete().eq("id", id);
  yenile(id);
  return {};
}

export async function kontrolDegistir(id: string, sira: number, deger: boolean) {
  if (sira < 0 || sira >= KONTROL_LISTESI.length) throw new Error("Geçersiz madde");
  await basvuruyuGuncelle(id, (b) => {
    if (b.asama !== "sozlesme") return; // kontrol listesi yalnızca Sözleşme aşamasında değişir
    b.kontroller[sira] = deger;
  });
  yenile(id);
}

const sayiVeyaBos = (n: unknown, en: number, enCok: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= en && n <= enCok ? Math.round(n) : null;

/** Sözleşme maddesinin ayrıntısını kaydeder; zorunlu alanlar dolunca madde kendiliğinden işaretlenir. */
export async function sozlesmeKaydet(id: string, sira: number, d: SozlesmeDetayi): Promise<{ hata?: string; sozlesme?: SozlesmeDetayi; kontroller?: boolean[] }> {
  if (sira < 0 || sira >= KONTROL_LISTESI.length) return { hata: "Geçersiz madde" };
  const temiz: SozlesmeDetayi = {
    bolge: { kapsam: String(d.bolge.kapsam ?? "").trim().slice(0, 120), munhasir: typeof d.bolge.munhasir === "boolean" ? d.bolge.munhasir : null },
    moq: {
      one: sayiVeyaBos(d.moq.one, 0, 10_000),
      lite: sayiVeyaBos(d.moq.lite, 0, 10_000),
      yillik: sayiVeyaBos(d.moq.yillik, 0, 100_000),
      indirim: sayiVeyaBos(d.moq.indirim, 0, 60),
    },
    marka: {
      kitTarihi: /^\d{4}-\d{2}-\d{2}$/.test(d.marka.kitTarihi) ? d.marka.kitTarihi : "",
      logoOnay: !!d.marka.logoOnay,
      not: String(d.marka.not ?? "").trim().slice(0, 300),
    },
    destek: {
      bayi: DESTEK_KALEMLERI.filter((k) => d.destek.bayi.includes(k)),
    },
  };
  const mevcut = await basvuruyuGuncelle(id, () => {});
  if (mevcut && mevcut.asama !== "sozlesme") return { hata: "Kontrol listesi yalnızca Sözleşme aşamasında düzenlenebilir." };
  const b = await basvuruyuGuncelle(id, (x) => {
    x.sozlesme = temiz;
    if (maddeTamam(sira, temiz)) x.kontroller[sira] = true;
    if (sira === 0 && temiz.bolge.kapsam) x.bolge = temiz.bolge.kapsam;
  });
  if (!b) return { hata: "Başvuru bulunamadı." };
  // TODO: Supabase bağlanınca: await supabase.from("dealer_applications").update({ contract: temiz, checklist: b.kontroller }).eq("id", id);
  yenile(id);
  return { sozlesme: structuredClone(temiz), kontroller: [...b.kontroller] };
}

export async function puanKaydet(id: string, puan: number): Promise<{ hata?: string }> {
  if (!Number.isInteger(puan) || puan < 0 || puan > 100) return { hata: "Puan 0–100 arası tam sayı olmalı." };
  await basvuruyuGuncelle(id, (b) => {
    b.puan = puan;
  });
  yenile(id);
  return {};
}

export type IlerletmeSonucu = { hata?: string; eksikMadde?: number; basvuru?: Basvuru; musteri?: { id: string; ad: string; yeni: boolean } };

/** Başvuruyu bir sonraki aşamaya taşır. Lansmanda bayi aktif bayilere ve müşterilere eklenir. */
export async function asamaIlerlet(id: string): Promise<IlerletmeSonucu> {
  const b = await basvuruyuGuncelle(id, () => {});
  if (!b) return { hata: "Başvuru bulunamadı." };
  const hedef = sonrakiAsama(b.asama);
  if (!hedef) return { hata: "Başvuru zaten lansman aşamasında." };
  if (hedef === "sozlesme" && b.puan === null) return { hata: "Sözleşmeye geçmeden önce uygunluk puanı verin." };
  if (hedef === "lansman" && b.kontroller.some((k) => !k)) {
    const eksik = KONTROL_LISTESI.filter((_, i) => !b.kontroller[i]).map((k) => k.baslik);
    return { hata: `Lansman için kontrol listesi tamamlanmalı: ${eksik.join(", ")}.`, eksikMadde: b.kontroller.findIndex((k) => !k) };
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
      stok: (b.sozlesme.moq.one ?? 0) + (b.sozlesme.moq.lite ?? 0) || b.ilkSiparis,
      moqHedef: b.sozlesme.moq.yillik ? Math.ceil(b.sozlesme.moq.yillik / 4) : Math.max(b.ilkSiparis, 1) * 2, // çeyreklik
      moqGerceklesen: 0,
    });

    // İlk stok: sözleşmedeki ilk sipariş adetleri sevkiyat olarak işlenir (seri no sonradan girilebilir)
    const ilkKalemler = [
      ...Array.from({ length: b.sozlesme.moq.one ?? 0 }, () => ({ model: "ONE" as const, seriNo: null })),
      ...Array.from({ length: b.sozlesme.moq.lite ?? 0 }, () => ({ model: "ONE Lite" as const, seriNo: null })),
    ];
    if (!ilkKalemler.length) ilkKalemler.push(...Array.from({ length: b.ilkSiparis }, () => ({ model: "ONE" as const, seriNo: null })));
    await hareketEkle({ id: crypto.randomUUID(), bayiId: b.id, tur: "sevkiyat", tarih: bugunIso(), kalemler: ilkKalemler, not: "İlk stok (lansman)" });

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
        yetkililer: [{ id: crypto.randomUUID(), ad: b.yetkili, unvan: "", telefon: b.telefon, eposta: b.eposta }],
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
