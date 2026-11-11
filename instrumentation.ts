// Sunucu açılınca bir kez çalışır. Geliştirmede (ve kendi sunucunuzda `next start` ile) kampanya zamanlayıcısını
// dakikada bir çalıştırır. Vercel gibi sunucusuz ortamlarda bunun yerine /api/kampanya-zamanlayici cron ile çağrılmalı.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  const g = globalThis as { __embedraZamanlayici?: ReturnType<typeof setInterval> };
  if (g.__embedraZamanlayici) clearInterval(g.__embedraZamanlayici);
  const { zamanlayiciCalistir } = await import("./components/pazarlama/gonderim");
  const { otomasyonCalistir } = await import("./components/otomasyon/motor");
  const taban = process.env.SITE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  g.__embedraZamanlayici = setInterval(() => {
    zamanlayiciCalistir(taban).catch((e) => console.error("[kampanya zamanlayıcı]", e));
    otomasyonCalistir(taban).catch((e) => console.error("[otomasyon]", e));
  }, 60_000);
}
