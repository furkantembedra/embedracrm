// Sahte Meta Graph API (WhatsApp Cloud API). Kullanım:
//   const meta = await sahteMetaBaslat();  process.env.META_GRAPH_URL = meta.adres;
// POST /v{sürüm}/{phone_id}/messages → başarıda { messaging_product, contacts, messages: [{ id: "wamid.SAHTE…" }] }.
// Authorization başlığı beklenen token değilse Meta gibi 401 döner; hata() ile bir sonraki yanıt hataya çevrilebilir.
import { sahteSunucuBaslat, type SahteSunucu } from "./sunucu";

export type SahteMeta = SahteSunucu & {
  /** Bir sonraki istek bu durum kodu ve Meta hata gövdesiyle yanıtlanır */
  hata: (durum: number, mesaj: string) => void;
  /** Gönderilen mesajların gövdeleri */
  gonderilenler: () => Record<string, unknown>[];
};

export async function sahteMetaBaslat(beklenenToken = "test-whatsapp-token"): Promise<SahteMeta> {
  let siradakiHata: { durum: number; mesaj: string } | null = null;
  let sayac = 0;
  const sunucu = await sahteSunucuBaslat((istek) => {
    if (istek.yontem !== "POST" || !/^\/v\d+\.\d+\/[^/]+\/messages$/.test(istek.yol)) {
      return { durum: 404, govde: { error: { message: "Unknown path", type: "OAuthException", code: 803 } } };
    }
    if (istek.basliklar.authorization !== `Bearer ${beklenenToken}`) {
      return { durum: 401, govde: { error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190 } } };
    }
    if (siradakiHata) {
      const h = siradakiHata;
      siradakiHata = null;
      return { durum: h.durum, govde: { error: { message: h.mesaj, type: "OAuthException", code: 100 } } };
    }
    const g = istek.govde as { to?: string };
    sayac++;
    return {
      durum: 200,
      govde: { messaging_product: "whatsapp", contacts: [{ input: g.to, wa_id: g.to }], messages: [{ id: `wamid.SAHTE${sayac}` }] },
    };
  });
  return {
    ...sunucu,
    hata: (durum, mesaj) => void (siradakiHata = { durum, mesaj }),
    gonderilenler: () => sunucu.istekler.filter((i) => i.yontem === "POST").map((i) => i.govde as Record<string, unknown>),
  };
}
