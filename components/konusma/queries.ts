// Kanaldan bağımsız konuşmalar ve mesajlar (Supabase: konusmalar, konusma_mesajlari).
// Konuşma kanal + dış kullanıcı kimliğiyle tekildir (WhatsApp: normalize telefon "+90…", Instagram: IGSID).
// Mesajın dış kimliği (Meta wamid / IG mid) tekildir: aynı mesaj iki kez gelirse ikinci yazma reddedilir,
// böylece eşzamanlı iki webhook'tan yalnızca biri mesajı işler.
import { db, sonuc } from "@/lib/supabase/db";

export type Kanal = "whatsapp" | "instagram";
export type Gonderen = "musteri" | "bot" | "temsilci";

/** Konuşmayı bulur, yoksa açar. Aynı anda iki istek açmaya çalışsa da tek kayıt kalır (unique + ignoreDuplicates). */
export async function konusmaGetirVeyaAc(kanal: Kanal, disKullaniciId: string): Promise<{ id: number; satisHattiId: number | null }> {
  const s = await db();
  sonuc(
    await s.from("konusmalar").upsert({ kanal, dis_kullanici_id: disKullaniciId }, { onConflict: "kanal,dis_kullanici_id", ignoreDuplicates: true }),
    "Konuşma açılırken",
  );
  const r = sonuc(
    await s.from("konusmalar").select("id, satis_hatti_id").eq("kanal", kanal).eq("dis_kullanici_id", disKullaniciId).single(),
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
  tur: string;
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
      tur: m.tur || "text",
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
