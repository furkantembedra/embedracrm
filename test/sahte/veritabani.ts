// Boş bir Postgres 17 (PGlite, süreç içinde) üzerinde repodaki supabase/migrations + supabase/seed.sql'i kurar.
// Supabase'in hazır sağladığı roller, auth ve storage şemaları burada küçük taklitlerle verilir;
// public'teki yeni tablolara authenticated / service_role yetkisi Supabase platformunun varsayılanıdır.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const KOK = path.resolve(import.meta.dirname, "../..");

const SUPABASE_TAKLIDI = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable
  as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

export const MIGRATIONLAR = readdirSync(path.join(KOK, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();

/**
 * Migration'ları sırayla, ardından (isteğe bağlı) seed'i uygular.
 * `oncesi` verilirse yalnızca adı ondan küçük migration'lar uygulanır (veri taşıyan migration'ı eski veriyle sınamak için;
 * kalanlar migrationUygula ile sonradan uygulanır).
 */
export async function bosVeritabani({ seed = true, oncesi }: { seed?: boolean; oncesi?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_TAKLIDI);
  for (const dosya of MIGRATIONLAR.filter((f) => !oncesi || f < oncesi)) {
    try {
      await db.exec(readFileSync(path.join(KOK, "supabase/migrations", dosya), "utf8"));
    } catch (e) {
      throw new Error(`Migration uygulanamadı: ${dosya}: ${(e as Error).message}`);
    }
  }
  if (seed) await db.exec(readFileSync(path.join(KOK, "supabase/seed.sql"), "utf8"));
  return db;
}

/** Tek bir migration dosyasını uygular */
export async function migrationUygula(db: PGlite, dosya: string) {
  await db.exec(readFileSync(path.join(KOK, "supabase/migrations", dosya), "utf8"));
}

/** Sorguyu verilen rol ve (varsa) oturum kullanıcısıyla, ayrı bir işlemde çalıştırıp geri alır */
export async function rolIle<T>(db: PGlite, rol: "anon" | "authenticated", kullanici: string | null, sql: string): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [kullanici ?? ""]);
    await tx.exec(`set local role ${rol}`);
    const r = await tx.query<T>(sql);
    await tx.rollback();
    return r.rows;
  });
}
