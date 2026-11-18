// E-posta onay / sihirli bağlantı dönüşü: Supabase'in gönderdiği bağlantı buraya ?code=… (PKCE) ya da
// ?token_hash=…&type=… ile gelir. Oturum açılır ve ?sonra= ile verilen site içi sayfaya gidilir.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(istek: NextRequest) {
  const u = istek.nextUrl;
  const sonraHam = u.searchParams.get("sonra") ?? "/";
  const sonra = sonraHam.startsWith("/") && !sonraHam.startsWith("//") ? sonraHam : "/";
  const giris = sonra.startsWith("/portal") ? "/portal/giris" : "/giris";
  const s = await createClient();

  const code = u.searchParams.get("code");
  const tokenHash = u.searchParams.get("token_hash");
  const type = u.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await s.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await s.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: { message: "Bağlantı eksik" } };

  if (error) return NextResponse.redirect(new URL(`${giris}?hata=onay`, u.origin));
  return NextResponse.redirect(new URL(sonra, u.origin));
}
