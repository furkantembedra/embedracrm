// Botun araçları: strict JSON şemalı tanım + sunucuda yeniden doğrulayan çalıştırıcı. tool_choice auto (claude-haiku-5-5
// zorlamalı araç seçimini düşünmesiz yapar; bot ne zaman çağıracağını istemden bilir).
// P2.1'de yalnızca insana_devret var; ihtiyac_kaydet, lead_skoru_ver, demo_talep_et, plan_oner, izin_kaydet P2.2'de
// bu listeye eklenir. Araçlar yalnızca turun konuşmasına dokunur (değişmez kural 12): konuşma kimliği modelden değil
// bağlamdan gelir. Liste sırası sabittir (araç tanımları önbellek önekinin başındadır).
import type Anthropic from "@anthropic-ai/sdk";
import { botDevretti } from "@/components/konusma/devir";
import type { DevirSebebi } from "@/components/konusma/devir-sebepleri";

export type AracBaglami = { konusmaId: number };
export type AracSonucu = {
  /** Modele dönen kısa sonuç (kişisel veri yok) */
  icerik: string;
  hata?: boolean;
  /** Araç konuşmayı insana devretti */
  devir?: boolean;
};
export type BotAraci = {
  tanim: Anthropic.Tool;
  calistir(girdi: unknown, b: AracBaglami): Promise<AracSonucu>;
};

/** insana_devret'in modelin seçebileceği sebepleri (bot_hatasi ve tur_siniri döngünün kendi sebepleridir) */
export const ARAC_DEVIR_SEBEPLERI = [
  "fiyat_pazarligi", "sikayet", "ozel_fiyat", "emin_degil", "musteri_istedi", "bayi_bolgesi", "desteklenmeyen_dil", "veri_silme", "diger",
] as const satisfies readonly DevirSebebi[];

const insanaDevret: BotAraci = {
  tanim: {
    name: "insana_devret",
    description:
      "Konuşmayı Embedra satış ekibine devreder; bundan sonra sen cevap vermezsin. Müşteri insanla görüşmek isterse, fiyat pazarlığı ya da özel fiyat isterse, şikâyet ederse, verilerinin silinmesini isterse, desteklemediğin bir dilde yazarsa ya da emin olmadığın bir şey sorulursa çağır. Çağırdıktan sonra müşteriye tek kısa cümleyle bir ekip arkadaşının döneceğini söyleyebilirsin.",
    input_schema: {
      type: "object",
      properties: {
        sebep: { type: "string", enum: [...ARAC_DEVIR_SEBEPLERI], description: "Devretme sebebi" },
        aciklama: {
          type: "string",
          description: "Satışçı için tek cümlelik kısa gerekçe (en çok 200 karakter). Müşterinin mesajını kopyalama; telefon, e-posta, ad gibi kişisel bilgi yazma.",
        },
      },
      required: ["sebep", "aciklama"],
      additionalProperties: false,
    },
    strict: true,
  },
  async calistir(girdi, b) {
    const g = girdi as { sebep?: unknown; aciklama?: unknown } | null;
    const sebep = (ARAC_DEVIR_SEBEPLERI as readonly unknown[]).includes(g?.sebep) ? (g!.sebep as DevirSebebi) : null;
    if (!sebep) return { icerik: "Geçersiz sebep. Listeden bir sebep seç.", hata: true };
    const aciklama = typeof g?.aciklama === "string" ? g.aciklama.slice(0, 200) : null;
    await botDevretti(b.konusmaId, sebep, aciklama);
    return { icerik: "Konuşma ekibe devredildi. İstersen müşteriye tek kısa cümleyle bir ekip arkadaşının döneceğini söyle; soru sorma.", devir: true };
  },
};

export const BOT_ARACLARI: readonly BotAraci[] = [insanaDevret];

/** API'ye giden araç tanımları (sabit sıra) */
export const aracTanimlari = (): Anthropic.Tool[] => BOT_ARACLARI.map((a) => a.tanim);

/** Araç çağrısını çalıştırır; bilinmeyen araç ya da hata modele is_error olarak döner, fırlatmaz */
export async function araciCalistir(ad: string, girdi: unknown, b: AracBaglami): Promise<AracSonucu> {
  const a = BOT_ARACLARI.find((x) => x.tanim.name === ad);
  if (!a) return { icerik: `Bilinmeyen araç: ${ad.slice(0, 40)}`, hata: true };
  try {
    return await a.calistir(girdi, b);
  } catch (e) {
    console.error(`[bot] araç ${a.tanim.name} hata verdi: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
    return { icerik: "Araç çalıştırılamadı.", hata: true };
  }
}
