// Sunucu açılınca bir kez çalışır. Geliştirmede (ve kendi sunucunuzda `next start` ile) kampanya zamanlayıcısını
// dakikada bir çalıştırır. Vercel gibi sunucusuz ortamlarda bunun yerine /api/kampanya-zamanlayici cron ile çağrılmalı.
// Zamanlayıcıda oturum yoktur: işler gizli anahtarlı Supabase istemcisiyle (sistemOlarak) çalışır.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  const g = globalThis as { __embedraZamanlayici?: ReturnType<typeof setInterval> };
  if (g.__embedraZamanlayici) clearInterval(g.__embedraZamanlayici);
  const { zamanlayiciCalistir } = await import("./components/pazarlama/gonderim");
  const { otomasyonZamanlayici } = await import("./components/otomasyon/motor");
  const { gizliAnahtarVar } = await import("./lib/supabase/admin");
  const { sistemOlarak } = await import("./lib/supabase/db");
  const taban = process.env.SITE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  let uyarildi = false;
  g.__embedraZamanlayici = setInterval(() => {
    // Gizli anahtar yoksa döngüyü öldürmeden bir kez uyar, her turda yeniden kontrol et (anahtar sonradan eklenebilir)
    if (!gizliAnahtarVar()) {
      if (!uyarildi) console.warn("[zamanlayıcı] SUPABASE_SECRET_KEY tanımlı değil; kampanya ve otomasyon zamanlayıcıları çalışmıyor.");
      uyarildi = true;
      return;
    }
    try {
      sistemOlarak(() => zamanlayiciCalistir(taban)).catch((e) => console.error("[kampanya zamanlayıcı]", e));
      otomasyonZamanlayici(taban).catch((e) => console.error("[otomasyon]", e));
    } catch (e) {
      console.error("[zamanlayıcı]", e);
    }
  }, 60_000);
}
