// Bot döngüsünün veri katmanı (Supabase). İşleyici gizli anahtarla (sistemOlarak), geliştirme simülasyonu CRM
// kullanıcısıyla çalışır; ikisinde de aynı sorgular. Modele gidecek veri burada en aza indirilir (değişmez kural 7):
// telefon ve profil adı modele gitmez (dış kullanıcı kimliği yalnızca "kanal telefon veriyor mu" için okunur); lead
// kartında firma adı telefon gibi görünüyorsa atılır, kartın telefon / e-postası istemde yalnızca "alındı" olur.
import { db, sonuc } from "@/lib/supabase/db";
import type { Kanal, MesajEki } from "@/components/konusma/queries";
import { ASAMA_BILGI, type Asama } from "@/components/satis-hatti/sabitler";
import type { IstemMesaji, LeadOzeti } from "./istem";
import { adaptorBul } from "@/components/konusma/kanallar";
import { kimlikGibi, leadKartiOku } from "./lead-karti";
import { BOT_SON_MESAJ, VARSAYILAN_GUNLUK_MALIYET_USD, VARSAYILAN_TUR_SINIRI } from "./yapilandirma";

export type BotModu = "kapali" | "golge" | "otomatik";
export const BOT_MODLARI: readonly BotModu[] = ["kapali", "golge", "otomatik"];

export type BotBaglami = {
  id: number;
  kanal: Kanal;
  botAktif: boolean;
  /** Bot yalnızca bundan sonra gelen müşteri mesajlarına cevap verir (P1.3) */
  botDurumuZamani: string;
  sonMusteriMesaji: string | null;
  /** Son mesajlar, eskiden yeniye; olusturma: sunucunun mesajı kaydettiği an */
  mesajlar: (IstemMesaji & { id: number; olusturma: string })[];
  lead: LeadOzeti | null;
};

type KonusmaSatiri = {
  id: number; kanal: Kanal; bot_aktif: boolean; bot_durumu_zamani: string; son_musteri_mesaji_zamani: string | null; dis_kullanici_id: string;
  firsat: { f_firma: string | null; f_konum: string | null; f_icerik: string | null; lead_karti: unknown; asama: { kod: Asama } | null } | null;
};
type MesajSatiri = { id: number; gonderen: IstemMesaji["gonderen"]; metin: string; tur: string; zaman: string; created_at: string; ek: MesajEki | null };


export async function botBaglamiOku(konusmaId: number): Promise<BotBaglami | null> {
  const s = await db();
  const [k, m] = await Promise.all([
    s.from("konusmalar")
      .select(`id, kanal, bot_aktif, bot_durumu_zamani, son_musteri_mesaji_zamani, dis_kullanici_id,
        firsat:satis_hatti!konusmalar_satis_hatti_id_fkey(f_firma, f_konum, f_icerik, lead_karti, asama:asama!satis_hatti_asama_id_fkey(kod))`)
      .eq("id", konusmaId).maybeSingle(),
    s.from("konusma_mesajlari").select("id, gonderen, metin, tur, zaman, created_at, ek")
      .eq("konusma_id", konusmaId).order("zaman", { ascending: false }).order("id", { ascending: false }).limit(BOT_SON_MESAJ),
  ]);
  const ks = sonuc(k, "Bot için konuşma okunurken") as unknown as KonusmaSatiri | null;
  if (!ks) return null;
  const satirlar = (sonuc(m, "Bot için mesajlar okunurken") ?? []) as MesajSatiri[];
  const f = ks.firsat;
  const firma = f?.f_firma?.trim() || null;
  const konum = f?.f_konum?.trim() || null;
  return {
    id: Number(ks.id),
    kanal: ks.kanal,
    botAktif: ks.bot_aktif,
    botDurumuZamani: new Date(ks.bot_durumu_zamani).toISOString(),
    sonMusteriMesaji: ks.son_musteri_mesaji_zamani,
    mesajlar: satirlar.reverse().map((x) => ({
      id: Number(x.id), gonderen: x.gonderen, metin: x.metin, tur: x.tur, ek: x.ek,
      zaman: new Date(x.zaman).toISOString(), olusturma: new Date(x.created_at).toISOString(),
    })),
    lead: f
      ? {
          firma: firma && !kimlikGibi(firma) ? firma : null,
          konum: konum && konum !== "—" ? konum : null,
          asama: f.asama?.kod ? ASAMA_BILGI[f.asama.kod]?.ad ?? null : null,
          ilgi: f.f_icerik?.trim() && f.f_icerik.trim() !== "Ürün belirlenmedi" ? f.f_icerik.trim() : null,
          kart: leadKartiOku(f.lead_karti),
          // Telefonun kendisi modele gitmez; yalnızca kanalın verip vermediği (eksikler listesi için)
          kanalTelefonu: !!adaptorBul(ks.kanal)?.telefon(ks.dis_kullanici_id),
        }
      : null,
  };
}

/** Konuşmada bot hâlâ açık mı (tur sırasında temsilci devralmış olabilir) */
export async function botAktifMi(konusmaId: number): Promise<boolean> {
  const s = await db();
  const r = sonuc(await s.from("konusmalar").select("bot_aktif").eq("id", konusmaId).maybeSingle(), "Bot durumu okunurken") as { bot_aktif: boolean } | null;
  return !!r?.bot_aktif;
}

export type BotAyarlari = { acilDurdurma: boolean; gunlukMaliyetSiniriUsd: number; turSiniri: number; guncelleme: string | null };

export async function botAyarlariOku(): Promise<BotAyarlari> {
  const s = await db();
  const r = sonuc(
    await s.from("bot_ayarlari").select("acil_durdurma, gunluk_maliyet_siniri_usd, tur_siniri, updated_at").eq("id", 1).maybeSingle(),
    "Bot ayarları okunurken",
  ) as { acil_durdurma: boolean; gunluk_maliyet_siniri_usd: number | string; tur_siniri: number; updated_at: string } | null;
  // Satır yoksa güvenli taraf: acil durdurma açık sayılır (bot çağrılmaz)
  if (!r) return { acilDurdurma: true, gunlukMaliyetSiniriUsd: VARSAYILAN_GUNLUK_MALIYET_USD, turSiniri: VARSAYILAN_TUR_SINIRI, guncelleme: null };
  return { acilDurdurma: r.acil_durdurma, gunlukMaliyetSiniriUsd: Number(r.gunluk_maliyet_siniri_usd), turSiniri: r.tur_siniri, guncelleme: r.updated_at };
}

/** Bot ayarlarını yazar (yalnızca Yönetici; RLS de denetler) */
export async function botAyarlariYaz(a: Omit<BotAyarlari, "guncelleme">, kullaniciId: number | null) {
  const s = await db();
  const r = sonuc(
    await s.from("bot_ayarlari").update({
      acil_durdurma: a.acilDurdurma, gunluk_maliyet_siniri_usd: a.gunlukMaliyetSiniriUsd, tur_siniri: a.turSiniri,
      guncelleyen_id: kullaniciId, updated_at: new Date().toISOString(),
    }).eq("id", 1).select("id"),
    "Bot ayarları kaydedilirken",
  ) as { id: number }[];
  if (!r.length) throw new Error("Bot ayarları kaydedilemedi (yetki yok).");
}

/** Kanalın bot modu; satır yoksa kapali */
export async function kanalBotModu(kanal: Kanal): Promise<BotModu> {
  const s = await db();
  const r = sonuc(await s.from("kanal_ayarlari").select("bot_modu").eq("kanal", kanal).maybeSingle(), "Kanal bot modu okunurken") as { bot_modu: BotModu } | null;
  return r?.bot_modu && BOT_MODLARI.includes(r.bot_modu) ? r.bot_modu : "kapali";
}

/** İstanbul gününün başlangıcı (UTC ISO). Türkiye 2016'dan beri sabit UTC+3. */
export function istanbulGunBasi(simdi = new Date()): string {
  const gun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(simdi); // 2026-11-20
  return new Date(`${gun}T00:00:00+03:00`).toISOString();
}

/** Bugünkü (İstanbul günü) toplam bot maliyeti, USD */
export async function gunlukMaliyet(simdi = new Date()): Promise<number> {
  const s = await db();
  const r = (sonuc(
    await s.from("bot_kullanim").select("maliyet_usd").gte("created_at", istanbulGunBasi(simdi)).limit(100_000),
    "Günlük bot maliyeti okunurken",
  ) ?? []) as { maliyet_usd: number | string }[];
  return r.reduce((t, x) => t + Number(x.maliyet_usd), 0);
}

/** Konuşmada bot son açıldığından beri (bot_durumu_zamani) kaç tur çalıştı */
export async function turSayisi(konusmaId: number, beri: string): Promise<number> {
  const s = await db();
  const r = await s.from("bot_kullanim").select("id", { count: "exact", head: true }).eq("konusma_id", konusmaId).gt("created_at", beri);
  if (r.error) throw new Error(`Bot tur sayısı okunurken başarısız: ${r.error.message}`);
  return r.count ?? 0;
}

export type BotKullanimKaydi = {
  konusmaId: number;
  kanal: Kanal;
  model: string;
  effort: string;
  istemSurumu: string;
  apiCagrisi: number;
  girdi: number;
  cikti: number;
  cacheYazma: number;
  cacheOkuma: number;
  maliyetUsd: number;
  araclar: string[];
  sonuc: "cevap" | "devir" | "sessiz" | "iptal" | "hata" | "red";
  hataKodu: string | null;
  sureMs: number;
};

/** Tur kaydı (metin ve kişisel veri yok); kimliğini döner */
export async function botKullanimYaz(k: BotKullanimKaydi): Promise<number> {
  const s = await db();
  const r = sonuc(
    await s.from("bot_kullanim").insert({
      konusma_id: k.konusmaId, kanal: k.kanal, model: k.model, effort: k.effort, istem_surumu: k.istemSurumu,
      api_cagrisi: k.apiCagrisi, girdi_token: k.girdi, cikti_token: k.cikti, cache_yazma_token: k.cacheYazma,
      cache_okuma_token: k.cacheOkuma, maliyet_usd: k.maliyetUsd, araclar: k.araclar.slice(0, 50), sonuc: k.sonuc,
      hata_kodu: k.hataKodu?.slice(0, 60) ?? null, sure_ms: Math.max(0, Math.round(k.sureMs)),
    }).select("id").single(),
    "Bot kullanımı yazılırken",
  ) as { id: number };
  return Number(r.id);
}

/** Botun gönderdiği mesajları turuna bağlar (araç geçmişi) */
export async function botMesajlariniBagla(mesajIdleri: number[], botKullanimId: number) {
  if (!mesajIdleri.length) return;
  const s = await db();
  sonuc(await s.from("konusma_mesajlari").update({ bot_kullanim_id: botKullanimId }).in("id", mesajIdleri).eq("gonderen", "bot"), "Bot mesajı tura bağlanırken");
}
