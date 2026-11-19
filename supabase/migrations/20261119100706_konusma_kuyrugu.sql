-- P1.1 Konuşma kuyruğu ve konuşma kilidi.
-- Webhook Meta'ya hızlı 200 dönmek için yalnızca mesajı kaydeder ve kuyruğa iş yazar (public.gelen_mesaj_kaydet);
-- ağır işi (fırsat eşleştirme / yeni lead / müşteri zaman çizelgesi, P2.1'de bot) işleyici yapar
-- (components/konusma/kuyruk.ts, /api/konusma/isleyici). Aynı konuşmanın işleri asla paralel işlenmez:
-- işleyici önce konuşma kilidini alır (kilit sütunu + süre aşımı).
--
-- Neden advisory lock değil: uygulama veritabanına PostgREST (supabase-js) üzerinden gider; her istek ayrı bir
-- işlemdir ve bağlantı havuzlanır. Oturum düzeyindeki advisory lock başka isteklere sızar, işlem düzeyindeki ise
-- tek RPC bitince düşer; işleyicinin birden çok istekten oluşan işini kapsayamaz. Süreli kilit sütunu ise
-- çöken işleyicinin kilidini kendiliğinden bırakır (kilit_bitis geçince başka işleyici alabilir).

-- 1) Konuşma kilidi ve kanal profil adı
alter table public.konusmalar
  add column kilit_sahibi uuid,
  add column kilit_bitis timestamptz,
  add column dis_profil_adi text constraint konusmalar_dis_profil_adi_check check (length(dis_profil_adi) <= 200);
comment on column public.konusmalar.kilit_sahibi is 'Konuşmanın işlerini şu an işleyen işleyicinin kimliği (konusma_kilidi_al); kilit_bitis geçmişse kilit yok sayılır';
comment on column public.konusmalar.kilit_bitis is 'Konuşma kilidinin süresi; işleyici çökerse bu zamandan sonra başka işleyici alır';
comment on column public.konusmalar.dis_profil_adi is 'Müşterinin kanaldaki profil adı (WhatsApp profil adı, IG kullanıcı adı…); yeni lead firma adı için, son gelen mesajla güncellenir';

-- 2) Kuyruk
create table public.konusma_isleri (
  id             bigint generated always as identity primary key,
  konusma_id     bigint not null references public.konusmalar (id) on delete cascade,
  mesaj_id       bigint not null references public.konusma_mesajlari (id) on delete cascade,
  tur            text not null check (tur in ('musteri_mesaji', 'temsilci_mesaji')),
  durum          text not null default 'bekliyor' check (durum in ('bekliyor', 'tamam', 'hata')),
  deneme         integer not null default 0 check (deneme >= 0),
  sonraki_deneme timestamptz not null default now(),
  son_hata       text check (length(son_hata) <= 500),
  islendi_at     timestamptz,
  created_at     timestamptz not null default now()
);
comment on table public.konusma_isleri is
  'Konuşma kuyruğu: webhook mesajı kaydedip buraya iş yazar, işleyici (components/konusma/kuyruk.ts) konuşma kilidiyle sırayla işler. son_hata yalnızca hata türü/mesajı içerir, müşteri metni içermez';
-- İşleyicinin aradığı: zamanı gelmiş bekleyen işler (kısmi indeks, tamamlanan işler indekse girmez)
create index konusma_isleri_bekleyen_idx on public.konusma_isleri (konusma_id, id) where durum = 'bekliyor';
create index konusma_isleri_mesaj_id_idx on public.konusma_isleri (mesaj_id);

-- 3) Yetki ve RLS: anon hiç erişemez; webhook / işleyici gizli anahtarla (service_role), simülasyon CRM kullanıcısıyla
revoke all on public.konusma_isleri from anon;
alter table public.konusma_isleri enable row level security;
create policy crm_tam_erisim on public.konusma_isleri for all to authenticated
  using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()));

-- 4) Gelen mesajı kaydet: konuşmayı bul / aç, mesajı yaz, kuyruğa iş ekle. Tek işlemde (atomik) ve tek istekte.
--    Aynı dis_mesaj_id zaten kayıtlıysa (Meta tekrar gönderdi, iki webhook aynı anda geldi ya da CRM'in / botun kendi
--    gönderdiği mesajın echo'su) hiçbir şey yazılmaz ve boş sonuç döner.
--    security invoker: çağıranın yetkisi ve RLS'i geçerli (service_role ya da CRM ekibi).
create function public.gelen_mesaj_kaydet(
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

  insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id)
  values (p_kanal, p_kanal_hesap_id, p_dis_kullanici_id)
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

  -- 24 saat penceresi müşterinin son mesajından hesaplanır (geç gelen eski mesaj zamanı geri almaz)
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
comment on function public.gelen_mesaj_kaydet is
  'Webhook: konuşma + mesaj + kuyruk işi tek işlemde; aynı dis_mesaj_id ikinci kez gelirse hiçbir şey yazmaz (boş sonuç)';

-- 5) Konuşma kilidi al: zamanı gelmiş bekleyen işi olan, kilitsiz (ya da kilidinin süresi geçmiş) en eski konuşmayı
--    kilitler ve kimliğini döner; yoksa null. p_konusma_id verilirse yalnızca o konuşmaya bakar (simülasyon).
--    Konuşmanın işleri sırayla işlenir: en eski bekleyen işi henüz zamanı gelmemiş bir tekrar denemesiyse konuşma alınmaz.
--    FOR UPDATE SKIP LOCKED: aynı anda çalışan iki işleyici aynı konuşmayı seçemez, birbirini de beklemez.
create function public.konusma_kilidi_al(p_sahip uuid, p_sure_sn integer default 120, p_konusma_id bigint default null)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare v_konusma bigint;
begin
  if p_sure_sn not between 5 and 900 then
    raise exception 'Kilit süresi 5–900 saniye olmalı' using errcode = '22023';
  end if;
  update public.konusmalar k
  set kilit_sahibi = p_sahip, kilit_bitis = now() + make_interval(secs => p_sure_sn)
  where k.id = (
    select k2.id
    from public.konusma_isleri i
    join public.konusmalar k2 on k2.id = i.konusma_id
    where i.durum = 'bekliyor' and i.sonraki_deneme <= now()
      -- sıra korunur: konuşmanın en eski bekleyen işi tekrar beklemesindeyse sonrakiler de bekler
      and not exists (select 1 from public.konusma_isleri j
                      where j.konusma_id = i.konusma_id and j.durum = 'bekliyor' and j.id < i.id)
      and (k2.kilit_bitis is null or k2.kilit_bitis < now())
      and (p_konusma_id is null or i.konusma_id = p_konusma_id)
    order by i.id
    limit 1
    for update of k2 skip locked
  )
  -- satır kilidi alındıktan sonra koşul yeni sürüm üzerinde yeniden denetlenir (READ COMMITTED)
  and (k.kilit_bitis is null or k.kilit_bitis < now())
  returning k.id into v_konusma;
  return v_konusma;
end;
$$;

-- 6) İşi bitir: yalnızca kilidi hâlâ elinde tutan işleyici yazabilir (süresi geçip başkasına geçtiyse false döner).
--    p_hata null → tamam; değilse deneme artar, bekleme 30 sn × 2^deneme (en çok 5 deneme, sonra 'hata').
--    Her başarılı çağrı kilidi p_sure_sn kadar uzatır.
create function public.konusma_isi_bitir(p_is_id bigint, p_sahip uuid, p_hata text default null, p_sure_sn integer default 120)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_konusma bigint;
begin
  update public.konusmalar k set kilit_bitis = now() + make_interval(secs => p_sure_sn)
  from public.konusma_isleri i
  where i.id = p_is_id and k.id = i.konusma_id and k.kilit_sahibi = p_sahip and k.kilit_bitis >= now()
  returning k.id into v_konusma;
  if v_konusma is null then
    return false;
  end if;
  if p_hata is null then
    update public.konusma_isleri set durum = 'tamam', islendi_at = now(), son_hata = null where id = p_is_id;
  else
    update public.konusma_isleri set
      deneme = deneme + 1,
      son_hata = left(p_hata, 500),
      durum = case when deneme + 1 >= 5 then 'hata' else 'bekliyor' end,
      sonraki_deneme = now() + make_interval(secs => 30 * power(2, deneme)::integer)
    where id = p_is_id;
  end if;
  return true;
end;
$$;

-- 7) Kilidi bırak: 'birakildi' | 'devam' (bu arada zamanı gelmiş yeni iş eklenmiş: kilit bırakılmaz, uzatılır;
--    işleyici aynı konuşmaya devam eder, böylece işlemeyi bitirip kilidi bırakma arasına düşen iş beklemez) |
--    'kayip' (kilit süresi geçip başka işleyiciye geçmiş).
create function public.konusma_kilidi_birak(p_konusma_id bigint, p_sahip uuid, p_sure_sn integer default 120)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare v_sahip uuid;
begin
  select k.kilit_sahibi into v_sahip from public.konusmalar k where k.id = p_konusma_id for update;
  if v_sahip is distinct from p_sahip then
    return 'kayip';
  end if;
  -- konuşmanın en eski bekleyen işinin zamanı gelmişse devam (tekrar beklemesindeki iş sırayı tutar)
  if (select i.sonraki_deneme <= now() from public.konusma_isleri i
      where i.konusma_id = p_konusma_id and i.durum = 'bekliyor' order by i.id limit 1) then
    update public.konusmalar set kilit_bitis = now() + make_interval(secs => p_sure_sn) where id = p_konusma_id;
    return 'devam';
  end if;
  update public.konusmalar set kilit_sahibi = null, kilit_bitis = null where id = p_konusma_id;
  return 'birakildi';
end;
$$;

revoke all on function
  public.gelen_mesaj_kaydet(text, text, text, text, text, text, text, jsonb, timestamptz, text),
  public.konusma_kilidi_al(uuid, integer, bigint),
  public.konusma_isi_bitir(bigint, uuid, text, integer),
  public.konusma_kilidi_birak(bigint, uuid, integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.gelen_mesaj_kaydet(text, text, text, text, text, text, text, jsonb, timestamptz, text),
  public.konusma_kilidi_al(uuid, integer, bigint),
  public.konusma_isi_bitir(bigint, uuid, text, integer),
  public.konusma_kilidi_birak(bigint, uuid, integer)
to authenticated, service_role;
