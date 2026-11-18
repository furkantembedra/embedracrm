# Eski migration'lar (Singapur projesi, arşiv)

Bu dosyalar `ap-southeast-1` (Singapur) bölgesindeki ilk Supabase projesine (`ejjlyhqelcajpsrdgvxv`) uygulanan artımlı
migration'lardır. Panelden açılmış temel tabloları varsaydıkları için boş bir veritabanını **baştan kuramazlar**; yalnızca
tarihçe için saklanıyor.

18 Kasım 2026'da veritabanı Frankfurt'a (`eu-central-1`, proje `wglfzzbzifszwkugamjj`) taşındı. Yeni projenin şeması,
eski veritabanının kataloğundan birebir çıkarılıp `supabase/migrations/` altındaki dört `temel_sema_*` dosyasıyla kuruldu
(sütun, kısıt, indeks, politika, fonksiyon izni ve tablo yetkisi özetleri iki projede eşleşti). Yeni değişiklikler
`supabase/migrations/` altına eklenmeli.

`20261118100900_eski_sutunlari_kaldir.sql`'in sildiği sütunlar (`musteri.m_yk/m_tel/m_eposta`, `bayi_basvurulari.b_*`)
taşıma sırasında eski veritabanında zaten yoktu, yani bu adım daha önce elle uygulanmış; yeni şemada da yoklar.
