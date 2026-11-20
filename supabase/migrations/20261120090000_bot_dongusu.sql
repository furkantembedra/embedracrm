-- P2.1 Claude adaptörü ve bot döngüsü.
--  1) Debounce kuyrukta, zaman damgasıyla (bellekte bekleme yok): bot açık bir konuşmaya müşteri mesajı gelince
--     konusmalar.bot_cevap_zamani = now() + 6 sn yazılır; her yeni müşteri mesajı bu zamanı ileri iter. İşleyici
--     konuşmayı bu zaman geçince alır (konusma_kilidi_al), bekleyen mesaj işlerini bitirir, sonra bot turunu
--     konusma_bot_turu_al ile tek kez "üstlenir" (zamanı siler) ve Claude'u bir kez çağırır. Müşteri arka arkaya
--     yazarsa tek çağrı olur. 6 sn components/bot/yapilandirma.ts › BOT_BEKLEME_SN ile aynıdır.
--  2) kanal_ayarlari.bot_modu: kanal başına kapali | golge | otomatik (gölge mod P2.5; o gelene kadar bot yalnızca
--     otomatik kanalda cevap verir).
--  3) bot_ayarlari (tek satır): acil durdurma, günlük maliyet sınırı (USD), konuşma başına tur sınırı. Okuma CRM ekibi,
--     değiştirme yalnızca Yönetici (P2.4 bu tabloya kişilik / bilgi bankası alanlarını ekler).
--  4) bot_kullanim: her bot turunun (içindeki API çağrıları toplanmış) token kullanımı, maliyeti, istem sürümü, çağrılan
--     araçlar ve sonucu. Mesaj metni, araç girdisi ve kişisel veri YAZILMAZ (değişmez kural 7).
--  5) konusma_mesajlari.bot_kullanim_id: botun gönderdiği mesaj hangi turdan çıktı (Gelen kutusu'nda araç geçmişi).

-- 1) Debounce zamanı
alter table public.konusmalar add column bot_cevap_zamani timestamptz;
comment on column public.konusmalar.bot_cevap_zamani is
  'Bot turunun en erken zamanı (son müşteri mesajı + 6 sn); işleyici bu zaman geçince turu üstlenir ve siler. null: bekleyen bot turu yok';
create index konusmalar_bot_cevap_zamani_idx on public.konusmalar (bot_cevap_zamani) where bot_cevap_zamani is not null;

-- 2) Kanal bazında bot modu
alter table public.kanal_ayarlari
  add column bot_modu text not null default 'kapali' constraint kanal_ayarlari_bot_modu_check check (bot_modu in ('kapali', 'golge', 'otomatik'));
comment on column public.kanal_ayarlari.bot_modu is
  'Kanalda bot: kapali (hiç çağrılmaz) | golge (P2.5: cevap taslak olur) | otomatik (cevap müşteriye gider)';

-- 3) Bot ayarları (tek satır)
create table public.bot_ayarlari (
  id                       smallint primary key default 1 constraint bot_ayarlari_tek_satir check (id = 1),
  acil_durdurma            boolean not null default false,
  gunluk_maliyet_siniri_usd numeric(10, 2) not null default 5 check (gunluk_maliyet_siniri_usd >= 0),
  tur_siniri               integer not null default 20 check (tur_siniri between 1 and 200),
  -- tek satırlık tablo: guncelleyen_id üzerinde indeks gerekmez
  guncelleyen_id           bigint references public.kullanicilar (id) on delete set null,
  updated_at               timestamptz not null default now()
);
comment on table public.bot_ayarlari is
  'Botun genel ayarları (tek satır, Bot › Ayarlar): acil durdurma, günlük maliyet sınırı (USD, İstanbul günü), konuşma başına tur sınırı';
insert into public.bot_ayarlari (id) values (1);

revoke all on public.bot_ayarlari from anon;
alter table public.bot_ayarlari enable row level security;
create policy crm_okur on public.bot_ayarlari for select to authenticated using ((select private.crm_kullanicisi()));
create policy yonetici_degistirir on public.bot_ayarlari for update to authenticated
  using ((select private.yonetici_mi())) with check ((select private.yonetici_mi()));

-- 4) Bot kullanımı (tur başına)
create table public.bot_kullanim (
  id                bigint generated always as identity primary key,
  konusma_id        bigint not null references public.konusmalar (id) on delete cascade,
  kanal             text not null check (kanal in ('whatsapp', 'instagram', 'messenger')),
  model             text not null check (length(model) <= 80),
  effort            text check (length(effort) <= 20),
  istem_surumu      text not null check (length(istem_surumu) <= 40),
  api_cagrisi       integer not null default 0 check (api_cagrisi >= 0),
  girdi_token       integer not null default 0 check (girdi_token >= 0),
  cikti_token       integer not null default 0 check (cikti_token >= 0),
  cache_yazma_token integer not null default 0 check (cache_yazma_token >= 0),
  cache_okuma_token integer not null default 0 check (cache_okuma_token >= 0),
  maliyet_usd       numeric(12, 6) not null default 0 check (maliyet_usd >= 0),
  -- Çağrılan araçların adları, çağrı sırasıyla (girdileri yazılmaz)
  araclar           text[] not null default '{}' check (cardinality(araclar) <= 50),
  -- cevap: müşteriye gitti · devir: bot insana devretti · sessiz: gönderilecek metin yok · iptal: tur sırasında temsilci
  -- devraldı, cevap gönderilmedi · hata: API hatası / zaman aşımı / gönderim hatası (konuşma devredildi) · red: refusal
  sonuc             text not null check (sonuc in ('cevap', 'devir', 'sessiz', 'iptal', 'hata', 'red')),
  -- Kısa hata kodu (ör. zaman_asimi, http_529, max_tokens); hata mesajı ya da müşteri metni değil
  hata_kodu         text check (length(hata_kodu) <= 60),
  sure_ms           integer check (sure_ms >= 0),
  created_at        timestamptz not null default now()
);
comment on table public.bot_kullanim is
  'Bot turu başına Claude kullanımı: token, maliyet (USD), istem sürümü, çağrılan araçlar, sonuç. Mesaj metni ve kişisel veri yazılmaz';
create index bot_kullanim_konusma_zaman_idx on public.bot_kullanim (konusma_id, created_at);
-- Günlük maliyet toplamı (son gün) ve rapor
create index bot_kullanim_zaman_idx on public.bot_kullanim (created_at);

revoke all on public.bot_kullanim from anon;
alter table public.bot_kullanim enable row level security;
-- Bot gizli anahtarla (service_role) yazar; geliştirme simülasyonu CRM kullanıcısıyla çalıştığı için ekleme de açık.
-- Güncelleme / silme yok (kullanım kaydı değişmez).
create policy crm_okur on public.bot_kullanim for select to authenticated using ((select private.crm_kullanicisi()));
create policy crm_ekler on public.bot_kullanim for insert to authenticated with check ((select private.crm_kullanicisi()));

-- 5) Bot mesajı ↔ tur
alter table public.konusma_mesajlari
  add column bot_kullanim_id bigint references public.bot_kullanim (id) on delete set null,
  add constraint konusma_mesajlari_bot_kullanim_check check (bot_kullanim_id is null or gonderen = 'bot');
create index konusma_mesajlari_bot_kullanim_id_idx on public.konusma_mesajlari (bot_kullanim_id) where bot_kullanim_id is not null;
comment on column public.konusma_mesajlari.bot_kullanim_id is 'Bot mesajının üretildiği tur (bot_kullanim); araç geçmişi için';

-- 6) Gelen mesajı kaydet: bot açık konuşmada müşteri mesajı bot turunu 6 sn sonraya kurar / iter
--    (gövde 20261119160000 ile aynı, yalnızca son güncelleme değişti)
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
      dis_profil_adi = coalesce(nullif(left(btrim(p_profil_adi), 200), ''), k.dis_profil_adi),
      -- debounce: son müşteri mesajının geliş anından 6 sn sonra (Meta zaman damgası değil, sunucu saati)
      bot_cevap_zamani = case when k.bot_aktif then now() + interval '6 seconds' else k.bot_cevap_zamani end
    where k.id = v_konusma;
  end if;

  konusma_id := v_konusma;
  mesaj_id := v_mesaj;
  return next;
end;
$$;

-- 7) Konuşma kilidi al: zamanı gelmiş işi olan YA DA (p_bot ise) bot turunun zamanı gelmiş kilitsiz konuşmayı alır
--    (iş sırası kuralı 20261119100706 ile aynı; en eski bekleyen önce).
--    p_bot: işleyici bot turunu çalıştırabiliyor mu. Botu bilmeyen işleyici (webhook after(), simülasyon, dağıtım
--    sırasında hâlâ çalışan eski kod) varsayılan false ile çağırır; bot turu bekleyen konuşmayı almaz, kilidi bırakırken
--    de bot turu yüzünden 'devam' almaz (aksi hâlde işsiz konuşmada sonsuz 'devam' döngüsüne girerdi).
--    İmza değiştiği için eski işlevler kaldırılır; eski kodun adlandırılmış argümanlı çağrısı yeni işleve düşer.
drop function public.konusma_kilidi_al(uuid, integer, bigint);
drop function public.konusma_kilidi_birak(bigint, uuid, integer);
create function public.konusma_kilidi_al(p_sahip uuid, p_sure_sn integer default 120, p_konusma_id bigint default null, p_bot boolean default false)
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
    from (
      select i.konusma_id as id, i.created_at as zaman, i.id as sira
      from public.konusma_isleri i
      where i.durum = 'bekliyor' and i.sonraki_deneme <= now()
        and not exists (select 1 from public.konusma_isleri j
                        where j.konusma_id = i.konusma_id and j.durum = 'bekliyor' and j.id < i.id)
      union all
      select k3.id, k3.bot_cevap_zamani, 0
      from public.konusmalar k3
      where p_bot and k3.bot_cevap_zamani <= now()
    ) aday
    join public.konusmalar k2 on k2.id = aday.id
    where (k2.kilit_bitis is null or k2.kilit_bitis < now())
      and (p_konusma_id is null or aday.id = p_konusma_id)
    order by aday.zaman, aday.sira
    limit 1
    for update of k2 skip locked
  )
  and (k.kilit_bitis is null or k.kilit_bitis < now())
  returning k.id into v_konusma;
  return v_konusma;
end;
$$;

-- 8) Kilidi bırak: zamanı gelmiş iş ya da (p_bot ise) zamanı gelmiş bot turu varsa 'devam'
create function public.konusma_kilidi_birak(p_konusma_id bigint, p_sahip uuid, p_sure_sn integer default 120, p_bot boolean default false)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_sahip uuid;
  v_bot timestamptz;
begin
  select k.kilit_sahibi, k.bot_cevap_zamani into v_sahip, v_bot from public.konusmalar k where k.id = p_konusma_id for update;
  if v_sahip is distinct from p_sahip then
    return 'kayip';
  end if;
  if coalesce((select i.sonraki_deneme <= now() from public.konusma_isleri i
               where i.konusma_id = p_konusma_id and i.durum = 'bekliyor' order by i.id limit 1), false)
     or (p_bot and v_bot <= now()) then
    update public.konusmalar set kilit_bitis = now() + make_interval(secs => p_sure_sn) where id = p_konusma_id;
    return 'devam';
  end if;
  update public.konusmalar set kilit_sahibi = null, kilit_bitis = null where id = p_konusma_id;
  return 'birakildi';
end;
$$;

-- 9) Bot turunu üstlen: kilit sahibi, zamanı gelmiş bot turunu siler ve true alır (tur bir kez çalışır).
--    Tur sırasında yeni müşteri mesajı gelirse gelen_mesaj_kaydet yeni bir zaman yazar; o da ayrı bir tur olur.
create function public.konusma_bot_turu_al(p_konusma_id bigint, p_sahip uuid)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_id bigint;
begin
  update public.konusmalar set bot_cevap_zamani = null
  where id = p_konusma_id and kilit_sahibi = p_sahip and kilit_bitis >= now() and bot_cevap_zamani <= now()
  returning id into v_id;
  return v_id is not null;
end;
$$;
comment on function public.konusma_bot_turu_al is 'Kilit sahibi zamanı gelmiş bot turunu üstlenir (zamanı siler); üstlendiyse true';

revoke all on function
  public.konusma_kilidi_al(uuid, integer, bigint, boolean),
  public.konusma_kilidi_birak(bigint, uuid, integer, boolean),
  public.konusma_bot_turu_al(bigint, uuid)
from public, anon, authenticated, service_role;
grant execute on function
  public.konusma_kilidi_al(uuid, integer, bigint, boolean),
  public.konusma_kilidi_birak(bigint, uuid, integer, boolean),
  public.konusma_bot_turu_al(bigint, uuid)
to authenticated, service_role;
