// Ürün bilgi bankası: hangi ONESuite özelliği hangi planda, ve istenen özellikler için en uygun plan.
// Kural 10: plan önerisini model değil bu kod verir. Model müşterinin anlattığını özellik kimliklerine çevirir,
// enUygunPlan karar verir. Katalogda olmayan özellik sorulursa bot uydurmaz, insana devreder.
//
// Kaynak belgeler: docs/bot/ozellikler.md (var), docs/bot/uyumluluk.md ve docs/bot/sss.md (henüz yok).
// Katalog YALNIZCA bu belgelerden doldurulur; belgede olmayan özellik eklenmez.
// Fiyatlar burada tutulmaz: her zaman Operasyon › Ayarlar'daki güncel fiyat listesi (getFiyatListesi) parametre olarak verilir.

import { CIHAZ_MODELLERI, LISANS_PAKETLERI, lisansYillikFiyat, type CihazModeli, type FiyatListesi, type LisansPaketi, type ParaBirimi } from "./urunler";

/** Planlar küçükten büyüğe. Bir özellik "en düşük plan"ında ve ondan sonraki tüm planlarda vardır. */
export const PLAN_SIRASI = Object.keys(LISANS_PAKETLERI) as LisansPaketi[];

export type Ozellik = {
  /** Kalıcı kimlik (küçük harf, tire ile). Bot araçları bu kimlikle çağırır; sonradan değiştirilmez. */
  id: string;
  ad: string;
  aciklama: string;
  /** Müşterinin bu ihtiyacı anlatırken kullandığı örnek cümleler (modele çeviri için ipucu). */
  ifadeler: string[];
  /** Özelliğin dahil olduğu en düşük plan. */
  enDusukPlan: LisansPaketi;
  /** Yalnızca bu cihaz modellerinde çalışıyorsa (ör. ["ONE"]). Boş/yok = her iki cihazda da. */
  cihazlar?: CihazModeli[];
  /** Bilginin geldiği belge, ör. "docs/bot/ozellikler.md". */
  kaynak: string;
};

const KAYNAK = "docs/bot/ozellikler.md";

/**
 * Gerçek katalog: docs/bot/ozellikler.md'den birebir aktarıldı (19 Kasım 2026, kaynağı embedra.net).
 * Belgede cihazı "?" olan özellikler (ONEAssist) cevaplanana kadar burada yok.
 * "ifadeler" belgede (TASLAK) işaretli öneriler; plan kararını etkilemez, modele ipucudur.
 * test/urun-bilgisi.test.ts bu listenin belgeyle aynı olduğunu denetler; belge değişince burayı da güncelleyin.
 */
export const OZELLIK_KATALOGU: readonly Ozellik[] = [
  {
    id: "temel-direksiyon-testi",
    ad: "Temel direksiyon testi",
    aciklama: "Direksiyon ünitesini tezgâhta test etme ve onarım sonrası doğrulama. Sitedeki adı \"Basic steering test\".",
    ifadeler: ["Arada bir gelen direksiyon kutularını tezgâhta test etmek istiyorum", "Tamirden sonra kutunun çalıştığını müşteriye vermeden kontrol edeyim"],
    enDusukPlan: "Basic",
    kaynak: KAYNAK,
  },
  {
    id: "can-protokolu",
    ad: "CAN protokolü desteği",
    aciklama: "CAN haberleşmeli direksiyon ECU'larıyla çalışma.",
    ifadeler: ["Elime gelen araçların çoğu CAN'lı"],
    enDusukPlan: "Basic",
    kaynak: KAYNAK,
  },
  {
    id: "k-line-protokolu",
    ad: "K-Line protokolü desteği",
    aciklama: "K-Line haberleşmeli direksiyon ECU'larıyla çalışma.",
    ifadeler: ["Eski model araçlar da geliyor, K-Line lazım"],
    enDusukPlan: "Basic",
    kaynak: KAYNAK,
  },
  {
    id: "can-fd-protokolu",
    ad: "CAN-FD protokolü desteği",
    aciklama: "CAN-FD haberleşmeli direksiyon ECU'larıyla çalışma.",
    ifadeler: ["Yeni nesil araçlarla da çalışacak mı, CAN-FD var mı?"],
    enDusukPlan: "Pro",
    kaynak: KAYNAK,
  },
  {
    id: "flexray-protokolu",
    ad: "FlexRay protokolü desteği",
    aciklama: "FlexRay haberleşmeli direksiyon ECU'larıyla çalışma.",
    ifadeler: ["BMW/Audi'lerde FlexRay'li kutular geliyor"],
    enDusukPlan: "Pro",
    kaynak: KAYNAK,
  },
  {
    id: "ariza-teshisi",
    ad: "Arıza teşhisi (Diagnostics)",
    aciklama: "Tam arıza teşhisi: hata kodlarını okuma, yorumlama ve silme. Ana sayfa SSS'sinde \"Pro unlocks full diagnostics\" deniyor.",
    ifadeler: ["Arızanın nereden geldiğini bulmak istiyorum", "Hata kodlarını okuyup silebilecek miyim?"],
    enDusukPlan: "Pro",
    kaynak: KAYNAK,
  },
  {
    id: "canli-veri",
    ad: "Canlı veri (Live data)",
    aciklama: "ECU'dan gerçek zamanlı veri akışı: voltaj, akım, sinyaller ve hata kodları anlık izlenir.",
    ifadeler: ["Kutu çalışırken değerleri canlı görmek istiyorum", "Tork sensörü değerlerini izleyebilir miyim?"],
    enDusukPlan: "Pro",
    kaynak: KAYNAK,
  },
  {
    id: "flash",
    ad: "Flash (yazılım yükleme)",
    aciklama: "Direksiyon ECU'suna yazılım (firmware) güncelleme. Yalnızca desteklenen modellerde çalışır; liste güncellenebilir.",
    ifadeler: ["Kutuya yazılım atmam lazım", "Değişen kutuya yazılım yükleyebilir miyim?"],
    enDusukPlan: "Pro",
    kaynak: KAYNAK,
  },
  {
    id: "programlama",
    ad: "Programlama",
    aciklama: "Kalibrasyon verisi yazma ve direksiyon modülünü yeniden programlama.",
    ifadeler: ["Kalibrasyon yazmam gerekiyor"],
    enDusukPlan: "Pro",
    kaynak: KAYNAK,
  },
  {
    id: "ozel-fonksiyonlar",
    ad: "Özel fonksiyonlar",
    aciklama: "Marka ve modele özel işlemler; normalde yalnızca OEM cihazlarıyla yapılabilen görevler. Örnek: VIN yazma, EEPROM okuma/yazma, belirli hata kodlarını silme, sağ/sol direksiyon dönüşümü. Modülerdir, araca göre değişir, her güncellemeyle yenileri eklenir.",
    ifadeler: ["Kutu değişince VIN yazmam lazım", "Focus'ta U3000 hatası var, çözebiliyor musunuz?", "Sağdan direksiyonluya çevirmem gerekiyor"],
    enDusukPlan: "Pro",
    cihazlar: ["ONE"],
    kaynak: KAYNAK,
  },
  {
    id: "onarim-dokumanlari",
    ad: "Onarım dokümanları",
    aciklama: "Onarım dokümanlarına erişim. Sitede yalnızca Premium açıklamasında \"repair documents\" diye geçiyor; içeriği tarif edilmemiş.",
    ifadeler: ["Onarım adımlarını anlatan doküman var mı?"],
    enDusukPlan: "Premium",
    kaynak: KAYNAK,
  },
  {
    id: "oncelikli-destek",
    ad: "Öncelikli destek talebi",
    aciklama: "Destek taleplerine öncelik verilir.",
    ifadeler: ["Sorun olursa beklemeden destek alabilir miyim?"],
    enDusukPlan: "Premium",
    kaynak: KAYNAK,
  },
  {
    id: "hesap-yoneticisi",
    ad: "Özel hesap yöneticisi",
    aciklama: "Müşteriye atanmış bir hesap yöneticisi.",
    ifadeler: ["Distribütörüz, bizimle ilgilenecek bir muhatap istiyoruz"],
    enDusukPlan: "Enterprise",
    kaynak: KAYNAK,
  },
  {
    id: "ozel-kurulum",
    ad: "Özel cihaz sayısı ve kurulum",
    aciklama: "Cihaz sayısı, kurulum ve koşullar müşteriye göre belirlenir.",
    ifadeler: ["20 cihazlık bir servis ağımız var"],
    enDusukPlan: "Enterprise",
    kaynak: KAYNAK,
  },
  {
    id: "bilgisayarsiz-kullanim",
    ad: "Bilgisayarsız kullanım",
    aciklama: "Cihazın kendi ekranı ve sesli komutla bilgisayara bağlanmadan test yapma.",
    ifadeler: ["Her seferinde laptop bağlamak istemiyorum", "Cihaz tek başına çalışabiliyor mu?"],
    enDusukPlan: "Basic",
    cihazlar: ["ONE"],
    kaynak: KAYNAK,
  },
  {
    id: "dokunmatik-ekran",
    ad: "Dokunmatik ekran",
    aciklama: "Cihaz üzerindeki dokunmatik ekran voltajı, akımı ve bağlantı durumunu anlık gösterir.",
    ifadeler: ["Cihazın üstünde ekran var mı?"],
    enDusukPlan: "Basic",
    cihazlar: ["ONE"],
    kaynak: KAYNAK,
  },
  {
    id: "kablosuz-baglanti",
    ad: "Kablosuz ve Ethernet bağlantısı",
    aciklama: "Bilgisayara Wi-Fi, Bluetooth ya da Ethernet ile bağlanma; cihazı atölyenin başka yerinden yönetme. ONE Lite yalnızca USB-C ile bağlanır.",
    ifadeler: ["Kablo uzatmadan atölyenin öbür ucundan kullanabilir miyim?"],
    enDusukPlan: "Basic",
    cihazlar: ["ONE"],
    kaynak: KAYNAK,
  },
];

export type PlanSecenegi = {
  plan: LisansPaketi;
  /** Cihaz adedini karşılamak için gereken lisans sayısı (Enterprise gibi cihaz sınırı olmayan planda 1). */
  lisansAdedi: number;
  paraBirimi: ParaBirimi;
  /** Lisans başına yıllık ücret; null = özel fiyat (satışçı belirler). */
  birimFiyat: number | null;
  /** lisansAdedi × birimFiyat; null = özel fiyat. KDV eklenmez (lisanslar KDV'siz). */
  yillikTutar: number | null;
};

export type UstPlanFarki = PlanSecenegi & {
  /** Önerilen planda olmayıp bu planda gelen özellikler. */
  ekOzellikler: Ozellik[];
  /** Önerilen plana göre yıllık ek tutar; iki tarafın fiyatı da biliniyorsa. */
  ekTutar: number | null;
};

export type PlanOnerisi = {
  /** İstenen bilinen özelliklerin hepsini kapsayan en ucuz plan; null = hiçbir plan kapsamıyor / fiyat yok. */
  oneri: PlanSecenegi | null;
  /** Katalogda bulunmayan kimlikler. Bot bunlar için uydurmaz, insana devreder. */
  bilinmeyen: string[];
  /** Tanınan özellikler (sırasıyla). */
  ozellikler: Ozellik[];
  /** İstenen özelliklerin birlikte çalıştığı cihaz modelleri. Hepsi = koşul yok, boş = çakışma. */
  uygunCihazlar: CihazModeli[];
  /** Cihaz koşulu olan özellikler: müşteriye "bu özellik yalnızca ONE'da" denebilsin. */
  cihazKosullari: { ozellik: Ozellik; cihazlar: CihazModeli[] }[];
  /** Müşterinin belirttiği model istenen bir özelliği desteklemiyorsa true. */
  modelUyumsuz: boolean;
  /** En ucuz yükseltme: önerilen plandan fazla özellik veren üst planlar içinde yıllık tutarı en düşük olanı
   *  (ör. 7 cihazda Basic önerilince Pro × 7 değil Pro+ × 3). Özellik eklemeyen üst plan (Pro'ya göre Pro+) sayılmaz. Yoksa null. */
  ustPlan: UstPlanFarki | null;
};

export type PlanKaynagi = {
  /** Operasyon › Ayarlar'daki güncel fiyat listesi (getFiyatListesi). Zorunlu: sabit fiyat kullanılmaz. */
  fiyat: Pick<FiyatListesi, "lisans" | "eurKur">;
  /** Varsayılan TRY. EUR'da elle girilmiş EUR fiyatı, yoksa kurla çevrilmiş TL fiyatı kullanılır (lisansYillikFiyat). */
  paraBirimi?: ParaBirimi;
  /** Varsayılan OZELLIK_KATALOGU; testler sahte katalog verir. */
  katalog?: readonly Ozellik[];
  /** Müşteri belli bir modeli söylediyse; cihaz koşulu bununla karşılaştırılır. */
  cihazModeli?: CihazModeli;
};

const sira = (p: LisansPaketi) => PLAN_SIRASI.indexOf(p);

function secenek(plan: LisansPaketi, cihazAdedi: number, fiyat: PlanKaynagi["fiyat"], paraBirimi: ParaBirimi): PlanSecenegi {
  const { cihaz } = fiyat.lisans[plan];
  const birimFiyat = lisansYillikFiyat(fiyat, plan, paraBirimi);
  const lisansAdedi = cihaz === null || cihaz <= 0 ? 1 : Math.max(1, Math.ceil(cihazAdedi / cihaz));
  return { plan, lisansAdedi, paraBirimi, birimFiyat, yillikTutar: birimFiyat === null ? null : birimFiyat * lisansAdedi };
}

/**
 * İstenen tüm özellikleri kapsayan en ucuz planı bulur. Saf fonksiyon: veritabanı okumaz.
 * - Aday planlar: en yüksek "en düşük plan" ve üstü. Aralarından yıllık tutarı en düşük olan seçilir
 *   (eşitlikte küçük plan). Ör. 2 cihazda Pro (2 lisans) Pro+'dan (3 cihazlık 1 lisans) pahalıysa Pro+ önerilir.
 * - Fiyatı belli aday yoksa (yalnızca özel fiyatlı planlar kapsıyorsa) en küçük aday özel fiyatla önerilir.
 * - Bilinmeyen kimlikler `bilinmeyen`de döner, hesaba katılmaz.
 */
export function enUygunPlan(ozellikIdleri: readonly string[], cihazAdedi: number, kaynak: PlanKaynagi): PlanOnerisi {
  const katalog = kaynak.katalog ?? OZELLIK_KATALOGU;
  const paraBirimi = kaynak.paraBirimi ?? "TRY";
  const adet = Number.isFinite(cihazAdedi) ? Math.max(1, Math.ceil(cihazAdedi)) : 1;

  const ozellikler: Ozellik[] = [];
  const bilinmeyen: string[] = [];
  for (const id of new Set(ozellikIdleri)) {
    const o = katalog.find((x) => x.id === id);
    if (o) ozellikler.push(o);
    else bilinmeyen.push(id);
  }

  const cihazKosullari = ozellikler
    .filter((o) => o.cihazlar && o.cihazlar.length > 0 && o.cihazlar.length < CIHAZ_MODELLERI.length)
    .map((o) => ({ ozellik: o, cihazlar: [...o.cihazlar!] }));
  const uygunCihazlar = CIHAZ_MODELLERI.filter((m) => cihazKosullari.every((k) => k.cihazlar.includes(m)));
  const modelUyumsuz = kaynak.cihazModeli !== undefined && !uygunCihazlar.includes(kaynak.cihazModeli);

  const enAz = ozellikler.reduce((max, o) => Math.max(max, sira(o.enDusukPlan)), 0);
  const adaylar = PLAN_SIRASI.slice(enAz).map((p) => secenek(p, adet, kaynak.fiyat, paraBirimi));
  const fiyatli = adaylar.filter((a) => a.yillikTutar !== null);
  const oneri = fiyatli.length > 0
    ? fiyatli.reduce((en, a) => (a.yillikTutar! < en.yillikTutar! ? a : en))
    : (adaylar[0] ?? null);

  let ustPlan: UstPlanFarki | null = null;
  if (oneri) {
    const yukseltmeler = PLAN_SIRASI.slice(sira(oneri.plan) + 1)
      .map((p): UstPlanFarki => {
        const ust = secenek(p, adet, kaynak.fiyat, paraBirimi);
        return {
          ...ust,
          ekOzellikler: katalog.filter((o) => sira(o.enDusukPlan) > sira(oneri.plan) && sira(o.enDusukPlan) <= sira(p)),
          ekTutar: ust.yillikTutar !== null && oneri.yillikTutar !== null ? ust.yillikTutar - oneri.yillikTutar : null,
        };
      })
      .filter((u) => u.ekOzellikler.length > 0);
    const fiyatliUst = yukseltmeler.filter((u) => u.yillikTutar !== null);
    ustPlan = fiyatliUst.length > 0
      ? fiyatliUst.reduce((en, u) => (u.yillikTutar! < en.yillikTutar! ? u : en))
      : (yukseltmeler[0] ?? null);
  }

  return { oneri, bilinmeyen, ozellikler, uygunCihazlar, cihazKosullari, modelUyumsuz, ustPlan };
}

/** Katalog tutarlılığı: tekil kimlik, geçerli plan ve cihaz, boş olmayan ad ve kaynak. Hata listesi döner. */
export function katalogHatalari(katalog: readonly Ozellik[]): string[] {
  const hatalar: string[] = [];
  const gorulen = new Set<string>();
  for (const o of katalog) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.id)) hatalar.push(`${o.id}: kimlik küçük harf ve tire olmalı`);
    if (gorulen.has(o.id)) hatalar.push(`${o.id}: kimlik tekrar ediyor`);
    gorulen.add(o.id);
    if (!PLAN_SIRASI.includes(o.enDusukPlan)) hatalar.push(`${o.id}: bilinmeyen plan ${o.enDusukPlan}`);
    for (const c of o.cihazlar ?? []) if (!CIHAZ_MODELLERI.includes(c)) hatalar.push(`${o.id}: bilinmeyen cihaz ${c}`);
    if (!o.ad.trim()) hatalar.push(`${o.id}: ad boş`);
    if (!o.kaynak.trim()) hatalar.push(`${o.id}: kaynak belge yazılmamış`);
  }
  return hatalar;
}
