// Planlı ve sürekli kampanya gönderimlerini çalıştırır. Canlıda dakikada / saatte bir cron ile çağrılır:
//   GET /api/kampanya-zamanlayici   Authorization: Bearer <CRON_SECRET>
// (Vercel Cron bu başlığı CRON_SECRET tanımlıysa kendisi ekler.) Geliştirmede instrumentation.ts dakikada bir zaten çalıştırır.
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { zamanlayiciCalistir } from "@/components/pazarlama/gonderim";

export async function GET(istek: NextRequest) {
  const sir = process.env.CRON_SECRET;
  if (!sir || istek.headers.get("authorization") !== `Bearer ${sir}`) return NextResponse.json({ ok: false }, { status: 401 });
  const gonderimler = await zamanlayiciCalistir(process.env.SITE_URL ?? istek.nextUrl.origin);
  if (gonderimler.length) revalidatePath("/pazarlama");
  return NextResponse.json({ ok: true, gonderim: gonderimler.length });
}
