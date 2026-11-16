// RMA ekranlarının paylaştığı yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import { ADIM_ADI, type RmaKaydi } from "./queries";

/** Kapanmış: müşteriye gönderildi ya da iade kararıyla tamamlandı (cihaz geri gönderilmez). Gönderim bekleyen tamamlanmış kayıt hâlâ açıktır. */
export const acikMi = (r: Pick<RmaKaydi, "adim" | "karar">) => !(r.adim === "gonderildi" || (r.adim === "tamamlandi" && r.karar === "iade"));
export const kapsamda = (r: Pick<RmaKaydi, "garantide" | "garantiElle">) => r.garantiElle ?? r.garantide;

export function adimTonu(r: RmaKaydi): ChipTon {
  if (!acikMi(r)) return r.karar === "red" ? "gray" : "ok";
  if (r.adim === "karar") return "lime";
  return r.adim === "talep" ? "warn" : "info";
}
export const adimEtiketi = (r: RmaKaydi) => ADIM_ADI[r.adim];

export const tarihYaz = (t: string) => new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

/** Açılıştan kapanışa (ya da bugüne) geçen gün */
export const gunSay = (bas: string, bit: string) => Math.max(0, Math.round((Date.parse(bit) - Date.parse(bas)) / 86_400_000));

/** Aynı cihazın bu kayıttan önce açılmış RMA sayısı (tekrar eden arıza) */
export const tekrarSayisi = (r: Pick<RmaKaydi, "id" | "seriNo" | "acilis">, tum: Pick<RmaKaydi, "id" | "seriNo" | "acilis">[]) =>
  tum.filter((x) => x.id !== r.id && x.seriNo === r.seriNo && (x.acilis < r.acilis || (x.acilis === r.acilis && x.id < r.id))).length;

/** Garanti dışı, servis ücreti belirlenmiş ama müşteri onayı alınmamış kayıt */
export const onayBekliyor = (r: Pick<RmaKaydi, "garantide" | "garantiElle" | "ucret" | "ucretOnay">) => !kapsamda(r) && !!r.ucret && !r.ucretOnay;
