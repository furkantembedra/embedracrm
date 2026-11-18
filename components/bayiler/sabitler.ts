// bayiler: istemci bileşenlerinin de kullandığı sabitler (sunucu kodu içermez; queries.ts bunları yeniden dışa açar).
import type { BayiAsamasi, HareketTuru } from "./queries";

export const ASAMALAR = ["basvuru", "degerlendirme", "sozlesme", "lansman"] as const;
export const ASAMA_BILGI: Record<BayiAsamasi, { ad: string; aciklama: string }> = {
  basvuru: { ad: "Başvuru", aciklama: "Ad, e-posta, telefon, ülke, şirket ve vergi no kaydedilir" },
  degerlendirme: { ad: "Değerlendirme", aciklama: "Bölge ve iş modeli uygunluk incelemesi" },
  sozlesme: { ad: "Sözleşme", aciklama: "Bölge hakkı, MOQ ve marka standartları" },
  lansman: { ad: "Lansman", aciklama: "İlk stok sevkiyatı ve satış başlangıcı" },
};
export const KONTROL_LISTESI = [
  { baslik: "Bölge bütünlüğü", not: "Bölgesel dağıtım hakları netleştirildi" },
  { baslik: "Minimum sipariş (MOQ)", not: "İşletme ölçeğine göre giriş seviyesi" },
  { baslik: "Marka standartları", not: "EmbedraONE marka kiti paylaşıldı" },
  { baslik: "Destek taahhüdü", not: "Teknik destek ve yerel uzmanlık ayrımı" },
] as const;
export const ULKELER: Record<string, string> = {
  // Türkiye ve yakın çevre
  TR: "Türkiye", AZ: "Azerbaycan", GE: "Gürcistan", KZ: "Kazakistan", UZ: "Özbekistan", TM: "Türkmenistan", KG: "Kırgızistan",
  // Batı ve Orta Avrupa
  DE: "Almanya", AT: "Avusturya", CH: "İsviçre", FR: "Fransa", BE: "Belçika", NL: "Hollanda", LU: "Lüksemburg",
  GB: "Birleşik Krallık", IE: "İrlanda", ES: "İspanya", PT: "Portekiz", IT: "İtalya", MT: "Malta",
  // Kuzey Avrupa
  SE: "İsveç", NO: "Norveç", DK: "Danimarka", FI: "Finlandiya", EE: "Estonya", LV: "Letonya", LT: "Litvanya",
  // Doğu Avrupa ve Balkanlar
  PL: "Polonya", CZ: "Çekya", SK: "Slovakya", HU: "Macaristan", RO: "Romanya", BG: "Bulgaristan", MD: "Moldova", UA: "Ukrayna",
  GR: "Yunanistan", CY: "Kıbrıs", SI: "Slovenya", HR: "Hırvatistan", BA: "Bosna-Hersek", RS: "Sırbistan", ME: "Karadağ",
  MK: "Kuzey Makedonya", AL: "Arnavutluk", XK: "Kosova",
  // Orta Doğu ve Kuzey Afrika
  IQ: "Irak", SA: "Suudi Arabistan", AE: "Birleşik Arap Emirlikleri", QA: "Katar", KW: "Kuveyt", JO: "Ürdün", IL: "İsrail",
  EG: "Mısır", MA: "Fas", TN: "Tunus", DZ: "Cezayir",
};
export const DESTEK_KALEMLERI = ["Kurulum", "Kullanıcı eğitimi", "Standart Teknik Destek", "Yedek parça"] as const;
export const HAREKET_ADI: Record<HareketTuru, string> = { sevkiyat: "Bayiye sevkiyat", satis: "Müşteriye satış", lisans: "Lisans satışı", iade: "Embedra'ya iade", degisim: "RMA değişimi" };

// Bölge kapsamasında her zaman listelenen ülkeler (bayi yoksa "Bayi aranıyor")
export const HEDEF_ULKELER = Object.keys(ULKELER);
