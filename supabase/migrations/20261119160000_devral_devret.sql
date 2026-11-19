-- P1.3 Devral, bota geri ver ve insana devretme.
--  1) kanal_ayarlari: yeni konuşmada bot açık mı (kanal başına; Bot › Kanallar'dan yalnızca Yönetici değiştirir, P2.4
--     bot modunu da buraya ekler). Yeni konuşma gelen_mesaj_kaydet'te bu değerle açılır.
--  2) konusmalar: devralan_id (konuşmayı devralan kişi; fırsat sorumlusundan ayrıdır, sorumlu değişmez),
--     devir_sebebi (bot devretti ve henüz ekipten kimse devralmadı / yazmadı → "Cevap bekliyor"), bot_notu (bota geri
--     verirken yazılan not; bot bir sonraki turda konusma_bot_notu_al ile okur ve not silinir), bot_durumu_zamani
--     (botun son açılış / kapanış zamanı: bot yalnızca bundan sonra gelen müşteri mesajlarına cevap verir, P2.1).
--  3) konusma_olaylari: sohbet içindeki sistem satırları (kim devraldı, kim bota geri verdi, bot neden devretti).
--     Ayrı tablo, çünkü bunlar müşteriyle yazışma değildir: konusma_mesajlari'na girselerdi 24 saat penceresi, okunmamış
--     sayısı, listedeki son mesaj ve botun modele verdiği son mesajlar ayrıca süzülmek zorunda kalırdı.
--  4) firsat_notlari: fırsata düşülen notlar ("Bot devretti: [sebep]"); satış hattında ve gelen kutusunda görünür.
--  5) Durum geçişleri tek işlemde, satır kilidiyle (FOR UPDATE): konusma_devral, konusma_bota_ver, konusma_bot_devretti.
--     Her biri durum gerçekten değiştiyse olay satırı yazar ve true döner (çift tıklama / tekrar → tek satır, tek bildirim).
--     İşlemi yapan kullanıcı oturumdan okunur (private.kullanici_no()); oturumsuz çağrıda (webhook / işleyici,
--     service_role) parametreden gelir. Böylece CRM kullanıcısı başkası adına devralmış görünemez.

-- 0) Rol yardımcısı (RLS: kanal ayarını yalnızca Yönetici değiştirir)
create function private.yonetici_mi()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.kullanicilar k where k.auth_id = (select auth.uid()) and k.k_aktif and k.k_rol = 'Yönetici');
$$;
comment on function private.yonetici_mi() is 'Oturumdaki kullanıcı aktif Yönetici mi; yalnızca kendi auth.uid()''sine bakar';
revoke all on function private.yonetici_mi() from public, anon, authenticated, service_role;
grant execute on function private.yonetici_mi() to authenticated;

-- 1) Kanal ayarları
create table public.kanal_ayarlari (
  kanal              text primary key check (kanal in ('whatsapp', 'instagram', 'messenger')),
  yeni_konusmada_bot boolean not null default false,
  -- 3 satırlık tablo: guncelleyen_id üzerinde indeks gerekmez (kullanıcı silinince taranacak satır sayısı en çok 3)
  guncelleyen_id     bigint references public.kullanicilar (id) on delete set null,
  updated_at         timestamptz not null default now()
);
comment on table public.kanal_ayarlari is 'Kanal başına bot ayarları (Bot › Kanallar). yeni_konusmada_bot: yeni konuşma bot açık başlar mı';
insert into public.kanal_ayarlari (kanal) values ('whatsapp'), ('instagram'), ('messenger');

revoke all on public.kanal_ayarlari from anon;
alter table public.kanal_ayarlari enable row level security;
create policy crm_okur on public.kanal_ayarlari for select to authenticated using ((select private.crm_kullanicisi()));
create policy yonetici_degistirir on public.kanal_ayarlari for update to authenticated
  using ((select private.yonetici_mi())) with check ((select private.yonetici_mi()));

-- 2) Konuşmanın devir durumu
alter table public.konusmalar
  add column devralan_id bigint references public.kullanicilar (id) on delete set null,
  add column devir_sebebi text,
  add column bot_notu text,
  add column bot_durumu_zamani timestamptz not null default now(),
  add constraint konusmalar_devir_sebebi_check check (devir_sebebi in (
    'fiyat_pazarligi', 'sikayet', 'ozel_fiyat', 'emin_degil', 'musteri_istedi', 'bayi_bolgesi', 'desteklenmeyen_dil',
    'veri_silme', 'bot_hatasi', 'tur_siniri', 'diger')),
  add constraint konusmalar_bot_notu_check check (length(bot_notu) <= 1000),
  -- Bot konuşurken ne devralan ne de bekleyen devir olabilir
  add constraint konusmalar_bot_devir_check check (not bot_aktif or (devralan_id is null and devir_sebebi is null));
create index konusmalar_devralan_id_idx on public.konusmalar (devralan_id) where devralan_id is not null;
comment on column public.konusmalar.devralan_id is 'Konuşmayı devralan kullanıcı (Devral ya da CRM''den cevap); fırsat sorumlusu bundan etkilenmez';
comment on column public.konusmalar.devir_sebebi is 'Bot devretti, ekipten henüz kimse devralmadı / yazmadı ("Cevap bekliyor"); sebep kodu';
comment on column public.konusmalar.bot_notu is 'Bota geri verirken yazılan not; bot bir sonraki turda konusma_bot_notu_al ile alır (alınca silinir)';
comment on column public.konusmalar.bot_durumu_zamani is 'Botun son açılış / kapanış zamanı; bot yalnızca bundan sonraki müşteri mesajlarına cevap verir';

-- 3) Sohbetteki sistem satırları
create table public.konusma_olaylari (
  id           bigint generated always as identity primary key,
  konusma_id   bigint not null references public.konusmalar (id) on delete cascade,
  tur          text not null check (tur in ('devralindi', 'bota_verildi', 'bot_devretti')),
  -- devralindi: dugme (Devral), cevap (Gelen kutusu'ndan yazdı), kanal_disi (echo: Meta gelen kutusu / telefon)
  kaynak       text check (kaynak in ('dugme', 'cevap', 'kanal_disi')),
  kullanici_id bigint references public.kullanicilar (id) on delete set null,
  sebep        text,
  aciklama     text check (length(aciklama) <= 1000),  -- bota_verildi: bota not · bot_devretti: botun kısa açıklaması
  zaman        timestamptz not null default now(),
  constraint konusma_olaylari_tur_kaynak_check check ((tur = 'devralindi') = (kaynak is not null)),
  constraint konusma_olaylari_tur_sebep_check check ((tur = 'bot_devretti') = (sebep is not null))
);
create index konusma_olaylari_konusma_zaman_idx on public.konusma_olaylari (konusma_id, zaman);
create index konusma_olaylari_kullanici_id_idx on public.konusma_olaylari (kullanici_id) where kullanici_id is not null;
comment on table public.konusma_olaylari is 'Konuşmadaki sistem satırları: kim devraldı, kim bota geri verdi, bot neden devretti. Müşteriye gitmez';

revoke all on public.konusma_olaylari from anon;
alter table public.konusma_olaylari enable row level security;
create policy crm_tam_erisim on public.konusma_olaylari for all to authenticated
  using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()));

-- 4) Fırsat notları
create table public.firsat_notlari (
  id             bigint generated always as identity primary key,
  satis_hatti_id bigint not null references public.satis_hatti (id) on delete cascade,
  tur            text not null default 'not' check (tur in ('not', 'bot_devretti')),
  metin          text not null check (length(metin) between 1 and 1000),
  kullanici_id   bigint references public.kullanicilar (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index firsat_notlari_firsat_idx on public.firsat_notlari (satis_hatti_id, created_at desc);
create index firsat_notlari_kullanici_id_idx on public.firsat_notlari (kullanici_id) where kullanici_id is not null;
comment on table public.firsat_notlari is 'Fırsata düşülen notlar (ör. "Bot devretti: Fiyat pazarlığı")';

revoke all on public.firsat_notlari from anon;
alter table public.firsat_notlari enable row level security;
create policy crm_tam_erisim on public.firsat_notlari for all to authenticated
  using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()));

-- 5a) Devral. p_kaynak: dugme | cevap | kanal_disi.
--     dugme: devralan her zaman bu kişi olur (başkasından da devralınabilir).
--     cevap: CRM'den yazan kişi, konuşmada devralan yoksa devralır; başkası devraldıysa devralan değişmez.
--     kanal_disi: kim yazdığı bilinmez; yalnızca bot susar / bekleyen devir kapanır.
create function public.konusma_devral(p_konusma_id bigint, p_kaynak text, p_kullanici_id bigint default null)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_kullanici bigint := coalesce((select private.kullanici_no()), p_kullanici_id);
  v_k public.konusmalar%rowtype;
  v_devralan bigint;
begin
  if p_kaynak is null or p_kaynak not in ('dugme', 'cevap', 'kanal_disi') then
    raise exception 'Geçersiz devralma kaynağı' using errcode = '22023';
  end if;
  if p_kaynak = 'kanal_disi' then v_kullanici := null; end if;
  if p_kaynak = 'dugme' and v_kullanici is null then
    raise exception 'Devralan kullanıcı bilinmiyor' using errcode = '22023';
  end if;

  select * into v_k from public.konusmalar where id = p_konusma_id for update;
  if not found then return false; end if;

  v_devralan := case when p_kaynak = 'dugme' then v_kullanici else coalesce(v_k.devralan_id, v_kullanici) end;
  if not v_k.bot_aktif and v_k.devir_sebebi is null and v_k.devralan_id is not distinct from v_devralan then
    return false; -- değişiklik yok (zaten bu kişide / bot zaten kapalı)
  end if;

  update public.konusmalar set
    bot_aktif = false, devir_sebebi = null, devralan_id = v_devralan, bot_notu = null,
    bot_durumu_zamani = case when v_k.bot_aktif or v_k.devir_sebebi is not null then now() else v_k.bot_durumu_zamani end
  where id = p_konusma_id;
  insert into public.konusma_olaylari (konusma_id, tur, kaynak, kullanici_id)
  values (p_konusma_id, 'devralindi', p_kaynak, v_kullanici);
  return true;
end;
$$;
comment on function public.konusma_devral is 'Konuşmayı devralır (bot susar); değişiklik olduysa sistem satırı yazar ve true döner';

-- 5b) Bota geri ver: bot sıradaki müşteri mesajından itibaren devam eder; isteğe bağlı not bir sonraki turda bota gider
create function public.konusma_bota_ver(p_konusma_id bigint, p_not text default null, p_kullanici_id bigint default null)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_kullanici bigint := coalesce((select private.kullanici_no()), p_kullanici_id);
  v_not text := nullif(left(btrim(coalesce(p_not, '')), 1000), '');
  v_aktif boolean;
begin
  select bot_aktif into v_aktif from public.konusmalar where id = p_konusma_id for update;
  if not found then return false; end if;
  if v_aktif and v_not is null then return false; end if;
  update public.konusmalar set
    bot_aktif = true, devralan_id = null, devir_sebebi = null, bot_notu = coalesce(v_not, bot_notu),
    bot_durumu_zamani = case when v_aktif then bot_durumu_zamani else now() end
  where id = p_konusma_id;
  insert into public.konusma_olaylari (konusma_id, tur, kullanici_id, aciklama)
  values (p_konusma_id, 'bota_verildi', v_kullanici, v_not);
  return true;
end;
$$;
comment on function public.konusma_bota_ver is 'Konuşmayı bota geri verir (isteğe bağlı bota not); değişiklik olduysa sistem satırı yazar';

-- 5c) Bot devretti (P2.2 insana_devret aracı, P2.1 hata / tur sınırı). Yalnızca bot konuşuyorsa geçerli: bot kapalıyken
--     gelen çağrı (yarış, tekrar) hiçbir şey yapmaz, böylece bildirim de tek kez gider.
create function public.konusma_bot_devretti(p_konusma_id bigint, p_sebep text, p_aciklama text default null)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_aktif boolean;
begin
  select bot_aktif into v_aktif from public.konusmalar where id = p_konusma_id for update;
  if not found or not v_aktif then return false; end if;
  update public.konusmalar set bot_aktif = false, devir_sebebi = p_sebep, devralan_id = null, bot_notu = null, bot_durumu_zamani = now()
  where id = p_konusma_id;
  insert into public.konusma_olaylari (konusma_id, tur, sebep, aciklama)
  values (p_konusma_id, 'bot_devretti', p_sebep, nullif(left(btrim(coalesce(p_aciklama, '')), 1000), ''));
  return true;
end;
$$;
comment on function public.konusma_bot_devretti is 'Bot konuşmayı insana devreder ("Cevap bekliyor"); bot zaten kapalıysa hiçbir şey yapmaz';

-- 5d) Bota not: bir sonraki bot turu alır, alınca silinir (tek kez görülür)
create function public.konusma_bot_notu_al(p_konusma_id bigint)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_not text;
begin
  select bot_notu into v_not from public.konusmalar where id = p_konusma_id and bot_aktif for update;
  if v_not is not null then
    update public.konusmalar set bot_notu = null where id = p_konusma_id;
  end if;
  return v_not;
end;
$$;

-- 6) Yeni konuşma kanalın varsayılanıyla açılır (gövde 20261119100706 ile aynı, yalnızca konuşma eklemesi değişti)
create or replace function public.gelen_mesaj_kaydet(
  p_kanal text, p_kanal_hesap_id text, p_dis_kullanici_id text, p_dis_mesaj_id text,
  p_gonderen text, p_metin text, p_tur text, p_ek jsonb, p_zaman timestamptz, p_profil_adi text default null
) returns table (konusma_id bigint, mesaj_id bigint)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_konusma bigint;
  v_mesaj bigint;
  v_musteri boolean := p_gonderen = 'musteri';
begin
  if p_dis_mesaj_id is null or length(p_dis_mesaj_id) = 0 then
    raise exception 'dis_mesaj_id zorunlu' using errcode = '22023';
  end if;
  if p_gonderen not in ('musteri', 'temsilci') then
    raise exception 'Gelen mesajın göndereni musteri ya da temsilci (echo) olmalı' using errcode = '22023';
  end if;

  insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id, bot_aktif)
  values (p_kanal, p_kanal_hesap_id, p_dis_kullanici_id,
          coalesce((select a.yeni_konusmada_bot from public.kanal_ayarlari a where a.kanal = p_kanal), false))
  on conflict (kanal, kanal_hesap_id, dis_kullanici_id) do nothing;
  select k.id into strict v_konusma from public.konusmalar k
  where k.kanal = p_kanal and k.kanal_hesap_id = p_kanal_hesap_id and k.dis_kullanici_id = p_dis_kullanici_id;

  insert into public.konusma_mesajlari (konusma_id, yon, gonderen, dis_mesaj_id, metin, tur, ek, zaman)
  values (v_konusma, case when v_musteri then 'gelen' else 'giden' end, p_gonderen, p_dis_mesaj_id,
          p_metin, p_tur, coalesce(p_ek, '{}'::jsonb), p_zaman)
  on conflict (dis_mesaj_id) do nothing
  returning id into v_mesaj;
  if v_mesaj is null then
    return;
  end if;

  insert into public.konusma_isleri (konusma_id, mesaj_id, tur)
  values (v_konusma, v_mesaj, case when v_musteri then 'musteri_mesaji' else 'temsilci_mesaji' end);

  if v_musteri then
    update public.konusmalar k set
      son_musteri_mesaji_zamani = greatest(k.son_musteri_mesaji_zamani, p_zaman),
      dis_profil_adi = coalesce(nullif(left(btrim(p_profil_adi), 200), ''), k.dis_profil_adi)
    where k.id = v_konusma;
  end if;

  konusma_id := v_konusma;
  mesaj_id := v_mesaj;
  return next;
end;
$$;

-- 7) Gelen kutusu: devir durumu da döner (dönüş tipi değiştiği için yeniden oluşturulur)
drop function public.gelen_kutusu(integer);
create function public.gelen_kutusu(p_limit integer default 500)
returns table (
  id bigint, kanal text, kanal_hesap_id text, dis_kullanici_id text, dis_profil_adi text, bot_aktif boolean,
  devir_sebebi text, devralan_id bigint,
  son_musteri_mesaji_zamani timestamptz, satis_hatti_id bigint, firma text, asama_kod text, sorumlu_id bigint,
  son_mesaj_id bigint, son_metin text, son_zaman timestamptz, son_yon text, son_gonderen text, okunmamis integer
)
language sql stable security invoker set search_path = ''
as $$
  select k.id, k.kanal, k.kanal_hesap_id, k.dis_kullanici_id, k.dis_profil_adi, k.bot_aktif,
         k.devir_sebebi, k.devralan_id,
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
  public.konusma_devral(bigint, text, bigint),
  public.konusma_bota_ver(bigint, text, bigint),
  public.konusma_bot_devretti(bigint, text, text),
  public.konusma_bot_notu_al(bigint),
  public.gelen_kutusu(integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.konusma_devral(bigint, text, bigint),
  public.konusma_bota_ver(bigint, text, bigint),
  public.gelen_kutusu(integer)
to authenticated, service_role;
-- Bot devretmesi ve bota notu yalnızca sunucudaki bot / işleyici (service_role) ve geliştirme simülasyonu (CRM kullanıcısı)
grant execute on function
  public.konusma_bot_devretti(bigint, text, text),
  public.konusma_bot_notu_al(bigint)
to authenticated, service_role;

-- 8) Realtime: sistem satırları da sohbete anında düşsün
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.konusma_olaylari;
  end if;
end;
$$;
