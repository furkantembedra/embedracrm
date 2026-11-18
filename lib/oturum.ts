// CRM oturumu: Supabase Auth hesabı kullanicilar.auth_id ile bağlı ve aktif olan ekip üyesi.
// (Bağlama e-posta onaylanınca veritabanı tetikleyicisiyle yapılır: supabase/migrations/…_rls_ve_auth.sql)
import { createClient } from "@/lib/supabase/server";
import { sistemdeMi } from "@/lib/supabase/db";
import type { Rol } from "@/components/operasyon/queries";

export type CrmKullanicisi = { id: string; ad: string; eposta: string; rol: string };

/** Oturumdaki CRM ekip üyesi; oturum yoksa ya da hesap ekipte değilse null */
export async function crmKullanicisi(): Promise<CrmKullanicisi | null> {
  const s = await createClient();
  const { data: claims } = await s.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data } = await s.from("kullanicilar").select("id, k_ad, k_eposta, k_rol, k_aktif").eq("auth_id", uid).maybeSingle();
  if (!data || !data.k_aktif) return null;
  return { id: `u${data.id}`, ad: data.k_ad, eposta: data.k_eposta, rol: data.k_rol };
}

/** Oturumdaki hesabın bağlı olduğu bayi (portal hesabı ve erişimi açıksa) */
export async function bayiHesabi(): Promise<{ bayiId: string } | null> {
  const s = await createClient();
  const { data: claims } = await s.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data } = await s.from("bayi_kullanicilari").select("bayi_id, bk_erisim").eq("auth_id", uid).maybeSingle();
  return data?.bk_erisim ? { bayiId: String(data.bayi_id) } : null;
}

/**
 * Her CRM Server Action'ının ilk satırı. Server Action'lar doğrudan POST ile çağrılabildiği için sayfadaki kontrol yetmez.
 * Oturum yoksa ya da hesap aktif ekip üyesi değilse, roller verilmişse ve kullanıcının rolü listede yoksa hata fırlatır.
 * sistemOlarak(…) içinde (webhook, zamanlayıcı) null döner: o yolların kendi doğrulaması var.
 */
export async function oturumGerekli(roller?: readonly Rol[]): Promise<CrmKullanicisi | null> {
  if (sistemdeMi()) return null;
  const k = await crmKullanicisi();
  if (!k) throw new Error("Oturum gerekli: lütfen tekrar giriş yapın.");
  if (roller && !roller.includes(k.rol as Rol)) throw new Error(`Bu işlem için yetkiniz yok (yalnızca ${roller.join(" / ")}).`);
  return k;
}
