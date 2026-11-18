// Her test dosyasından önce çalışır.
// Değişmez kural 8: gerçek API'ye (Meta, Anthropic, Supabase, Resend…) istek atan test çalıştırılmaz.
// fetch yalnızca bu makinedeki adreslere (sahte sunucular) izin verir; dışarı çıkmaya çalışan test hata alır.
const gercekFetch = globalThis.fetch;
const YEREL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

globalThis.fetch = (async (girdi: RequestInfo | URL, ayar?: RequestInit) => {
  const adres = new URL(typeof girdi === "string" ? girdi : girdi instanceof URL ? girdi.href : girdi.url);
  if (!YEREL.has(adres.hostname)) {
    throw new Error(`Testte gerçek ağa çıkılamaz: ${adres.origin} (sahte sunucu kullanın: test/sahte/)`);
  }
  return gercekFetch(girdi, ayar);
}) as typeof fetch;
