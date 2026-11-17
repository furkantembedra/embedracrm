// Bayi portalı "Destek": bayinin açtığı destek talepleri (CRM › Destek'e "Bayi portalı" kanalıyla düşer).
// Bayi yalnızca kendi taleplerini, durum değişikliklerinin adını ve "Bayiye yanıt" notlarını görür; iç notlar görünmez.
import { DURUM_ADI, KONULAR, NOT_BILGI, getTalepler } from "@/components/destek/queries";
import { ONCELIKLER } from "@/lib/constants";
import { bayiVerisi } from "./veri";

export type PortalTalebi = {
  id: string;
  acilis: string;
  baslik: string;
  konu: string;
  oncelik: string;
  durum: string;
  durumKod: "yeni" | "islemde" | "beklemede" | "cozuldu";
  seriNo: string | null;
  akis: { zaman: string; kim: "bayi" | "embedra"; baslik: string; metin: string | null }[];
};

const GORUNUR = new Set(["acilis", "bayi", "bayiye", "islemde", "beklemede", "cozuldu", "yeniden"]);

export async function destekVerisi() {
  const v = await bayiVerisi();
  const talepler: PortalTalebi[] = (await getTalepler())
    .filter((t) => t.bayiId === v.bayi.id)
    .sort((a, b) => b.acilis.localeCompare(a.acilis))
    .map((t) => ({
      id: t.id, acilis: t.acilis, baslik: t.baslik, konu: t.konu, oncelik: t.oncelik, durum: DURUM_ADI[t.durum], durumKod: t.durum, seriNo: t.seriNo,
      akis: t.notlar.filter((n) => GORUNUR.has(n.tur)).map((n) => ({
        zaman: n.zaman,
        kim: n.tur === "bayi" || n.tur === "acilis" ? "bayi" as const : "embedra" as const,
        baslik: n.tur === "acilis" ? "Talebi açtınız" : n.tur === "bayi" ? "Mesajınız" : n.tur === "bayiye" ? "Embedra yanıtı" : NOT_BILGI[n.tur].ad,
        // Durum değişikliklerinde CRM'in yazdığı metin iç not olabilir: yalnızca açılış, bayi mesajı ve bayiye yanıt metni gösterilir
        metin: n.tur === "acilis" ? t.aciklama : n.tur === "bayi" || n.tur === "bayiye" ? n.metin : null,
      })),
    }));
  return {
    talepler,
    cihazlar: v.cihazlar.map((c) => ({ seriNo: c.seriNo, ad: `${c.seriNo} · ${c.musteriId ? c.musteri : "stokta"}` })),
    konular: [...KONULAR],
    oncelikler: [...ONCELIKLER],
    ozet: {
      acik: talepler.filter((t) => t.durumKod !== "cozuldu").length,
      yanitBekleyen: talepler.filter((t) => t.durumKod !== "cozuldu" && t.akis.at(-1)?.kim === "embedra").length,
    },
  };
}
export type DestekVerisi = Awaited<ReturnType<typeof destekVerisi>>;
