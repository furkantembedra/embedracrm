// Bot › Ayarlar'daki sürümlü istem ayarları (P2.4): tip, varsayılanlar, doğrulama ve mesai hesabı. Saf modül: hem
// sunucuda (Server Action yeniden doğrular) hem istemcide (form anında uyarır) kullanılır.
//
// Bu alanlar botun SABİT sistem istemine girer (components/bot/istem.ts). Her "Kaydet" yeni bir sürüm açar
// (bot_istem_surumleri) ve prompt cache'i sıfırlar. Sınırlar P2.3'teki istem kaynaklarıyla aynıdır
// (scripts/bot-istem-kaynaklari.mjs): docs/'tan üretilen örnek konuşmalar + itirazlar ile bu ayarların metinleri
// birlikte en çok 40.000 karakter olabilir, ve telefon / e-posta gibi görünen satır varsa kayıt reddedilir
// (değişmez kural 7). P2.4b'de onaylanan bilgi kaynakları da (BilgiKaynagi) aynı toplamın içindedir.
import { ITIRAZLAR, ORNEK_KONUSMALAR } from "./istem-kaynaklari";

export const GUNLER = ["pzt", "sal", "car", "per", "cum", "cmt", "paz"] as const;
export type Gun = (typeof GUNLER)[number];
export const GUN_ADI: Record<Gun, string> = { pzt: "Pazartesi", sal: "Salı", car: "Çarşamba", per: "Perşembe", cum: "Cuma", cmt: "Cumartesi", paz: "Pazar" };
const GUN_KISA: Record<Gun, string> = { pzt: "Pzt", sal: "Sal", car: "Çar", per: "Per", cum: "Cum", cmt: "Cmt", paz: "Paz" };

/** Gün başına [açılış, kapanış] "HH:MM"; null ya da eksik gün: kapalı. Boş nesne: mesai tanımlı değil. */
export type MesaiSaatleri = Partial<Record<Gun, [string, string] | null>>;

/** P2.4b: onaylanmış bilgi kaynağının sürümdeki kopyası (hedef alan: bilgi bankası / itirazlar / örnek konuşmalar) */
export type BilgiKaynagi = { id: number; baslik: string; hedef: "bilgi_bankasi" | "itirazlar" | "ornek_konusmalar"; metin: string };

export type IstemAyarlari = {
  botAdi: string;
  acilisMesaji: string;
  tonNotu: string;
  /** Ek bilgi bankası (SSS, kurulum, garanti, teslim, ödeme koşulları…) */
  bilgiBankasi: string;
  /** İtirazlar ve cevapları */
  itirazlar: string;
  /** Örnek konuşmalar; birden çok konuşma "---" satırıyla ayrılır */
  ornekKonusmalar: string;
  mesaiSaatleri: MesaiSaatleri;
  /** Mesai dışında devredilen müşteriye söylenecek cevap süresi notu */
  mesaiDisiNotu: string;
};

export type MetinAlani = Exclude<keyof IstemAyarlari, "mesaiSaatleri">;

export const VARSAYILAN_AYARLAR: IstemAyarlari = {
  botAdi: "", acilisMesaji: "", tonNotu: "", bilgiBankasi: "", itirazlar: "", ornekKonusmalar: "", mesaiSaatleri: {}, mesaiDisiNotu: "",
};

/** Alan başına üst sınır (karakter); SQL kısıtlarıyla uyumlu (onlar daha geniş, kaba üst sınır) */
export const ALAN_SINIRI: Record<MetinAlani, number> = {
  botAdi: 40, acilisMesaji: 600, tonNotu: 1500, bilgiBankasi: 30_000, itirazlar: 20_000, ornekKonusmalar: 30_000, mesaiDisiNotu: 300,
};
export const ALAN_ETIKETI: Record<MetinAlani, string> = {
  botAdi: "Bot adı", acilisMesaji: "Açılış mesajı", tonNotu: "Ton notu", bilgiBankasi: "Bilgi bankası", itirazlar: "İtirazlar ve cevapları",
  ornekKonusmalar: "Örnek konuşmalar", mesaiDisiNotu: "Mesai dışı notu",
};
export const METIN_ALANLARI = Object.keys(ALAN_SINIRI) as MetinAlani[];
/** Tek satırlık alanlar (satır sonu kabul etmez) */
const TEK_SATIR: readonly MetinAlani[] = ["botAdi", "mesaiDisiNotu"];

/** İsteme giren toplam ek metin sınırı (scripts/bot-istem-kaynaklari.mjs AZAMI_TOPLAM ile aynı) */
export const AZAMI_TOPLAM = 40_000;
/** Bu oranı geçince arayüz uyarır */
export const UYARI_ORANI = 0.85;

// scripts/bot-istem-kaynaklari.mjs ile aynı ifadeler (test/bot-ayarlar.test.ts ikisinin aynı sonucu verdiğini denetler)
const TELEFON = /(?:\+|00)?\d[\d\s().-]{8,}\d/;
const EPOSTA = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i;

/** Metinde kişisel veri gibi görünen ilk satırın numarası (1'den); yoksa null */
export function kisiselVeriBul(metin: string): number | null {
  const satirlar = metin.split("\n");
  for (let i = 0; i < satirlar.length; i++) {
    if (TELEFON.test(satirlar[i]) || EPOSTA.test(satirlar[i])) return i + 1;
  }
  return null;
}

/** docs/'tan üretilen istem kaynaklarının (P2.3) karakter sayısı: toplam sınırı onlarla paylaşılır */
export const DOSYA_KAYNAK_UZUNLUGU = ORNEK_KONUSMALAR.reduce((t, o) => t + o.metin.length, 0) + (ITIRAZLAR?.length ?? 0);

/** İsteme giren ek metnin toplam uzunluğu (docs kaynakları + ayar metinleri + bilgi kaynakları) */
export function toplamUzunluk(a: IstemAyarlari, kaynaklar: readonly BilgiKaynagi[] = []): number {
  return DOSYA_KAYNAK_UZUNLUGU + METIN_ALANLARI.reduce((t, k) => t + a[k].length, 0) + kaynaklar.reduce((t, k) => t + k.metin.length, 0);
}

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;
const dakika = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

const metin = (x: unknown) => (typeof x === "string" ? x : "");
/** Kontrol karakterlerini atar, satır sonlarını \n yapar, baştaki / sondaki boşluğu kırpar */
const temizMetin = (x: unknown, tekSatir: boolean) => {
  const t = metin(x).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
  return (tekSatir ? t.replace(/\s+/g, " ") : t).trim();
};

export type AyarDenetimi = {
  /** Kayıt girdisi (temizlenmiş). Hata varsa da döner; kaydetmeden önce hatalar boş olmalı. */
  ayarlar: IstemAyarlari;
  /** alan → Türkçe hata ("mesaiSaatleri" ve "toplam" dahil) */
  hatalar: Partial<Record<MetinAlani | "mesaiSaatleri" | "toplam", string>>;
  toplam: number;
  /** Toplam sınıra yaklaştı */
  uyari: boolean;
};

/**
 * Formdan / istemciden gelen ayarı temizler ve denetler (sunucu her kayıtta yeniden çağırır).
 * kaynaklar: aktif sürümdeki bilgi kaynakları (P2.4b), toplam sınırına dahil.
 */
export function ayarlariDenetle(girdi: unknown, kaynaklar: readonly BilgiKaynagi[] = []): AyarDenetimi {
  const g = girdi && typeof girdi === "object" ? (girdi as Record<string, unknown>) : {};
  const hatalar: AyarDenetimi["hatalar"] = {};
  const ayarlar = { ...VARSAYILAN_AYARLAR, mesaiSaatleri: {} } as IstemAyarlari;
  for (const k of METIN_ALANLARI) {
    const t = temizMetin(g[k], TEK_SATIR.includes(k));
    ayarlar[k] = t;
    if (t.length > ALAN_SINIRI[k]) hatalar[k] = `${ALAN_ETIKETI[k]} en çok ${ALAN_SINIRI[k].toLocaleString("tr-TR")} karakter olabilir (şu an ${t.length.toLocaleString("tr-TR")}).`;
    else {
      const satir = kisiselVeriBul(t);
      if (satir) hatalar[k] = `${ALAN_ETIKETI[k]}, ${satir}. satır: telefon ya da e-posta gibi görünüyor. Kişisel bilgileri temizleyin.`;
    }
  }
  if (ayarlar.botAdi && /[<>{}[\]]/.test(ayarlar.botAdi)) hatalar.botAdi = "Bot adında < > { } [ ] kullanılamaz.";

  const ms = g.mesaiSaatleri && typeof g.mesaiSaatleri === "object" ? (g.mesaiSaatleri as Record<string, unknown>) : {};
  for (const gun of GUNLER) {
    const v = ms[gun];
    if (v == null) continue;
    if (!Array.isArray(v) || v.length !== 2 || !v.every((s) => typeof s === "string" && SAAT.test(s))) {
      hatalar.mesaiSaatleri = `${GUN_ADI[gun]}: saatleri SS:DD biçiminde yazın.`;
      continue;
    }
    if (dakika(v[0]) >= dakika(v[1])) {
      hatalar.mesaiSaatleri = `${GUN_ADI[gun]}: kapanış açılıştan sonra olmalı.`;
      continue;
    }
    ayarlar.mesaiSaatleri[gun] = [v[0], v[1]];
  }
  if (ayarlar.mesaiDisiNotu && !mesaiTanimli(ayarlar.mesaiSaatleri)) hatalar.mesaiSaatleri = "Mesai dışı notu için en az bir günün mesai saatini girin.";

  const toplam = toplamUzunluk(ayarlar, kaynaklar);
  if (toplam > AZAMI_TOPLAM) {
    hatalar.toplam = `İsteme giren metinler toplam ${toplam.toLocaleString("tr-TR")} karakter; sınır ${AZAMI_TOPLAM.toLocaleString("tr-TR")}. Metinleri kısaltın.`;
  }
  return { ayarlar, hatalar, toplam, uyari: toplam > AZAMI_TOPLAM * UYARI_ORANI };
}

/** Veritabanından okunan (güvenilir ama eski biçimli olabilecek) ayarı tipe çevirir; doğrulama yapmaz */
export function ayarlariOku(r: Record<string, unknown> | null | undefined): IstemAyarlari {
  if (!r) return { ...VARSAYILAN_AYARLAR, mesaiSaatleri: {} };
  const ms: MesaiSaatleri = {};
  const ham = r.mesai_saatleri && typeof r.mesai_saatleri === "object" ? (r.mesai_saatleri as Record<string, unknown>) : {};
  for (const gun of GUNLER) {
    const v = ham[gun];
    if (Array.isArray(v) && v.length === 2 && v.every((s) => typeof s === "string" && SAAT.test(s))) ms[gun] = [v[0], v[1]];
  }
  return {
    botAdi: metin(r.bot_adi), acilisMesaji: metin(r.acilis_mesaji), tonNotu: metin(r.ton_notu), bilgiBankasi: metin(r.bilgi_bankasi),
    itirazlar: metin(r.itirazlar), ornekKonusmalar: metin(r.ornek_konusmalar), mesaiSaatleri: ms, mesaiDisiNotu: metin(r.mesai_disi_notu),
  };
}

/** Veritabanındaki bilgi kaynakları dizisini tipe çevirir (P2.4b yazar) */
export function bilgiKaynaklariOku(x: unknown): BilgiKaynagi[] {
  if (!Array.isArray(x)) return [];
  const hedefler = ["bilgi_bankasi", "itirazlar", "ornek_konusmalar"];
  return x.flatMap((k) => {
    const o = k && typeof k === "object" ? (k as Record<string, unknown>) : null;
    if (!o || typeof o.metin !== "string" || !hedefler.includes(o.hedef as string)) return [];
    return [{ id: Number(o.id) || 0, baslik: metin(o.baslik).slice(0, 200), hedef: o.hedef as BilgiKaynagi["hedef"], metin: o.metin }];
  });
}

export const mesaiTanimli = (m: MesaiSaatleri) => GUNLER.some((g) => !!m[g]);

/** İstanbul saatiyle gün ve dakika (Türkiye 2016'dan beri sabit UTC+3) */
export function istanbulAni(simdi: Date): { gun: Gun; dakika: number; saat: string } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(simdi);
  const deger = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const gunler: Record<string, Gun> = { Mon: "pzt", Tue: "sal", Wed: "car", Thu: "per", Fri: "cum", Sat: "cmt", Sun: "paz" };
  const saat = `${deger("hour")}:${deger("minute")}`;
  return { gun: gunler[deger("weekday")] ?? "pzt", dakika: dakika(saat), saat };
}

/** Şu an mesai içinde mi; mesai tanımlı değilse null */
export function mesaiDurumu(m: MesaiSaatleri, simdi = new Date()): "ici" | "disi" | null {
  if (!mesaiTanimli(m)) return null;
  const a = istanbulAni(simdi);
  const s = m[a.gun];
  return s && a.dakika >= dakika(s[0]) && a.dakika < dakika(s[1]) ? "ici" : "disi";
}

/** "Pzt–Cum 09:00–18:00 · Cmt 10:00–14:00 · Paz kapalı" (ardışık aynı saatler birleştirilir) */
export function mesaiMetni(m: MesaiSaatleri): string {
  if (!mesaiTanimli(m)) return "Tanımlı değil";
  const parcalar: string[] = [];
  let i = 0;
  while (i < GUNLER.length) {
    const s = m[GUNLER[i]];
    let j = i;
    while (j + 1 < GUNLER.length && JSON.stringify(m[GUNLER[j + 1]] ?? null) === JSON.stringify(s ?? null)) j++;
    const ad = i === j ? GUN_KISA[GUNLER[i]] : `${GUN_KISA[GUNLER[i]]}–${GUN_KISA[GUNLER[j]]}`;
    parcalar.push(`${ad} ${s ? `${s[0]}–${s[1]}` : "kapalı"}`);
    i = j + 1;
  }
  return parcalar.join(" · ");
}

/** İki ayarın istemi etkileyen içeriği aynı mı (Kaydet düğmesi ve "taslak değişti" uyarısı) */
export function ayarlarEsit(a: IstemAyarlari, b: IstemAyarlari): boolean {
  return METIN_ALANLARI.every((k) => a[k] === b[k]) && GUNLER.every((g) => JSON.stringify(a.mesaiSaatleri[g] ?? null) === JSON.stringify(b.mesaiSaatleri[g] ?? null));
}
