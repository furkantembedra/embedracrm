"use server";
// CRM › Bayi detayı › Portal paneli: bayinin portal ayarları (temsilci, teslimat adresi, sözleşme süresi) ve
// portaldan gelen her şey tek yerde: açık siparişler, yenileme / düzeltme talepleri, açık RMA'lar, lisans havuzu.
// Yalnızca Yönetici ve Satış rolleri (oturumGerekli).
import { oturumGerekli } from "@/lib/oturum";
import { revalidatePath } from "next/cache";
import { getCihaz } from "@/components/cihaz-lisans/queries";
import { getEkip } from "@/components/operasyon/queries";
import { duzeltmeTalebiCoz, getDuzeltmeTalepleri, getYenilemeTalepleri, yenilemeTalebiSil } from "@/components/portal/queries";
import { getRmalar, ADIM_ADI } from "@/components/rma/queries";
import { acikMi } from "@/components/rma/ortak";
import { getSiparisler } from "@/components/siparisler/queries";
import { DURUM_ADI, acikSiparis } from "@/components/siparisler/ortak";
import { getHavuz } from "./lisans-havuzu";
import { getTalepler, DURUM_ADI as TALEP_DURUMU } from "@/components/destek/queries";
import { aktifBayiyiGuncelle, getAktifBayiler } from "./queries";

export type PortalAyari = { temsilciId: string | null; adres: string; sozlesmeBaslangic: string | null; sozlesmeSureAy: number | null };

export async function bayiPortalPaneli(bayiId: string) {
  await oturumGerekli(["Yönetici", "Satış"]);
  const bayi = (await getAktifBayiler()).find((b) => b.id === bayiId);
  if (!bayi) return null;
  const [ekip, yenileme, duzeltme, rmalar, siparisler, havuz, talepler] = await Promise.all([
    getEkip(), getYenilemeTalepleri(bayiId), getDuzeltmeTalepleri(bayiId), getRmalar(), getSiparisler(), getHavuz(bayiId), getTalepler(),
  ]);
  const yenilemeSatirlari = await Promise.all(yenileme.map(async (y) => {
    const c = await getCihaz(y.seriNo);
    const siparisli = siparisler.some((s) => s.bayiId === bayiId && acikSiparis(s) && s.lisansAtamalari?.some((a) => a.seriNo === y.seriNo));
    return { seriNo: y.seriNo, tarih: y.tarih, musteri: c?.musteri ?? "—", plan: c?.plan ?? "—", bitis: c?.lisansBitis ?? null, siparisli };
  }));
  const cihazlar = new Set((await Promise.all(rmalar.map((r) => getCihaz(r.seriNo)))).filter((c) => c?.bayiId === bayiId).map((c) => c!.seriNo));
  return {
    ayar: { temsilciId: bayi.temsilciId ?? null, adres: bayi.adres ?? "", sozlesmeBaslangic: bayi.sozlesmeBaslangic ?? null, sozlesmeSureAy: bayi.sozlesmeSureAy ?? null } as PortalAyari,
    ekip: ekip.filter((k) => k.aktif).map((k) => ({ id: k.id, ad: k.ad, rol: k.rol })),
    siparisler: siparisler.filter((s) => s.bayiId === bayiId && acikSiparis(s)).map((s) => ({
      id: s.id, tarih: s.tarih.slice(0, 10), durum: DURUM_ADI[s.durum], paraBirimi: s.paraBirimi, tutar: s.tutar,
      ozet: s.kalemler.map((k) => `${k.adet}× ${k.tur === "cihaz" ? k.model : k.tur === "lisans" ? `${k.paket} lisans` : k.stokKodu}`).join(", "),
    })),
    yenileme: yenilemeSatirlari,
    duzeltme: duzeltme.map((d) => ({ ...d })),
    rmalar: rmalar.filter((r) => acikMi(r) && (r.sahip.id === bayiId || cihazlar.has(r.seriNo))).map((r) => ({ id: r.id, seriNo: r.seriNo, adim: ADIM_ADI[r.adim], acilis: r.acilis })),
    destek: talepler.filter((t) => t.bayiId === bayiId && t.durum !== "cozuldu").map((t) => ({ id: t.id, baslik: t.baslik, durum: TALEP_DURUMU[t.durum], oncelik: t.oncelik })),
    havuz: havuz.map(({ paket, sureAy, adet, kaynak }) => ({ paket, sureAy, adet, kaynak })),
  };
}
export type PortalPaneli = NonNullable<Awaited<ReturnType<typeof bayiPortalPaneli>>>;

export async function bayiPortalAyariKaydet(bayiId: string, a: PortalAyari): Promise<{ hata?: string; tamam?: string }> {
  await oturumGerekli(["Yönetici", "Satış"]);
  const ekip = await getEkip();
  if (a.temsilciId && !ekip.some((k) => k.id === a.temsilciId && k.aktif)) return { hata: "Temsilci seçin." };
  if (a.sozlesmeBaslangic && !/^\d{4}-\d{2}-\d{2}$/.test(a.sozlesmeBaslangic)) return { hata: "Sözleşme başlangıç tarihi geçersiz." };
  if (a.sozlesmeSureAy !== null && !(Number.isInteger(a.sozlesmeSureAy) && a.sozlesmeSureAy >= 1 && a.sozlesmeSureAy <= 120)) return { hata: "Sözleşme süresi 1–120 ay olmalı." };
  const b = await aktifBayiyiGuncelle(bayiId, (x) => {
    x.temsilciId = a.temsilciId;
    x.adres = a.adres.trim().slice(0, 200);
    x.sozlesmeBaslangic = a.sozlesmeBaslangic;
    x.sozlesmeSureAy = a.sozlesmeSureAy;
  });
  if (!b) return { hata: "Bayi bulunamadı." };
  for (const y of ["/bayiler", "/portal", "/portal/siparis", "/portal/dokumanlar"]) revalidatePath(y);
  return { tamam: "Portal ayarları kaydedildi." };
}

export async function bayiDuzeltmeCoz(id: string, cozum: string): Promise<{ hata?: string }> {
  await oturumGerekli(["Yönetici", "Satış"]);
  const m = cozum.trim();
  if (m.length < 3) return { hata: "Ne yapıldığını kısaca yazın." };
  if (!(await duzeltmeTalebiCoz(id, m.slice(0, 300)))) return { hata: "Talep bulunamadı." };
  revalidatePath("/portal/cihazlar");
  return {};
}

export async function bayiYenilemeTalebiKapat(seriNo: string): Promise<void> {
  await oturumGerekli(["Yönetici", "Satış"]);
  await yenilemeTalebiSil(seriNo);
  revalidatePath("/portal/lisanslar");
  revalidatePath("/portal");
}
