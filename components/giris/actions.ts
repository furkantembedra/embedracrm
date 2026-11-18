"use server";
// CRM ve bayi portalı ortak giriş işlemleri (Supabase Auth, e-posta + şifre).
// Hesap yalnızca e-postası Operasyon › Ekip'te (CRM) ya da bayi portal hesaplarında kayıtlıysa bir şey görebilir;
// eşleştirme e-posta onaylanınca veritabanında yapılır.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bayiHesabi, crmKullanicisi } from "@/lib/oturum";

export type GirisDurumu = { hata?: string; bilgi?: string };

/** Yönlendirme hedefi yalnızca site içi bir yol olabilir */
function guvenliYol(v: FormDataEntryValue | null, varsayilan: string) {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : varsayilan;
}

async function siteAdresi() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const HATA_METNI: Record<string, string> = {
  invalid_credentials: "E-posta ya da şifre hatalı.",
  email_not_confirmed: "E-posta adresiniz henüz onaylanmadı. Gelen kutunuzdaki bağlantıya tıklayın.",
  over_request_rate_limit: "Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.",
  over_email_send_rate_limit: "Çok fazla e-posta istendi. Birkaç dakika sonra tekrar deneyin.",
  user_already_exists: "Bu e-postayla bir hesap zaten var. Giriş yapın.",
  weak_password: "Şifre çok zayıf. En az 8 karakter, harf ve rakam kullanın.",
};
const hataMetni = (e: { code?: string; message: string }) => HATA_METNI[e.code ?? ""] ?? `Giriş yapılamadı: ${e.message}`;

/** alan: "crm" → /giris, "portal" → /portal/giris */
export async function girisYap(_o: GirisDurumu, form: FormData): Promise<GirisDurumu> {
  const alan = form.get("alan") === "portal" ? "portal" : "crm";
  const eposta = String(form.get("eposta") ?? "").trim().toLowerCase();
  const sifre = String(form.get("sifre") ?? "");
  if (!eposta || !sifre) return { hata: "E-posta ve şifreyi girin." };

  const s = await createClient();
  const { error } = await s.auth.signInWithPassword({ email: eposta, password: sifre });
  if (error) return { hata: hataMetni(error) };

  const [crm, bayi] = await Promise.all([crmKullanicisi(), bayiHesabi()]);
  if (alan === "portal") {
    if (bayi) {
      await s.from("bayi_kullanicilari").update({ bk_son_giris: new Date().toISOString() }).eq("bayi_id", Number(bayi.bayiId)).ilike("bk_eposta", eposta);
      redirect(guvenliYol(form.get("sonra"), "/portal"));
    }
    if (crm) redirect("/bayiler"); // ekip üyesi portala "Bayi gibi görüntüle" ile girer
  } else {
    if (crm) redirect(guvenliYol(form.get("sonra"), "/genel-bakis"));
    if (bayi) redirect("/portal");
  }
  await s.auth.signOut();
  return {
    hata: alan === "portal"
      ? "Bu hesabın bayi portalı erişimi yok ya da kapalı. Embedra bayi sorumlunuzla görüşün."
      : "Bu hesap Embedra ekibinde kayıtlı değil. Yöneticinizden Operasyon › Ekip'e e-postanızı eklemesini isteyin.",
  };
}

/** İlk kez: kayıtlı e-postayla şifre belirleyip hesabı açar; onay e-postası gönderilir. */
export async function hesapEtkinlestir(_o: GirisDurumu, form: FormData): Promise<GirisDurumu> {
  const alan = form.get("alan") === "portal" ? "portal" : "crm";
  const eposta = String(form.get("eposta") ?? "").trim().toLowerCase();
  const sifre = String(form.get("sifre") ?? "");
  const tekrar = String(form.get("sifreTekrar") ?? "");
  if (!eposta || !sifre) return { hata: "E-posta ve şifreyi girin." };
  if (sifre.length < 8) return { hata: "Şifre en az 8 karakter olmalı." };
  if (sifre !== tekrar) return { hata: "Şifreler aynı değil." };

  const s = await createClient();
  const sonra = alan === "portal" ? "/portal" : "/genel-bakis";
  const { error } = await s.auth.signUp({
    email: eposta,
    password: sifre,
    options: { emailRedirectTo: `${await siteAdresi()}/auth/confirm?sonra=${encodeURIComponent(sonra)}` },
  });
  if (error) return { hata: hataMetni(error) };
  return { bilgi: "Onay bağlantısını e-postanıza gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsiniz." };
}

export async function cikisYap() {
  const s = await createClient();
  await s.auth.signOut();
  redirect("/giris");
}
