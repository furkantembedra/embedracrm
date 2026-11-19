// Zamanlayıcı adreslerinin ortak doğrulaması: Authorization: Bearer <CRON_SECRET>.
// Vercel Cron bu başlığı CRON_SECRET tanımlıysa kendisi ekler. Secret tanımlı değilse hiçbir istek kabul edilmez.
// Yalnızca sunucuda import edin.
import { timingSafeEqual } from "node:crypto";

export function cronYetkili(authorization: string | null) {
  const sir = process.env.CRON_SECRET;
  if (!sir || !authorization) return false;
  const beklenen = Buffer.from(`Bearer ${sir}`);
  const gelen = Buffer.from(authorization);
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
}
