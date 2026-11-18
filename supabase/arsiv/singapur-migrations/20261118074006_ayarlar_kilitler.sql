-- Embedra CRM · tüm modüllerin şeması (2/7): ayarlar, kilitler, cihaz durumları
-- Kurallar: Türkçe tablo adları, tablo başına kısa sütun öneki, bigint identity id, FK'lerde index,
-- sabit listeler için check constraint, created_at. Belge numaraları (S-26-1184, TKL-2026-0001…) ayrı "no" sütununda unique.

create table public.ayarlar (
  anahtar    text primary key,
  deger      jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.ayarlar is 'Uygulama ayarları (fiyat listesi, kargo firmaları, servis adresi, garanti süresi)';

-- Aynı işin iki kez çalışmasını önleyen kısa süreli kilitler (otomasyon motoru)
create table public.kilitler (
  anahtar text primary key,
  bitis   timestamptz not null
);

alter table public.ayarlar enable row level security;
alter table public.kilitler enable row level security;

alter table public.cihazlar drop constraint cihazlar_c_durum_check;
alter table public.cihazlar
  add constraint cihazlar_c_durum_check check (c_durum in ('aktif', 'bitiyor', 'lisanssiz', 'stokta', 'serviste'));
