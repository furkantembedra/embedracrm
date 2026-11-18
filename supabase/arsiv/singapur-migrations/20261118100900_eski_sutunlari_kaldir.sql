-- Embedra CRM · kullanılmayan eski sütunları kaldırır (tablolar boşken onaylandı)
-- musteri'nin tek yetkili alanları musteri_yetkilileri'ne, bayi performans sayaçları bayiler / bayi_hareketleri'ne taşındı.

begin;
alter table public.musteri drop column m_yk, drop column m_tel, drop column m_eposta;
alter table public.bayi_basvurulari drop constraint bayi_basvurulari_sayilar_check;
alter table public.bayi_basvurulari drop column b_satilan, drop column b_stok, drop column b_moq_hedef;
commit;
