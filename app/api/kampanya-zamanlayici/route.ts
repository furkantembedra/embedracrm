// Planlı ve sürekli kampanya gönderimlerini çalıştırır. Canlıda dakikada / saatte bir cron ile çağrılır:
//   GET /api/kampanya-zamanlayici   Authorization: Bearer <CRON_SECRET>
// (Vercel Cron bu başlığı CRON_SECRET tanımlıysa kendisi ekler.) Geliştirmede instrumentation.ts dakikada bir zaten çalıştırır.
// Kampanya ve otomasyonu birlikte çalıştıran adres /api/zamanlayici'dir (vercel.json onu çağırır); bu adres yalnızca kampanya içindir.
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { zamanlayiciCalistir } from "@/components/pazarlama/gonderim";
import { cronYetkili } from "@/lib/cron";
import { gizliAnahtarVar } from "@/lib/supabase/admin";
import { sistemOlarak } from "@/lib/supabase/db";

export async function GET(istek: NextRequest) {
  if (!cronYetkili(istek.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  // Cron isteğinde oturum yok: gizli anahtarlı istemciyle çalışır
  if (!gizliAnahtarVar()) return NextResponse.json({ ok: false, hata: "SUPABASE_SECRET_KEY tanımlı değil." }, { status: 503 });
  const gonderimler = await sistemOlarak(() => zamanlayiciCalistir(process.env.SITE_URL || istek.nextUrl.origin));
  if (gonderimler.length) revalidatePath("/pazarlama");
  return NextResponse.json({ ok: true, gonderim: gonderimler.length });
}
