-- whatsapp_mesajlari'nın verisi konusma_mesajlari'na taşındı (20261118123643); kodda kullanılmıyor.
-- Canlı veritabanında (wglfzzbzifszwkugamjj) elle kaldırıldı; bu dosya sıfırdan kurulan veritabanlarını aynı hâle getirir.
-- if exists: zaten yoksa bir şey yapmaz.
drop table if exists public.whatsapp_mesajlari;
drop function if exists public.gecici_veri_aktar(text);
