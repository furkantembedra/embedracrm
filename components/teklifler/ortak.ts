// Teklif hesapları (sunucu ve tarayıcı ortak)
import { URUN_BILGI, type CihazModeli } from "@/lib/urunler";
import type { Teklif, TeklifKalemi } from "./queries";

/** "ONE" → "EmbedraONE", "ONE Lite" → "EmbedraONE LITE" */
export const cihazTamAdi = (m: CihazModeli) => `Embedra${URUN_BILGI[m].ad}`;

export function kalemAdi(k: TeklifKalemi) {
  if (k.tur === "cihaz") return `${cihazTamAdi(k.model)} cihaz`;
  if (k.tur === "lisans") return `ONESuite ${k.paket} lisans · 12 ay`;
  return k.aciklama;
}

export const kalemKdvli = (k: TeklifKalemi) => k.tur === "cihaz" || (k.tur === "ozel" && k.kdvli);

/** Ara toplam, iskonto, KDV matrahı, KDV ve genel toplam (KDV yalnızca cihaz / KDV'li kalemlere) */
export function teklifToplami(t: Pick<Teklif, "kalemler" | "iskonto" | "kdv">) {
  const ara = t.kalemler.reduce((s, k) => s + k.adet * k.birimFiyat, 0);
  const oran = Math.min(100, Math.max(0, t.iskonto)) / 100;
  const iskonto = Math.round(ara * oran);
  const kdvliAra = t.kalemler.filter(kalemKdvli).reduce((s, k) => s + k.adet * k.birimFiyat, 0);
  const kdv = Math.round(kdvliAra * (1 - oran) * t.kdv);
  const net = ara - iskonto; // KDV hariç (fırsat tutarı)
  return { ara, iskonto, net, kdv, toplam: net + kdv };
}

/** Gönderilmiş ama geçerlilik tarihi geçmiş teklif */
export function suresiDoldu(t: Pick<Teklif, "durum" | "gecerlilik">, bugun: string) {
  return t.durum === "gonderildi" && t.gecerlilik < bugun;
}

/** Fırsat kartı metni: "2× ONE + Pro+ lisans" (satış hattının icerikCoz'u bunu okuyabilir) */
export function teklifIcerigi(kalemler: TeklifKalemi[]) {
  const cihaz = kalemler.find((k) => k.tur === "cihaz");
  const lisans = kalemler.find((k) => k.tur === "lisans");
  const parca = [
    cihaz ? `${cihaz.adet}× ${URUN_BILGI[cihaz.model].ad}` : "",
    lisans ? `${lisans.adet > 1 ? `${lisans.adet}× ` : ""}${lisans.paket} lisans` : "",
  ].filter(Boolean);
  const diger = kalemler.filter((k) => k.tur === "ozel").length + Math.max(0, kalemler.filter((k) => k.tur !== "ozel").length - parca.length);
  return [parca.join(" + "), diger ? `+${diger} kalem` : ""].filter(Boolean).join(" ") || "Özel teklif";
}
