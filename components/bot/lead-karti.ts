// Lead kartı (P2.2): botun konuşmada topladığı bilgiler fırsatın satis_hatti.lead_karti alanında birikir; satış hattı
// kartında ve botun her turunda (eksikleriyle) görünür. Saf modül: sunucu kodu içermez, istemci bileşenleri de okur.
// Araç girdisi modelden gelir: strict şema tipi garanti eder ama uzunluk, biçim ve anlam burada yeniden doğrulanır.
import { telefonNormalize } from "@/components/whatsapp/telefon";
import { ULKELER } from "@/components/bayiler/sabitler";
import { IZIN_KANALLARI, type IzinKanali } from "@/components/musteriler/izin";
import type { CihazModeli, LisansPaketi, ParaBirimi } from "@/lib/urunler";

export const EKRAN_TERCIHLERI = ["ekranli", "ekransiz", "kararsiz"] as const;
export type EkranTercihi = (typeof EKRAN_TERCIHLERI)[number];
export const EKRAN_TERCIHI_ADI: Record<EkranTercihi, string> = { ekranli: "Ekranlı (ONE)", ekransiz: "Ekransız (ONE Lite)", kararsiz: "Kararsız" };
/** Ekran tercihi → cihaz modeli (plan_oner cihaz koşulu için) */
export const EKRAN_MODELI: Record<EkranTercihi, CihazModeli | undefined> = { ekranli: "ONE", ekransiz: "ONE Lite", kararsiz: undefined };

export const ACILIYETLER = ["hemen", "bu_ay", "uc_ay_icinde", "arastiriyor"] as const;
export type Aciliyet = (typeof ACILIYETLER)[number];
export const ACILIYET_ADI: Record<Aciliyet, string> = { hemen: "Hemen", bu_ay: "Bu ay", uc_ay_icinde: "3 ay içinde", arastiriyor: "Araştırıyor" };

export const LEAD_SKORLARI = ["sicak", "ilik", "soguk"] as const;
export type LeadSkoru = (typeof LEAD_SKORLARI)[number];
export const LEAD_SKORU_ADI: Record<LeadSkoru, string> = { sicak: "Sıcak", ilik: "Ilık", soguk: "Soğuk" };

/** Botun izin_kaydet ile aldığı ama henüz bir müşteri yetkilisine yazılamamış izin (fırsat müşteriye bağlanınca taşınır) */
export type BekleyenIzin = { kanal: IzinKanali; kaynak: string; tarih: string };

export type LeadKarti = {
  firma?: string;
  yetkili?: string;
  sehir?: string;
  /** ISO 3166-1 alpha-2, büyük harf ("TR", "DE") */
  ulke_kodu?: string;
  kullanim_alani?: string;
  cihaz_adedi?: number;
  ekran_tercihi?: EkranTercihi;
  lisans_ihtiyaci?: string;
  mevcut_lisans?: string;
  aciliyet?: Aciliyet;
  butce_notu?: string;
  /** "+905321234567" (normalize) */
  telefon?: string;
  eposta?: string;
  skor?: { deger: LeadSkoru; gerekce: string; zaman: string };
  plan?: {
    plan: LisansPaketi;
    lisans_adedi: number;
    cihaz_adedi: number;
    para_birimi: ParaBirimi;
    yillik_tutar: number | null;
    ust_plan: LisansPaketi | null;
    ust_plan_ek_tutar: number | null;
    ozellikler: string[];
    zaman: string;
  };
  demo?: { not: string; zaman: string };
  /** Ülkede münhasır bayi (satışçı karar verir; bot yönlendirmez) */
  bayi?: { bayi_id: number; ad: string; kapsam: string | null; ulke_kodu: string; zaman: string };
  izinler?: BekleyenIzin[];
  guncelleme?: string;
};

/** Bilgi alanları: ihtiyac_kaydet'in yazdığı alanlar (sıra = ekranda ve istemde sıra) */
export const BILGI_ALANLARI = [
  "firma", "yetkili", "sehir", "ulke_kodu", "kullanim_alani", "cihaz_adedi", "ekran_tercihi", "lisans_ihtiyaci",
  "mevcut_lisans", "aciliyet", "butce_notu", "telefon", "eposta",
] as const;
export type BilgiAlani = (typeof BILGI_ALANLARI)[number];
export type LeadBilgisi = Pick<LeadKarti, BilgiAlani>;

export const ALAN_ADI: Record<BilgiAlani, string> = {
  firma: "Firma", yetkili: "Yetkili", sehir: "Şehir", ulke_kodu: "Ülke", kullanim_alani: "Kullanım alanı",
  cihaz_adedi: "Cihaz adedi", ekran_tercihi: "Ekran tercihi", lisans_ihtiyaci: "Lisans ihtiyacı",
  mevcut_lisans: "Mevcut lisans", aciliyet: "Aciliyet", butce_notu: "Bütçe notu", telefon: "Telefon", eposta: "E-posta",
};

/** Teklif / demo için önemli olanlar: botun sohbet içinde toplaması beklenen eksikler (bütçe ve mevcut lisans zorunlu değil) */
export const ONEMLI_ALANLAR: readonly BilgiAlani[] = [
  "firma", "yetkili", "ulke_kodu", "kullanim_alani", "cihaz_adedi", "ekran_tercihi", "aciliyet", "telefon", "eposta",
];

const METIN_SINIRI: Partial<Record<BilgiAlani, number>> = {
  firma: 120, yetkili: 80, sehir: 60, kullanim_alani: 300, lisans_ihtiyaci: 200, mevcut_lisans: 200, butce_notu: 200,
};
export const AZAMI_CIHAZ = 10_000;

/** Telefon / kimlik gibi görünen değer (yeni lead'in geçici firma adı "+90 532 …") */
export const kimlikGibi = (x: string) => (x.match(/\d/g)?.length ?? 0) >= 7;

/** Fırsatın firma adı geçici mi: boş, telefon gibi ya da konuşmanın profil adının aynısı (lead açılırken konan) */
export function geciciFirmaMi(firma: string | null | undefined, profilAdi?: string | null): boolean {
  const f = (firma ?? "").trim();
  if (!f || f === "—" || kimlikGibi(f)) return true;
  const p = (profilAdi ?? "").trim();
  return p.length > 0 && f.localeCompare(p, "tr", { sensitivity: "base" }) === 0;
}

const EPOSTA = /^[^\s@<>()"',;:]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i;
export const epostaNormalize = (x: string): string | null => {
  const e = x.trim().toLowerCase();
  return e.length <= 254 && EPOSTA.test(e) ? e : null;
};

/** Tek satır, kontrol karakteri ve açılı ayraç yok, kırpılmış */
function temizMetin(x: unknown, sinir: number): string | null {
  if (typeof x !== "string") return null;
  const t = x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, sinir) : null;
}

export type DogrulamaSonucu<T> = { ok: true; deger: T; atlanan: string[] } | { ok: false; hata: string };

/**
 * ihtiyac_kaydet girdisini sunucuda yeniden doğrular. Geçersiz tek alan tüm çağrıyı düşürmez: atlanır ve modele
 * hangi alanın neden atlandığı söylenir (kişisel veri tekrar edilmez). Hiç geçerli alan yoksa hata.
 */
export function ihtiyacGirdisi(girdi: unknown): DogrulamaSonucu<LeadBilgisi> {
  if (!girdi || typeof girdi !== "object" || Array.isArray(girdi)) return { ok: false, hata: "Girdi nesne olmalı." };
  const g = girdi as Record<string, unknown>;
  const d: LeadBilgisi = {};
  const atlanan: string[] = [];
  for (const k of Object.keys(g)) if (!(BILGI_ALANLARI as readonly string[]).includes(k)) atlanan.push(`${k}: bilinmeyen alan`);

  for (const k of ["firma", "yetkili", "sehir", "kullanim_alani", "lisans_ihtiyaci", "mevcut_lisans", "butce_notu"] as const) {
    if (g[k] === undefined || g[k] === null) continue;
    const t = temizMetin(g[k], METIN_SINIRI[k]!);
    if (t) d[k] = t;
    else atlanan.push(`${k}: boş ya da metin değil`);
  }
  if (g.ulke_kodu != null) {
    const u = typeof g.ulke_kodu === "string" ? g.ulke_kodu.trim().toUpperCase() : "";
    if (/^[A-Z]{2}$/.test(u)) d.ulke_kodu = u;
    else atlanan.push("ulke_kodu: iki harfli ISO kodu olmalı (TR, DE)");
  }
  if (g.cihaz_adedi != null) {
    const n = g.cihaz_adedi;
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= AZAMI_CIHAZ) d.cihaz_adedi = n;
    else atlanan.push(`cihaz_adedi: 1-${AZAMI_CIHAZ} arası tam sayı olmalı`);
  }
  if (g.ekran_tercihi != null) {
    if ((EKRAN_TERCIHLERI as readonly unknown[]).includes(g.ekran_tercihi)) d.ekran_tercihi = g.ekran_tercihi as EkranTercihi;
    else atlanan.push("ekran_tercihi: geçersiz");
  }
  if (g.aciliyet != null) {
    if ((ACILIYETLER as readonly unknown[]).includes(g.aciliyet)) d.aciliyet = g.aciliyet as Aciliyet;
    else atlanan.push("aciliyet: geçersiz");
  }
  if (g.telefon != null) {
    const t = typeof g.telefon === "string" ? telefonNormalize(g.telefon) : "";
    if (t) d.telefon = t;
    else atlanan.push("telefon: geçerli bir numara değil (ülke koduyla iste)");
  }
  if (g.eposta != null) {
    const e = typeof g.eposta === "string" ? epostaNormalize(g.eposta) : null;
    if (e) d.eposta = e;
    else atlanan.push("eposta: geçerli bir adres değil");
  }
  if (Object.keys(d).length === 0) {
    return { ok: false, hata: `Kaydedilecek geçerli bilgi yok.${atlanan.length ? ` ${atlanan.join("; ")}.` : ""}` };
  }
  return { ok: true, deger: d, atlanan };
}

/** Kartın bilgi alanlarından eksik olan önemli alanlar (telefon, kanal telefon veriyorsa eksik sayılmaz) */
export function eksikAlanlar(k: LeadKarti, kanalTelefonu = false): BilgiAlani[] {
  return ONEMLI_ALANLAR.filter((a) => {
    if (a === "telefon" && kanalTelefonu) return false;
    const v = k[a];
    return v === undefined || v === null || v === "";
  });
}

export const ulkeAdi = (kod: string | undefined | null) => (kod ? ULKELER[kod] ?? kod : "");

/** Kart değeri → ekrandaki metin (kişisel veri: telefon / e-posta olduğu gibi; ekranı CRM ekibi görür) */
export function alanMetni(k: LeadKarti, a: BilgiAlani): string | null {
  const v = k[a];
  if (v === undefined || v === null || v === "") return null;
  if (a === "ulke_kodu") return ulkeAdi(String(v));
  if (a === "ekran_tercihi") return EKRAN_TERCIHI_ADI[v as EkranTercihi] ?? String(v);
  if (a === "aciliyet") return ACILIYET_ADI[v as Aciliyet] ?? String(v);
  return String(v);
}

/** Bozuk / eski kayda karşı: veritabanından gelen jsonb'yi kart tipine indirger (bilinmeyen anahtarlar atılır) */
export function leadKartiOku(x: unknown): LeadKarti {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const r = x as Record<string, unknown>;
  const v = ihtiyacGirdisi(Object.fromEntries(BILGI_ALANLARI.filter((a) => r[a] != null).map((a) => [a, r[a]])));
  const k: LeadKarti = v.ok ? { ...v.deger } : {};
  const skor = r.skor as LeadKarti["skor"] | undefined;
  if (skor && (LEAD_SKORLARI as readonly unknown[]).includes(skor.deger)) k.skor = { deger: skor.deger, gerekce: String(skor.gerekce ?? ""), zaman: String(skor.zaman ?? "") };
  if (r.plan && typeof r.plan === "object") k.plan = r.plan as LeadKarti["plan"];
  const demo = r.demo as LeadKarti["demo"] | undefined;
  if (demo && typeof demo === "object") k.demo = { not: String(demo.not ?? ""), zaman: String(demo.zaman ?? "") };
  const bayi = r.bayi as LeadKarti["bayi"] | undefined;
  if (bayi && typeof bayi === "object" && typeof bayi.ad === "string") k.bayi = bayi;
  if (Array.isArray(r.izinler)) {
    k.izinler = (r.izinler as BekleyenIzin[]).filter((i) => i && (IZIN_KANALLARI as readonly unknown[]).includes(i.kanal));
  }
  if (typeof r.guncelleme === "string") k.guncelleme = r.guncelleme;
  return k;
}
