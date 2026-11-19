// Bot menüsüne erişim (yol haritası "Bot menüsü"): Yönetici, Satış ve Pazarlama görür; Destek ve Operasyon görmez.
// Kanallar ve Ayarlar'da değişikliği yalnızca Yönetici yapar (P2.4). Kontrol her zaman sunucuda yapılır.
import type { Rol } from "@/components/operasyon/queries";

export const BOT_ROLLERI = ["Yönetici", "Satış", "Pazarlama"] as const satisfies readonly Rol[];
/** Simülasyon (yalnızca geliştirmede) ve ileride kanal / bot ayarı değişikliği */
export const BOT_YONETICI_ROLLERI = ["Yönetici"] as const satisfies readonly Rol[];

export function botMenusuGorur(rol: string | null | undefined): boolean {
  return !!rol && (BOT_ROLLERI as readonly string[]).includes(rol);
}

/** Simülasyon formu yalnızca geliştirmede ve Yönetici için (sunucu aksiyonu da aynı kontrolü yapar) */
export function simulasyonAcik(rol: string | null | undefined): boolean {
  return process.env.NODE_ENV !== "production" && !!rol && (BOT_YONETICI_ROLLERI as readonly string[]).includes(rol);
}
