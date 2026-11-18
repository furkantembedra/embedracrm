-- P0.1 tamamlama: kanaldan bağımsız konuşma modeli + normalize telefon sütunları
-- konusmalar  = yol haritasındaki "conversations"; konusma_mesajlari = "messages"

-- 1) Telefon normalizasyonu: components/whatsapp/telefon.ts › telefonNormalize ile aynı kurallar ("+905321234567" ya da null)
create function private.telefon_normal(girdi text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select case when length(d) between 10 and 15 then '+' || d end
  from (
    select regexp_replace(
      case
        when s like '+%' then substr(s, 2)
        when s like '00%' then substr(s, 3)
        when s like '0%' and length(s) = 11 then '90' || substr(s, 2)   -- 05xx… yurt içi
        when length(s) = 10 and s like '5%' then '90' || s               -- 5xx… yurt içi
        else s
      end, '\D', '', 'g') as d
    from (select regexp_replace(coalesce(girdi, ''), '[^0-9+]', '', 'g') as s) a
  ) b;
$$;
revoke all on function private.telefon_normal(text) from public, anon;
grant execute on function private.telefon_normal(text) to authenticated, service_role;

alter table public.musteri_yetkilileri add column y_tel_normal text generated always as (private.telefon_normal(y_tel)) stored;
create index musteri_yetkilileri_tel_normal_idx on public.musteri_yetkilileri (y_tel_normal) where y_tel_normal is not null;
alter table public.satis_hatti add column f_telefon_normal text generated always as (private.telefon_normal(f_telefon)) stored;
create index satis_hatti_telefon_normal_idx on public.satis_hatti (f_telefon_normal) where f_telefon_normal is not null;

-- 2) Konuşmalar: kanal + dış kullanıcı kimliği başına tek kayıt (WhatsApp: normalize telefon, Instagram: IGSID)
create table public.konusmalar (
  id                        bigint generated always as identity primary key,
  kanal                     text not null check (kanal in ('whatsapp', 'instagram')),
  dis_kullanici_id          text not null check (length(dis_kullanici_id) > 0),
  satis_hatti_id            bigint references public.satis_hatti (id) on delete set null,  -- şu an bağlı olduğu fırsat
  musteri_id                bigint references public.musteri (id) on delete set null,
  bot_aktif                 boolean not null default false,                                 -- P1.3'te açılıp kapatılır
  son_musteri_mesaji_zamani timestamptz,                                                    -- WhatsApp 24 saat penceresi
  created_at                timestamptz not null default now(),
  constraint konusmalar_kanal_kullanici_key unique (kanal, dis_kullanici_id)
);
create index konusmalar_satis_hatti_id_idx on public.konusmalar (satis_hatti_id);
create index konusmalar_musteri_id_idx on public.konusmalar (musteri_id);
comment on table public.konusmalar is 'Kanaldan bağımsız müşteri konuşması (WhatsApp, Instagram); kanal + dış kullanıcı kimliği tekil';

-- 3) Mesajlar: dış mesaj kimliği tekil (aynı Meta mesajı ikinci kez yazılamaz; ilk yazan işi alır)
create table public.konusma_mesajlari (
  id             bigint generated always as identity primary key,
  konusma_id     bigint not null references public.konusmalar (id) on delete cascade,
  satis_hatti_id bigint references public.satis_hatti (id) on delete set null,  -- mesaj işlendiğinde bağlandığı fırsat
  yon            text not null check (yon in ('gelen', 'giden')),
  gonderen       text not null check (gonderen in ('musteri', 'bot', 'temsilci')),
  dis_mesaj_id   text unique,                                                   -- Meta wamid / IG mid
  metin          text not null,
  tur            text not null default 'text',
  zaman          timestamptz not null,
  created_at     timestamptz not null default now(),
  constraint konusma_mesajlari_yon_gonderen_check check ((yon = 'gelen') = (gonderen = 'musteri'))
);
create index konusma_mesajlari_konusma_zaman_idx on public.konusma_mesajlari (konusma_id, zaman);
create index konusma_mesajlari_firsat_zaman_idx on public.konusma_mesajlari (satis_hatti_id, zaman);
comment on table public.konusma_mesajlari is 'Konuşma mesajları; gönderen: musteri | bot | temsilci';

-- 4) Yetki ve RLS: yalnızca CRM ekibi (webhook / bot gizli anahtarla yazar); anon hiç erişemez
revoke all on public.konusmalar, public.konusma_mesajlari from anon;
alter table public.konusmalar enable row level security;
alter table public.konusma_mesajlari enable row level security;
create policy crm_tam_erisim on public.konusmalar for all to authenticated
  using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()));
create policy crm_tam_erisim on public.konusma_mesajlari for all to authenticated
  using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()));

-- 5) Mevcut WhatsApp mesajlarını taşı (whatsapp_mesajlari artık kullanılmaz)
insert into public.konusmalar (kanal, dis_kullanici_id, satis_hatti_id, musteri_id, son_musteri_mesaji_zamani)
select distinct on (f.f_telefon_normal) 'whatsapp', f.f_telefon_normal, f.id, f.musteri_id,
  (select max(w2.w_zaman) from public.whatsapp_mesajlari w2 where w2.satis_hatti_id = f.id and w2.w_yon = 'gelen')
from public.whatsapp_mesajlari w join public.satis_hatti f on f.id = w.satis_hatti_id
where f.f_telefon_normal is not null
order by f.f_telefon_normal, f.id desc
on conflict (kanal, dis_kullanici_id) do nothing;

insert into public.konusma_mesajlari (konusma_id, satis_hatti_id, yon, gonderen, dis_mesaj_id, metin, tur, zaman, created_at)
select k.id, w.satis_hatti_id, w.w_yon, case when w.w_yon = 'gelen' then 'musteri' else 'temsilci' end, w.w_mesaj_id, w.w_metin, w.w_tur, w.w_zaman, w.created_at
from public.whatsapp_mesajlari w
join public.satis_hatti f on f.id = w.satis_hatti_id
join public.konusmalar k on k.kanal = 'whatsapp' and k.dis_kullanici_id = f.f_telefon_normal
on conflict (dis_mesaj_id) do nothing;

comment on table public.whatsapp_mesajlari is 'KULLANILMIYOR (18 Kasım 2026): mesajlar konusma_mesajlari tablosuna taşındı; silinebilir';
