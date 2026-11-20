// Bot › Gelen kutusu veri katmanı. Okuma oturumdaki kullanıcının istemcisiyle (RLS: CRM ekibi); okundu bilgisi
// kullanıcı başına (konusma_okumalari, SQL: 20261119123218_gelen_kutusu.sql). Pencere ve kanal farkları adaptörden
// (components/konusma/kanallar): burada kanal adına göre dal yoktur (değişmez kural 13).
import { db, sonuc } from "@/lib/supabase/db";
import { adaptorBul, kanalListesi } from "@/components/konusma/kanallar";
import type { KapaliPencereYolu, PencereDurumu } from "@/components/konusma/kanallar/tur";
import type { Gonderen, Kanal, MesajEki } from "@/components/konusma/queries";
import { ASAMA_BILGI, type Asama } from "@/components/satis-hatti/sabitler";
import type { BotModu } from "./veri";

export type KanalBilgisi = { kanal: Kanal; ad: string; bagli: boolean };

/** Sekmeler: tüm kanallar; adaptörü olmayan kanal "bağlı değil" (Instagram P4.1, Messenger P4.2) */
export function kanalBilgileri(): KanalBilgisi[] {
  return kanalListesi().map((k) => ({ kanal: k.kanal, ad: k.ad, bagli: k.hazir }));
}

const KAPALI: PencereDurumu = { durum: "kapali", bitis: null };

/** Konuşmanın penceresi adaptörden; adaptörü olmayan kanalda gönderim yok */
export function konusmaPenceresi(kanal: string, sonMusteriMesaji: string | null, simdi = new Date()): PencereDurumu {
  return adaptorBul(kanal)?.pencere(sonMusteriMesaji, simdi) ?? KAPALI;
}

export type GelenKutusuSatiri = {
  id: number;
  kanal: Kanal;
  /** Ekranda gösterilecek ad: profil adı, yoksa fırsat adı, yoksa okunur kimlik */
  ad: string;
  /** Okunur kimlik (WhatsApp'ta telefon) */
  kimlik: string;
  /** Arama için ham kimlik (telefon / BSUID / IGSID) */
  disKullaniciId: string;
  botAktif: boolean;
  /** Bot devretti ve henüz kimse devralmadı / yazmadı: sebep kodu ("Cevap bekliyor") */
  devirSebebi: string | null;
  /** Konuşmayı devralan ("u6") */
  devralanId: string | null;
  firsatId: string | null;
  firma: string | null;
  asama: Asama | null;
  sorumluId: string | null;
  son: { id: number; metin: string; zaman: string; yon: "gelen" | "giden"; gonderen: Gonderen };
  okunmamis: number;
  pencere: PencereDurumu;
};

type ListeSatiri = {
  id: number; kanal: Kanal; kanal_hesap_id: string; dis_kullanici_id: string; dis_profil_adi: string | null; bot_aktif: boolean;
  devir_sebebi: string | null; devralan_id: number | null;
  son_musteri_mesaji_zamani: string | null; satis_hatti_id: number | null; firma: string | null; asama_kod: Asama | null;
  sorumlu_id: number | null; son_mesaj_id: number; son_metin: string; son_zaman: string; son_yon: "gelen" | "giden";
  son_gonderen: Gonderen; okunmamis: number;
};

function gorunenKimlik(kanal: string, id: string) {
  return adaptorBul(kanal)?.gorunenKimlik(id) ?? "Kanal kullanıcısı";
}

export async function gelenKutusu(simdi = new Date()): Promise<GelenKutusuSatiri[]> {
  const s = await db();
  const rows = (sonuc(await s.rpc("gelen_kutusu", { p_limit: 500 }), "Gelen kutusu okunurken") ?? []) as ListeSatiri[];
  return rows.map((r) => {
    const kimlik = gorunenKimlik(r.kanal, r.dis_kullanici_id);
    return {
      id: Number(r.id),
      kanal: r.kanal,
      ad: r.dis_profil_adi || r.firma || kimlik,
      kimlik,
      disKullaniciId: r.dis_kullanici_id,
      botAktif: r.bot_aktif,
      devirSebebi: r.devir_sebebi ?? null,
      devralanId: r.devralan_id != null ? `u${r.devralan_id}` : null,
      firsatId: r.satis_hatti_id != null ? String(r.satis_hatti_id) : null,
      firma: r.firma,
      asama: r.asama_kod,
      sorumluId: r.sorumlu_id != null ? `u${r.sorumlu_id}` : null,
      son: { id: Number(r.son_mesaj_id), metin: r.son_metin, zaman: new Date(r.son_zaman).toISOString(), yon: r.son_yon, gonderen: r.son_gonderen },
      okunmamis: Number(r.okunmamis) || 0,
      pencere: konusmaPenceresi(r.kanal, r.son_musteri_mesaji_zamani, simdi),
    };
  });
}

export type TeslimGorunumu = { durum: "gonderildi" | "iletildi" | "okundu" | "basarisiz"; zaman: string | null; hata: string | null };

export type SohbetMesaji = {
  id: number;
  yon: "gelen" | "giden";
  gonderen: Gonderen;
  /** CRM'den yazan temsilcinin adı (echo ve bot mesajında yok) */
  gonderenAd: string | null;
  metin: string;
  zaman: string;
  tur: string;
  teslim: TeslimGorunumu | null;
  demo: boolean;
  sablon: string | null;
  insanEtiketi: boolean;
  /** Bot mesajı: üretildiği turda çağrılan araçlar (bot_kullanim) */
  botAraclari: string[] | null;
};

/** Bot turu (bot_kullanim): sağ paneldeki araç geçmişi. Metin yok, yalnızca araçlar, sonuç ve kullanım. */
export type BotTuruGorunumu = {
  id: number;
  zaman: string;
  araclar: string[];
  sonuc: string;
  hataKodu: string | null;
  apiCagrisi: number;
  token: number;
  cacheOkuma: number;
  maliyetUsd: number;
  istemSurumu: string;
  model: string;
};

/** Sohbetteki sistem satırı (konusma_olaylari): kim devraldı, kim bota geri verdi, bot neden devretti */
export type SistemSatiri = {
  id: number;
  tur: "devralindi" | "bota_verildi" | "bot_devretti";
  kaynak: "dugme" | "cevap" | "kanal_disi" | null;
  kullaniciAd: string | null;
  sebep: string | null;
  aciklama: string | null;
  zaman: string;
};

export type KonusmaDetayi = {
  id: number;
  kanal: Kanal;
  kanalAd: string;
  ad: string;
  kimlik: string;
  /** Kanal telefon veriyorsa (WhatsApp): pencere kapalıyken "telefonla ulaşın" önerisi için */
  telefon: string | null;
  botAktif: boolean;
  devirSebebi: string | null;
  devralanId: string | null;
  devralanAd: string | null;
  /** Bota geri verirken yazılan, bot henüz okumamış not */
  botNotu: string | null;
  pencere: PencereDurumu;
  kapaliPencereYolu: KapaliPencereYolu;
  /** Gönderim mümkün mü (adaptör var mı) */
  kanalBagli: boolean;
  mesajlar: SohbetMesaji[];
  /** Sistem satırları (zamana göre mesajların arasına yerleşir) */
  olaylar: SistemSatiri[];
  /** Son bot turları (yeniden eskiye) */
  botGecmisi: BotTuruGorunumu[];
  firsat: {
    id: string; firma: string; asama: Asama; asamaAd: string; tutar: number; icerik: string;
    sorumluId: string | null; sorumluAd: string | null; telefon: string | null;
    notlar: { id: number; tur: string; metin: string; zaman: string }[];
  } | null;
  musteriId: string | null;
};

type MesajSatiri = {
  id: number; yon: "gelen" | "giden"; gonderen: Gonderen; metin: string; zaman: string; tur: string; ek: MesajEki | null;
  teslim_durumu: TeslimGorunumu["durum"] | null; teslim_zamani: string | null; teslim_hata_kodu: string | null;
  kullanici: { k_ad: string } | null;
  bot_tur: { araclar: string[] } | null;
};
type OlaySatiri = {
  id: number; tur: SistemSatiri["tur"]; kaynak: SistemSatiri["kaynak"]; sebep: string | null; aciklama: string | null; zaman: string;
  kullanici: { k_ad: string } | null;
};
type DetaySatiri = {
  id: number; kanal: Kanal; dis_kullanici_id: string; dis_profil_adi: string | null; bot_aktif: boolean;
  devir_sebebi: string | null; devralan_id: number | null; bot_notu: string | null; devralan: { k_ad: string } | null;
  son_musteri_mesaji_zamani: string | null; musteri_id: number | null;
  firsat: {
    id: number; f_firma: string; f_tutar: number | string | null; f_icerik: string | null; f_telefon: string | null; sorumlu_id: number | null;
    asama: { kod: Asama } | null; sorumlu: { k_ad: string } | null;
    notlar: { id: number; tur: string; metin: string; created_at: string }[] | null;
  } | null;
};

type BotTuruSatiri = {
  id: number; created_at: string; araclar: string[] | null; sonuc: string; hata_kodu: string | null; api_cagrisi: number;
  girdi_token: number; cikti_token: number; cache_yazma_token: number; cache_okuma_token: number; maliyet_usd: number | string;
  istem_surumu: string; model: string;
};
/** Sağ panelde gösterilen bot turu sayısı */
const BOT_GECMISI_SINIRI = 20;

/** Sohbette gösterilen en eski mesaj sınırı (daha eskisi P1.3 sonrası "daha fazla yükle" ile) */
const SOHBET_SINIRI = 300;

export async function konusmaDetayi(id: number, simdi = new Date()): Promise<KonusmaDetayi | null> {
  const s = await db();
  const [k, m, o, bt] = await Promise.all([
    s.from("konusmalar")
      .select(`id, kanal, dis_kullanici_id, dis_profil_adi, bot_aktif, devir_sebebi, devralan_id, bot_notu, son_musteri_mesaji_zamani, musteri_id,
        devralan:kullanicilar!konusmalar_devralan_id_fkey(k_ad),
        firsat:satis_hatti!konusmalar_satis_hatti_id_fkey(id, f_firma, f_tutar, f_icerik, f_telefon, sorumlu_id,
          asama:asama!satis_hatti_asama_id_fkey(kod), sorumlu:kullanicilar!satis_hatti_sorumlu_id_fkey(k_ad),
          notlar:firsat_notlari(id, tur, metin, created_at))`)
      .eq("id", id)
      .order("created_at", { ascending: false, referencedTable: "firsat.notlar" }).limit(10, { referencedTable: "firsat.notlar" })
      .maybeSingle(),
    s.from("konusma_mesajlari")
      .select(`id, yon, gonderen, metin, zaman, tur, ek, teslim_durumu, teslim_zamani, teslim_hata_kodu,
        kullanici:kullanicilar!konusma_mesajlari_gonderen_kullanici_id_fkey(k_ad),
        bot_tur:bot_kullanim!konusma_mesajlari_bot_kullanim_id_fkey(araclar)`)
      .eq("konusma_id", id).order("zaman", { ascending: false }).order("id", { ascending: false }).limit(SOHBET_SINIRI),
    s.from("konusma_olaylari")
      .select("id, tur, kaynak, sebep, aciklama, zaman, kullanici:kullanicilar!konusma_olaylari_kullanici_id_fkey(k_ad)")
      .eq("konusma_id", id).order("zaman", { ascending: false }).order("id", { ascending: false }).limit(SOHBET_SINIRI),
    s.from("bot_kullanim")
      .select("id, created_at, araclar, sonuc, hata_kodu, api_cagrisi, girdi_token, cikti_token, cache_yazma_token, cache_okuma_token, maliyet_usd, istem_surumu, model")
      .eq("konusma_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(BOT_GECMISI_SINIRI),
  ]);
  const turlar = (sonuc(bt, "Bot araç geçmişi okunurken") ?? []) as BotTuruSatiri[];
  const ks = sonuc(k, "Konuşma okunurken") as unknown as DetaySatiri | null;
  if (!ks) return null;
  const satirlar = (sonuc(m, "Mesajlar okunurken") ?? []) as unknown as MesajSatiri[];
  const olaySatirlari = (sonuc(o, "Sistem satırları okunurken") ?? []) as unknown as OlaySatiri[];
  // Gösterilen en eski mesajdan önceki sistem satırları da gösterilmez (sohbet sınırı)
  const enEski = satirlar.length >= SOHBET_SINIRI ? satirlar.at(-1)!.zaman : null;
  const a = adaptorBul(ks.kanal);
  const ad = kanalListesi().find((x) => x.kanal === ks.kanal)?.ad ?? ks.kanal;
  const kimlik = gorunenKimlik(ks.kanal, ks.dis_kullanici_id);
  const f = ks.firsat;
  const asama: Asama = f?.asama?.kod ?? "yeni";
  return {
    id: ks.id,
    kanal: ks.kanal,
    kanalAd: ad,
    ad: ks.dis_profil_adi || f?.f_firma || kimlik,
    kimlik,
    telefon: a?.telefon(ks.dis_kullanici_id) ?? null,
    botAktif: ks.bot_aktif,
    devirSebebi: ks.devir_sebebi ?? null,
    devralanId: ks.devralan_id != null ? `u${ks.devralan_id}` : null,
    devralanAd: ks.devralan?.k_ad ?? null,
    botNotu: ks.bot_notu ?? null,
    pencere: konusmaPenceresi(ks.kanal, ks.son_musteri_mesaji_zamani, simdi),
    kapaliPencereYolu: a?.kapaliPencereYolu ?? "baska_kanal",
    kanalBagli: !!a,
    mesajlar: satirlar.reverse().map((x) => ({
      id: Number(x.id),
      yon: x.yon,
      gonderen: x.gonderen,
      gonderenAd: x.kullanici?.k_ad ?? null,
      metin: x.metin,
      zaman: new Date(x.zaman).toISOString(),
      tur: x.tur,
      teslim: x.teslim_durumu
        ? { durum: x.teslim_durumu, zaman: x.teslim_zamani, hata: x.teslim_durumu === "basarisiz" ? (a?.hataAciklamasi(x.teslim_hata_kodu) ?? "Gönderilemedi.") : null }
        : null,
      demo: !!x.ek?.demo,
      sablon: x.ek?.sablon?.ad ?? null,
      insanEtiketi: !!x.ek?.insan_etiketi,
      botAraclari: x.gonderen === "bot" && x.bot_tur ? x.bot_tur.araclar ?? [] : null,
    })),
    olaylar: olaySatirlari
      .filter((x) => !enEski || Date.parse(x.zaman) >= Date.parse(enEski))
      .reverse()
      .map((x) => ({
        id: Number(x.id), tur: x.tur, kaynak: x.kaynak, kullaniciAd: x.kullanici?.k_ad ?? null, sebep: x.sebep, aciklama: x.aciklama,
        zaman: new Date(x.zaman).toISOString(),
      })),
    botGecmisi: turlar.map((t) => ({
      id: Number(t.id), zaman: new Date(t.created_at).toISOString(), araclar: t.araclar ?? [], sonuc: t.sonuc, hataKodu: t.hata_kodu,
      apiCagrisi: t.api_cagrisi, token: t.girdi_token + t.cikti_token + t.cache_yazma_token + t.cache_okuma_token,
      cacheOkuma: t.cache_okuma_token, maliyetUsd: Number(t.maliyet_usd), istemSurumu: t.istem_surumu, model: t.model,
    })),
    firsat: f
      ? {
          id: String(f.id), firma: f.f_firma, asama, asamaAd: ASAMA_BILGI[asama].ad, tutar: Number(f.f_tutar ?? 0), icerik: f.f_icerik ?? "",
          sorumluId: f.sorumlu_id != null ? `u${f.sorumlu_id}` : null, sorumluAd: f.sorumlu?.k_ad ?? null, telefon: f.f_telefon,
          notlar: (f.notlar ?? []).map((n) => ({ id: Number(n.id), tur: n.tur, metin: n.metin, zaman: new Date(n.created_at).toISOString() })),
        }
      : null,
    musteriId: ks.musteri_id != null ? String(ks.musteri_id) : null,
  };
}

/** Okundu işareti (kullanıcı başına, geri gitmez) */
export async function okunduYaz(konusmaId: number, mesajId: number) {
  const s = await db();
  sonuc(await s.rpc("konusma_okundu", { p_konusma_id: konusmaId, p_mesaj_id: mesajId }), "Okundu işaretlenirken");
}

/** Fırsatın sorumlusu (konuşmanın atanmış kişisi) */
export async function firsatSorumlusuYaz(firsatId: number, kullaniciId: number | null) {
  const s = await db();
  sonuc(await s.from("satis_hatti").update({ sorumlu_id: kullaniciId }).eq("id", firsatId), "Sorumlu kaydedilirken");
}

/* ---------------- Bot › Kanallar (P1.3: yeni konuşmada bot; P2.4 bot modu vb. ekler) ---------------- */

export type KanalAyari = { kanal: Kanal; yeniKonusmadaBot: boolean; botModu: BotModu; guncelleme: string | null };

export async function kanalAyarlari(): Promise<KanalAyari[]> {
  const s = await db();
  const r = (sonuc(await s.from("kanal_ayarlari").select("kanal, yeni_konusmada_bot, bot_modu, updated_at").order("kanal"), "Kanal ayarları okunurken") ?? []) as
    { kanal: Kanal; yeni_konusmada_bot: boolean; bot_modu: BotModu; updated_at: string | null }[];
  return r.map((x) => ({ kanal: x.kanal, yeniKonusmadaBot: x.yeni_konusmada_bot, botModu: x.bot_modu ?? "kapali", guncelleme: x.updated_at }));
}

/** Kanal ayarı: yeni konuşmada bot ve / veya bot modu (yalnızca Yönetici; RLS de denetler: başkası güncelleyemez → hata) */
export async function kanalAyariYaz(kanal: string, a: { yeniKonusmadaBot?: boolean; botModu?: BotModu }, kullaniciId: number | null) {
  const s = await db();
  const r = sonuc(
    await s.from("kanal_ayarlari")
      .update({
        ...(a.yeniKonusmadaBot !== undefined ? { yeni_konusmada_bot: a.yeniKonusmadaBot } : {}),
        ...(a.botModu !== undefined ? { bot_modu: a.botModu } : {}),
        guncelleyen_id: kullaniciId, updated_at: new Date().toISOString(),
      })
      .eq("kanal", kanal).select("kanal"),
    "Kanal ayarı kaydedilirken",
  ) as { kanal: string }[];
  if (!r.length) throw new Error("Kanal ayarı kaydedilemedi (yetki ya da kanal yok).");
}
