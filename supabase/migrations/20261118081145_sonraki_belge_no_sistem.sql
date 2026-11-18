-- Embedra CRM · sonraki_belge_no: oturumsuz sunucu işleri (service role) de çağırabilsin
create or replace function public.sonraki_belge_no(p_tur text)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
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
$$;
revoke all on function public.sonraki_belge_no(text) from public, anon;
grant execute on function public.sonraki_belge_no(text) to authenticated, service_role;
