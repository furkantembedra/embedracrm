// Bayi sipariş kataloğu: cihaz, ONESuite lisansı ve aksesuar kalemleri tek listede.
// Sayfa (fiyat gösterimi) ve server action (tutar hesabı) aynı listeyi kullanır; istemcide de çalışır.
import { CIHAZ_MODELLERI, URUN_BILGI, lisansYillikFiyat, type FiyatListesi, type LisansPaketi, type ParaBirimi } from "@/lib/urunler";
import type { Kalem, StokKalemi } from "@/components/siparisler/queries";

export type KatalogTuru = "cihaz" | "lisans" | "aksesuar";
export type KatalogUrunu = {
  anahtar: string; // form alanı: "cihaz:ONE", "lisans:Pro", "aksesuar:EO1-CBL-PIN"
  tur: KatalogTuru;
  ad: string;
  aciklama: string;
  liste: number; // KDV hariç, TL
  kdvli: boolean; // cihaz ve aksesuar KDV'li, lisans KDV'siz
  lisansCihaz?: number; // lisansın kapsadığı cihaz sayısı
  stokta?: boolean; // Embedra deposunda var mı (yoksa üretimden sevk)
};

/** Bayinin sipariş edebileceği ürünler. Fiyatı "özel" olan paketler (Premium, Enterprise) portalda yok. */
export function katalogOlustur(fiyat: FiyatListesi, stok: StokKalemi[]): KatalogUrunu[] {
  const cihazStok: Record<string, string> = { ONE: "EO1-HW", "ONE Lite": "EO1L-HW" };
  return [
    ...CIHAZ_MODELLERI.map((m): KatalogUrunu => ({
      anahtar: `cihaz:${m}`, tur: "cihaz", ad: `Embedra${URUN_BILGI[m].ad}`, aciklama: `${URUN_BILGI[m].ekran} · kutuda batarya, USB-C, ana teşhis ve pin kablosu`,
      liste: fiyat.cihaz[m], kdvli: true, stokta: (stok.find((s) => s.kod === cihazStok[m])?.adet ?? 0) > 0,
    })),
    ...(["Basic", "Pro", "Pro+"] as const).flatMap((p): KatalogUrunu[] => {
      const l = fiyat.lisans[p];
      if (!l?.fiyat) return [];
      const cihaz = l.cihaz ?? 1;
      return [{ anahtar: `lisans:${p}`, tur: "lisans", ad: `ONESuite ${p}`, aciklama: `12 ay · ${cihaz} cihaz`, liste: l.fiyat, kdvli: false, lisansCihaz: cihaz }];
    }),
    ...stok
      .filter((s) => s.fiyat && !s.kod.endsWith("-HW"))
      .map((s): KatalogUrunu => ({ anahtar: `aksesuar:${s.kod}`, tur: "aksesuar", ad: s.ad, aciklama: s.kod, liste: s.fiyat!, kdvli: true, stokta: s.adet > 0 })),
  ];
}

export const bayiFiyati = (liste: number, indirim: number) => Math.round(liste * (1 - indirim / 100));

/* ---------- Teslimat, ödeme ve para birimi ---------- */

export const ODEME_SECENEKLERI = [
  { deger: "Proforma", ad: "Proforma (peşin)", aciklama: "Proforma ödendikten sonra sipariş hazırlanır." },
  { deger: "Havale/EFT", ad: "Havale/EFT · 30 gün vade", aciklama: "Fatura kesilir, ödeme 30 gün içinde yapılır." },
  { deger: "Kart", ad: "Kredi kartı", aciklama: "E-postanıza güvenli ödeme bağlantısı gönderilir." },
] as const;
export type PortalOdeme = (typeof ODEME_SECENEKLERI)[number]["deger"];

/** Bayinin ticari koşulları: yurt dışı bayi EUR ile faturalanır ve ihracat olduğu için KDV uygulanmaz. */
/** Kur ve KDV, CRM › Operasyon › Ayarlar › Fiyat listesi'nden gelir. */
export function ticariKosullar(ulkeKodu: string, fiyat: Pick<FiyatListesi, "kdv" | "eurKur">) {
  const yurtDisi = ulkeKodu !== "TR";
  return { paraBirimi: (yurtDisi ? "EUR" : "TRY") as "EUR" | "TRY", kur: yurtDisi ? fiyat.eurKur : 1, kdv: yurtDisi ? 0 : fiyat.kdv, yurtDisi };
}

/**
 * Bayinin göreceği fiyat listesi. Portal tutarları TL tutar ve en sonda kura böler; EUR'lu bayide Ayarlar'da elle
 * EUR fiyatı girilmiş lisansın TL karşılığı "EUR fiyat × kur" yapılır, böylece her "TL / kur" hesabı tam o EUR fiyatını
 * bulur (bot da aynı fiyatı lisansYillikFiyat ile okur). EUR fiyatı girilmemişse ya da bayi TRY ise liste aynen döner.
 */
export function etkinFiyatListesi(fiyat: FiyatListesi, paraBirimi: ParaBirimi): FiyatListesi {
  if (paraBirimi === "TRY") return fiyat;
  const lisans = Object.fromEntries(
    (Object.entries(fiyat.lisans) as [LisansPaketi, FiyatListesi["lisans"][LisansPaketi]][]).map(([p, l]) => [
      p,
      l.eurFiyat == null ? l : { ...l, fiyat: Math.round(lisansYillikFiyat(fiyat, p, "EUR")! * fiyat.eurKur) },
    ]),
  ) as FiyatListesi["lisans"];
  return { ...fiyat, lisans };
}

/** Bayinin ticari koşulları ve onun para birimine göre etkin fiyat listesi; portaldaki her fiyat okuması bununla başlar. */
export function bayiFiyatlari(ulkeKodu: string, fiyat: FiyatListesi) {
  const kosul = ticariKosullar(ulkeKodu, fiyat);
  return { kosul, fiyat: etkinFiyatListesi(fiyat, kosul.paraBirimi) };
}

/** TL tutarı bayinin para birimine çevirir ve biçimler */
export function paraYaz(tlTutar: number, paraBirimi: "EUR" | "TRY", kur: number) {
  if (paraBirimi === "TRY") return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(tlTutar);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(tlTutar / kur));
}

/** Bayinin kayıtlı teslimat adresi: CRM'deki bayi kaydı (Bayi detayı › Portal); boşsa son fiziksel teslimatın adresi, o da yoksa bölgesi */
export function kayitliAdres(bayi: { id: string; adres?: string; bolge: string }, siparisler: { bayiId?: string | null; tarih: string; adres: string }[]) {
  if (bayi.adres?.trim()) return bayi.adres.trim();
  return [...siparisler].filter((s) => s.bayiId === bayi.id && s.adres && s.adres !== bayi.bolge && s.adres !== "Dijital teslimat").sort((a, b) => b.tarih.localeCompare(a.tarih))[0]?.adres ?? bayi.bolge;
}

/** En erken istenebilecek teslim tarihi: bugünden 3 gün sonra ("2026-11-19") */
export const enErkenTeslim = (bugun: string) => new Date(Date.parse(bugun) + 3 * 86_400_000).toISOString().slice(0, 10);

/** Sepet: anahtar → adet. Ara toplam (liste), iskonto, net, KDV ve genel toplam. */
export function sepetToplami(katalog: KatalogUrunu[], sepet: Record<string, number>, indirim: number, kdv: number) {
  let liste = 0, net = 0, kdvTutari = 0;
  for (const u of katalog) {
    const adet = sepet[u.anahtar] ?? 0;
    if (!adet) continue;
    const satir = bayiFiyati(u.liste, indirim) * adet;
    liste += u.liste * adet;
    net += satir;
    if (u.kdvli) kdvTutari += Math.round(satir * kdv);
  }
  return { liste, iskonto: liste - net, net, kdv: kdvTutari, genel: net + kdvTutari };
}

/** Sepetteki cihaz adedi ve sepetteki lisansların kapsadığı cihaz sayısı */
export function lisansKapsami(katalog: KatalogUrunu[], sepet: Record<string, number>) {
  let cihaz = 0, kapsanan = 0;
  for (const u of katalog) {
    const adet = sepet[u.anahtar] ?? 0;
    if (u.tur === "cihaz") cihaz += adet;
    if (u.tur === "lisans") kapsanan += adet * (u.lisansCihaz ?? 1);
  }
  return { cihaz, kapsanan, eksik: Math.max(0, cihaz - kapsanan) };
}

/** Sepeti sipariş kalemlerine çevirir */
export function sepettenKalemler(katalog: KatalogUrunu[], sepet: Record<string, number>): Kalem[] {
  return katalog.flatMap((u): Kalem[] => {
    const adet = sepet[u.anahtar] ?? 0;
    if (!adet) return [];
    const kod = u.anahtar.slice(u.anahtar.indexOf(":") + 1);
    if (u.tur === "cihaz") return [{ tur: "cihaz", model: kod as (typeof CIHAZ_MODELLERI)[number], adet }];
    if (u.tur === "lisans") return [{ tur: "lisans", paket: kod, adet, sureAy: 12 }];
    return [{ tur: "aksesuar", stokKodu: kod, adet }];
  });
}
