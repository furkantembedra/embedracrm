// Botun araçları (P2.2): strict JSON şemalı tanım + sunucuda yeniden doğrulayan çalıştırıcı. tool_choice auto
// (claude-haiku-5-5'te zorlamalı araç seçimi yok; bot ne zaman çağıracağını istemden ve araç açıklamasından bilir).
// Strict şemada sayı / uzunluk kısıtı desteklenmez: sınırlar açıklamada yazılır ve ./lead-karti.ts'te yeniden denetlenir.
//
// Değişmez kurallar:
//  1  Fiyatı model değil kod hesaplar: plan_oner tutarı fiyat listesinden okur; hiçbir şemada iskonto alanı yok.
//  7  Modele dönen sonuçlarda kişisel veri yok (telefon / e-posta tekrar edilmez, eşleşen müşteri söylenmez).
//  10 Plan önerisini kod verir (enUygunPlan); bilinmeyen özellikte bot uydurmaz, devreder.
//  11 İzin otomatik verilmez: izin_kaydet yalnızca açık kabulde; kaynak kanal adaptöründen ("WhatsApp bot").
//  12 Araçlar yalnızca turun konuşmasının fırsat / müşterisine dokunur: kimlikler bağlamdan, modelden değil.
//  13 Kanal adına göre dal yok: telefon ve izin kaynağı kanal adaptöründen.
// Liste sırası sabittir (araç tanımları önbellek önekinin başındadır; değişirse ISTEM_SURUMU artırılır).
import type Anthropic from "@anthropic-ai/sdk";
import { botDevretti } from "@/components/konusma/devir";
import type { DevirSebebi } from "@/components/konusma/devir-sebepleri";
import { adaptorBul } from "@/components/konusma/kanallar";
import { IZIN_KANALLARI, IZIN_KANAL_ADI, type IzinKanali } from "@/components/musteriler/izin";
import { enUygunPlan, PLAN_SIRASI } from "@/lib/urun-bilgisi";
import type { ParaBirimi } from "@/lib/urunler";
import { supabaseAracDeposu, type AracDeposu, type AracKonusmasi } from "./arac-deposu";
import {
  ACILIYETLER, ALAN_ADI, AZAMI_CIHAZ, EKRAN_MODELI, EKRAN_TERCIHLERI, LEAD_SKORLARI, LEAD_SKORU_ADI, eksikAlanlar,
  geciciFirmaMi, ihtiyacGirdisi, ulkeAdi, type BekleyenIzin, type LeadKarti, type LeadSkoru,
} from "./lead-karti";

export type AracBaglami = {
  konusmaId: number;
  /** Testler bellek içi depo verir */
  depo?: AracDeposu;
  simdi?: () => Date;
};
export type AracSonucu = {
  /** Modele dönen kısa sonuç (kişisel veri yok) */
  icerik: string;
  hata?: boolean;
  /** Araç konuşmayı insana devretti */
  devir?: boolean;
};
export type BotAraci = {
  tanim: Anthropic.Tool;
  calistir(girdi: unknown, b: AracBaglami): Promise<AracSonucu>;
};

const hata = (icerik: string): AracSonucu => ({ icerik, hata: true });
const nesne = (g: unknown) => (g && typeof g === "object" && !Array.isArray(g) ? (g as Record<string, unknown>) : null);
const tekSatir = (x: unknown, sinir: number) =>
  typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, sinir) : "";

type Hedef = { k: AracKonusmasi; f: NonNullable<AracKonusmasi["firsat"]>; depo: AracDeposu; simdi: Date };

/** Turun konuşmasının fırsatı (değişmez kural 12); fırsat yoksa araç çalışmaz */
async function hedef(b: AracBaglami): Promise<Hedef | AracSonucu> {
  const depo = b.depo ?? supabaseAracDeposu;
  const k = await depo.konusma(b.konusmaId);
  if (!k?.firsat) return hata("Bu konuşma henüz bir satış fırsatına bağlı değil; bilgi kaydedilemedi. Sohbete devam et.");
  return { k, f: k.firsat, depo, simdi: b.simdi?.() ?? new Date() };
}
const hedefMi = (h: Hedef | AracSonucu): h is Hedef => "f" in h;

/** Kanalın verdiği telefon (WhatsApp) — kanal adına göre dal yok, adaptör söyler */
const kanalTelefonu = (k: AracKonusmasi) => adaptorBul(k.kanal)?.telefon(k.disKullaniciId) ?? null;

const eksikMetni = (kart: LeadKarti, k: AracKonusmasi) => {
  const e = eksikAlanlar(kart, !!kanalTelefonu(k));
  return e.length ? `Eksik: ${e.map((a) => ALAN_ADI[a]).join(", ")}.` : "Önemli bilgilerin hepsi alındı.";
};

/**
 * Bekleyen izinleri (fırsat müşteriye bağlıysa) eşleşen yetkiliye yazar ve karttan siler. Eşleşen yetkili yoksa
 * izin kartta bekler (satışçı müşteri kaydını açınca ya da bot telefon / e-postayla eşleştirince taşınır).
 */
async function bekleyenIzinleriTasi(h: Hedef, kart: LeadKarti, musteriId: number | null): Promise<LeadKarti> {
  if (musteriId == null || !kart.izinler?.length) return kart;
  const telefon = kanalTelefonu(h.k) ?? kart.telefon ?? h.f.telefon ?? null;
  const kalan: BekleyenIzin[] = [];
  for (const i of kart.izinler) {
    const eposta = i.kanal === "eposta";
    const y = (await h.depo.yetkiliEslestir(eposta ? null : telefon, eposta ? kart.eposta ?? null : null)).find((x) => x.musteriId === musteriId);
    if (y) await h.depo.izinYaz(y.yetkiliId, i.kanal, i.kaynak, i.tarih);
    else kalan.push(i);
  }
  if (kalan.length === kart.izinler.length) return kart;
  return h.depo.kartBirlestir(h.f.id, { izinler: kalan.length ? kalan : null });
}

/* ---------- ihtiyac_kaydet ---------- */

const metinAlani = (aciklama: string) => ({ type: "string", description: aciklama });

const ihtiyacKaydet: BotAraci = {
  tanim: {
    name: "ihtiyac_kaydet",
    description:
      "Müşterinin konuşmada söylediği bilgileri fırsatın lead kartına kaydeder. Müşteri yeni bir bilgi verdiği her seferde, yalnızca o turda öğrendiğin alanlarla çağır; bilmediğin alanı gönderme, tahmin etme ya da uydurma. Kart <baglam> içinde sana her turda gösterilir; orada yazan bilgiyi tekrar sorma. Telefon ve e-postayı teklif ya da demo için gerekçesini söyleyerek iste, ısrar etme. Ülke kodu yazıldığında sistem bölgedeki bayi durumunu kontrol eder; sonuçtaki yönergeye uy. Serbest metin alanlarını (kullanım alanı, lisans, bütçe notu) satış ekibi için Türkçe yaz; firma ve kişi adlarını olduğu gibi bırak.",
    input_schema: {
      type: "object",
      properties: {
        firma: metinAlani("Firmanın gerçek adı (en çok 120 karakter)"),
        yetkili: metinAlani("Görüştüğün kişinin adı soyadı (en çok 80 karakter)"),
        sehir: metinAlani("Şehir"),
        ulke_kodu: metinAlani("Ülkenin iki harfli ISO 3166-1 kodu, büyük harf: TR, DE, PL, AZ"),
        kullanim_alani: metinAlani("Cihazı ne için kullanacak: servis, üretim hattı, eğitim, yeniden üretim vb. (en çok 300 karakter)"),
        cihaz_adedi: { type: "integer", description: `Kaç cihaz düşündüğü (1-${AZAMI_CIHAZ})` },
        ekran_tercihi: { type: "string", enum: [...EKRAN_TERCIHLERI], description: "ekranli = ONE, ekransiz = ONE Lite, kararsiz = henüz karar vermedi" },
        lisans_ihtiyaci: metinAlani("Lisansla ilgili ihtiyacı: yeni lisans, yenileme, ek cihaz, hangi özellikler gerekli"),
        mevcut_lisans: metinAlani("Varsa elindeki Embedra cihazı / ONESuite planı ve bitiş zamanı"),
        aciliyet: { type: "string", enum: [...ACILIYETLER], description: "Ne zaman almayı düşünüyor" },
        butce_notu: metinAlani("Müşterinin bütçe hakkında söylediği (yorum ekleme, fiyat verme)"),
        telefon: metinAlani("Müşterinin verdiği telefon, ülke koduyla (+49 …)"),
        eposta: metinAlani("Müşterinin verdiği e-posta adresi"),
      },
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const v = ihtiyacGirdisi(girdi);
    if (!v.ok) return hata(v.hata);
    const h = await hedef(b);
    if (!hedefMi(h)) return h;
    const { k, f, depo, simdi } = h;
    const d = v.deger;
    const zaman = simdi.toISOString();

    let kart = await depo.kartBirlestir(f.id, { ...d, guncelleme: zaman });

    // Fırsatın görünen alanları: geçici firma adı ("+90 532 …" ya da profil adı), boş konum, eksik telefon
    const yama: { firma?: string; konum?: string; telefon?: string } = {};
    if (d.firma && geciciFirmaMi(f.firma, k.profilAdi)) yama.firma = d.firma;
    if (d.sehir || d.ulke_kodu) {
      const ulke = ulkeAdi(kart.ulke_kodu);
      const konum = [kart.sehir, ulke].filter(Boolean).join(", ");
      const mevcut = (f.konum ?? "").trim();
      if (konum && (!mevcut || mevcut === "—" || mevcut === ulke || mevcut === "Türkiye")) yama.konum = konum;
    }
    if (d.telefon && !f.telefon && !kanalTelefonu(k)) yama.telefon = d.telefon;
    await depo.firsatGuncelle(f.id, yama);

    // Mevcut müşteriyle eşleşme: fırsat o müşteriye bağlanır, yeni müşteri açılmaz
    let musteriId = f.musteriId ?? k.musteriId;
    if (musteriId == null && (d.telefon || d.eposta)) {
      const eslesen = [...new Set((await depo.yetkiliEslestir(d.telefon ?? null, d.eposta ?? null)).map((x) => x.musteriId))];
      if (eslesen.length === 1) {
        musteriId = eslesen[0];
        await depo.musteriyeBagla(k.konusmaId, f.id, musteriId);
        await depo.firsatNotu(f.id, "Bot: Telefon / e-posta kayıtlı bir müşteri yetkilisiyle eşleşti; fırsat o müşteriye bağlandı.");
      } else if (eslesen.length > 1) {
        await depo.firsatNotu(f.id, `Bot: Telefon / e-posta ${eslesen.length} farklı müşterinin yetkilisiyle eşleşti; fırsat otomatik bağlanmadı, kontrol edin.`);
      }
    }
    kart = await bekleyenIzinleriTasi(h, kart, musteriId);

    // Bayi bölgesi (kural: satışçı karar verir) — bot yönlendirmez, kartta uyarı çıkar
    let bayiNotu = "";
    if (d.ulke_kodu && kart.bayi?.ulke_kodu !== d.ulke_kodu) {
      const bayiler = await depo.munhasirBayiler(d.ulke_kodu);
      if (bayiler.length) {
        const ad = bayiler.map((x) => x.ad).join(", ");
        kart = await depo.kartBirlestir(f.id, {
          bayi: { bayi_id: bayiler[0].bayiId, ad, kapsam: bayiler[0].kapsam, ulke_kodu: d.ulke_kodu, zaman },
        });
        await depo.firsatNotu(f.id, `Bölgede münhasır bayi var: ${ad}${bayiler[0].kapsam ? ` (${bayiler[0].kapsam})` : ""}. Bayiye mi yönlendirilecek, Embedra mı satacak: satışçı karar verir.`);
      } else if (kart.bayi) {
        kart = await depo.kartBirlestir(f.id, { bayi: null });
      }
    }
    if (kart.bayi) {
      bayiNotu = " Bu ülkede yetkili bir bayi var; satış ekibi değerlendirecek. Müşteriyi bayiye yönlendirme, bayi ya da bölge hakkında söz verme; ihtiyacını anlamaya ve bilgi toplamaya devam et.";
    }

    const alanlar = Object.keys(d).map((a) => ALAN_ADI[a as keyof typeof ALAN_ADI]).join(", ");
    const atlanan = v.atlanan.length ? ` Kaydedilmeyen: ${v.atlanan.join("; ")}.` : "";
    return { icerik: `Kaydedildi: ${alanlar}.${atlanan} ${eksikMetni(kart, k)}${bayiNotu}` };
  },
};

/* ---------- lead_skoru_ver ---------- */

const leadSkoruVer: BotAraci = {
  tanim: {
    name: "lead_skoru_ver",
    description:
      "Lead'in ne kadar sıcak olduğunu satış ekibi için işaretler. sicak: ihtiyacı, adedi ve zamanı belli, kısa sürede almak istiyor ya da teklif / demo istedi. ilik: ilgili ama zamanı veya ihtiyacı belirsiz. soguk: yalnızca bilgi topluyor, alım planı yok. Konuşmada skoru değiştiren yeni bir bilgi çıktığında çağır; müşteriye skordan söz etme.",
    input_schema: {
      type: "object",
      properties: {
        skor: { type: "string", enum: [...LEAD_SKORLARI] },
        gerekce: { type: "string", description: "Satışçı için Türkçe, tek cümle gerekçe (en çok 200 karakter); kişisel bilgi ve müşteri mesajı kopyası yazma" },
      },
      required: ["skor", "gerekce"],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const g = nesne(girdi);
    const skor = (LEAD_SKORLARI as readonly unknown[]).includes(g?.skor) ? (g!.skor as LeadSkoru) : null;
    if (!skor) return hata("Geçersiz skor: sicak, ilik ya da soguk olmalı.");
    const gerekce = tekSatir(g?.gerekce, 200);
    if (!gerekce) return hata("Gerekçe boş olamaz.");
    const h = await hedef(b);
    if (!hedefMi(h)) return h;
    await h.depo.kartBirlestir(h.f.id, { skor: { deger: skor, gerekce, zaman: h.simdi.toISOString() } });
    return { icerik: `Lead skoru kaydedildi: ${LEAD_SKORU_ADI[skor]}. Müşteriye skordan söz etme.` };
  },
};

/* ---------- demo_talep_et ---------- */

/** Aynı zaman notuyla bu kadar süre içinde ikinci hatırlatma açılmaz */
const DEMO_TEKRAR_MS = 24 * 3600_000;

const demoTalepEt: BotAraci = {
  tanim: {
    name: "demo_talep_et",
    description:
      "Müşteri ürün demosu (canlı gösterim) istediğinde ya da teklif ettiğin demoyu kabul ettiğinde çağır. Satış ekibine hatırlatma açar; satış aşamasını değiştirmez, kesin randevu oluşturmaz. Çağırdıktan sonra müşteriye ekibin zamanı teyit etmek için döneceğini söyle; kesin gün / saat sözü verme.",
    input_schema: {
      type: "object",
      properties: {
        zaman_notu: {
          type: "string",
          description: "Müşterinin tercih ettiği zaman, Türkçe ve kısaca (\"perşembe öğleden sonra\", \"gelecek hafta\"); söylemediyse \"belirtilmedi\" (en çok 200 karakter)",
        },
      },
      required: ["zaman_notu"],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const not = tekSatir(nesne(girdi)?.zaman_notu, 200) || "belirtilmedi";
    const h = await hedef(b);
    if (!hedefMi(h)) return h;
    const { k, f, depo, simdi } = h;
    const onceki = f.kart.demo;
    const tekrar = onceki && onceki.not === not && simdi.getTime() - Date.parse(onceki.zaman) < DEMO_TEKRAR_MS;
    const kart = await depo.kartBirlestir(f.id, { demo: { not, zaman: simdi.toISOString() } });
    if (!tekrar) {
      await depo.firsatNotu(f.id, `Bot: Müşteri demo istedi (tercih: ${not}). Aşama otomatik değişmedi; uygunsa "Demo planlandı"ya alın.`);
      await depo.hatirlatma({
        firsatId: f.id, firma: f.firma, konusmaId: k.konusmaId, sorumluId: f.sorumluId,
        baslik: `Demo talebi: ${f.firma}`,
        aciklama: `Müşterinin tercih ettiği zaman: ${not}. Zamanı teyit edip aşamayı "Demo planlandı"ya almayı düşünün.`,
      });
    }
    const iletisim = kanalTelefonu(k) || kart.telefon || kart.eposta || f.telefon;
    const ek = iletisim ? "" : " Ekibin ulaşabilmesi için telefon ya da e-posta yok: gerekçesini söyleyerek (demo zamanını teyit etmek için) iste, ısrar etme.";
    return { icerik: `Demo talebi satış ekibine iletildi.${ek} Müşteriye ekibin zamanı teyit etmek için döneceğini söyle.` };
  },
};

/* ---------- insana_devret ---------- */

/** insana_devret'in modelin seçebileceği sebepleri (bot_hatasi ve tur_siniri döngünün kendi sebepleridir) */
export const ARAC_DEVIR_SEBEPLERI = [
  "fiyat_pazarligi", "sikayet", "ozel_fiyat", "emin_degil", "musteri_istedi", "bayi_bolgesi", "veri_silme", "diger",
] as const satisfies readonly DevirSebebi[];
// desteklenmeyen_dil SQL listesinde duruyor ama araçta yok: kullanıcı kararı (P2.3) bot her dilde müşterinin diliyle
// cevap verir, dil yüzünden devretmez.

const insanaDevret: BotAraci = {
  tanim: {
    name: "insana_devret",
    description:
      "Konuşmayı Embedra satış ekibine devreder; bundan sonra sen cevap vermezsin. Müşteri insanla görüşmek isterse, fiyat pazarlığı ya da özel fiyat isterse, şikâyet ederse, verilerinin silinmesini isterse, teknik destek gereken bir arıza anlatırsa (diger), plan_oner bilinmeyen bir özellik bildirirse ya da emin olmadığın bir şey sorulursa çağır. Dil hiçbir zaman devretme sebebi değildir. Çağırdıktan sonra müşteriye tek kısa cümleyle bir ekip arkadaşının döneceğini söyleyebilirsin.",
    input_schema: {
      type: "object",
      properties: {
        sebep: { type: "string", enum: [...ARAC_DEVIR_SEBEPLERI], description: "Devretme sebebi" },
        aciklama: {
          type: "string",
          description: "Satışçı için Türkçe, tek cümlelik kısa gerekçe (en çok 200 karakter); müşteri başka dilde yazsa da Türkçe. Müşterinin mesajını kopyalama; telefon, e-posta, ad gibi kişisel bilgi yazma.",
        },
      },
      required: ["sebep", "aciklama"],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const g = nesne(girdi);
    const sebep = (ARAC_DEVIR_SEBEPLERI as readonly unknown[]).includes(g?.sebep) ? (g!.sebep as DevirSebebi) : null;
    if (!sebep) return hata("Geçersiz sebep. Listeden bir sebep seç.");
    const aciklama = typeof g?.aciklama === "string" ? g.aciklama.slice(0, 200) : null;
    await botDevretti(b.konusmaId, sebep, aciklama);
    return { icerik: "Konuşma ekibe devredildi. İstersen müşteriye tek kısa cümleyle bir ekip arkadaşının döneceğini söyle; soru sorma.", devir: true };
  },
};

/* ---------- plan_oner ---------- */

const AZAMI_OZELLIK = 30;
const para = (n: number, pb: ParaBirimi) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: pb, maximumFractionDigits: 0 }).format(n);

const planOner: BotAraci = {
  tanim: {
    name: "plan_oner",
    description:
      "Müşterinin anlattığı işleri karşılayan en uygun ONESuite planını kod hesaplar; plan önerisini kendin yapma. Müşterinin ihtiyaçlarını sistem istemindeki özellik kataloğunun kimliklerine çevir ve cihaz adediyle çağır. Sonuçtaki planı, gerekçeyi ve bir üst planın farkını müşterinin işine bağlayarak anlat; tutar yalnızca sonuçta yazıyorsa söylenebilir, iskonto yok. Katalogda karşılığı olmayan bir ihtiyaç için kimlik uydurma: onu kimlik olarak değil olduğu gibi yaz, sistem 'bilinmeyen' diye döner; o zaman 'kontrol edip dönelim' de ve insana_devret (emin_degil) çağır.",
    input_schema: {
      type: "object",
      properties: {
        ozellik_idleri: {
          type: "array",
          items: { type: "string" },
          description: `Özellik kimlikleri (katalogdaki "kimlik" sütunu; en çok ${AZAMI_OZELLIK})`,
        },
        cihaz_adedi: { type: "integer", description: `Cihaz adedi (1-${AZAMI_CIHAZ}); bilinmiyorsa 1` },
      },
      required: ["ozellik_idleri", "cihaz_adedi"],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const g = nesne(girdi);
    const ham = Array.isArray(g?.ozellik_idleri) ? (g!.ozellik_idleri as unknown[]) : null;
    if (!ham || !ham.length) return hata("En az bir özellik kimliği gönder.");
    if (ham.length > AZAMI_OZELLIK) return hata(`En çok ${AZAMI_OZELLIK} özellik gönderilebilir.`);
    const idler = [...new Set(ham.map((x) => tekSatir(x, 60)).filter(Boolean))];
    if (!idler.length) return hata("Özellik kimlikleri metin olmalı.");
    const adet = g?.cihaz_adedi;
    if (typeof adet !== "number" || !Number.isInteger(adet) || adet < 1 || adet > AZAMI_CIHAZ) return hata(`cihaz_adedi 1-${AZAMI_CIHAZ} arası tam sayı olmalı.`);
    const h = await hedef(b);
    if (!hedefMi(h)) return h;
    const { f, depo, simdi } = h;

    const paraBirimi: ParaBirimi = f.kart.ulke_kodu && f.kart.ulke_kodu !== "TR" ? "EUR" : "TRY";
    const cihazModeli = f.kart.ekran_tercihi ? EKRAN_MODELI[f.kart.ekran_tercihi] : undefined;
    const p = enUygunPlan(idler, adet, { fiyat: await depo.fiyatListesi(), paraBirimi, cihazModeli });

    const satirlar: string[] = [];
    if (p.bilinmeyen.length) {
      satirlar.push(`Katalogda olmayan: ${p.bilinmeyen.map((x) => `"${x}"`).join(", ")}. Bunlar için uydurma; "kontrol edip dönelim" de ve insana_devret (emin_degil) çağır.`);
    }
    if (!p.oneri || !p.ozellikler.length) {
      satirlar.push("Tanınan özellik yok; plan önerilemedi.");
      return { icerik: satirlar.join("\n"), hata: !p.bilinmeyen.length };
    }
    const o = p.oneri;
    const tutar = o.yillikTutar === null ? "özel fiyat (satış ekibi iletir)" : `yıllık ${para(o.yillikTutar, o.paraBirimi)} (KDV yok)`;
    satirlar.push(`Önerilen plan: ${o.plan} × ${o.lisansAdedi} lisans, ${adet} cihaz için; ${tutar}.`);
    const enUst = Math.max(...p.ozellikler.map((x) => PLAN_SIRASI.indexOf(x.enDusukPlan)));
    const belirleyen = p.ozellikler.filter((x) => PLAN_SIRASI.indexOf(x.enDusukPlan) === enUst);
    satirlar.push(
      `Gerekçe: istenen özelliklerden ${belirleyen.map((x) => x.ad).join(", ")} en az ${PLAN_SIRASI[enUst]} planı gerektiriyor; ` +
        `kapsayan planlar içinde ${adet} cihaz için en düşük yıllık tutar ${o.plan}.`,
    );
    for (const c of p.cihazKosullari) satirlar.push(`Cihaz koşulu: ${c.ozellik.ad} yalnızca ${c.cihazlar.join(", ")} ile çalışır.`);
    if (p.modelUyumsuz) satirlar.push("Müşterinin tercih ettiği cihaz istenen özelliklerden birini desteklemiyor; bunu nazikçe belirt.");
    if (p.ustPlan) {
      const u = p.ustPlan;
      const fark = u.ekTutar === null ? "fiyatı satış ekibi iletir" : `yıllık ${para(u.ekTutar, u.paraBirimi)} fazla`;
      satirlar.push(`Bir üst seçenek: ${u.plan} × ${u.lisansAdedi}; ek olarak ${u.ekOzellikler.map((x) => x.ad).join(", ")}; ${fark}.`);
    }
    satirlar.push("Gereğinden pahalı plan önerme; öneriyi müşterinin anlattığı işe bağla.");

    await depo.kartBirlestir(f.id, {
      plan: {
        plan: o.plan, lisans_adedi: o.lisansAdedi, cihaz_adedi: adet, para_birimi: o.paraBirimi, yillik_tutar: o.yillikTutar,
        ust_plan: p.ustPlan?.plan ?? null, ust_plan_ek_tutar: p.ustPlan?.ekTutar ?? null,
        ozellikler: p.ozellikler.map((x) => x.id), zaman: simdi.toISOString(),
      },
    });
    return { icerik: satirlar.join("\n") };
  },
};

/* ---------- izin_kaydet ---------- */

const TELEFON_KANALLARI: readonly IzinKanali[] = ["whatsapp", "sms", "arama"];

const izinKaydet: BotAraci = {
  tanim: {
    name: "izin_kaydet",
    description:
      "Yalnızca müşteri, Embedra'dan pazarlama / kampanya mesajı almayı bu konuşmada AÇIKÇA kabul ettiğinde çağır (ör. \"evet, WhatsApp'tan kampanyaları gönderebilirsiniz\"). Kabul yoksa, belirsizse ya da yalnızca teklif / demo için iletişim bilgisi verdiyse çağırma; izni kendiliğinden varsayma. Her kanal için ayrı çağır. WhatsApp, SMS ve arama izni için müşterinin telefonu, e-posta izni için e-postası alınmış olmalı.",
    input_schema: {
      type: "object",
      properties: {
        kanal: { type: "string", enum: [...IZIN_KANALLARI], description: "Müşterinin izin verdiği kanal: eposta, whatsapp, sms, arama" },
      },
      required: ["kanal"],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const g = nesne(girdi);
    const kanal = (IZIN_KANALLARI as readonly unknown[]).includes(g?.kanal) ? (g!.kanal as IzinKanali) : null;
    if (!kanal) return hata("Geçersiz kanal: eposta, whatsapp, sms ya da arama olmalı.");
    const h = await hedef(b);
    if (!hedefMi(h)) return h;
    const { k, f, depo, simdi } = h;
    const a = adaptorBul(k.kanal);
    if (!a) return hata("Kanal tanınmadı; izin kaydedilmedi.");

    const telefon = kanalTelefonu(k) ?? f.kart.telefon ?? f.telefon ?? null;
    if (TELEFON_KANALLARI.includes(kanal) && !telefon) {
      return hata(`${IZIN_KANAL_ADI[kanal]} izni için müşterinin telefon numarası yok; izin kaydedilmedi. İstersen gerekçesini söyleyerek telefonunu iste, ihtiyac_kaydet ile kaydet, sonra tekrar çağır.`);
    }
    if (kanal === "eposta" && !f.kart.eposta) {
      return hata("E-posta izni için müşterinin e-posta adresi yok; izin kaydedilmedi. İstersen e-postasını iste, ihtiyac_kaydet ile kaydet, sonra tekrar çağır.");
    }

    const tarih = simdi.toISOString().slice(0, 10);
    const izin: BekleyenIzin = { kanal, kaynak: a.izinKaynagi, tarih };
    const kalan = (f.kart.izinler ?? []).filter((i) => i.kanal !== kanal);
    const kart = await depo.kartBirlestir(f.id, { izinler: [...kalan, izin] });
    await bekleyenIzinleriTasi(h, kart, f.musteriId ?? k.musteriId);
    return { icerik: `${IZIN_KANAL_ADI[kanal]} izni kaydedildi. Müşteriye teşekkür et; izni istediği zaman geri alabileceğini söyleyebilirsin.` };
  },
};

export const BOT_ARACLARI: readonly BotAraci[] = [ihtiyacKaydet, leadSkoruVer, demoTalepEt, insanaDevret, planOner, izinKaydet];

/** API'ye giden araç tanımları (sabit sıra) */
export const aracTanimlari = (): Anthropic.Tool[] => BOT_ARACLARI.map((a) => a.tanim);

/** Araç çağrısını çalıştırır; bilinmeyen araç ya da hata modele is_error olarak döner, fırlatmaz */
export async function araciCalistir(ad: string, girdi: unknown, b: AracBaglami): Promise<AracSonucu> {
  const a = BOT_ARACLARI.find((x) => x.tanim.name === ad);
  if (!a) return { icerik: `Bilinmeyen araç: ${ad.slice(0, 40)}`, hata: true };
  try {
    return await a.calistir(girdi, b);
  } catch (e) {
    console.error(`[bot] araç ${a.tanim.name} hata verdi: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
    return { icerik: "Araç çalıştırılamadı.", hata: true };
  }
}
