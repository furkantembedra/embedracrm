// Toplu e-posta ve WhatsApp gönderimi için sağlayıcı bağlantıları. Yalnızca sunucuda import edin.
//
// E-posta (Resend):   RESEND_API_KEY, EPOSTA_GONDEREN="Embedra <bulten@embedra.com>" (alan adı Resend'de doğrulanmış olmalı)
// WhatsApp (Meta Cloud API): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, isteğe bağlı WHATSAPP_SABLON_DILI (varsayılan "tr")
//   Pazarlama mesajı yalnızca Meta'da onaylanmış şablonla gönderilebilir; şablondaki {{1}} kişi adı, {{2}} firma adıdır.
//
// Anahtarlar tanımlı değilse DEMO modundadır: hiçbir şey gönderilmez, yalnızca adresler doğrulanıp sonuç kaydedilir.
// Türkiye'deki alıcılara ticari ileti göndermeden önce izinlerin İYS'ye (İleti Yönetim Sistemi) kayıtlı olması gerekir.

export type GonderimSonucu = { ok: true } | { ok: false; hata: string };

export const EPOSTA_GECERLI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Uluslararası biçimde rakamlar (ülke kodu dahil, 10–15 hane) */
export const TELEFON_GECERLI = /^\d{10,15}$/;

export function saglayicilar() {
  return {
    eposta: process.env.RESEND_API_KEY && process.env.EPOSTA_GONDEREN ? "Resend" : null,
    whatsapp: process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID ? "WhatsApp Cloud API" : null,
  };
}

async function hataMetni(r: Response) {
  try {
    const j = (await r.json()) as { message?: string; error?: { message?: string } };
    return j.message ?? j.error?.message ?? `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status}`;
  }
}

export async function epostaGonder(e: { kime: string; konu: string; metin: string; html: string; abonelikUrl: string }): Promise<GonderimSonucu> {
  if (!EPOSTA_GECERLI.test(e.kime)) return { ok: false, hata: "geçersiz e-posta adresi" };
  if (!saglayicilar().eposta) return { ok: true }; // demo
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EPOSTA_GONDEREN,
        to: [e.kime],
        subject: e.konu,
        text: e.metin,
        html: e.html,
        headers: { "List-Unsubscribe": `<${e.abonelikUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    return r.ok ? { ok: true } : { ok: false, hata: await hataMetni(r) };
  } catch {
    return { ok: false, hata: "sağlayıcıya ulaşılamadı" };
  }
}

export async function whatsappGonder(w: { telefon: string; sablon: string; parametreler: string[] }): Promise<GonderimSonucu> {
  if (!TELEFON_GECERLI.test(w.telefon)) return { ok: false, hata: "geçersiz telefon (ülke koduyla yazılmalı)" };
  if (!saglayicilar().whatsapp) return { ok: true }; // demo
  if (!w.sablon) return { ok: false, hata: "WhatsApp şablon adı girilmemiş" };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: w.telefon,
        type: "template",
        template: {
          name: w.sablon,
          language: { code: process.env.WHATSAPP_SABLON_DILI ?? "tr" },
          components: [{ type: "body", parameters: w.parametreler.map((text) => ({ type: "text", text: text || "-" })) }],
        },
      }),
    });
    return r.ok ? { ok: true } : { ok: false, hata: await hataMetni(r) };
  } catch {
    return { ok: false, hata: "sağlayıcıya ulaşılamadı" };
  }
}

/** İşleri en fazla `paralel` tanesi aynı anda çalışacak şekilde yürütür (sağlayıcı hız sınırına takılmamak için) */
export async function sirayla<T, S>(isler: T[], paralel: number, f: (x: T) => Promise<S>): Promise<S[]> {
  const sonuc: S[] = new Array(isler.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(paralel, isler.length) }, async () => {
      while (i < isler.length) {
        const n = i++;
        sonuc[n] = await f(isler[n]);
      }
    }),
  );
  return sonuc;
}
