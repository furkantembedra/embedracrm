// Kanaldan bağımsız konuşmalar ve mesajlar (Supabase: konusmalar, konusma_mesajlari).
// Konuşma kanal + kanal hesabı + dış kullanıcı kimliğiyle tekildir:
//   WhatsApp:  hesap = phone_number_id,          kullanıcı = normalize telefon "+90…"
//   Instagram: hesap = Instagram hesap kimliği,  kullanıcı = IGSID (hesaba özgü)
//   Messenger: hesap = Facebook sayfa kimliği,   kullanıcı = PSID (sayfaya özgü)
// Mesajın dış kimliği (Meta wamid / mid) tüm kanallarda tekildir: aynı mesaj iki kez gelirse ikinci yazma reddedilir,
// böylece eşzamanlı iki webhook'tan yalnızca biri mesajı işler (karar ve gerekçe: 20261119090656_cok_kanal_hazirlik.sql).
import { db, sonuc } from "@/lib/supabase/db";

export const KONUSMA_KANALLARI = ["whatsapp", "instagram", "messenger"] as const;
export type Kanal = (typeof KONUSMA_KANALLARI)[number];
export type Gonderen = "musteri" | "bot" | "temsilci";

/** WhatsApp phone_number_id bilinmiyorsa (simülasyon, metadata'sız gövde) kullanılan hesap; mevcut satırlar da bununla dolduruldu */
export const VARSAYILAN_KANAL_HESABI = "varsayilan";

/**
 * Kanaldan bağımsız mesaj türleri (konusma_mesajlari.tur kısıtıyla aynı liste):
 * metin · gorsel · ses · video · dosya (belge) · hikaye_yaniti (Instagram hikâyesine yanıt) · hikaye_bahsetme (hikâyede
 * işletmeden bahsedilmesi) · paylasim (gönderi / reels / bağlantı paylaşımı) · tepki (emoji tepkisi) · yorum (gönderi
 * yorumu, P4.3) · diger (konum, kişi kartı, desteklenmeyen…; aslı ek.kaynak_tur'da).
 */
export const MESAJ_TURLERI = ["metin", "gorsel", "ses", "video", "dosya", "hikaye_yaniti", "hikaye_bahsetme", "paylasim", "tepki", "yorum", "diger"] as const;
export type MesajTuru = (typeof MESAJ_TURLERI)[number];

/**
 * konusma_mesajlari.ek (jsonb) alanları. Hepsi isteğe bağlı. Kişisel veri (telefon, ad, e-posta, konum) ve token YAZILMAZ;
 * medya bağlantıları da yazılmaz (Meta'nın imzalı, süreli adresleridir).
 */
export type MesajEki = {
  /** Kanalın kendi tür adı, ortak türe birebir karşılık gelmiyorsa (ör. WhatsApp "sticker", "location") */
  kaynak_tur?: string;
  /** Ek dosyanın MIME türü (ör. "image/jpeg", "application/pdf") */
  ek_dosya_turu?: string;
  /** Müşterinin yanıtladığı mesajın dış kimliği (WhatsApp context.id, Instagram / Messenger reply_to.mid) */
  yanitlanan_mesaj_id?: string;
  /** Instagram hikâye yanıtı / bahsetmesi: hikâyenin kimliği */
  hikaye?: { id?: string };
  /** Reklam / yönlendirme (Click-to-WhatsApp / Messenger / Instagram reklamı, m.me bağlantısı…) */
  yonlendirme?: { kaynak_turu?: string; kaynak_id?: string; reklam_id?: string; baslik?: string; govde?: string; medya_turu?: string; ref?: string; kaynak_url?: string };
};

/** Konuşmayı bulur, yoksa açar. Aynı anda iki istek açmaya çalışsa da tek kayıt kalır (unique + ignoreDuplicates). */
export async function konusmaGetirVeyaAc(
  kanal: Kanal,
  kanalHesapId: string,
  disKullaniciId: string,
): Promise<{ id: number; satisHattiId: number | null }> {
  const s = await db();
  sonuc(
    await s.from("konusmalar").upsert(
      { kanal, kanal_hesap_id: kanalHesapId, dis_kullanici_id: disKullaniciId },
      { onConflict: "kanal,kanal_hesap_id,dis_kullanici_id", ignoreDuplicates: true },
    ),
    "Konuşma açılırken",
  );
  const r = sonuc(
    await s.from("konusmalar").select("id, satis_hatti_id")
      .eq("kanal", kanal).eq("kanal_hesap_id", kanalHesapId).eq("dis_kullanici_id", disKullaniciId).single(),
    "Konuşma okunurken",
  ) as { id: number; satis_hatti_id: number | null };
  return { id: r.id, satisHattiId: r.satis_hatti_id };
}

export type YeniMesaj = {
  konusmaId: number;
  yon: "gelen" | "giden";
  gonderen: Gonderen;
  disMesajId: string | null;
  metin: string;
  tur: MesajTuru;
  ek?: MesajEki;
  zaman: string; // ISO
  satisHattiId?: number | null;
};

/**
 * Mesajı kaydeder ve kimliğini döner. Aynı dış mesaj kimliği zaten kayıtlıysa null döner:
 * Meta aynı mesajı tekrar gönderdiyse ya da iki webhook aynı anda geldiyse işi ilk yazan alır.
 */
export async function mesajKaydet(m: YeniMesaj): Promise<number | null> {
  const s = await db();
  const r = await s
    .from("konusma_mesajlari")
    .insert({
      konusma_id: m.konusmaId,
      satis_hatti_id: m.satisHattiId ?? null,
      yon: m.yon,
      gonderen: m.gonderen,
      dis_mesaj_id: m.disMesajId,
      metin: m.metin,
      tur: m.tur,
      ek: m.ek ?? {},
      zaman: m.zaman,
    })
    .select("id")
    .single();
  if (r.error?.code === "23505") return null; // dis_mesaj_id tekilliği: bu mesaj zaten işlendi / işleniyor
  return (sonuc(r, "Mesaj kaydedilirken") as { id: number }).id;
}

/** İşlenmesi yarım kalan mesajı geri alır (Meta tekrar gönderdiğinde yeniden işlenebilsin). */
export async function mesajiGeriAl(mesajId: number) {
  const s = await db();
  sonuc(await s.from("konusma_mesajlari").delete().eq("id", mesajId), "Mesaj geri alınırken");
}

/** İşlenen mesajı fırsata bağlar; konuşmanın bağlı fırsatını, müşterisini ve son müşteri mesajı zamanını günceller. */
export async function mesajiBagla(
  konusmaId: number,
  mesajId: number,
  b: { satisHattiId: number; musteriId: number | null; sonMusteriMesaji: string | null },
) {
  const s = await db();
  const konusma: Record<string, unknown> = { satis_hatti_id: b.satisHattiId };
  if (b.musteriId != null) konusma.musteri_id = b.musteriId;
  if (b.sonMusteriMesaji) konusma.son_musteri_mesaji_zamani = b.sonMusteriMesaji;
  const [m, k] = await Promise.all([
    s.from("konusma_mesajlari").update({ satis_hatti_id: b.satisHattiId }).eq("id", mesajId),
    s.from("konusmalar").update(konusma).eq("id", konusmaId),
  ]);
  sonuc(m, "Mesaj fırsata bağlanırken");
  sonuc(k, "Konuşma güncellenirken");
}
