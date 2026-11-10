"use server";
// Hatırlatmalar (Server Actions). Sayfalar bunları tarayıcıdan çağırır: "şimdi" sunucu saatinden alınır,
// böylece otomatik kurallar her açılışta güncel veriyle hesaplanır.
import { getEkip, type Kullanici } from "@/components/operasyon/queries";
import { otomatikHatirlatmalar } from "./kurallar";
import {
  AKTIF_KULLANICI_ID, elleGuncelle, getElleHatirlatmalar, getOkunanlar, getOtoDurumlar, hatirlatmaEkleDepo, okunduIsaretle, otoDurumKaydet,
  type Hatirlatma, type KayitTuru,
} from "./queries";

const p2 = (n: number) => String(n).padStart(2, "0");
function simdiYerel(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export type HatirlatmaVerisi = {
  liste: (Hatirlatma & { okundu: boolean })[];
  ekip: Pick<Kullanici, "id" | "ad" | "rol">[];
  aktif: Pick<Kullanici, "id" | "ad" | "rol">;
  simdi: string;
};

async function aktifKullanici() {
  const ekip = await getEkip();
  const k = ekip.find((x) => x.id === AKTIF_KULLANICI_ID) ?? ekip[0];
  return { ekip, aktif: k };
}

/** Aktif kullanıcının görebildiği hatırlatmalar. Yönetici herkesinkini görür. */
export async function hatirlatmalariGetir(): Promise<HatirlatmaVerisi> {
  const simdi = simdiYerel();
  const bugun = simdi.slice(0, 10);
  const { ekip, aktif } = await aktifKullanici();
  const [elle, oto, durumlar, okunan] = await Promise.all([getElleHatirlatmalar(), otomatikHatirlatmalar(bugun), getOtoDurumlar(), getOkunanlar()]);
  const otomatik = oto.flatMap((h) => {
    const d = durumlar[h.id];
    if (d?.tamam) return [{ ...h, durum: "tamam" as const, tamamlanma: d.tamam }];
    return [{ ...h, zaman: d?.ertelendi ?? h.zaman }];
  });
  const sinir = `${bugun.slice(0, 8)}01`; // tamamlananlardan yalnızca bu ay ve sonrası
  const liste = [...elle, ...otomatik]
    .filter((h) => aktif.rol === "Yönetici" || h.sorumluId === aktif.id)
    .filter((h) => h.durum === "bekliyor" || (h.tamamlanma ?? "") >= sinir)
    .sort((a, b) => a.zaman.localeCompare(b.zaman))
    .map((h) => ({ ...h, okundu: okunan.has(`${h.id}@${h.zaman}`) }));
  return { liste, ekip: ekip.filter((k) => k.aktif).map(({ id, ad, rol }) => ({ id, ad, rol })), aktif: { id: aktif.id, ad: aktif.ad, rol: aktif.rol }, simdi };
}

export type HatirlatmaFormDurumu = { hatalar?: Record<string, string>; hatirlatma?: Hatirlatma; zaman?: number };

const KAYIT_TURLERI: KayitTuru[] = ["firsat", "teklif", "siparis", "musteri", "bayi", "rma", "stok", "cihaz"];

export async function hatirlatmaEkle(_o: HatirlatmaFormDurumu, form: FormData): Promise<HatirlatmaFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const baslik = metin("baslik");
  const tarih = metin("tarih");
  const saat = metin("saat") || "09:00";
  const sorumluId = metin("sorumluId");
  const ekip = await getEkip();
  const hatalar: Record<string, string> = {};
  if (!baslik) hatalar.baslik = "Ne hatırlatılsın?";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) hatalar.tarih = "Tarih seçin.";
  if (!/^\d{2}:\d{2}$/.test(saat)) hatalar.saat = "Saat seçin.";
  if (!ekip.some((k) => k.id === sorumluId && k.aktif)) hatalar.sorumluId = "Sorumlu seçin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const kayitTuru = metin("kayitTuru") as KayitTuru;
  const h: Hatirlatma = {
    id: crypto.randomUUID(),
    baslik: baslik.slice(0, 140),
    aciklama: metin("aciklama").slice(0, 500),
    kayit: KAYIT_TURLERI.includes(kayitTuru) && metin("kayitId")
      ? { tur: kayitTuru, id: metin("kayitId"), ad: metin("kayitAd").slice(0, 120), href: metin("kayitHref").startsWith("/") ? metin("kayitHref") : "/" }
      : null,
    sorumluId,
    zaman: `${tarih}T${saat}`,
    durum: "bekliyor",
    otomatik: false,
    onem: metin("onem") === "yuksek" ? "yuksek" : "normal",
  };
  await hatirlatmaEkleDepo(h);
  return { hatirlatma: h, zaman: Date.now() };
}

export async function hatirlatmaTamamla(id: string, tamam = true) {
  const zaman = simdiYerel();
  if (id.startsWith("oto:")) {
    const d = (await getOtoDurumlar())[id];
    await otoDurumKaydet(id, tamam ? { ...d, tamam: zaman } : d?.ertelendi ? { ertelendi: d.ertelendi } : null);
  } else {
    await elleGuncelle(id, (h) => {
      h.durum = tamam ? "tamam" : "bekliyor";
      h.tamamlanma = tamam ? zaman : null;
    });
  }
}

export async function hatirlatmaErtele(id: string, sure: "1s" | "yarin" | "hafta") {
  const d = new Date();
  if (sure === "1s") d.setHours(d.getHours() + 1);
  else {
    d.setDate(d.getDate() + (sure === "yarin" ? 1 : 7));
    d.setHours(9, 0, 0, 0);
  }
  const yeni = simdiYerel(d);
  if (id.startsWith("oto:")) await otoDurumKaydet(id, { ertelendi: yeni });
  else await elleGuncelle(id, (h) => void (h.zaman = yeni));
  return yeni;
}

/** Zildeki bildirimleri okundu sayar (hatırlatma zamanıyla birlikte: ertelenen tekrar bildirilir) */
export async function bildirimleriOkundu(anahtarlar: string[]) {
  await okunduIsaretle(anahtarlar.slice(0, 200));
}
