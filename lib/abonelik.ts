// Abonelikten çıkma bağlantısı: kişinin kaydı (ref) ve kanal imzalanır, böylece bağlantı başkası adına uydurulamaz.
// Canlıda .env.local'a ABONELIK_SIRRI=<uzun rastgele değer> ekleyin. Yalnızca sunucuda import edin.
import { createHmac, timingSafeEqual } from "node:crypto";

const DEMO_SIRRI = "embedra-demo-abonelik";
function sir() {
  const s = process.env.ABONELIK_SIRRI;
  if (!s && process.env.NODE_ENV === "production") throw new Error("ABONELIK_SIRRI tanımlı değil");
  return s ?? DEMO_SIRRI;
}

export type AbonelikBilgisi = { ref: string; kanal: "eposta" | "whatsapp"; anahtar: string }; // anahtar: e-posta ya da telefon rakamları

const imza = (govde: string) => createHmac("sha256", sir()).update(govde).digest("base64url").slice(0, 32);

export function abonelikJetonu(b: AbonelikBilgisi) {
  const govde = Buffer.from(JSON.stringify([b.ref, b.kanal, b.anahtar])).toString("base64url");
  return `${govde}.${imza(govde)}`;
}

export function abonelikCoz(jeton: string): AbonelikBilgisi | null {
  const [govde, gelen] = jeton.split(".");
  if (!govde || !gelen) return null;
  const a = Buffer.from(imza(govde));
  const b = Buffer.from(gelen);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const [ref, kanal, anahtar] = JSON.parse(Buffer.from(govde, "base64url").toString()) as string[];
    if (kanal !== "eposta" && kanal !== "whatsapp") return null;
    return { ref, kanal, anahtar };
  } catch {
    return null;
  }
}
