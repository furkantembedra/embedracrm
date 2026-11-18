// teklifler: istemci bileşenlerinin de kullandığı sabitler (sunucu kodu içermez; queries.ts bunları yeniden dışa açar).
import type { TeklifDurumu } from "./queries";

export const DURUM_ADI: Record<TeklifDurumu, string> = {
  taslak: "Taslak", gonderildi: "Gönderildi", kabul: "Kabul edildi", red: "Reddedildi", revize: "Revize edildi",
};
