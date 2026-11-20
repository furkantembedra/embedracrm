// Konuşma kuyruğu: webhook hızlı döner, ağır işi işleyici yapar.
//
//   Webhook  → kuyrugaYaz(mesajlar): her mesaj tek SQL çağrısıyla kaydedilir + kuyruğa iş (public.gelen_mesaj_kaydet).
//              Aynı dis_mesaj_id ikinci kez gelirse hiçbir şey yazılmaz.
//   İşleyici → kuyruguIsle(): konuşma kilidini alır (FOR UPDATE SKIP LOCKED + süreli kilit), konuşmanın bekleyen işlerini
//              sırayla işler (./isle.ts), tur bitince `turSonrasi`nı bir kez çağırır, bot turunun zamanı geldiyse
//              (son müşteri mesajı + 6 sn, konusmalar.bot_cevap_zamani) `botTuru`nu bir kez çağırır (P2.1), kilidi bırakır. Bu arada yeni iş geldiyse kilit bırakılmaz, aynı işleyici devam eder.
//
// Aynı konuşmanın işleri asla paralel işlenmez: kilidi tek işleyici tutar; kilit süresi (KILIT_SN) her iş bitince uzar,
// işleyici çökerse süre dolunca başka işleyici devralır. Hata veren iş 30 sn × 2^deneme sonra yeniden denenir (en çok 5),
// o arada konuşmanın sonraki işleri de bekler (sıra korunur).
//
// Tetikleme (sunucusuz ortamda setTimeout / after() ile beklemeye güvenilmez):
//   • Asıl: Supabase pg_cron + pg_net 10 saniyede bir POST /api/konusma/isleyici (Bearer CRON_SECRET). Kurulum SQL'i
//     docs/BOT_KURULUM.md "Konuşma işleyicisi". Vercel Hobby cron günde bir kez çalışabildiği için bu iş için uygun değil.
//   • Hızlandırıcı: webhook kayıttan sonra after() ile işleyiciyi hemen bir kez çalıştırır. Çalışmasa da (zaman aşımı,
//     platform) iş kaybolmaz, cron alır.
//   • Geliştirme / `next start`: instrumentation.ts döngüsü 5 saniyede bir çalıştırır.
import { randomUUID } from "node:crypto";
import {
  bekleyenIsler, gelenMesajKaydet, konusmaBotTuruAl, konusmaIsiBitir, konusmaKilidiAl, konusmaKilidiBirak,
} from "@/components/konusma/queries";
import type { GelenMesaj } from "./kanallar/tur";
import { isiIsle, type IsSonucu } from "./isle";

/** Konuşma kilidinin süresi (sn). İşleyicinin tek işi bundan çok kısa sürmeli; her iş bitince yeniden uzar. */
export const KILIT_SN = 120;
/** İşleyicinin varsayılan zaman bütçesi: bundan sonra yeni konuşma almaz (route maxDuration 60 sn) */
export const VARSAYILAN_SURE_MS = 25_000;
/** Saklanan mesaj metninin üst sınırı (WhatsApp metin sınırı 4096) */
const AZAMI_METIN = 4096;

export type KaydedilenMesaj = { konusmaId: number; mesajId: number; echo: boolean };

/** Adaptörün çevirdiği mesajları kaydeder ve kuyruğa yazar; yeni yazılanları döner (tekrarlar atlanır) */
export async function kuyrugaYaz(mesajlar: GelenMesaj[]): Promise<KaydedilenMesaj[]> {
  const sonuc: KaydedilenMesaj[] = [];
  for (const m of mesajlar) {
    const r = await gelenMesajKaydet({
      kanal: m.kanal, kanalHesapId: m.kanalHesapId, disKullaniciId: m.disKullaniciId, disMesajId: m.disMesajId,
      gonderen: m.echo ? "temsilci" : "musteri", metin: (m.metin.trim() || "[mesaj]").slice(0, AZAMI_METIN),
      tur: m.tur, ek: m.ek, zaman: m.zaman, profilAdi: m.echo ? null : m.profilAdi,
    });
    if (r) sonuc.push({ ...r, echo: m.echo });
  }
  return sonuc;
}

export type TurSonrasi = (konusmaId: number, sonuclar: IsSonucu[]) => Promise<void>;
/** P2.1 bot turu (components/bot/dongu.ts): konuşmanın bot turunun zamanı geldiyse, işler bittikten sonra bir kez */
export type BotTuru = (konusmaId: number) => Promise<unknown>;

export type IsleyiciSonucu = {
  konusma: number;
  islenen: number;
  hatali: number;
  sonuclar: IsSonucu[];
  /** Çalışan bot turu sayısı */
  botTuru?: number;
};

/** Hata metni: yalnızca hata mesajı (müşteri metni içermez), kısa */
const hataMetni = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/**
 * Kuyruğu işler. `konusmaId` verilirse yalnızca o konuşmaya bakar (simülasyon). `turSonrasi` her konuşma turunun
 * sonunda, kilit hâlâ elindeyken bir kez çağrılır.
 */
export async function kuyruguIsle(o: { sureMs?: number; konusmaId?: number; turSonrasi?: TurSonrasi; botTuru?: BotTuru } = {}): Promise<IsleyiciSonucu> {
  const sahip = randomUUID();
  const bitis = Date.now() + (o.sureMs ?? VARSAYILAN_SURE_MS);
  const ozet: IsleyiciSonucu = { konusma: 0, islenen: 0, hatali: 0, sonuclar: [] };

  while (Date.now() < bitis) {
    const konusmaId = await konusmaKilidiAl(sahip, KILIT_SN, o.konusmaId, !!o.botTuru);
    if (konusmaId === null) break;
    ozet.konusma++;
    const tur: IsSonucu[] = [];
    let kilitBizde = true;

    // Kilit bizdeyken: bekleyen işleri sırayla işle → tur sonrası → bırak; bırakırken yeni iş varsa ('devam') tekrar
    for (;;) {
      let durdu = false;
      for (;;) {
        const { konusma, isler } = await bekleyenIsler(konusmaId);
        if (!isler.length || isler[0].bekliyor) break;
        for (const is of isler) {
          if (is.bekliyor) break;
          let hata: string | null = null;
          let r: IsSonucu | null = null;
          try {
            r = await isiIsle(konusma, is);
            // sonraki iş aynı turda güncel fırsatı görsün
            if (r.firsatId) konusma.satisHattiId = Number(r.firsatId);
          } catch (e) {
            hata = hataMetni(e);
            console.error(`[konuşma kuyruğu] iş ${is.id} hata verdi: ${hata}`);
          }
          kilitBizde = await konusmaIsiBitir(is.id, sahip, hata, KILIT_SN);
          if (!kilitBizde) {
            console.error(`[konuşma kuyruğu] konuşma ${konusmaId} kilidi süresi doldu, başka işleyiciye geçti`);
            break;
          }
          if (hata) {
            ozet.hatali++;
            durdu = true; // sıra korunur: hatalı işin sonrakiler tekrar denemeyi bekler
            break;
          }
          ozet.islenen++;
          tur.push(r!);
        }
        if (!kilitBizde || durdu) break;
      }
      if (!kilitBizde) break;
      if (tur.length && o.turSonrasi) {
        try {
          await o.turSonrasi(konusmaId, [...tur]);
        } catch (e) {
          console.error(`[konuşma kuyruğu] tur sonrası hata: ${hataMetni(e)}`);
        }
      }
      ozet.sonuclar.push(...tur);
      tur.length = 0;
      // Bot turu: mesaj işleri bittikten sonra (fırsat eşleşmiş, echo işlendiyse bot kapanmış olur), zamanı geldiyse.
      // Debounce SQL'de zaman damgasıyla: arka arkaya gelen mesajlar zamanı ileri iter, tur bir kez çalışır.
      if (o.botTuru && (await konusmaBotTuruAl(konusmaId, sahip))) {
        try {
          await o.botTuru(konusmaId);
          ozet.botTuru = (ozet.botTuru ?? 0) + 1;
        } catch (e) {
          console.error(`[konuşma kuyruğu] bot turu hata: ${hataMetni(e)}`);
        }
      }
      // Hatalı iş tekrar beklemesindeyse en eski iş "zamanı gelmemiş" olduğundan 'devam' dönmez, kilit bırakılır.
      // 'devam' yalnızca işlemeyi bitirmekle bırakmak arasına zamanı gelmiş yeni iş düştüyse (ya da hatalı iş son
      // denemesini tüketip 'hata'ya geçtiyse) döner: aynı kilitle devam edilir.
      if ((await konusmaKilidiBirak(konusmaId, sahip, KILIT_SN, !!o.botTuru)) !== "devam") break;
    }
    if (o.konusmaId !== undefined) break;
  }
  return ozet;
}

