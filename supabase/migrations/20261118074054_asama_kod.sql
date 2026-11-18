-- Embedra CRM · tüm modüllerin şeması (3/7): satış hattı aşama kodları
-- Kurallar: Türkçe tablo adları, tablo başına kısa sütun öneki, bigint identity id, FK'lerde index,
-- sabit listeler için check constraint, created_at. Belge numaraları (S-26-1184, TKL-2026-0001…) ayrı "no" sütununda unique.

-- satış hattı aşamalarına kod (uygulamadaki anahtar) ve Kaybedildi
alter table public.asama add column kod text;
update public.asama set kod = 'yeni' where f_asama = 'Yeni lead';
update public.asama set kod = 'demo' where f_asama = 'Demo planlandı';
update public.asama set kod = 'teklif' where f_asama = 'Teklif gönderildi';
update public.asama set kod = 'muzakere' where f_asama = 'Müzakere';
update public.asama set kod = 'kazanildi' where f_asama = 'Kazanıldı';
insert into public.asama (f_asama, sira, kod) values ('Kaybedildi', 6, 'kaybedildi');
alter table public.asama alter column kod set not null;
alter table public.asama add constraint asama_kod_key unique (kod);
