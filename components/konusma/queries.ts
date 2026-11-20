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
  /** Giden mesaj demo modunda kaydedildi: kanal anahtarı olmadığı için gönderilmedi */
  demo?: true;
  /** Giden mesaj onaylı şablonla gönderildi (WhatsApp, pencere kapalıyken) */
  sablon?: { ad: string; dil: string };
  /** Temsilci, kanalın insan etiketiyle (HUMAN_AGENT) gönderdi */
  insan_etiketi?: true;
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
 * Giden mesajı (CRM'den temsilci ya da bot) kaydeder ve kimliğini döner. Kanalın verdiği dış kimlikle yazılır; böylece
 * aynı mesajın echo'su webhook'tan gelirse dis_mesaj_id tekilliği onu ikinci kez yazmaz. Echo bizden önce yazılmışsa
 * (yarış) mevcut satır gönderenimizle düzeltilir ve onun kimliği döner.
 */
export async function gidenMesajKaydet(
  m: Omit<YeniMesaj, "yon"> & { gonderen: "bot" | "temsilci"; /** CRM'den yazan temsilci (kullanicilar.id) */ gonderenKullaniciId?: number | null },
): Promise<number> {
  const s = await db();
  const kullanici = m.gonderen === "temsilci" ? m.gonderenKullaniciId ?? null : null;
  const satir = {
    konusma_id: m.konusmaId, satis_hatti_id: m.satisHattiId ?? null, yon: "giden", gonderen: m.gonderen,
    dis_mesaj_id: m.disMesajId, metin: m.metin, tur: m.tur, ek: m.ek ?? {}, zaman: m.zaman, gonderen_kullanici_id: kullanici,
  };
  const r = await s.from("konusma_mesajlari").insert(satir).select("id").single();
  if (r.error?.code === "23505" && m.disMesajId) {
    const g = await s.from("konusma_mesajlari").update({ gonderen: m.gonderen, gonderen_kullanici_id: kullanici }).eq("dis_mesaj_id", m.disMesajId).select("id").single();
    return (sonuc(g, "Giden mesaj düzeltilirken") as { id: number }).id;
  }
  return (sonuc(r, "Mesaj kaydedilirken") as { id: number }).id;
}

/* ---------------- Kuyruk (konusma_isleri) ve konuşma kilidi: SQL tarafı 20261119100706_konusma_kuyrugu.sql ---------------- */

export type GelenKayit = {
  kanal: Kanal;
  kanalHesapId: string;
  disKullaniciId: string;
  disMesajId: string;
  gonderen: "musteri" | "temsilci";
  metin: string;
  tur: MesajTuru;
  ek: MesajEki;
  zaman: string;
  profilAdi?: string | null;
};

/**
 * Webhook: konuşmayı bul / aç, mesajı yaz, kuyruğa iş ekle (tek işlem, tek istek). Aynı dis_mesaj_id zaten kayıtlıysa
 * hiçbir şey yazılmaz ve null döner (Meta'nın tekrarı, eşzamanlı iki webhook, kendi mesajımızın echo'su).
 */
export async function gelenMesajKaydet(m: GelenKayit): Promise<{ konusmaId: number; mesajId: number } | null> {
  const s = await db();
  const r = sonuc(
    await s.rpc("gelen_mesaj_kaydet", {
      p_kanal: m.kanal, p_kanal_hesap_id: m.kanalHesapId, p_dis_kullanici_id: m.disKullaniciId, p_dis_mesaj_id: m.disMesajId,
      p_gonderen: m.gonderen, p_metin: m.metin, p_tur: m.tur, p_ek: m.ek ?? {}, p_zaman: m.zaman, p_profil_adi: m.profilAdi ?? null,
    }),
    "Gelen mesaj kaydedilirken",
  ) as { konusma_id: number; mesaj_id: number }[] | null;
  const satir = r?.[0];
  return satir ? { konusmaId: Number(satir.konusma_id), mesajId: Number(satir.mesaj_id) } : null;
}

/**
 * Zamanı gelmiş işi olan kilitsiz bir konuşmayı kilitler (yoksa null). konusmaId verilirse yalnızca ona bakar.
 * bot: işleyici bot turunu çalıştırabiliyorsa true; o zaman bot turunun zamanı gelmiş konuşmalar da alınır.
 */
export async function konusmaKilidiAl(sahip: string, sureSn: number, konusmaId?: number, bot = false): Promise<number | null> {
  const s = await db();
  const r = sonuc(
    await s.rpc("konusma_kilidi_al", { p_sahip: sahip, p_sure_sn: sureSn, p_konusma_id: konusmaId ?? null, p_bot: bot }),
    "Konuşma kilidi alınırken",
  ) as number | string | null;
  return r == null ? null : Number(r);
}

/** İşi tamam / hatalı işaretler ve kilidi uzatır. Kilit artık bizde değilse false. */
export async function konusmaIsiBitir(isId: number, sahip: string, hata: string | null, sureSn: number): Promise<boolean> {
  const s = await db();
  return sonuc(
    await s.rpc("konusma_isi_bitir", { p_is_id: isId, p_sahip: sahip, p_hata: hata, p_sure_sn: sureSn }),
    "Kuyruk işi bitirilirken",
  ) as boolean;
}

/**
 * Bot turunu üstlenir: kilit bizdeyken konuşmanın bot turunun zamanı (son müşteri mesajı + 6 sn) geldiyse zamanı siler
 * ve true döner; tur böylece bir kez çalışır (SQL: 20261120090000_bot_dongusu.sql).
 */
export async function konusmaBotTuruAl(konusmaId: number, sahip: string): Promise<boolean> {
  const s = await db();
  return sonuc(await s.rpc("konusma_bot_turu_al", { p_konusma_id: konusmaId, p_sahip: sahip }), "Bot turu alınırken") as boolean;
}

/** Kilidi bırakır: 'birakildi' | 'devam' (yeni iş geldi, kilit bizde kaldı) | 'kayip' (kilit başkasına geçmiş) */
export async function konusmaKilidiBirak(konusmaId: number, sahip: string, sureSn: number, bot = false): Promise<"birakildi" | "devam" | "kayip"> {
  const s = await db();
  return sonuc(
    await s.rpc("konusma_kilidi_birak", { p_konusma_id: konusmaId, p_sahip: sahip, p_sure_sn: sureSn, p_bot: bot }),
    "Konuşma kilidi bırakılırken",
  ) as "birakildi" | "devam" | "kayip";
}

export type KuyrukKonusmasi = {
  id: number;
  kanal: Kanal;
  kanalHesapId: string;
  disKullaniciId: string;
  satisHattiId: number | null;
  musteriId: number | null;
  profilAdi: string | null;
  sonMusteriMesaji: string | null;
};
export type KuyrukIsi = {
  id: number;
  tur: "musteri_mesaji" | "temsilci_mesaji";
  /** Zamanı gelmemiş tekrar denemesi: işleyici burada durur (sıra korunur) */
  bekliyor: boolean;
  mesaj: { id: number; metin: string; zaman: string; satisHattiId: number | null };
};

/** Kilitli konuşmanın bilgisi ve bekleyen işleri (eskiden yeniye) */
export async function bekleyenIsler(konusmaId: number): Promise<{ konusma: KuyrukKonusmasi; isler: KuyrukIsi[] }> {
  const s = await db();
  const [k, i] = await Promise.all([
    s.from("konusmalar")
      .select("id, kanal, kanal_hesap_id, dis_kullanici_id, satis_hatti_id, musteri_id, dis_profil_adi, son_musteri_mesaji_zamani")
      .eq("id", konusmaId).single(),
    s.from("konusma_isleri")
      .select("id, tur, sonraki_deneme, mesaj:konusma_mesajlari!konusma_isleri_mesaj_id_fkey(id, metin, zaman, satis_hatti_id)")
      .eq("konusma_id", konusmaId).eq("durum", "bekliyor").order("id").limit(50),
  ]);
  const ks = sonuc(k, "Konuşma okunurken") as {
    id: number; kanal: Kanal; kanal_hesap_id: string; dis_kullanici_id: string; satis_hatti_id: number | null;
    musteri_id: number | null; dis_profil_adi: string | null; son_musteri_mesaji_zamani: string | null;
  };
  const satirlar = (sonuc(i, "Kuyruk okunurken") ?? []) as unknown as {
    id: number; tur: KuyrukIsi["tur"]; sonraki_deneme: string; mesaj: { id: number; metin: string; zaman: string; satis_hatti_id: number | null };
  }[];
  const simdi = Date.now();
  return {
    konusma: {
      id: ks.id, kanal: ks.kanal, kanalHesapId: ks.kanal_hesap_id, disKullaniciId: ks.dis_kullanici_id,
      satisHattiId: ks.satis_hatti_id, musteriId: ks.musteri_id, profilAdi: ks.dis_profil_adi, sonMusteriMesaji: ks.son_musteri_mesaji_zamani,
    },
    isler: satirlar.map((x) => ({
      id: x.id, tur: x.tur, bekliyor: Date.parse(x.sonraki_deneme) > simdi,
      mesaj: { id: x.mesaj.id, metin: x.mesaj.metin, zaman: x.mesaj.zaman, satisHattiId: x.mesaj.satis_hatti_id },
    })),
  };
}

/* ---------------- Devral / bota geri ver / bot devretti: SQL tarafı 20261119160000_devral_devret.sql ---------------- */

/** dugme: Devral düğmesi · cevap: Gelen kutusu'ndan yazdı · kanal_disi: echo (Meta gelen kutusu, telefondaki uygulama) */
export type DevralmaKaynagi = "dugme" | "cevap" | "kanal_disi";

/**
 * Konuşmayı devralır (bot susar). Durum değiştiyse sistem satırı yazılır ve true döner. Kullanıcı oturumdan okunur;
 * oturumsuz çağrıda (işleyici) parametreden. kanal_disi'nde kullanıcı yoktur.
 */
export async function konusmaDevral(konusmaId: number, kaynak: DevralmaKaynagi, kullaniciId: number | null): Promise<boolean> {
  const s = await db();
  return sonuc(
    await s.rpc("konusma_devral", { p_konusma_id: konusmaId, p_kaynak: kaynak, p_kullanici_id: kullaniciId }),
    "Konuşma devralınırken",
  ) as boolean;
}

/**
 * "Temsilci yazdı" kuralı (değişmez kural 4): temsilci CRM'den ya da CRM dışından (echo) yazınca bot susar ve
 * bot devrettiyse "Cevap bekliyor" biter. CRM'den yazan, konuşmayı başkası devralmadıysa devralır.
 */
export async function temsilciYazdi(konusmaId: number, kaynak: "cevap" | "kanal_disi", kullaniciId: number | null = null) {
  return konusmaDevral(konusmaId, kaynak, kaynak === "cevap" ? kullaniciId : null);
}

/** Bota geri verir; isteğe bağlı not botun bir sonraki turuna gider */
export async function konusmaBotaVer(konusmaId: number, not: string | null, kullaniciId: number | null): Promise<boolean> {
  const s = await db();
  return sonuc(
    await s.rpc("konusma_bota_ver", { p_konusma_id: konusmaId, p_not: not, p_kullanici_id: kullaniciId }),
    "Konuşma bota verilirken",
  ) as boolean;
}

/** Bot devretti: yalnızca bot konuşuyorsa geçerli; değiştiyse true (bildirim bir kez gitsin) */
export async function konusmaBotDevretti(konusmaId: number, sebep: string, aciklama: string | null): Promise<boolean> {
  const s = await db();
  return sonuc(
    await s.rpc("konusma_bot_devretti", { p_konusma_id: konusmaId, p_sebep: sebep, p_aciklama: aciklama }),
    "Bot devri yazılırken",
  ) as boolean;
}

/** Bota geri verilirken yazılan not: bot turu alır, alınca silinir (P2.1 bot döngüsü çağırır) */
export async function botNotunuAl(konusmaId: number): Promise<string | null> {
  const s = await db();
  return sonuc(await s.rpc("konusma_bot_notu_al", { p_konusma_id: konusmaId }), "Bota not okunurken") as string | null;
}

/** Devretme bildirimi için: konuşmanın fırsatı ve sorumlusu */
export async function devirBilgisi(konusmaId: number): Promise<{ satisHattiId: number | null; firma: string | null; sorumluId: number | null } | null> {
  const s = await db();
  const r = sonuc(
    await s.from("konusmalar")
      .select("satis_hatti_id, firsat:satis_hatti!konusmalar_satis_hatti_id_fkey(f_firma, sorumlu_id)")
      .eq("id", konusmaId).maybeSingle(),
    "Konuşma okunurken",
  ) as unknown as { satis_hatti_id: number | null; firsat: { f_firma: string; sorumlu_id: number | null } | null } | null;
  return r && { satisHattiId: r.satis_hatti_id, firma: r.firsat?.f_firma ?? null, sorumluId: r.firsat?.sorumlu_id ?? null };
}

/** Webhook teslim / okundu bildirimleri: yalnızca giden mesajda ve yalnızca ileri (SQL: teslim_durumlari_isle) */
export async function teslimDurumlariYaz(
  durumlar: { disMesajId: string; durum: string; zaman: string; hataKodu?: string }[],
): Promise<number> {
  if (!durumlar.length) return 0;
  const s = await db();
  const p = durumlar.map((d) => ({ dis_mesaj_id: d.disMesajId, durum: d.durum, zaman: d.zaman, hata_kodu: d.hataKodu ?? null }));
  return sonuc(await s.rpc("teslim_durumlari_isle", { p_durumlar: p }), "Teslim durumları yazılırken") as number;
}

/** Konuşmayı kimliğiyle okur (gönderim için) */
export async function konusmaOku(konusmaId: number): Promise<KuyrukKonusmasi | null> {
  const s = await db();
  const r = sonuc(
    await s.from("konusmalar")
      .select("id, kanal, kanal_hesap_id, dis_kullanici_id, satis_hatti_id, musteri_id, dis_profil_adi, son_musteri_mesaji_zamani")
      .eq("id", konusmaId).maybeSingle(),
    "Konuşma okunurken",
  ) as { id: number; kanal: Kanal; kanal_hesap_id: string; dis_kullanici_id: string; satis_hatti_id: number | null; musteri_id: number | null; dis_profil_adi: string | null; son_musteri_mesaji_zamani: string | null } | null;
  return r && {
    id: r.id, kanal: r.kanal, kanalHesapId: r.kanal_hesap_id, disKullaniciId: r.dis_kullanici_id, satisHattiId: r.satis_hatti_id,
    musteriId: r.musteri_id, profilAdi: r.dis_profil_adi, sonMusteriMesaji: r.son_musteri_mesaji_zamani,
  };
}

/** İşlenen mesajı fırsata bağlar; konuşmanın bağlı fırsatını ve müşterisini günceller (son müşteri mesajı zamanını gelen_mesaj_kaydet yazar). */
export async function mesajiBagla(
  konusmaId: number,
  mesajId: number,
  b: { satisHattiId: number; musteriId: number | null },
) {
  const s = await db();
  const konusma: Record<string, unknown> = { satis_hatti_id: b.satisHattiId };
  if (b.musteriId != null) konusma.musteri_id = b.musteriId;
  const [m, k] = await Promise.all([
    s.from("konusma_mesajlari").update({ satis_hatti_id: b.satisHattiId }).eq("id", mesajId),
    s.from("konusmalar").update(konusma).eq("id", konusmaId),
  ]);
  sonuc(m, "Mesaj fırsata bağlanırken");
  sonuc(k, "Konuşma güncellenirken");
}

/**
 * Kanala Meta bildirimi geldi (Bot › Kanallar "son webhook"). Webhook gizli anahtarla çağırır; SQL en çok 30 sn'de
 * bir yazar. Kimlik ya da içerik yazılmaz, yalnızca zaman.
 */
export async function kanalWebhookIsaretle(kanal: Kanal): Promise<void> {
  const s = await db();
  sonuc(await s.rpc("kanal_webhook_isaretle", { p_kanal: kanal }), "Son webhook zamanı yazılırken");
}
