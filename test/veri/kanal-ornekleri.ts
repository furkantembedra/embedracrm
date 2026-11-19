// Kanal adaptörü sözleşme testlerinin (test/kanal-adaptoru.test.ts) her adaptör için verisi. Yeni adaptör (P4.1 Instagram,
// P4.2 Messenger) yazılınca buraya bir satır eklenir; sözleşme testleri onu da otomatik sınar. Eksikse test düşer.
import { vi } from "vitest";
import type { Kanal } from "@/components/konusma/queries";
import type { TeslimDurumu } from "@/components/konusma/kanallar/tur";
import { VARSAYILAN_TOKENLAR, whatsappEchoGovdesi, whatsappGovdesi, waMesaj } from "../sahte/meta";

export type AdaptorOrnegi = {
  /** Müşteriden gelen tek metin mesajlı webhook gövdesi */
  musteriGovdesi(o: { kullanici: string; hesap: string; metin: string; mid: string; ad?: string }): unknown;
  /** İşletme hesabından CRM dışında gönderilmiş mesajın (echo) gövdesi */
  echoGovdesi(o: { kullanici: string; hesap: string; metin: string; mid: string }): unknown;
  /** Teslim / okundu bildirimi gövdesi */
  durumGovdesi(o: { mid: string; durum: TeslimDurumu; hesap: string }): unknown;
  /** Gövdedeki kullanıcı kimliğinin konuşma kimliğine çevrilmiş hâli */
  kullanici: { ham: string; kimlik: string };
  /** Elle / simülasyonda girilen kimlik */
  kimlikGirdisi: { gecerli: string; beklenen: string; gecersiz: string[] };
  /** Gönderim için ortam değişkenleri (sahte Meta adresiyle) */
  ortamKur(metaAdres: string): void;
  /** Gönderimi kapatan (demo moduna düşüren) ortam */
  ortamBosalt(): void;
  hesap: string;
};

export const ADAPTOR_ORNEKLERI: Partial<Record<Kanal, AdaptorOrnegi>> = {
  whatsapp: {
    musteriGovdesi: (o) => whatsappGovdesi({ phoneNumberId: o.hesap, ad: o.ad, mesajlar: [waMesaj({ from: o.kullanici, id: o.mid, text: { body: o.metin } })] }),
    echoGovdesi: (o) => whatsappEchoGovdesi({ to: o.kullanici, id: o.mid, metin: o.metin, phoneNumberId: o.hesap }),
    durumGovdesi: (o) => whatsappGovdesi({
      phoneNumberId: o.hesap,
      durumlar: [{ id: o.mid, status: { gonderildi: "sent", iletildi: "delivered", okundu: "read", basarisiz: "failed" }[o.durum], timestamp: "1763460000", recipient_id: "905321112233",
        ...(o.durum === "basarisiz" ? { errors: [{ code: 131047, title: "Re-engagement message" }] } : {}) }],
    }),
    kullanici: { ham: "905321112233", kimlik: "+905321112233" },
    kimlikGirdisi: { gecerli: "0532 111 22 33", beklenen: "+905321112233", gecersiz: ["", "123", "abc"] },
    ortamKur: (adres) => {
      vi.stubEnv("META_GRAPH_URL", adres);
      vi.stubEnv("WHATSAPP_TOKEN", VARSAYILAN_TOKENLAR.whatsapp);
      vi.stubEnv("WHATSAPP_PHONE_ID", "PNID-1");
    },
    ortamBosalt: () => {
      vi.stubEnv("WHATSAPP_TOKEN", "");
      vi.stubEnv("WHATSAPP_PHONE_ID", "");
    },
    hesap: "PNID-1",
  },
};
