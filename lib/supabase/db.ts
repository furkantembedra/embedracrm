// queries.ts dosyalarının kullandığı tek giriş noktası.
//  • Normalde oturumdaki kullanıcının istemcisini döner (RLS: CRM ekibi her şeyi, bayi yalnızca kendi satırlarını görür).
//  • sistemOlarak(() => …) içinde çağrılırsa gizli anahtarlı istemciyi döner (webhook, zamanlayıcı gibi oturumsuz işler).
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";
import { createAdminClient } from "./admin";

const sistem = new AsyncLocalStorage<SupabaseClient>();

export async function db(): Promise<SupabaseClient> {
  return sistem.getStore() ?? (await createClient());
}

/** sistemOlarak(…) içinde mi çalışıyoruz (webhook / zamanlayıcı)? */
export function sistemdeMi(): boolean {
  return sistem.getStore() !== undefined;
}

/** Oturumsuz sunucu işini gizli anahtarla çalıştırır (yalnızca route handler / zamanlayıcıdan çağırın). */
export function sistemOlarak<T>(is: () => Promise<T>): Promise<T> {
  return sistem.run(createAdminClient(), is);
}

/** Supabase yanıtındaki hatayı fırlatır, veriyi döner. */
export function sonuc<T>(r: { data: T; error: { message: string; code?: string } | null }, ne = "Veritabanı işlemi"): T {
  if (r.error) throw new Error(`${ne} başarısız: ${r.error.message}${r.error.code ? ` (${r.error.code})` : ""}`);
  return r.data;
}

/** "u2" ↔ 2: kullanıcı kimlikleri uygulamada "u" önekiyle taşınır (eski sabitler "u2", "u3"… çalışmaya devam eder). */
export const kullaniciKimligi = (id: number | string) => `u${id}`;
export const kullaniciNo = (id: string) => Number(String(id).replace(/^u/, ""));

/** Yerel saat dizesi: "2026-11-04T09:02" (timestamptz / timestamp sütunlarını uygulamanın biçimine çevirir) */
export function yerelZaman(v: string | null | undefined): string {
  if (!v) return "";
  if (!/[zZ]|[+-]\d\d(:?\d\d)?$/.test(v)) return v.replace(" ", "T").slice(0, 16); // timestamp (saat dilimi yok)
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
