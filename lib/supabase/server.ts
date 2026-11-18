// Sunucu tarafı Supabase istemcisi — createServerClient (@supabase/ssr) + next/headers cookies.
// Oturumdaki kullanıcının yetkileriyle çalışır (RLS). Server Component, Server Action ve route handler'larda kullanılır.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { io } from "next/cache";

export async function createClient() {
  const cerezler = await cookies();
  // Supabase oturumu okurken token süresini Date.now() ile karşılaştırır. Cache Components açıkken bu, prerender'da
  // (çerezler çözülmüş olsa bile) "unstable value Date.now()" hatası verir; io() prerender'da bekler, istekte hemen geçer.
  await io();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cerezler.getAll();
      },
      setAll(yazilacaklar) {
        try {
          for (const { name, value, options } of yazilacaklar) cerezler.set(name, value, options);
        } catch {
          // Server Component içinden çerez yazılamaz; oturum yenilemesini proxy.ts üstleniyor.
        }
      },
    },
  });
}
