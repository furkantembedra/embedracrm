-- Embedra CRM · Supabase Auth + RLS
--
-- Erişim modeli
--   • CRM ekibi: auth.users hesabı kullanicilar.auth_id ile bağlı ve k_aktif = true olan kullanıcı → tüm tablolarda tam erişim.
--   • Bayi: bayi_kullanicilari.auth_id ile bağlı ve bk_erisim = true olan kullanıcı → yalnızca kendi bayi_id'sinin satırları.
--   • anon: hiçbir tabloya erişemez.
-- Hesap bağlama: Supabase Auth'ta açılan hesabın e-postası onaylandığında, aynı e-postalı kullanicilar /
-- bayi_kullanicilari satırına auth_id yazılır (tetikleyici aşağıda). Hesapları Supabase panelinden ya da
-- portalın "hesabını etkinleştir" akışından açılır; e-postası listede olmayan hesap hiçbir veriyi göremez.
-- Oturumsuz sunucu işleri (cihaz bildirimi, WhatsApp webhook'u, zamanlayıcılar) service role ile çalışır ve RLS'e takılmaz.

-- ─────────────────────────────────────────────────────────────
-- 1. Yetki fonksiyonları (API'ye açık olmayan "private" şemasında)
-- ─────────────────────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.crm_kullanicisi()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.kullanicilar k
    where k.auth_id = (select auth.uid()) and k.k_aktif
  );
$$;

create or replace function private.bayi_id()
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select bk.bayi_id from public.bayi_kullanicilari bk
  where bk.auth_id = (select auth.uid()) and bk.bk_erisim
  limit 1;
$$;

revoke all on function private.crm_kullanicisi() from public;
revoke all on function private.bayi_id() from public;
grant execute on function private.crm_kullanicisi() to authenticated;
grant execute on function private.bayi_id() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Auth hesabını e-postayla ekip / bayi kaydına bağla (yalnızca onaylı e-posta)
-- ─────────────────────────────────────────────────────────────
create or replace function private.auth_hesabini_bagla()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
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
$$;
revoke all on function private.auth_hesabini_bagla() from public;

create trigger auth_hesabini_bagla
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function private.auth_hesabini_bagla();

-- Bayi kullanıcısı kendi hesap satırında yalnızca bk_son_giris'i değiştirebilir
create or replace function private.bayi_hesabi_koru()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or private.crm_kullanicisi() then
    return new;   -- service role / CRM ekibi
  end if;
  if new.bayi_id is distinct from old.bayi_id or new.auth_id is distinct from old.auth_id
     or new.bk_eposta is distinct from old.bk_eposta or new.bk_erisim is distinct from old.bk_erisim then
    raise exception 'Bu alanı yalnızca Embedra ekibi değiştirebilir';
  end if;
  return new;
end;
$$;
revoke all on function private.bayi_hesabi_koru() from public;
create trigger bayi_kullanicilari_koru
  before update on public.bayi_kullanicilari
  for each row execute function private.bayi_hesabi_koru();

-- ─────────────────────────────────────────────────────────────
-- 3. Tüm tablolar: RLS açık, anon kapalı, CRM ekibine tam erişim
-- ─────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format(
      'create policy crm_tam_erisim on public.%I for all to authenticated using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()))',
      t.tablename);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Herkese (oturumlu) açık sabit listeler ve kendi hesabı
-- ─────────────────────────────────────────────────────────────
create policy oturumlu_okur on public.kaynak for select to authenticated using (true);
create policy oturumlu_okur on public.asama for select to authenticated using (true);
create policy oturumlu_okur on public.lisans_planlari for select to authenticated using (true);

create policy kendi_kaydi on public.kullanicilar for select to authenticated
  using (auth_id = (select auth.uid()));
create policy kendi_hesabi on public.bayi_kullanicilari for select to authenticated
  using (auth_id = (select auth.uid()));
create policy kendi_hesabi_guncelle on public.bayi_kullanicilari for update to authenticated
  using (auth_id = (select auth.uid())) with check (auth_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 5. Bayi: kendi satırlarını okur (yazma policy'leri portal işlemleriyle birlikte ayrı migration'da)
-- ─────────────────────────────────────────────────────────────
create policy bayi_okur on public.bayiler for select to authenticated using (id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_basvurulari for select to authenticated using (id = (select private.bayi_id()));
create policy bayi_temsilcisini_okur on public.kullanicilar for select to authenticated
  using (id = (select b.temsilci_id from public.bayiler b where b.id = (select private.bayi_id())));
create policy bayi_okur on public.ayarlar for select to authenticated using ((select private.bayi_id()) is not null);
create policy bayi_okur on public.stok_kalemleri for select to authenticated using ((select private.bayi_id()) is not null);

create policy bayi_okur on public.cihazlar for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.lisanslar for select to authenticated
  using (exists (select 1 from public.cihazlar c where c.id = cihaz_id and c.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.cihaz_surum_gecmisi for select to authenticated
  using (exists (select 1 from public.cihazlar c where c.id = cihaz_id and c.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.garanti_uzatmalari for select to authenticated
  using (exists (select 1 from public.cihazlar c where c.id = cihaz_id and c.bayi_id = (select private.bayi_id())));
-- bayinin son kullanıcıları (cihazı ya da hareketi üzerinden)
create policy bayi_okur on public.musteri for select to authenticated
  using (exists (select 1 from public.cihazlar c where c.musteri_id = musteri.id and c.bayi_id = (select private.bayi_id()))
      or exists (select 1 from public.bayi_hareketleri h where h.musteri_id = musteri.id and h.bayi_id = (select private.bayi_id())));

create policy bayi_okur on public.siparisler for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.siparis_kalemleri for select to authenticated
  using (exists (select 1 from public.siparisler s where s.id = siparis_id and s.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.siparis_notlari for select to authenticated
  using (exists (select 1 from public.siparisler s where s.id = siparis_id and s.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.siparis_lisans_atamalari for select to authenticated
  using (exists (select 1 from public.siparisler s where s.id = siparis_id and s.bayi_id = (select private.bayi_id())));

create policy bayi_okur on public.destek_talepleri for select to authenticated using (bayi_id = (select private.bayi_id()));
-- iç notlar (not / gorusme / yapilacak) bayiye görünmez
create policy bayi_okur on public.talep_notlari for select to authenticated
  using (n_tur not in ('not', 'gorusme', 'yapilacak')
     and exists (select 1 from public.destek_talepleri t where t.id = talep_id and t.bayi_id = (select private.bayi_id())));

create policy bayi_okur on public.rma_kayitlari for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.rma_gecmisi for select to authenticated
  using (exists (select 1 from public.rma_kayitlari r where r.id = rma_id and r.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.rma_ekleri for select to authenticated
  using (exists (select 1 from public.rma_kayitlari r where r.id = rma_id and r.bayi_id = (select private.bayi_id())));

create policy bayi_okur on public.bayi_hareketleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_hareket_kalemleri for select to authenticated
  using (exists (select 1 from public.bayi_hareketleri h where h.id = hareket_id and h.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.bayi_lisans_havuzu for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_yenileme_talepleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_duzeltme_talepleri for select to authenticated using (bayi_id = (select private.bayi_id()));

-- Bayinin kendi lead'leri: tam erişim (Embedra'nın da CRM policy'siyle erişimi var ama ekranda göstermez)
create policy bayi_yonetir on public.bayi_leadleri for all to authenticated
  using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_yonetir on public.bayi_lead_notlari for all to authenticated
  using (exists (select 1 from public.bayi_leadleri l where l.id = lead_id and l.bayi_id = (select private.bayi_id())))
  with check (exists (select 1 from public.bayi_leadleri l where l.id = lead_id and l.bayi_id = (select private.bayi_id())));
create policy bayi_yonetir on public.bayi_lead_teklifleri for all to authenticated
  using (exists (select 1 from public.bayi_leadleri l where l.id = lead_id and l.bayi_id = (select private.bayi_id())))
  with check (exists (select 1 from public.bayi_leadleri l where l.id = lead_id and l.bayi_id = (select private.bayi_id())));
create policy bayi_yonetir on public.bayi_lead_teklif_kalemleri for all to authenticated
  using (exists (select 1 from public.bayi_lead_teklifleri t join public.bayi_leadleri l on l.id = t.lead_id
                 where t.id = teklif_id and l.bayi_id = (select private.bayi_id())))
  with check (exists (select 1 from public.bayi_lead_teklifleri t join public.bayi_leadleri l on l.id = t.lead_id
                 where t.id = teklif_id and l.bayi_id = (select private.bayi_id())));

-- Dokümanlar / duyurular: herkese açık olanlar ya da bu bayiye hedeflenenler
create policy bayi_okur on public.bayi_dokumanlari for select to authenticated
  using ((select private.bayi_id()) is not null and (bd_hepsine or exists (
    select 1 from public.bayi_dokuman_hedefleri h where h.dokuman_id = id and h.bayi_id = (select private.bayi_id()))));
create policy bayi_okur on public.bayi_dokuman_hedefleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_duyurulari for select to authenticated
  using ((select private.bayi_id()) is not null and (bdu_hepsine or exists (
    select 1 from public.bayi_duyuru_hedefleri h where h.duyuru_id = id and h.bayi_id = (select private.bayi_id()))));
create policy bayi_okur on public.bayi_duyuru_hedefleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_yonetir on public.bayi_duyuru_okumalari for all to authenticated
  using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_yonetir on public.bayi_egitim_tamamlamalari for all to authenticated
  using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));

-- Bayiyle paylaşılan pazarlama içerikleri ve görselleri
create policy bayi_okur on public.icerikler for select to authenticated
  using (ic_bayi_paylas and (select private.bayi_id()) is not null);
create policy bayi_okur on public.icerik_medyalari for select to authenticated
  using (exists (select 1 from public.icerikler i where i.id = icerik_id and i.ic_bayi_paylas) and (select private.bayi_id()) is not null);
create policy bayi_okur on public.medya_dosyalari for select to authenticated
  using ((select private.bayi_id()) is not null and exists (
    select 1 from public.icerik_medyalari im join public.icerikler i on i.id = im.icerik_id
    where im.medya_id = medya_dosyalari.id and i.ic_bayi_paylas));

-- ─────────────────────────────────────────────────────────────
-- 6. Storage: özel bucket'lar
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('pazarlama-medya', 'pazarlama-medya', false, 26214400),
       ('bayi-dokumanlari', 'bayi-dokumanlari', false, 26214400),
       ('rma-ekleri', 'rma-ekleri', false, 10485760)
on conflict (id) do nothing;

create policy crm_tam_erisim on storage.objects for all to authenticated
  using (bucket_id in ('pazarlama-medya', 'bayi-dokumanlari', 'rma-ekleri') and (select private.crm_kullanicisi()))
  with check (bucket_id in ('pazarlama-medya', 'bayi-dokumanlari', 'rma-ekleri') and (select private.crm_kullanicisi()));

create policy bayi_dokuman_okur on storage.objects for select to authenticated
  using (bucket_id = 'bayi-dokumanlari' and exists (
    select 1 from public.bayi_dokumanlari d where d.bd_yol = name));   -- satırın kendi RLS'i hedefi kontrol eder
create policy bayi_medya_okur on storage.objects for select to authenticated
  using (bucket_id = 'pazarlama-medya' and exists (
    select 1 from public.medya_dosyalari m where m.id::text = name));
-- RMA ekleri: "<rma_id>/<dosya>" yolunda, kendi RMA'sı
create policy bayi_rma_eki on storage.objects for select to authenticated
  using (bucket_id = 'rma-ekleri' and exists (
    select 1 from public.rma_kayitlari r where r.id::text = (storage.foldername(name))[1] and r.bayi_id = (select private.bayi_id())));
create policy bayi_rma_eki_yukler on storage.objects for insert to authenticated
  with check (bucket_id = 'rma-ekleri' and exists (
    select 1 from public.rma_kayitlari r where r.id::text = (storage.foldername(name))[1] and r.bayi_id = (select private.bayi_id())));
