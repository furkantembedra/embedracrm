// Gizli anahtarla (service role) çalışan Supabase istemcisi: RLS'e takılmaz.
// YALNIZCA oturumu olmayan sunucu işleri için: ONESuite cihaz bildirimi, WhatsApp webhook'u, abonelikten çıkma
// bağlantısı, kampanya / otomasyon zamanlayıcısı. Sayfalar ve formlar bunu kullanmaz (lib/supabase/server.ts).
import { createClient } from "@supabase/supabase-js";

export function gizliAnahtarVar() {
  return !!process.env.SUPABASE_SECRET_KEY;
}

export function createAdminClient() {
  const anahtar = process.env.SUPABASE_SECRET_KEY;
  if (!anahtar) throw new Error("SUPABASE_SECRET_KEY tanımlı değil (.env.local). Oturumsuz sunucu işleri bu anahtar olmadan çalışmaz.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anahtar, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
