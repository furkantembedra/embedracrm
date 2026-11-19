// WhatsApp Cloud API kanal adaptörü. Kaynaklar (resmi Meta dokümanı, 19 Kasım 2026'da kontrol edildi):
//  • Webhook gövdesi (field: messages): entry[].changes[].value { metadata.phone_number_id, contacts[], messages[], statuses[] }
//    developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
//  • Kullanıcı adı kullanan kişilerde `from` (telefon) ve `wa_id` gelmeyebilir; kimlik BSUID: messages[].from_user_id,
//    contacts[].user_id ("US.1349…", işletme portföyüne özgü). Gönderim: `to` yerine `recipient` (Temmuz 2026'dan beri).
//    developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids
//  • WhatsApp Business uygulamasından (coexistence) gönderilen mesajlar: field smb_message_echoes, value.message_echoes[]
//    { from (işletme), to (müşteri), to_user_id, id, timestamp, type, … }. Cloud API'nin kendi gönderdiği mesajlar için
//    echo geldiğine dair belge yok (gelirse dis_mesaj_id tekilliği ikinci kez yazmaz).
//    developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/smb_message_echoes
//  • statuses[].status: sent | delivered | read | played (sesli mesaj) | failed; errors[].code
//  • Metin mesajı body en fazla 4096 karakter. Biçimlendirme (*kalın*, _italik_, ~üstü çizili~, ```kod```, liste, > alıntı)
//    geliştirici dokümanında değil, WhatsApp Yardım Merkezi'nde (faq.whatsapp.com/539178204879377) yazıyor.
//  • Müşteri hizmetleri penceresi: müşterinin son mesajından 24 saat; dışında yalnızca onaylı şablon. (Click-to-WhatsApp
//    reklamlarının "free entry point" 7 günü fiyatlandırma kuralıdır, serbest mesaj penceresini uzatmaz.)
import type { Kanal, MesajEki, MesajTuru } from "@/components/konusma/queries";
import { VARSAYILAN_KANAL_HESABI } from "@/components/konusma/queries";
import { graphAdresi } from "@/lib/ileti-gonder";
import { telefonGoster, telefonNormalize } from "@/components/whatsapp/telefon";
import { karakterSay, metniBol } from "./bol";
import type { DurumBildirimi, GelenMesaj, KanalAdaptoru, PencereDurumu, TeslimDurumu, WebhookSonucu } from "./tur";

const KANAL: Kanal = "whatsapp";
const PENCERE_MS = 24 * 60 * 60 * 1000;
const AZAMI = 4096;
const GRAPH_SURUMU = "v21.0";

/* ---------------- Webhook türleri ---------------- */

type WaMedya = { mime_type?: string; caption?: string; filename?: string };
export type WaMesaj = {
  from?: string; from_user_id?: string; to?: string; to_user_id?: string;
  id?: string; timestamp?: string; type?: string;
  text?: { body?: string };
  image?: WaMedya; document?: WaMedya; video?: WaMedya; audio?: WaMedya; sticker?: WaMedya;
  location?: { name?: string; address?: string; latitude?: number; longitude?: number };
  button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  reaction?: { message_id?: string; emoji?: string };
  context?: { id?: string; from?: string };
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; media_type?: string; ctwa_clid?: string };
};
type WaDurum = { id?: string; status?: string; timestamp?: string; errors?: { code?: number | string }[] };
type WaDeger = {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; user_id?: string; profile?: { name?: string } }[];
  messages?: WaMesaj[];
  message_echoes?: WaMesaj[];
  statuses?: WaDurum[];
};

/* ---------------- Tür ve metin ---------------- */

const TUR_ESLEME: Record<string, MesajTuru> = {
  text: "metin",
  button: "metin", // şablon düğmesine basma: düğme metni gelir
  interactive: "metin", // düğme / liste cevabı: seçilen başlık gelir
  image: "gorsel",
  sticker: "gorsel",
  audio: "ses",
  video: "video",
  document: "dosya",
  reaction: "tepki",
};
/** Ortak listede kendi adıyla bulunan türler: aslını ek.kaynak_tur'a yazmaya gerek yok */
const BIREBIR = new Set(["text", "image", "audio", "video", "document"]);

/** WhatsApp türü (messages[].type) → ortak tür; birebir olmayanın aslı ek.kaynak_tur'da */
export function whatsappTuru(tur: string | undefined): { tur: MesajTuru; ek: Pick<MesajEki, "kaynak_tur"> } {
  const t = (tur || "text").trim();
  return { tur: TUR_ESLEME[t] ?? "diger", ek: BIREBIR.has(t) ? {} : { kaynak_tur: t.slice(0, 40) } };
}

const TUR_METNI: Record<string, string> = {
  image: "📷 Fotoğraf", document: "📄 Belge", location: "📍 Konum", audio: "🎤 Sesli mesaj", video: "🎬 Video",
  sticker: "Çıkartma", contacts: "👤 Kişi kartı",
};

export function mesajMetni(m: WaMesaj): string {
  const metin = (() => {
    switch (m.type) {
      case "text": return m.text?.body ?? "";
      case "image": return m.image?.caption ? `📷 ${m.image.caption}` : "";
      case "video": return m.video?.caption ? `🎬 ${m.video.caption}` : "";
      case "document": return `📄 ${m.document?.filename ?? "Belge"}${m.document?.caption ? ` · ${m.document.caption}` : ""}`;
      case "location": return `📍 ${m.location?.name ?? m.location?.address ?? `${m.location?.latitude}, ${m.location?.longitude}`}`;
      case "button": return m.button?.text ?? "";
      case "interactive": return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
      case "reaction": return m.reaction?.emoji ? `Tepki: ${m.reaction.emoji}` : "Tepki kaldırıldı";
      default: return "";
    }
  })().trim();
  return metin || TUR_METNI[m.type ?? ""] || `[${(m.type ?? "mesaj").slice(0, 40)}]`;
}

const kirp = (x: unknown, n = 300) => (typeof x === "string" && x ? x.slice(0, n) : undefined);

/**
 * Mesajın ek bilgisi. Kişisel veri yazılmaz: context.from (telefon), konum, ctwa_clid (tıklama kimliği) ve medya
 * bağlantıları bilerek atlanır.
 */
export function whatsappEki(m: WaMesaj): MesajEki {
  const ek: MesajEki = {};
  const medya = m.image ?? m.document ?? m.video ?? m.audio ?? m.sticker;
  if (medya?.mime_type) ek.ek_dosya_turu = kirp(medya.mime_type, 100);
  const yanitlanan = m.type === "reaction" ? m.reaction?.message_id : m.context?.id;
  if (yanitlanan) ek.yanitlanan_mesaj_id = kirp(yanitlanan, 200);
  if (m.referral) {
    const r = m.referral;
    ek.yonlendirme = Object.fromEntries(Object.entries({
      kaynak_turu: kirp(r.source_type, 40), kaynak_id: kirp(r.source_id, 100), baslik: kirp(r.headline),
      govde: kirp(r.body, 1000), medya_turu: kirp(r.media_type, 40), kaynak_url: kirp(r.source_url, 500),
    }).filter(([, v]) => v !== undefined));
  }
  return { ...ek, ...whatsappTuru(m.type).ek };
}

/* ---------------- Kimlik ---------------- */

/** BSUID: ISO ülke kodu + "." + en çok 128 harf/rakam (ebeveyn BSUID'de "US.ENT.…") */
const BSUID = /^[A-Z]{2}(\.ENT)?\.[A-Za-z0-9]{1,128}$/;

/** Kişinin konuşma kimliği: telefon varsa normalize telefon ("+90…"), yoksa BSUID; ikisi de yoksa null */
export function whatsappKimligi(telefon: string | undefined, bsuid: string | undefined): string | null {
  const t = telefon ? telefonNormalize(`+${telefon.replace(/^\+/, "")}`) : "";
  if (t) return t;
  const b = bsuid?.trim();
  return b && BSUID.test(b) ? b : null;
}

/** Gelen WhatsApp mesajının hangi işletme numarasına geldiği */
export function whatsappHesabi(phoneNumberId?: string | null) {
  return phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_ID?.trim() || VARSAYILAN_KANAL_HESABI;
}

const zamanISO = (ts: string | undefined) => new Date(Number(ts) * 1000 || Date.now()).toISOString();

const DURUM: Record<string, TeslimDurumu> = { sent: "gonderildi", delivered: "iletildi", read: "okundu", played: "okundu", failed: "basarisiz" };

/* ---------------- Webhook → ortak liste ---------------- */

export function whatsappWebhookCevir(govde: unknown): WebhookSonucu {
  const sonuc: WebhookSonucu = { mesajlar: [], durumlar: [], atlanan: 0 };
  const g = govde as { object?: unknown; entry?: unknown } | null;
  if (!g || g.object !== "whatsapp_business_account" || !Array.isArray(g.entry)) return sonuc;
  for (const entry of g.entry as { changes?: { field?: string; value?: WaDeger }[] }[]) {
    for (const degisiklik of Array.isArray(entry?.changes) ? entry.changes : []) {
      const deger = degisiklik?.value;
      if (!deger || typeof deger !== "object") continue;
      const hesap = whatsappHesabi(deger.metadata?.phone_number_id);

      // Müşteri mesajları
      for (const m of Array.isArray(deger.messages) ? deger.messages : []) {
        // "system" (numara / BSUID değişti) ve kimliksiz olaylar konuşma mesajı değildir
        const kimlik = whatsappKimligi(m?.from, m?.from_user_id);
        if (!m?.id || !kimlik || m.type === "system") {
          sonuc.atlanan++;
          continue;
        }
        const kisi = deger.contacts?.find((c) => (m.from && c.wa_id === m.from) || (m.from_user_id && c.user_id === m.from_user_id));
        sonuc.mesajlar.push({
          kanal: KANAL, kanalHesapId: hesap, disKullaniciId: kimlik, disMesajId: m.id,
          tur: whatsappTuru(m.type).tur, metin: mesajMetni(m), ek: whatsappEki(m), zaman: zamanISO(m.timestamp),
          echo: false, profilAdi: kisi?.profile?.name?.trim() || undefined,
        });
      }

      // İşletmenin WhatsApp Business uygulamasından gönderdiği mesajlar (coexistence): gönderen temsilci
      for (const m of Array.isArray(deger.message_echoes) ? deger.message_echoes : []) {
        const kimlik = whatsappKimligi(m?.to, m?.to_user_id);
        if (!m?.id || !kimlik || m.type === "revoke" || m.type === "edit") {
          sonuc.atlanan++; // silme / düzenleme bildirimleri şimdilik işlenmez
          continue;
        }
        sonuc.mesajlar.push({
          kanal: KANAL, kanalHesapId: hesap, disKullaniciId: kimlik, disMesajId: m.id,
          tur: whatsappTuru(m.type).tur, metin: mesajMetni(m), ek: whatsappEki(m), zaman: zamanISO(m.timestamp), echo: true,
        });
      }

      // Teslim / okundu bildirimleri
      for (const d of Array.isArray(deger.statuses) ? deger.statuses : []) {
        const durum = DURUM[d?.status ?? ""];
        if (!d?.id || !durum) {
          sonuc.atlanan++;
          continue;
        }
        const b: DurumBildirimi = { disMesajId: d.id, durum, zaman: zamanISO(d.timestamp) };
        const kod = d.errors?.[0]?.code;
        if (kod !== undefined) b.hataKodu = String(kod).slice(0, 20);
        sonuc.durumlar.push(b);
      }
    }
  }
  return sonuc;
}

/* ---------------- Adaptör ---------------- */

export function whatsappPenceresi(sonMusteriMesaji: string | null, simdi = new Date()): PencereDurumu {
  const son = sonMusteriMesaji ? Date.parse(sonMusteriMesaji) : NaN;
  if (Number.isNaN(son)) return { durum: "kapali", bitis: null };
  const bitis = son + PENCERE_MS;
  return bitis > simdi.getTime() ? { durum: "acik", bitis: new Date(bitis).toISOString() } : { durum: "kapali", bitis: null };
}

async function hataMetni(r: Response) {
  try {
    const j = (await r.json()) as { error?: { message?: string; code?: number } };
    return j.error?.message ? `${j.error.message}${j.error.code ? ` (${j.error.code})` : ""}` : `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status}`;
  }
}

export const whatsappAdaptoru: KanalAdaptoru = {
  kanal: KANAL,
  webhookObject: "whatsapp_business_account",
  ad: "WhatsApp",
  leadKaynagi: "WhatsApp",
  sonrakiAdim: "WhatsApp'tan dönüş yap",
  kimlikAlani: { etiket: "Telefon", ornek: "+90 532 111 22 33" },
  kimlikCoz: (girdi) => telefonNormalize(girdi) || null,
  varsayilanHesap: () => whatsappHesabi(null),
  telefon: (id) => (id.startsWith("+") ? telefonNormalize(id) || null : null),
  gorunenKimlik: (id) => (id.startsWith("+") ? telefonGoster(id) : "WhatsApp kullanıcısı"),
  webhookCevir: whatsappWebhookCevir,
  pencere: whatsappPenceresi,
  sinirlar: {
    azamiUzunluk: AZAMI,
    birim: "karakter",
    bicimlendirme: ["kalin", "italik", "ustu_cizili", "kod", "liste", "alinti", "baglanti_onizleme"],
    not: "WhatsApp: düz metin; *kalın*, _italik_, ~üstü çizili~; Markdown başlık (#) ve [bağlantı](adres) desteklenmez.",
  },
  bol: (metin) => metniBol(metin, AZAMI, karakterSay),

  async gonder(alici, icerik) {
    const token = process.env.WHATSAPP_TOKEN;
    const hesap = alici.kanalHesapId === VARSAYILAN_KANAL_HESABI ? process.env.WHATSAPP_PHONE_ID : alici.kanalHesapId;
    if (icerik.tur !== "metin" || !icerik.metin.trim()) return { ok: false, hata: "Boş mesaj gönderilemez." };
    if (karakterSay(icerik.metin) > AZAMI) return { ok: false, hata: `Mesaj ${AZAMI} karakteri aşıyor; önce bölünmeli.` };
    if (!token || !process.env.WHATSAPP_PHONE_ID || !hesap) return { ok: true, disMesajId: null, demo: true };
    const telefon = alici.disKullaniciId.startsWith("+") ? alici.disKullaniciId.slice(1) : null;
    try {
      const r = await fetch(`${graphAdresi()}/${GRAPH_SURUMU}/${encodeURIComponent(hesap)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          // Telefonu olmayan (kullanıcı adlı) kişiye BSUID ile: `recipient`
          ...(telefon ? { to: telefon } : { recipient: alici.disKullaniciId }),
          type: "text",
          text: { body: icerik.metin, preview_url: false },
        }),
      });
      if (!r.ok) return { ok: false, hata: await hataMetni(r) };
      const j = (await r.json()) as { messages?: { id?: string }[] };
      return { ok: true, disMesajId: j.messages?.[0]?.id ?? null, demo: false };
    } catch {
      return { ok: false, hata: "WhatsApp'a ulaşılamadı." };
    }
  },
};

export type { GelenMesaj };
