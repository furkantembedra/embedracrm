-- Embedra CRM · şema düzeltmeleri
-- İlk 6 sayfanın (Genel Bakış, Müşteriler, Satış Hattı, Cihaz & Lisans, Destek, Bayi) kullandığı alanlar.
-- Uygulandığında tüm tablolar boştu (0 satır); tip değişiklikleri veri kaybına yol açmaz.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Tablo adları: fiil yerine isim
-- ─────────────────────────────────────────────────────────────
alter table public.lisanslar     rename to lisans_planlari;   -- Basic / Pro / Pro+
alter table public.lisans_tanima rename to lisanslar;          -- cihaza tanımlanan lisans kayıtları
alter table public.cihaz_ekle    rename to cihazlar;
alter table public.bayi_ekle     rename to bayi_basvurulari;

-- Birincil anahtarlar her tabloda "id"
alter table public.musteri     rename column m_id to id;
alter table public.satis_hatti rename column f_id to id;

-- ─────────────────────────────────────────────────────────────
-- 2. Sabit listeler (lookup)
-- ─────────────────────────────────────────────────────────────
alter table public.kaynak add constraint kaynak_f_kaynak_key unique (f_kaynak);
insert into public.kaynak (f_kaynak) values
  ('Web sitesi'), ('WhatsApp'), ('Instagram'), ('Bayi'), ('Fuar'), ('Mevcut müşteri');

alter table public.asama add column sira smallint;
alter table public.asama add constraint asama_f_asama_key unique (f_asama);
insert into public.asama (f_asama, sira) values
  ('Yeni lead', 1), ('Demo planlandı', 2), ('Teklif gönderildi', 3), ('Müzakere', 4), ('Kazanıldı', 5);
alter table public.asama alter column sira set not null;

alter table public.lisans_planlari alter column l_paket type text;
alter table public.lisans_planlari add constraint lisans_planlari_l_paket_key unique (l_paket);
insert into public.lisans_planlari (l_paket) values ('Basic'), ('Pro'), ('Pro+');

-- ─────────────────────────────────────────────────────────────
-- 3. musteri
-- ─────────────────────────────────────────────────────────────
alter table public.musteri
  alter column m_ad     type text,
  alter column m_sehir  type text,
  alter column m_ulke   type text,
  alter column m_yk     type text,            -- yetkili kişi
  alter column m_eposta type text,
  alter column m_tel    type text using m_tel::text,   -- "+49 711 555 0142": + ve boşluklar korunur
  alter column m_dk     set default false,    -- duyuru izni
  alter column m_dk     set not null;

alter table public.musteri
  add column m_vergino  text,
  add column m_durum    text not null default 'Yeni müşteri',  -- "Aktif · VIP", "Yenileme riski"…
  add column created_at timestamptz not null default now();

alter table public.musteri
  add constraint musteri_m_ad_bos_degil check (length(trim(m_ad)) > 0),
  add constraint musteri_m_segment_check check (m_segment in ('servis', 'muhendislik', 'egitim', 'bayi'));

-- ─────────────────────────────────────────────────────────────
-- 4. satis_hatti
-- ─────────────────────────────────────────────────────────────
alter table public.satis_hatti drop column f_kaynak, drop column f_asama;   -- metin yerine lookup FK

alter table public.satis_hatti rename column f_sat to f_sonraki_tarih;
alter table public.satis_hatti rename column f_sonrakiadim to f_sonraki_adim;

alter table public.satis_hatti
  alter column f_konum        type text,
  alter column f_konum        drop not null,   -- formda isteğe bağlı
  alter column f_icerik       type text,
  alter column f_sonraki_adim type text,
  alter column f_tutar        type numeric(14, 2);

alter table public.satis_hatti
  add column f_firma    text not null,
  add column kaynak_id  bigint references public.kaynak (id),
  add column asama_id   bigint not null references public.asama (id),
  add column musteri_id bigint references public.musteri (id) on delete set null,  -- kazanılınca dolar
  add column created_at timestamptz not null default now();

alter table public.satis_hatti
  add constraint satis_hatti_f_tutar_pozitif check (f_tutar is null or f_tutar >= 0);

create index satis_hatti_kaynak_id_idx  on public.satis_hatti (kaynak_id);
create index satis_hatti_asama_id_idx   on public.satis_hatti (asama_id);
create index satis_hatti_musteri_id_idx on public.satis_hatti (musteri_id);

-- ─────────────────────────────────────────────────────────────
-- 5. cihazlar
-- ─────────────────────────────────────────────────────────────
alter table public.cihazlar drop column lisans_id;   -- ilişki lisanslar.cihaz_id üzerinden; bir cihazın çok lisansı olur
alter table public.cihazlar rename column s_fw to c_fw;

alter table public.cihazlar
  alter column c_serino type text,
  alter column c_fw     type text;

alter table public.cihazlar
  add column c_model    text not null,
  add column c_durum    text not null default 'aktif',
  add column created_at timestamptz not null default now();

alter table public.cihazlar
  add constraint cihazlar_c_serino_key unique (c_serino),
  add constraint cihazlar_c_model_check check (c_model in ('ONE', 'ONE Lite')),
  add constraint cihazlar_c_durum_check check (c_durum in ('aktif', 'serviste')),
  add constraint cihazlar_musteri_id_fkey foreign key (musteri_id) references public.musteri (id) on delete restrict;

create index cihazlar_musteri_id_idx on public.cihazlar (musteri_id);

-- ─────────────────────────────────────────────────────────────
-- 6. lisanslar (eski lisans_tanima)
-- ─────────────────────────────────────────────────────────────
alter table public.lisanslar drop column musteri_id;   -- müşteri cihazdan gelir (cihazlar.musteri_id)

alter table public.lisanslar
  alter column cihaz_id set not null,
  alter column plan_id  set not null,
  alter column l_bat    set not null,   -- başlangıç
  alter column l_bit    set not null;   -- bitiş

alter table public.lisanslar
  add column created_at timestamptz not null default now();

alter table public.lisanslar
  add constraint lisanslar_cihaz_id_fkey foreign key (cihaz_id) references public.cihazlar (id) on delete cascade,
  add constraint lisanslar_plan_id_fkey  foreign key (plan_id)  references public.lisans_planlari (id),
  add constraint lisanslar_tarih_check check (l_bit > l_bat);

create index lisanslar_cihaz_id_idx on public.lisanslar (cihaz_id);
create index lisanslar_plan_id_idx  on public.lisanslar (plan_id);
create index lisanslar_l_bit_idx    on public.lisanslar (l_bit);   -- "süresi dolmak üzere" sorguları

-- ─────────────────────────────────────────────────────────────
-- 7. bayi_basvurulari (eski bayi_ekle)
-- ─────────────────────────────────────────────────────────────
alter table public.bayi_basvurulari alter column s_ad drop default;
alter table public.bayi_basvurulari alter column s_ad type text using null;    -- şirket adı (tarih değil)
alter table public.bayi_basvurulari alter column s_ad set not null;

alter table public.bayi_basvurulari rename column s_isc to s_ilk_siparis;   -- ilk sipariş (cihaz adedi)
alter table public.bayi_basvurulari rename column y_as to y_ad_soyad;       -- yetkili

alter table public.bayi_basvurulari
  alter column s_ulke       type text,            -- ülke kodu: "PL"
  alter column s_bolge      type text,
  alter column y_ad_soyad   type text,
  alter column y_eposta     type text,
  alter column s_vergino    type text using s_vergino::text,   -- "PL 7792 4410 22"
  alter column y_tel        type text using y_tel::text,
  alter column s_ilk_siparis type integer;

alter table public.bayi_basvurulari
  add column s_asama    text not null default 'basvuru',
  add column s_puan     smallint,                             -- uygunluk, değerlendirmede verilir
  add column k_bolge    boolean not null default false,       -- sözleşme kontrol listesi
  add column k_moq      boolean not null default false,
  add column k_marka    boolean not null default false,
  add column k_destek   boolean not null default false,
  add column g_tarih    timestamptz,                          -- planlanan görüşme
  add column g_not      text,
  add column b_satilan  integer not null default 0,           -- aktif bayi performansı (bu çeyrek)
  add column b_stok     integer not null default 0,
  add column b_moq_hedef integer,
  add column musteri_id bigint references public.musteri (id) on delete set null,  -- lansmanda dolar
  add column created_at timestamptz not null default now();

alter table public.bayi_basvurulari
  add constraint bayi_basvurulari_s_ad_bos_degil check (length(trim(s_ad)) > 0),
  add constraint bayi_basvurulari_s_asama_check check (s_asama in ('basvuru', 'degerlendirme', 'sozlesme', 'lansman')),
  add constraint bayi_basvurulari_s_puan_check check (s_puan between 0 and 100),
  add constraint bayi_basvurulari_s_ilk_siparis_check check (s_ilk_siparis is null or s_ilk_siparis >= 0),
  add constraint bayi_basvurulari_sayilar_check check (b_satilan >= 0 and b_stok >= 0 and (b_moq_hedef is null or b_moq_hedef >= 0)),
  -- lansman için kontrol listesi tamam olmalı
  add constraint bayi_basvurulari_lansman_check check (s_asama <> 'lansman' or (k_bolge and k_moq and k_marka and k_destek));

create index bayi_basvurulari_s_asama_idx    on public.bayi_basvurulari (s_asama);
create index bayi_basvurulari_musteri_id_idx on public.bayi_basvurulari (musteri_id);

-- ─────────────────────────────────────────────────────────────
-- 8. Yeni: musteri_olaylari (müşteri zaman çizelgesi + "Not ekle")
-- ─────────────────────────────────────────────────────────────
create table public.musteri_olaylari (
  id         bigint generated always as identity primary key,
  musteri_id bigint not null references public.musteri (id) on delete cascade,
  o_tur      text not null check (o_tur in ('siparis', 'destek', 'demo', 'teklif', 'arama', 'not')),
  o_metin    text not null check (length(trim(o_metin)) > 0),
  created_at timestamptz not null default now()
);
comment on table public.musteri_olaylari is 'Müşteri zaman çizelgesi ve notları';
create index musteri_olaylari_musteri_zaman_idx on public.musteri_olaylari (musteri_id, created_at desc);
alter table public.musteri_olaylari enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 9. Yeni: destek_talepleri + talep_notlari
-- ─────────────────────────────────────────────────────────────
create table public.destek_talepleri (
  id         bigint generated always as identity primary key,
  musteri_id bigint not null references public.musteri (id) on delete restrict,
  cihaz_id   bigint references public.cihazlar (id) on delete set null,
  t_kanal    text not null check (t_kanal in ('Telefon', 'WhatsApp', 'E-posta', 'Yüz yüze')),
  t_konu     text not null check (t_konu in ('Bağlantı', 'Flash / yazılım', 'Lisans', 'Donanım arızası', 'Araç kapsamı isteği', 'Diğer')),
  t_oncelik  text not null default 'Orta' check (t_oncelik in ('Düşük', 'Orta', 'Yüksek')),
  t_baslik   text not null check (length(trim(t_baslik)) > 0),
  t_aciklama text not null,
  t_arac     text,                       -- araç / sistem
  t_durum    text not null default 'acik' check (t_durum in ('acik', 'beklemede', 'cozuldu')),
  t_dosya    text,                       -- Supabase Storage yolu
  created_at timestamptz not null default now()
);
comment on table public.destek_talepleri is 'Destek talepleri';
create index destek_talepleri_musteri_id_idx  on public.destek_talepleri (musteri_id);
create index destek_talepleri_cihaz_id_idx    on public.destek_talepleri (cihaz_id);
create index destek_talepleri_durum_zaman_idx on public.destek_talepleri (t_durum, created_at desc);
alter table public.destek_talepleri enable row level security;

create table public.talep_notlari (
  id         bigint generated always as identity primary key,
  talep_id   bigint not null references public.destek_talepleri (id) on delete cascade,
  n_tur      text not null check (n_tur in ('acilis', 'not', 'gorusme', 'yapilacak', 'beklemede', 'cozuldu', 'yeniden')),
  n_metin    text not null,
  n_dosya    text,                       -- Supabase Storage yolu
  created_at timestamptz not null default now()
);
comment on table public.talep_notlari is 'Destek talebi notları ve durum geçmişi';
create index talep_notlari_talep_zaman_idx on public.talep_notlari (talep_id, created_at);
alter table public.talep_notlari enable row level security;

commit;

-- Not: Tüm tablolarda RLS açık ama henüz policy yok; yani anon/authenticated anahtarla erişim kapalı.
-- Giriş (Supabase Auth) bağlanınca "authenticated" rolü için policy'ler ayrı bir migration'da eklenecek.
