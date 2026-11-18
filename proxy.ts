// Next 16 "proxy" (eski adıyla middleware): Supabase oturumunu yeniler, oturumsuz isteği giriş sayfasına yönlendirir.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|pdf)$).*)"],
};
