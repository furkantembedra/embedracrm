// Cevap kutusunun hangi hâlde görüneceği (saf işlev; arayüz ve test aynı kuralı kullanır). Kanal adına göre dal yok:
// karar adaptörün pencere durumu ve kapaliPencereYolu'na göre verilir. Asıl kontrol sunucuda (components/konusma/gonder.ts).
import type { KapaliPencereYolu, PencereDurumu } from "@/components/konusma/kanallar/tur";

export type CevapModu =
  /** Serbest metin */
  | { tur: "serbest" }
  /** Serbest metin, kanalın insan temsilci etiketiyle (Instagram / Messenger HUMAN_AGENT, 7 gün) */
  | { tur: "etiketli"; bitis: string | null }
  /** Pencere kapalı, yalnızca onaylı şablon (WhatsApp) */
  | { tur: "sablon" }
  /** Pencere kapalı, kanaldan gönderilemez: e-posta / telefon */
  | { tur: "baska_kanal" }
  /** Kanalın adaptörü yok (Faz 4) */
  | { tur: "bagli_degil" };

export function cevapModu(k: { kanalBagli: boolean; pencere: PencereDurumu; kapaliPencereYolu: KapaliPencereYolu }): CevapModu {
  if (!k.kanalBagli) return { tur: "bagli_degil" };
  if (k.pencere.durum === "acik") return { tur: "serbest" };
  if (k.pencere.durum === "yalnizca_temsilci") return { tur: "etiketli", bitis: k.pencere.bitis };
  return { tur: k.kapaliPencereYolu === "sablon" ? "sablon" : "baska_kanal" };
}

export type Filtre = "bot" | "bekliyor" | "bana" | "kapali";

/** Liste filtresi ve arama (isim, firma, telefon / kimlik) */
export function listeyiSuz<T extends {
  kanal: string; ad: string; kimlik: string; disKullaniciId: string; firma: string | null; botAktif: boolean;
  sorumluId: string | null; son: { yon: "gelen" | "giden" }; pencere: PencereDurumu;
}>(liste: T[], o: { kanal: string | null; filtre: Filtre | null; arama: string; ben: string | null }): T[] {
  const q = o.arama.trim().toLocaleLowerCase("tr");
  const rakam = q.replace(/\D/g, "").replace(/^0+/, ""); // "0532…" yerel yazım da "+90532…" ile eşleşsin
  return liste.filter((x) => {
    if (o.kanal && x.kanal !== o.kanal) return false;
    if (o.filtre === "bot" && !x.botAktif) return false;
    if (o.filtre === "bekliyor" && (x.botAktif || x.son.yon !== "gelen")) return false;
    if (o.filtre === "bana" && (!o.ben || x.sorumluId !== o.ben)) return false;
    if (o.filtre === "kapali" && x.pencere.durum === "acik") return false;
    if (!q) return true;
    const metin = `${x.ad} ${x.firma ?? ""} ${x.kimlik}`.toLocaleLowerCase("tr");
    return metin.includes(q) || (rakam.length >= 3 && x.disKullaniciId.replace(/\D/g, "").includes(rakam));
  });
}
