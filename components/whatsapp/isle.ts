// Gelen WhatsApp mesajını satış hattına işler. Ortak Meta webhook'u (components/konusma/meta-webhook.ts) ve
// satış hattındaki "WhatsApp mesajı simüle et" aynı fonksiyonu kullanır.
//
// Kural: numarası açık bir fırsatta kayıtlıysa mesaj o fırsatın geçmişine eklenir (yeni lead açılmaz).
// Değilse "Yeni lead" aşamasına kaynak "WhatsApp" olan fırsat açılır. Numara bir müşteri
// yetkilisine aitse firma adı müşteriden alınır ve mesaj müşterinin zaman çizelgesine de düşer.
import { revalidatePath } from "next/cache";
import { firsatEkleDepo, firsatiGuncelle, getFirsat, KAPALI_ASAMALAR, type Firsat } from "@/components/satis-hatti/queries";
import { getMusteri, musteriyiGuncelle } from "@/components/musteriler/queries";
import { konusmaGetirVeyaAc, mesajiBagla, mesajiGeriAl, mesajKaydet, VARSAYILAN_KANAL_HESABI, type MesajEki } from "@/components/konusma/queries";
import { db, sonuc as veri } from "@/lib/supabase/db";
import { telefonGoster, telefonNormalize } from "./telefon";
import { whatsappTuru } from "./turler";

export type GelenMesaj = {
  waId: string; // "905321234567" (Meta'nın gönderdiği, + işaretsiz)
  ad: string; // WhatsApp profil adı (boş olabilir)
  metin: string;
  tur: string; // WhatsApp türü: text | image | document | location | audio … (ortak türe whatsappTuru çevirir)
  mesajId: string; // wamid… (aynı mesaj iki kez gelirse tekrar işlenmez)
  zaman: string; // ISO
  /** İşletme numarasının phone_number_id'si (webhook metadata); yoksa WHATSAPP_PHONE_ID, o da yoksa "varsayilan" */
  kanalHesapId?: string;
  /** Yönlendirme, yanıtlanan mesaj, dosya türü (kişisel veri içermez) */
  ek?: MesajEki;
};

/** Gelen WhatsApp mesajının hangi işletme numarasına geldiği */
export function whatsappHesabi(phoneNumberId?: string | null) {
  return phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_ID?.trim() || VARSAYILAN_KANAL_HESABI;
}

const TUR_METNI: Record<string, string> = {
  image: "📷 Fotoğraf", document: "📄 Belge", location: "📍 Konum", audio: "🎤 Sesli mesaj", video: "🎬 Video", sticker: "Çıkartma", contacts: "👤 Kişi kartı",
};

/** Webhook'tan (oturumsuz, sistemOlarak içinde) ve satış hattındaki simülasyondan (oturumlu) çağrılır. */
export async function whatsappMesajiIsle(m: GelenMesaj): Promise<{ firsat: Firsat; yeni: boolean } | null> {
  const telefon = telefonNormalize(`+${m.waId.replace(/^\+/, "")}`);
  if (!telefon) return null;
  const metin = m.metin.trim() || TUR_METNI[m.tur] || `[${m.tur}]`;

  // 1) Önce mesajı yaz: konusma_mesajlari.dis_mesaj_id tekil. Meta aynı mesajı tekrar gönderirse ya da iki webhook
  //    aynı anda gelirse yalnızca ilk yazan devam eder (kontrol-sonra-yaz yarışı yok).
  const konusma = await konusmaGetirVeyaAc("whatsapp", whatsappHesabi(m.kanalHesapId), telefon);
  const tur = whatsappTuru(m.tur);
  const mesajNo = await mesajKaydet({
    konusmaId: konusma.id, yon: "gelen", gonderen: "musteri", disMesajId: m.mesajId,
    metin: metin.slice(0, 2000), tur: tur.tur, ek: { ...m.ek, ...tur.ek }, zaman: m.zaman,
  });
  if (mesajNo === null) return null;

  try {
    // Sonraki adım tarihi sunucunun bugünü (mesaj zamanı gecikmeli gelebilir)
    const d = new Date();
    const bugun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const s = await db();

    // 2) Aynı numaralı açık fırsat ve numaranın sahibi müşteri yetkilisi: normalize telefon sütunları üzerinden (indeksli)
    const [acikSatir, yetkili] = await Promise.all([
      s.from("satis_hatti").select("id, asama:asama!satis_hatti_asama_id_fkey!inner(kod)")
        .eq("f_telefon_normal", telefon).not("asama.kod", "in", `(${KAPALI_ASAMALAR.join(",")})`)
        .order("id", { ascending: false }).limit(1).maybeSingle(),
      s.from("musteri_yetkilileri").select("musteri_id").eq("y_tel_normal", telefon).order("y_sira").limit(1).maybeSingle(),
    ]);
    const acikId = (veri(acikSatir, "Açık fırsat aranırken") as { id: number } | null)?.id ?? null;
    const sahibi = veri(yetkili, "Müşteri yetkilisi aranırken") as { musteri_id: number } | null;
    const musteri = sahibi ? await getMusteri(String(sahibi.musteri_id)) : null;
    if (musteri) {
      await musteriyiGuncelle(musteri.id, (x) => {
        x.olaylar.unshift({ metin: `WhatsApp: “${metin.slice(0, 120)}”`, zaman: "Bugün · WhatsApp", tur: "arama" });
        x.sonTemas = "Bugün";
      });
      revalidatePath("/musteriler");
    }

    // 3) Açık fırsat varsa ona eklenir, yoksa "Yeni lead" açılır
    let firsatId: string;
    const yeni = acikId === null;
    if (!yeni) {
      const f = await firsatiGuncelle(String(acikId), (x) => {
        x.sonrakiAdim = "WhatsApp'tan dönüş yap";
        x.sonrakiTarih = bugun;
      });
      firsatId = f!.id;
    } else {
      const f: Firsat = {
        id: "",
        firma: musteri?.ad ?? (m.ad.trim() || telefonGoster(telefon)),
        konum: musteri ? `${musteri.sehir}, ${musteri.ulke}` : telefon.startsWith("+90") ? "Türkiye" : "—",
        kaynak: "WhatsApp",
        icerik: "Ürün belirlenmedi",
        tutar: 0,
        asama: "yeni",
        sonrakiAdim: "WhatsApp'tan dönüş yap",
        sonrakiTarih: bugun,
        kampanyaId: null,
        telefon,
      };
      await firsatEkleDepo(f);
      firsatId = f.id;
    }

    // 4) Mesajı fırsata, konuşmayı fırsat / müşteriye bağla (24 saat penceresi için son müşteri mesajı zamanı)
    await mesajiBagla(konusma.id, mesajNo, {
      satisHattiId: Number(firsatId), musteriId: musteri ? Number(musteri.id) : null, sonMusteriMesaji: m.zaman,
    });
    revalidatePath("/satis-hatti");
    revalidatePath("/genel-bakis");
    return { firsat: (await getFirsat(firsatId))!, yeni };
  } catch (e) {
    await mesajiGeriAl(mesajNo).catch(() => {}); // Meta yeniden gönderdiğinde tekrar işlenebilsin
    throw e;
  }
}
