// Tarayıcı tarafı Supabase istemcisi — createBrowserClient (@supabase/ssr).
// Giriş formları gibi istemci bileşenlerinde kullanılır; veri okuma / yazma sunucuda (queries.ts / actions.ts) yapılır.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
