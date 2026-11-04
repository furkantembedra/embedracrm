// Her cihazın bildirim anahtarı: seri numarasından gizli bir sırla (HMAC) üretilir.
// Cihaza üretimde / lisans aktivasyonunda yazılır; CRM aynı hesabı yapıp doğrular.
// Sır yalnızca sunucuda durur. Canlıda .env.local'a CIHAZ_BILDIRIM_SIRRI=<uzun rastgele değer> ekleyin.
// Yalnızca sunucuda (route handler / server action) import edin; istemci bileşenine almayın.
import { createHmac, timingSafeEqual } from "node:crypto";

const DEMO_SIRRI = "embedra-demo-sirri";

function sir() {
  const s = process.env.CIHAZ_BILDIRIM_SIRRI;
  if (!s && process.env.NODE_ENV === "production") throw new Error("CIHAZ_BILDIRIM_SIRRI tanımlı değil");
  return s ?? DEMO_SIRRI;
}

export function cihazAnahtari(seriNo: string) {
  return createHmac("sha256", sir()).update(seriNo).digest("hex").slice(0, 32);
}

export function anahtarDogruMu(seriNo: string, anahtar: string) {
  const beklenen = Buffer.from(cihazAnahtari(seriNo));
  const gelen = Buffer.from(anahtar);
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
}
