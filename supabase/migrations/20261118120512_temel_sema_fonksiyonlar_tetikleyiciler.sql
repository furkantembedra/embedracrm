-- Embedra CRM · şema (3/4): yardımcı fonksiyonlar (security definer, search_path ''), izinleri ve tetikleyiciler
CREATE OR REPLACE FUNCTION private.crm_kullanicisi()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.kullanicilar k
    where k.auth_id = (select auth.uid()) and k.k_aktif
  );
$function$;

CREATE OR REPLACE FUNCTION private.bayi_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select bk.bayi_id from public.bayi_kullanicilari bk
  where bk.auth_id = (select auth.uid()) and bk.bk_erisim
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.bayinin_cihazi(p_seri text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.cihazlar c
    where c.c_serino = p_seri and c.bayi_id = (select private.bayi_id())
  );
$function$;

CREATE OR REPLACE FUNCTION private.bayinin_rmasi(p_rma text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.rma_kayitlari r
    where r.id::text = p_rma
      and (r.bayi_id = (select private.bayi_id())
           or exists (select 1 from public.cihazlar c where c.c_serino = r.r_seri_no and c.bayi_id = (select private.bayi_id())))
  );
$function$;

CREATE OR REPLACE FUNCTION private.auth_hesabini_bagla()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  update public.kullanicilar set auth_id = new.id
    where lower(k_eposta) = lower(new.email) and auth_id is null;
  update public.bayi_kullanicilari set auth_id = new.id
    where lower(bk_eposta) = lower(new.email) and auth_id is null;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.bayi_alanlari_koru()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or private.crm_kullanicisi() then
    return new;
  end if;
  if (to_jsonb(new) - tg_argv) is distinct from (to_jsonb(old) - tg_argv) then
    raise exception 'Bu alanı yalnızca Embedra ekibi değiştirebilir (%)', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.bayi_havuz_koru()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or private.crm_kullanicisi() then
    return new;
  end if;
  if new.blh_adet > old.blh_adet then
    raise exception 'Lisans havuzuna yalnızca Embedra ekibi lisans ekleyebilir' using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.bayi_hesabi_koru()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or private.crm_kullanicisi() then
    return new;
  end if;
  if new.bayi_id is distinct from old.bayi_id or new.auth_id is distinct from old.auth_id
     or new.bk_eposta is distinct from old.bk_eposta or new.bk_erisim is distinct from old.bk_erisim then
    raise exception 'Bu alanı yalnızca Embedra ekibi değiştirebilir';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sonraki_belge_no(p_tur text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  -- service role (oturumsuz sunucu işi) ya da CRM ekibi / erişimi açık bayi; anon'un çalıştırma yetkisi yok
  if (select auth.uid()) is not null and not (private.crm_kullanicisi() or private.bayi_id() is not null) then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_tur = 'siparis' then
    select coalesce(max(split_part(sp_no, '-', 3)::int), 0) + 1 into n from public.siparisler where sp_no ~ '^S-\d+-\d+$';
    return 'S-26-' || n;
  elsif p_tur = 'rma' then
    select coalesce(max(substr(r_no, 5)::int), 0) + 1 into n from public.rma_kayitlari where r_no ~ '^RMA-\d+$';
    return 'RMA-' || lpad(n::text, 4, '0');
  elsif p_tur = 'iade' then
    select coalesce(max(substr(ia_no, 3)::int), 0) + 1 into n from public.iadeler where ia_no ~ '^R-\d+$';
    return 'R-' || lpad(n::text, 4, '0');
  end if;
  raise exception 'Bilinmeyen belge türü: %', p_tur;
end;
$function$;

-- İzinler eski projeyle aynı: tetikleyici fonksiyonları yalnızca postgres; RLS yardımcıları authenticated
revoke all on function private.crm_kullanicisi(), private.bayi_id(), private.bayinin_cihazi(text), private.bayinin_rmasi(text),
  private.auth_hesabini_bagla(), private.bayi_alanlari_koru(), private.bayi_havuz_koru(), private.bayi_hesabi_koru(),
  public.sonraki_belge_no(text) from public, anon, authenticated, service_role;
grant execute on function private.crm_kullanicisi(), private.bayi_id(), private.bayinin_cihazi(text), private.bayinin_rmasi(text) to authenticated;
grant execute on function public.sonraki_belge_no(text) to authenticated, service_role;

CREATE TRIGGER bayi_kullanicilari_koru BEFORE UPDATE ON public.bayi_kullanicilari FOR EACH ROW EXECUTE FUNCTION private.bayi_hesabi_koru();
CREATE TRIGGER bayi_alanlari_koru BEFORE UPDATE ON public.bayi_lisans_havuzu FOR EACH ROW EXECUTE FUNCTION private.bayi_alanlari_koru('blh_adet');
CREATE TRIGGER bayi_havuz_koru BEFORE UPDATE ON public.bayi_lisans_havuzu FOR EACH ROW EXECUTE FUNCTION private.bayi_havuz_koru();
CREATE TRIGGER bayi_alanlari_koru BEFORE UPDATE ON public.cihazlar FOR EACH ROW EXECUTE FUNCTION private.bayi_alanlari_koru('musteri_id', 'c_sahip_adi', 'c_ulke', 'plan_id', 'c_lisans_bat', 'c_lisans_bit', 'c_durum');
CREATE TRIGGER bayi_alanlari_koru BEFORE UPDATE ON public.destek_talepleri FOR EACH ROW EXECUTE FUNCTION private.bayi_alanlari_koru('t_durum');
CREATE TRIGGER bayi_alanlari_koru BEFORE UPDATE ON public.rma_kayitlari FOR EACH ROW EXECUTE FUNCTION private.bayi_alanlari_koru('r_ucret_onay', 'r_gelis_kanal', 'r_gelis_takip');
CREATE TRIGGER bayi_alanlari_koru BEFORE UPDATE ON public.siparisler FOR EACH ROW EXECUTE FUNCTION private.bayi_alanlari_koru('sp_durum', 'sp_iptal_tarihi', 'sp_iptal_neden', 'sp_iptal_kim', 'sp_iptal_odeme_iadesi');
CREATE TRIGGER auth_hesabini_bagla AFTER INSERT OR UPDATE OF email_confirmed_at, email ON auth.users FOR EACH ROW EXECUTE FUNCTION private.auth_hesabini_bagla();
