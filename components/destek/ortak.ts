// Destek bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import type { Oncelik, TalepDurumu } from "./queries";

export const ONCELIK_TONU: Record<Oncelik, ChipTon> = { Yüksek: "err", Orta: "warn", Düşük: "gray" };
export const DURUM_TONU: Record<TalepDurumu, ChipTon> = { yeni: "info", islemde: "lime", beklemede: "warn", cozuldu: "ok" };

/** "2026-11-04T09:02" → "Bugün 09:02" · "Dün 16:20" · "28 Eki". bugun: useBugun() değeri */
export function zamanYaz(iso: string, bugun: number | null) {
  const d = new Date(iso);
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bugun !== null) {
    const gun = Math.round((new Date(d).setHours(0, 0, 0, 0) - bugun) / 86_400_000);
    if (gun === 0) return `Bugün ${saat}`;
    if (gun === -1) return `Dün ${saat}`;
  }
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/** Sunucuda şimdiki zaman, "2026-11-04T09:02" biçiminde (yerel saat). */
export function simdiIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "+49 711 555 0142" → tel ve WhatsApp için "+497115550142" */
export const telefonSade = (t: string) => t.replace(/[^\d+]/g, "");

/** Ek dosya sınırı (sunucudaki 4,5 MB'lık istek sınırının altında kalsın diye) */
export const DOSYA_SINIRI = 4 * 1024 * 1024;

/** Dosya seçildiğinde: sınırı aşarsa seçimi temizler ve hata metni döner */
export function dosyaSecildi(input: HTMLInputElement): { ad: string | null; hata: string | null } {
  const f = input.files?.[0];
  if (!f) return { ad: null, hata: null };
  if (f.size > DOSYA_SINIRI) {
    input.value = "";
    const mb = (f.size / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    return { ad: null, hata: `Dosya çok büyük (${mb} MB). En fazla 4 MB yükleyebilirsiniz.` };
  }
  return { ad: f.name, hata: null };
}
