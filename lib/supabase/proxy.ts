// Her istekte Supabase oturumunu yeniler (çerezleri tazeler) ve oturumu olmayanı giriş sayfasına yönlendirir.
// Rol kontrolü (CRM ekibi mi, bayi mi) burada değil, sayfa kabuklarında yapılır (lib/oturum.ts, components/portal/oturum.ts);
// veri erişimini zaten RLS sınırlar.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Oturum gerektirmeyen yollar: giriş sayfaları, e-posta onayı ve dışarıdan çağrılan API'ler (kendi doğrulamaları var) */
const ACIK_YOLLAR = [
  "/giris",
  "/portal/giris",
  "/auth/",
  "/api/cihaz-bildirimi",
  "/api/whatsapp/",
  "/api/abonelik",
  "/api/kampanya-zamanlayici",
];

export async function updateSession(request: NextRequest) {
  let yanit = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(yazilacaklar, basliklar) {
        for (const { name, value } of yazilacaklar) request.cookies.set(name, value);
        yanit = NextResponse.next({ request });
        for (const { name, value, options } of yazilacaklar) yanit.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(basliklar ?? {})) yanit.headers.set(k, v);
      },
    },
  });

  // createServerClient ile getClaims arasına kod koyma: oturum yenilemesi bozulur.
  const { data } = await supabase.auth.getClaims();
  const yol = request.nextUrl.pathname;

  const acik = ACIK_YOLLAR.some((y) => (y.endsWith("/") ? yol.startsWith(y) : yol === y || yol.startsWith(`${y}/`)));
  if (!data?.claims && !acik) {
    if (yol.startsWith("/api/")) return NextResponse.json({ ok: false, hata: "Oturum gerekli." }, { status: 401 });
    const hedef = request.nextUrl.clone();
    hedef.pathname = yol.startsWith("/portal") ? "/portal/giris" : "/giris";
    hedef.search = yol === "/" || yol === "/portal" ? "" : `?sonra=${encodeURIComponent(yol + request.nextUrl.search)}`;
    const y = NextResponse.redirect(hedef);
    for (const c of yanit.cookies.getAll()) y.cookies.set(c);
    return y;
  }
  return yanit;
}
