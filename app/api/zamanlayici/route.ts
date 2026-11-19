// Tüm zamanlanmış işleri tek çağrıda çalıştırır: planlı / sürekli kampanya gönderimleri ve otomasyon kuralları.
//   GET /api/zamanlayici   Authorization: Bearer <CRON_SECRET>
// Vercel'de vercel.json'daki cron tanımı çağırır (Hobby planda günde bir kez). Daha sık çalıştırmak için aynı adres
// Supabase pg_cron ya da harici bir zamanlayıcıyla, aynı başlıkla çağrılabilir. Geliştirmede ve `next start` ile
// instrumentation.ts aynı işleri dakikada bir zaten çalıştırır; Vercel'de o döngü kapalıdır.
// İki iş birbirinden bağımsızdır: biri hata verirse diğeri yine çalışır, hata yanıtta görünür.
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { zamanlayiciCalistir } from "@/components/pazarlama/gonderim";
import { otomasyonZamanlayici } from "@/components/otomasyon/motor";
import { cronYetkili } from "@/lib/cron";
import { gizliAnahtarVar } from "@/lib/supabase/admin";
import { sistemOlarak } from "@/lib/supabase/db";

export async function GET(istek: NextRequest) {
  if (!cronYetkili(istek.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  // Cron isteğinde oturum yok: işler gizli anahtarlı istemciyle çalışır
  if (!gizliAnahtarVar()) return NextResponse.json({ ok: false, hata: "SUPABASE_SECRET_KEY tanımlı değil." }, { status: 503 });
  const taban = process.env.SITE_URL || istek.nextUrl.origin;

  const [kampanya, otomasyon] = await Promise.allSettled([
    sistemOlarak(() => zamanlayiciCalistir(taban)),
    otomasyonZamanlayici(taban),
  ]);
  if (kampanya.status === "fulfilled" && kampanya.value.length) revalidatePath("/pazarlama");
  if (kampanya.status === "rejected") console.error("[zamanlayıcı] kampanya", kampanya.reason);
  if (otomasyon.status === "rejected") console.error("[zamanlayıcı] otomasyon", otomasyon.reason);

  const ok = kampanya.status === "fulfilled" && otomasyon.status === "fulfilled";
  return NextResponse.json(
    {
      ok,
      kampanya: kampanya.status === "fulfilled" ? { gonderim: kampanya.value.length } : { hata: "Kampanya zamanlayıcısı hata verdi." },
      // null: başka bir otomasyon çalıştırması sürüyordu (kilit), bu tur atlandı
      otomasyon: otomasyon.status === "fulfilled" ? otomasyon.value : { hata: "Otomasyon zamanlayıcısı hata verdi." },
    },
    { status: ok ? 200 : 500 },
  );
}
