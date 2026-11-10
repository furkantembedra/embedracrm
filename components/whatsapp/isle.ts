// Gelen WhatsApp mesajını satış hattına işler. Webhook (app/api/whatsapp/webhook) ve
// satış hattındaki "WhatsApp mesajı simüle et" aynı fonksiyonu kullanır.
//
// Kural: numarası açık bir fırsatta kayıtlıysa mesaj o fırsatın geçmişine eklenir (yeni lead açılmaz).
// Değilse "Yeni lead" aşamasına kaynak "WhatsApp" olan fırsat açılır. Numara bir müşteri
// yetkilisine aitse firma adı müşteriden alınır ve mesaj müşterinin zaman çizelgesine de düşer.
import { revalidatePath } from "next/cache";
import { firsatEkleDepo, firsatiGuncelle, getFirsatlar, KAPALI_ASAMALAR, type Firsat, type WhatsappMesaji } from "@/components/satis-hatti/queries";
import { getMusteriler, musteriyiGuncelle } from "@/components/musteriler/queries";
import { telefonGoster, telefonNormalize } from "./telefon";

export type GelenMesaj = {
  waId: string; // "905321234567" (Meta'nın gönderdiği, + işaretsiz)
  ad: string; // WhatsApp profil adı (boş olabilir)
  metin: string;
  tur: string; // text | image | document | location | audio …
  mesajId: string; // wamid… (aynı mesaj iki kez gelirse tekrar işlenmez)
  zaman: string; // ISO
};

const g = globalThis as { __embedraWaIslenen?: Set<string> };
const ISLENEN = (g.__embedraWaIslenen ??= new Set());

const TUR_METNI: Record<string, string> = {
  image: "📷 Fotoğraf", document: "📄 Belge", location: "📍 Konum", audio: "🎤 Sesli mesaj", video: "🎬 Video", sticker: "Çıkartma", contacts: "👤 Kişi kartı",
};

export async function whatsappMesajiIsle(m: GelenMesaj): Promise<{ firsat: Firsat; yeni: boolean } | null> {
  if (ISLENEN.has(m.mesajId)) return null;
  const telefon = telefonNormalize(`+${m.waId.replace(/^\+/, "")}`);
  if (!telefon) return null;
  ISLENEN.add(m.mesajId);

  const metin = m.metin.trim() || TUR_METNI[m.tur] || `[${m.tur}]`;
  const mesaj: WhatsappMesaji = { id: m.mesajId, metin: metin.slice(0, 2000), zaman: m.zaman, yon: "gelen", tur: m.tur };
  // Sonraki adım tarihi sunucunun bugünü (mesaj zamanı gecikmeli gelebilir)
  const d = new Date();
  const bugun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // 1) Aynı numaralı açık fırsat
  const firsatlar = await getFirsatlar();
  const acik = firsatlar.filter((f) => f.telefon && telefonNormalize(f.telefon) === telefon && !KAPALI_ASAMALAR.includes(f.asama)).at(-1);

  // 2) Numara bir müşteri yetkilisine ait mi?
  const musteri = (await getMusteriler()).find((x) => x.yetkililer.some((y) => telefonNormalize(y.telefon) === telefon)) ?? null;
  if (musteri) {
    await musteriyiGuncelle(musteri.id, (x) => {
      x.olaylar.unshift({ metin: `WhatsApp: “${metin.slice(0, 120)}”`, zaman: "Bugün · WhatsApp", tur: "arama" });
      x.sonTemas = "Bugün";
    });
    revalidatePath("/musteriler");
  }

  let sonuc: { firsat: Firsat; yeni: boolean };
  if (acik) {
    const f = await firsatiGuncelle(acik.id, (x) => {
      x.mesajlar = [...(x.mesajlar ?? []), mesaj];
      x.sonrakiAdim = "WhatsApp'tan dönüş yap";
      x.sonrakiTarih = bugun;
    });
    sonuc = { firsat: f!, yeni: false };
  } else {
    const f: Firsat = {
      id: crypto.randomUUID(),
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
      mesajlar: [mesaj],
    };
    await firsatEkleDepo(f);
    sonuc = { firsat: f, yeni: true };
  }
  // TODO (Supabase): insert into whatsapp_messages; deals upsert by phone
  revalidatePath("/satis-hatti");
  revalidatePath("/genel-bakis");
  return sonuc;
}
