-- P1.2 Bot › Gelen kutusu.
--  1) Fırsatın sorumlusu (satis_hatti.sorumlu_id): konuşmanın atanmış kişisi fırsatın sorumlusudur ("Bana atanan").
--  2) Giden mesajın gönderen kullanıcısı ve teslim durumu (webhook statuses → teslim_durumlari_isle).
--  3) Kullanıcı başına okundu bilgisi (konusma_okumalari): okunmamış = son okunan mesajdan sonra gelen müşteri mesajları.
--  4) Gelen kutusu listesi tek sorguda (gelen_kutusu()): son mesaj, okunmamış sayısı, bağlı fırsat.
--  5) Supabase Realtime: konusmalar ve konusma_mesajlari yayına eklenir. Tarayıcı postgres_changes'i yalnızca "değişti"
--     sinyali olarak kullanır, veriyi sunucudan yeniden okur. Realtime her değişikliği abonenin JWT'siyle RLS'ten geçirir;
--     CRM ekibi dışındaki hiçbir hesap (bayi, anon) bu tablolardan olay alamaz.

-- 0) Oturumdaki CRM kullanıcısının kullanicilar.id'si (RLS ve işlevlerde tek sefer okunur)
create function private.kullanici_no()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select k.id from public.kullanicilar k where k.auth_id = (select auth.uid()) and k.k_aktif;
$$;
comment on function private.kullanici_no() is 'Oturumdaki aktif CRM kullanıcısının kimliği (yoksa null); yalnızca kendi auth.uid()''sine bakar';
revoke all on function private.kullanici_no() from public, anon, authenticated, service_role;
grant execute on function private.kullanici_no() to authenticated, service_role;

-- 1) Fırsat sorumlusu
alter table public.satis_hatti
  add column sorumlu_id bigint references public.kullanicilar (id) on delete set null;
create index satis_hatti_sorumlu_id_idx on public.satis_hatti (sorumlu_id) where sorumlu_id is not null;
comment on column public.satis_hatti.sorumlu_id is 'Fırsatın sorumlusu; konuşmanın atanmış kişisi de budur (Bot › Gelen kutusu "Bana atanan")';

-- 2) Giden mesaj: gönderen kullanıcı ve teslim durumu
alter table public.konusma_mesajlari
  add column gonderen_kullanici_id bigint references public.kullanicilar (id) on delete set null,
  add column teslim_durumu text,
  add column teslim_zamani timestamptz,
  add column teslim_hata_kodu text,
  add constraint konusma_mesajlari_gonderen_kullanici_check check (gonderen_kullanici_id is null or gonderen = 'temsilci'),
  add constraint konusma_mesajlari_teslim_durumu_check
    check (teslim_durumu is null or (yon = 'giden' and teslim_durumu in ('gonderildi', 'iletildi', 'okundu', 'basarisiz'))),
  add constraint konusma_mesajlari_teslim_hata_kodu_check check (length(teslim_hata_kodu) <= 20);
create index konusma_mesajlari_gonderen_kullanici_idx on public.konusma_mesajlari (gonderen_kullanici_id) where gonderen_kullanici_id is not null;
-- Okunmamış sayımı: konuşmanın müşteri mesajları, kimlik sırasıyla
create index konusma_mesajlari_gelen_idx on public.konusma_mesajlari (konusma_id, id) where yon = 'gelen';
comment on column public.konusma_mesajlari.gonderen_kullanici_id is 'CRM''den yazan temsilci (Bot › Gelen kutusu); echo (CRM dışından yazılan) mesajlarda boş';
comment on column public.konusma_mesajlari.teslim_durumu is 'Giden mesajın kanaldaki durumu (webhook): gonderildi → iletildi → okundu, ya da basarisiz; boşsa henüz bildirim gelmedi';
comment on column public.konusma_mesajlari.teslim_hata_kodu is 'Kanalın hata kodu (ör. WhatsApp 131047); açıklamasını kanal adaptörü verir. Mesaj içeriği yazılmaz';

-- 3) Kullanıcı başına okundu bilgisi
create table public.konusma_okumalari (
  kullanici_id        bigint not null references public.kullanicilar (id) on delete cascade,
  konusma_id          bigint not null references public.konusmalar (id) on delete cascade,
  son_okunan_mesaj_id bigint not null,
  okundu_at           timestamptz not null default now(),
  primary key (kullanici_id, konusma_id)
);
create index konusma_okumalari_konusma_id_idx on public.konusma_okumalari (konusma_id);
comment on table public.konusma_okumalari is 'Kullanıcının konuşmada okuduğu son mesaj; okunmamış sayısı bundan sonra gelen müşteri mesajlarıdır';

revoke all on public.konusma_okumalari from anon;
alter table public.konusma_okumalari enable row level security;
-- Herkes yalnızca kendi okundu satırlarını görür ve yazar
create policy kendi_okumasi on public.konusma_okumalari for all to authenticated
  using (kullanici_id = (select private.kullanici_no()))
  with check (kullanici_id = (select private.kullanici_no()));

-- Okundu işareti: geri gitmez (eski bir mesaj açılsa da son okunan küçülmez)
create function public.konusma_okundu(p_konusma_id bigint, p_mesaj_id bigint)
returns void
language sql security invoker set search_path = ''
as $$
  insert into public.konusma_okumalari as o (kullanici_id, konusma_id, son_okunan_mesaj_id)
  select (select private.kullanici_no()), p_konusma_id, p_mesaj_id
  where (select private.kullanici_no()) is not null
  on conflict (kullanici_id, konusma_id) do update
    set son_okunan_mesaj_id = greatest(o.son_okunan_mesaj_id, excluded.son_okunan_mesaj_id), okundu_at = now();
$$;

-- 4) Teslim durumları (webhook): yalnızca giden mesajda ve yalnızca ileri gider (Meta bildirimleri sırasız gelebilir:
--    "okundu"dan sonra gelen "iletildi" durumu geri almaz). basarisiz en son aşamadır.
--    p_durumlar: [{ "dis_mesaj_id": "...", "durum": "iletildi", "zaman": "ISO", "hata_kodu": "131047" }]
create function public.teslim_durumlari_isle(p_durumlar jsonb)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_sayi integer;
begin
  with d as (
    select x.dis_mesaj_id, x.durum, x.zaman, left(x.hata_kodu, 20) as hata_kodu,
           array_position(array['gonderildi', 'iletildi', 'okundu', 'basarisiz'], x.durum) as sira
    from jsonb_to_recordset(coalesce(p_durumlar, '[]'::jsonb)) as x(dis_mesaj_id text, durum text, zaman timestamptz, hata_kodu text)
  ), en_ileri as (
    select distinct on (dis_mesaj_id) * from d where sira is not null and dis_mesaj_id is not null order by dis_mesaj_id, sira desc
  )
  update public.konusma_mesajlari m
     set teslim_durumu = e.durum, teslim_zamani = coalesce(e.zaman, now()), teslim_hata_kodu = e.hata_kodu
    from en_ileri e
   where m.dis_mesaj_id = e.dis_mesaj_id
     and m.yon = 'giden'
     and coalesce(array_position(array['gonderildi', 'iletildi', 'okundu', 'basarisiz'], m.teslim_durumu), 0) < e.sira;
  get diagnostics v_sayi = row_count;
  return v_sayi;
end;
$$;

-- 5) Gelen kutusu: son mesajı olan konuşmalar, en yeni önce. security invoker: RLS geçerli (CRM ekibi).
create function public.gelen_kutusu(p_limit integer default 500)
returns table (
  id bigint, kanal text, kanal_hesap_id text, dis_kullanici_id text, dis_profil_adi text, bot_aktif boolean,
  son_musteri_mesaji_zamani timestamptz, satis_hatti_id bigint, firma text, asama_kod text, sorumlu_id bigint,
  son_mesaj_id bigint, son_metin text, son_zaman timestamptz, son_yon text, son_gonderen text, okunmamis integer
)
language sql stable security invoker set search_path = ''
as $$
  select k.id, k.kanal, k.kanal_hesap_id, k.dis_kullanici_id, k.dis_profil_adi, k.bot_aktif,
         k.son_musteri_mesaji_zamani, k.satis_hatti_id, f.f_firma, a.kod, f.sorumlu_id,
         s.id, left(s.metin, 200), s.zaman, s.yon, s.gonderen,
         (select count(*)::integer from public.konusma_mesajlari g
           where g.konusma_id = k.id and g.yon = 'gelen' and g.id > coalesce(o.son_okunan_mesaj_id, 0))
    from public.konusmalar k
    join lateral (
      select m.id, m.metin, m.zaman, m.yon, m.gonderen from public.konusma_mesajlari m
       where m.konusma_id = k.id order by m.zaman desc, m.id desc limit 1
    ) s on true
    left join public.satis_hatti f on f.id = k.satis_hatti_id
    left join public.asama a on a.id = f.asama_id
    left join public.konusma_okumalari o on o.konusma_id = k.id and o.kullanici_id = (select private.kullanici_no())
   order by s.zaman desc, k.id desc
   limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

revoke all on function
  public.konusma_okundu(bigint, bigint),
  public.teslim_durumlari_isle(jsonb),
  public.gelen_kutusu(integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.konusma_okundu(bigint, bigint),
  public.teslim_durumlari_isle(jsonb),
  public.gelen_kutusu(integer)
to authenticated, service_role;

-- 6) Realtime yayını (yalnızca Supabase'de vardır; boş Postgres'te / testte atlanır)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.konusmalar, public.konusma_mesajlari;
  end if;
end;
$$;
