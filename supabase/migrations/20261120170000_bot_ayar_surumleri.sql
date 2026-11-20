-- P2.4 Bot › Kanallar ve Ayarlar.
--  1) bot_istem_surumleri: botun sabit istemine giren ayarların (bot adı, açılış mesajı, ton notu, bilgi bankası,
--     itirazlar, örnek konuşmalar, mesai saatleri ve mesai dışı notu) sürümleri. Yalnızca ekleme yapılır: kayıt
--     değişmez, silinmez. "Kaydet" ve "Bu sürüme dön" yeni bir sürüm açar (geri dönüş geri_donulen_surum'u yazar);
--     bot her zaman bot_ayarlari.aktif_surum_id'deki sürümü kullanır. Değişiklik prompt cache'ini sıfırladığı için
--     yalnızca bilinçli "Kaydet" ile olur. bilgi_kaynaklari: P2.4b'de onaylanan bilgi kaynaklarının o sürümdeki
--     anlık kopyası ([{id, baslik, hedef, metin}]); geri dönüldüğünde kaynaklar da o sürümdeki hâline döner.
--     Metin sınırları (alan başına ve 40.000 karakter toplam) ve kişisel veri taraması uygulamada
--     (components/bot/ayar-surumu.ts); buradaki kısıtlar yalnızca kaba üst sınırdır.
--  2) bot_ayarlari: aktif_surum_id; maliyet_bildirim_gunu (günlük maliyet sınırı aşıldığında yöneticilere giden
--     bildirimin günü; aynı gün ikinci kez gitmez).
--  3) kanal_ayarlari.son_webhook_zamani: kanala Meta'dan son bildirim ne zaman geldi (Bot › Kanallar). Webhook gizli
--     anahtarla yazar; en çok 30 saniyede bir güncellenir.
--  4) bot_kullanim: tur (konusma | deneme | cikarim). "Botu dene" paneli (deneme) ve P2.4b çıkarımı (cikarim) bir
--     konuşmaya bağlı değildir ama gerçek maliyettir; günlük maliyet sınırına dahildir.

-- 1) Ayar sürümleri
create table public.bot_istem_surumleri (
  id                  bigint generated always as identity primary key,
  surum_no            integer not null unique check (surum_no > 0),
  bot_adi             text not null default '' check (length(bot_adi) <= 60),
  acilis_mesaji       text not null default '' check (length(acilis_mesaji) <= 1000),
  ton_notu            text not null default '' check (length(ton_notu) <= 2000),
  bilgi_bankasi       text not null default '' check (length(bilgi_bankasi) <= 40000),
  itirazlar           text not null default '' check (length(itirazlar) <= 40000),
  ornek_konusmalar    text not null default '' check (length(ornek_konusmalar) <= 40000),
  -- {"pzt": ["09:00","18:00"], ..., "paz": null}; null gün kapalı. Saat dilimi Europe/Istanbul.
  mesai_saatleri      jsonb not null default '{}'::jsonb check (jsonb_typeof(mesai_saatleri) = 'object'),
  mesai_disi_notu     text not null default '' check (length(mesai_disi_notu) <= 500),
  bilgi_kaynaklari    jsonb not null default '[]'::jsonb check (jsonb_typeof(bilgi_kaynaklari) = 'array'),
  aciklama            text check (length(aciklama) <= 300),
  geri_donulen_surum  integer,
  olusturan_id        bigint references public.kullanicilar (id) on delete set null,
  created_at          timestamptz not null default now()
);
comment on table public.bot_istem_surumleri is
  'Bot › Ayarlar: botun sabit istemine giren ayarların sürümleri (yalnızca ekleme). Aktif sürüm bot_ayarlari.aktif_surum_id';
create index bot_istem_surumleri_olusturan_id_idx on public.bot_istem_surumleri (olusturan_id) where olusturan_id is not null;

revoke all on public.bot_istem_surumleri from anon;
alter table public.bot_istem_surumleri enable row level security;
create policy crm_okur on public.bot_istem_surumleri for select to authenticated using ((select private.crm_kullanicisi()));
create policy yonetici_ekler on public.bot_istem_surumleri for insert to authenticated with check ((select private.yonetici_mi()));
-- Güncelleme / silme politikası yok: sürüm kaydı değişmez

-- 2) Aktif sürüm ve maliyet bildirimi
alter table public.bot_ayarlari
  add column aktif_surum_id bigint references public.bot_istem_surumleri (id) on delete restrict,
  add column maliyet_bildirim_gunu date;
comment on column public.bot_ayarlari.aktif_surum_id is 'Botun kullandığı ayar sürümü (bot_istem_surumleri); null: henüz kaydedilmedi, istem varsayılanlarla kurulur';
comment on column public.bot_ayarlari.maliyet_bildirim_gunu is 'Günlük maliyet sınırı bildiriminin gittiği son İstanbul günü (günde bir bildirim)';

-- 3) Son webhook
alter table public.kanal_ayarlari add column son_webhook_zamani timestamptz;
comment on column public.kanal_ayarlari.son_webhook_zamani is 'Kanala Meta webhook bildiriminin son geldiği an (imza doğrulandıktan sonra; en çok 30 sn''de bir yazılır)';

-- 4) Kullanım türü
alter table public.bot_kullanim
  add column tur text not null default 'konusma' check (tur in ('konusma', 'deneme', 'cikarim')),
  alter column konusma_id drop not null,
  alter column kanal drop not null,
  add constraint bot_kullanim_tur_konusma_check check ((tur = 'konusma') = (konusma_id is not null));
comment on column public.bot_kullanim.tur is 'konusma: bot turu · deneme: Bot › Ayarlar "Botu dene" · cikarim: P2.4b bilgi kaynağı çıkarımı';

-- 5) Sürüm kaydet: yeni sürümü ekler ve aktif yapar (tek işlemde; bot_ayarlari satır kilidiyle sürüm no sıralı).
--    security invoker: ekleme RLS'i (yalnızca Yönetici) ve bot_ayarlari güncelleme politikası uygulanır.
--    p_geri_donulen verilirse o sürümün içeriği kopyalanır (diğer içerik parametreleri yok sayılır).
create function public.bot_istem_surumu_kaydet(
  p_bot_adi text, p_acilis_mesaji text, p_ton_notu text, p_bilgi_bankasi text, p_itirazlar text,
  p_ornek_konusmalar text, p_mesai_saatleri jsonb, p_mesai_disi_notu text, p_aciklama text,
  p_olusturan_id bigint, p_geri_donulen integer default null
) returns table (id bigint, surum_no integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_no integer;
  v_id bigint;
  v_eski public.bot_istem_surumleri;
begin
  -- Sıra kilidi: aynı anda iki kayıt aynı numarayı almasın. Yönetici değilse RLS satırı göstermez → yetki hatası.
  perform 1 from public.bot_ayarlari b where b.id = 1 for update;
  if not found then
    raise exception 'Bot ayarlarını değiştirme yetkiniz yok' using errcode = '42501';
  end if;
  select coalesce(max(s.surum_no), 0) + 1 into v_no from public.bot_istem_surumleri s;

  if p_geri_donulen is not null then
    select * into v_eski from public.bot_istem_surumleri s where s.surum_no = p_geri_donulen;
    if not found then
      raise exception 'Sürüm bulunamadı' using errcode = '22023';
    end if;
    insert into public.bot_istem_surumleri (surum_no, bot_adi, acilis_mesaji, ton_notu, bilgi_bankasi, itirazlar,
      ornek_konusmalar, mesai_saatleri, mesai_disi_notu, bilgi_kaynaklari, aciklama, geri_donulen_surum, olusturan_id)
    values (v_no, v_eski.bot_adi, v_eski.acilis_mesaji, v_eski.ton_notu, v_eski.bilgi_bankasi, v_eski.itirazlar,
      v_eski.ornek_konusmalar, v_eski.mesai_saatleri, v_eski.mesai_disi_notu, v_eski.bilgi_kaynaklari,
      left(coalesce(p_aciklama, format('Sürüm %s''e dönüldü', p_geri_donulen)), 300), p_geri_donulen, p_olusturan_id)
    returning bot_istem_surumleri.id into v_id;
  else
    insert into public.bot_istem_surumleri (surum_no, bot_adi, acilis_mesaji, ton_notu, bilgi_bankasi, itirazlar,
      ornek_konusmalar, mesai_saatleri, mesai_disi_notu, bilgi_kaynaklari, aciklama, olusturan_id)
    values (v_no, coalesce(p_bot_adi, ''), coalesce(p_acilis_mesaji, ''), coalesce(p_ton_notu, ''),
      coalesce(p_bilgi_bankasi, ''), coalesce(p_itirazlar, ''), coalesce(p_ornek_konusmalar, ''),
      coalesce(p_mesai_saatleri, '{}'::jsonb), coalesce(p_mesai_disi_notu, ''),
      -- Bilgi kaynakları elle kaydetmede değişmez: aktif sürümdekiler taşınır (P2.4b kendi onayıyla yeni sürüm açar)
      coalesce((select s.bilgi_kaynaklari from public.bot_ayarlari b join public.bot_istem_surumleri s on s.id = b.aktif_surum_id where b.id = 1), '[]'::jsonb),
      nullif(left(btrim(coalesce(p_aciklama, '')), 300), ''), p_olusturan_id)
    returning bot_istem_surumleri.id into v_id;
  end if;

  update public.bot_ayarlari b set aktif_surum_id = v_id, guncelleyen_id = p_olusturan_id, updated_at = now() where b.id = 1;
  id := v_id;
  surum_no := v_no;
  return next;
end;
$$;
comment on function public.bot_istem_surumu_kaydet is 'Bot ayarlarının yeni sürümünü ekler ve aktif yapar (geri dönüş de yeni sürümdür); yalnızca Yönetici';
revoke all on function public.bot_istem_surumu_kaydet(text, text, text, text, text, text, jsonb, text, text, bigint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.bot_istem_surumu_kaydet(text, text, text, text, text, text, jsonb, text, text, bigint, integer)
  to authenticated;

-- 6) Maliyet bildirimi: bugün için ilk çağıran true alır (yarış: bildirim bir kez gider). İşleyici gizli anahtarla
--    (service_role) çağırır; geliştirme simülasyonu Yönetici oturumuyla.
create function public.bot_maliyet_bildirimi_al(p_gun date)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_id smallint;
begin
  update public.bot_ayarlari set maliyet_bildirim_gunu = p_gun
  where id = 1 and maliyet_bildirim_gunu is distinct from p_gun
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.bot_maliyet_bildirimi_al(date) from public, anon, authenticated, service_role;
grant execute on function public.bot_maliyet_bildirimi_al(date) to authenticated, service_role;

-- 7) Son webhook zamanı (yalnızca webhook, gizli anahtarla)
create function public.kanal_webhook_isaretle(p_kanal text)
returns void
language sql security invoker set search_path = ''
as $$
  update public.kanal_ayarlari set son_webhook_zamani = now()
  where kanal = p_kanal and (son_webhook_zamani is null or son_webhook_zamani < now() - interval '30 seconds');
$$;
revoke all on function public.kanal_webhook_isaretle(text) from public, anon, authenticated, service_role;
grant execute on function public.kanal_webhook_isaretle(text) to service_role;
