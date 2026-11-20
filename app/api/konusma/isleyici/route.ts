// Konuşma kuyruğu işleyicisi (components/konusma/kuyruk.ts). Authorization: Bearer <CRON_SECRET>.
// Asıl tetikleyici Supabase pg_cron + pg_net (10 saniyede bir POST; kurulum docs/BOT_KURULUM.md "Konuşma işleyicisi").
// Vercel Cron Hobby planda günde bir kez çalıştığı için kullanılmaz; GET de kabul edilir ki elle / harici zamanlayıcıyla
// çağrılabilsin. Aynı anda birden çok çağrı güvenlidir: konuşma kilidi aynı konuşmanın işlerini tek işleyiciye verir.
import { NextResponse, type NextRequest } from "next/server";
import { konusmaIsleyicisi } from "@/components/bot/isleyici";
import { cronYetkili } from "@/lib/cron";
import { gizliAnahtarVar } from "@/lib/supabase/admin";
import { sistemOlarak } from "@/lib/supabase/db";

// İşleyici 25 sn sonra yeni konuşma almaz; elindeki konuşmayı (bot turu dahil: en çok ~60 sn Claude + gönderim)
// bitirmesi için pay. Bot turu sırasında fonksiyon öldürülürse tur kaybolur (kilit 120 sn sonra düşer).
export const maxDuration = 120;

async function calistir(istek: NextRequest) {
  if (!cronYetkili(istek.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  if (!gizliAnahtarVar()) return NextResponse.json({ ok: false, hata: "SUPABASE_SECRET_KEY tanımlı değil." }, { status: 503 });
  try {
    const r = await sistemOlarak(() => konusmaIsleyicisi());
    return NextResponse.json({ ok: true, konusma: r.konusma, islenen: r.islenen, hatali: r.hatali, botTuru: r.botTuru ?? 0 });
  } catch (e) {
    console.error(`[konuşma işleyicisi] ${(e as Error).message?.slice(0, 200)}`);
    return NextResponse.json({ ok: false, hata: "İşleyici hata verdi." }, { status: 500 });
  }
}

export const GET = calistir;
export const POST = calistir;
