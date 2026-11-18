// destek: istemci bileşenlerinin de kullandığı sabitler (sunucu kodu içermez; queries.ts bunları yeniden dışa açar).
import type { NotTuru, TalepDurumu } from "./queries";

export const KONULAR = ["Bağlantı", "Flash / yazılım", "Lisans", "Donanım arızası", "Araç kapsamı isteği", "Diğer"] as const;
export const DURUM_ADI: Record<TalepDurumu, string> = { yeni: "Yeni", islemde: "İşlemde", beklemede: "Beklemede", cozuldu: "Çözüldü" };
export const NOT_BILGI: Record<NotTuru, { ad: string; renk: string }> = {
  acilis: { ad: "Talep açıldı", renk: "#C9CCC2" },
  not: { ad: "Not", renk: "#2F4BFF" },
  gorusme: { ad: "Telefon görüşmesi", renk: "#2F4BFF" },
  yapilacak: { ad: "Yapılacak", renk: "#E58A2B" },
  beklemede: { ad: "Beklemeye alındı", renk: "#E58A2B" },
  cozuldu: { ad: "Çözüldü", renk: "#1F8A4C" },
  islemde: { ad: "İşleme alındı", renk: "#0E0F0C" },
  yeniden: { ad: "Yeniden açıldı", renk: "#0E0F0C" },
  bayi: { ad: "Bayiden mesaj", renk: "#7A5AF8" },
  bayiye: { ad: "Bayiye yanıt", renk: "#7A5AF8" },
};
