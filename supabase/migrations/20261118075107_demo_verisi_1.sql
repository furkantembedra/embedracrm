-- Embedra CRM · demo verisi (1/3) — uygulamanın eski bellek içi deposundan aktarıldı.
-- Kimlikler sabit verilir; demo_verisi_2 sonunda identity dizileri en büyük id'ye ayarlanır.

insert into public.kullanicilar (id, k_ad, k_eposta, k_rol, k_aktif, k_tel) values
  (1, 'Deniz Arslan', 'deniz@embedra.com', 'Yönetici', true, null),
  (2, 'Ayşe Kara', 'ayse@embedra.com', 'Satış', true, '+90 216 555 0142'),
  (3, 'Emre Yalçın', 'emre@embedra.com', 'Destek', true, null),
  (4, 'Selin Öz', 'selin@embedra.com', 'Operasyon', true, null),
  (5, 'Can Demir', 'can@embedra.com', 'Pazarlama', false, null);

insert into public.ayarlar (anahtar, deger) values
  ('fiyat_listesi', '{"cihaz": {"ONE": 98000, "ONE Lite": 70000}, "lisans": {"Basic": {"fiyat": 42000, "cihaz": 1}, "Pro": {"fiyat": 70000, "cihaz": 1}, "Pro+": {"fiyat": 100800, "cihaz": 3}, "Premium": {"fiyat": null, "cihaz": 5}, "Enterprise": {"fiyat": null, "cihaz": null}}, "kdv": 0.2, "eurKur": 48}'::jsonb),
  ('kargo_firmalari', '["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "UPS Express", "DHL Express", "DHL Freight"]'::jsonb),
  ('servis_adresi', '{"ad": "Embedra Teknik Servis", "adres": "Dudullu OSB, 1. Cadde No:12, 34776 Ümraniye / İstanbul, Türkiye", "telefon": "+90 216 555 0150"}'::jsonb),
  ('garanti_ay', '24'::jsonb);

insert into public.bayi_basvurulari (id, s_ad, s_ulke, s_vergino, s_bolge, s_ilk_siparis, y_ad_soyad, y_eposta, y_tel, s_asama, s_puan, k_bolge, k_moq, k_marka, k_destek, g_tarih, g_not, s_sozlesme, s_tarih) values
  (1, 'Polska EPS Serwis', 'PL', 'PL 7792 4410 22', 'Polonya (tamamı)', 10, 'Marta Nowak', 'marta@polskaeps.pl', '+48 61 555 0198', 'degerlendirme', 86, true, false, true, false, null, null, '{"bolge": {"kapsam": "Polonya (tamamı)", "munhasir": true}, "moq": {"one": null, "lite": null, "yillik": null, "indirim": null}, "marka": {"kitTarihi": "2026-10-29", "logoOnay": true, "not": ""}, "destek": {"bayi": []}}'::jsonb, '2026-10-28'),
  (2, 'Balkan Auto Diagnostics', 'RS', 'RS 1093 4471', 'Batı Balkanlar', 5, 'Nikola Petrović', 'nikola@balkanautodiag.rs', '+381 11 555 0144', 'basvuru', 64, false, false, false, false, null, null, '{"bolge": {"kapsam": "Batı Balkanlar", "munhasir": null}, "moq": {"one": null, "lite": null, "yillik": null, "indirim": null}, "marka": {"kitTarihi": "", "logoOnay": false, "not": ""}, "destek": {"bayi": []}}'::jsonb, '2026-11-01'),
  (3, 'Iberia Dirección SL', 'ES', 'ES B9844 1202', 'Valencia + Murcia', 6, 'Lucía Martín', 'lucia@iberiadireccion.es', '+34 96 555 0123', 'degerlendirme', 72, true, false, false, false, null, null, '{"bolge": {"kapsam": "Valencia + Murcia", "munhasir": false}, "moq": {"one": null, "lite": null, "yillik": null, "indirim": null}, "marka": {"kitTarihi": "", "logoOnay": false, "not": ""}, "destek": {"bayi": []}}'::jsonb, '2026-10-24'),
  (4, 'Hellas Steering Tech', 'GR', 'EL 8011 4392', 'rYunanistan + Kıbrıs', 12, 'Giorgos Papadakis', 'g.papadakis@hellassteering.gr', '+30 21 555 0187', 'sozlesme', 91, true, true, true, false, '2026-11-06 11:00+03', 'Destek taahhüdü maddesi', '{"bolge": {"kapsam": "Yunanistan + Kıbrıs", "munhasir": true}, "moq": {"one": 8, "lite": 4, "yillik": 48, "indirim": 18}, "marka": {"kitTarihi": "2026-10-20", "logoOnay": true, "not": "Yunanca broşür bayi tarafında"}, "destek": {"bayi": ["Kurulum", "Kullanıcı eğitimi"]}}'::jsonb, '2026-10-09'),
  (5, 'Řízení Servis s.r.o.', 'CZ', 'CZ 2841 7720', 'Çekya + Slovakya', 8, 'Tomáš Novák', 'tomas@rizeni-servis.cz', '+420 2 555 0193', 'sozlesme', 79, true, true, false, false, null, null, '{"bolge": {"kapsam": "Çekya + Slovakya", "munhasir": true}, "moq": {"one": 6, "lite": 2, "yillik": 32, "indirim": 15}, "marka": {"kitTarihi": "", "logoOnay": false, "not": ""}, "destek": {"bayi": []}}'::jsonb, '2026-10-02'),
  (6, 'Direcție Pro SRL', 'RO', 'RO 4019 2281', 'Romanya', 10, 'Andrei Popescu', 'andrei@directiepro.ro', '+40 21 555 0110', 'lansman', 88, true, true, true, true, null, null, '{"bolge": {"kapsam": "Romanya", "munhasir": true}, "moq": {"one": 7, "lite": 3, "yillik": 80, "indirim": 18}, "marka": {"kitTarihi": "2026-09-20", "logoOnay": true, "not": ""}, "destek": {"bayi": ["Kurulum", "Kullanıcı eğitimi", "Standart Teknik Destek"]}}'::jsonb, '2026-09-14');

insert into public.bayiler (id, basvuru_id, by_ad, by_bolge, by_ulke_kodu, by_moq_hedef, temsilci_id, by_adres, by_sozlesme_bat, by_sozlesme_sure_ay) values
  (6, 6, 'Direcție Pro SRL', 'Romanya', 'RO', 20, 2, 'Bd. Unirii 22, București, RO', '2026-09-14', 24),
  (7, null, 'AutoTech Distribution', 'Bulgaristan', 'BG', 18, 2, null, null, 24),
  (8, null, 'Volant Partner Netz', 'Almanya (Güney)', 'DE', 24, 2, null, null, 24),
  (9, null, 'Kafkas Oto Teknik', 'Azerbaycan + Gürcistan', 'AZ', 16, 2, null, null, 24);

insert into public.bayi_kullanicilari (bayi_id, bk_eposta, bk_erisim) values
  (6, 'andrei@directiepro.ro', true),
  (7, 'autotech@bayi.embedra.com', true),
  (8, 'volant-netz@bayi.embedra.com', true),
  (9, 'kafkas@bayi.embedra.com', false);

insert into public.musteri (id, m_ad, m_segment, m_sehir, m_ulke, m_vergino, m_durum, m_toplam_deger, m_son_temas) values
  (1, 'Volant Lenkung Service GmbH', 'servis', 'Stuttgart', 'Almanya', 'DE 284 117 903', 'Aktif · VIP', 1860000, '2026-11-06'),
  (2, 'Akdeniz Direksiyon Servisi', 'servis', 'Antalya', 'Türkiye', '0612 448 2190', 'Yenileme riski', 248000, '2026-10-30'),
  (3, 'Kaya Oto Elektronik', 'servis', 'İzmir', 'Türkiye', '5310 772 0184', 'Aktif', 412000, '2026-11-06'),
  (4, 'Polska EPS Serwis', 'bayi', 'Poznań', 'Polonya', 'PL 7792 4410 22', 'Bayi adayı', 2310000, '2026-11-06'),
  (5, 'Ege Meslek Yüksekokulu', 'egitim', 'Manisa', 'Türkiye', null, 'Yenileme yakın', 520000, '2026-10-27'),
  (6, 'Nordic Steering AB', 'muhendislik', 'Göteborg', 'İsveç', 'SE 5590 1144 01', 'Aktif', 690000, '2026-10-19'),
  (7, 'Başkent Rot & Direksiyon', 'servis', 'Ankara', 'Türkiye', '1450 228 9031', 'Yükseltme adayı', 164000, '2026-10-31'),
  (8, 'Iberia Dirección SL', 'servis', 'Valencia', 'İspanya', 'ES B9844 1202', 'Demo planlı', null, '2026-11-06'),
  (9, 'Bursa ECU Lab', 'muhendislik', 'Bursa', 'Türkiye', '1880 554 2071', 'Yenileme yakın', 356000, '2026-11-01'),
  (10, 'Auto Volan Cluj', 'servis', null, 'Romanya', null, 'Aktif', null, null),
  (11, 'Servo Direct Iași', 'servis', null, 'Romanya', null, 'Aktif', null, null),
  (12, 'Timiș Steering Lab', 'servis', null, 'Romanya', null, 'Aktif', null, null),
  (13, 'Brașov Auto Electric', 'servis', null, 'Romanya', null, 'Aktif', null, null),
  (14, 'Constanța Moto Service', 'servis', null, 'Romanya', null, 'Aktif', null, null);

insert into public.musteri_yetkilileri (id, musteri_id, y_ad, y_unvan, y_tel, y_eposta, y_sira) values
  (1, 1, 'Jonas Weber', 'Servis müdürü', '+49 711 555 0142', 'j.weber@volant-service.de', 0),
  (2, 1, 'Anna Schmidt', 'Satın alma', '+49 711 555 0150', 'a.schmidt@volant-service.de', 1),
  (3, 2, 'Hakan Yıldız', '', '+90 532 410 22 18', 'hakan@akdenizdireksiyon.com', 0),
  (4, 3, 'Serkan Kaya', '', '+90 533 290 41 77', 'serkan@kayaotoelektronik.com', 0),
  (5, 4, 'Marta Nowak', '', '+48 61 555 0198', 'marta@polskaeps.pl', 0),
  (6, 5, 'Dr. Ayşe Demir', '', '+90 236 555 08 40', 'ayse.demir@egemyo.edu.tr', 0),
  (7, 6, 'Erik Lindqvist', '', '+46 31 555 0170', 'erik@nordicsteering.se', 0),
  (8, 7, 'Mustafa Aydın', '', '+90 312 555 61 20', 'info@baskentrot.com.tr', 0),
  (9, 8, 'Lucía Martín', '', '+34 96 555 0123', 'lucia@iberiadireccion.es', 0),
  (10, 9, 'Burak Şen', '', '+90 224 555 30 14', 'burak@bursaeculab.com', 0);

insert into public.iletisim_izinleri (yetkili_id, i_kanal, i_verildi, i_tarih, i_kaynak, i_cekilme) values
  (1, 'eposta', true, '2026-03-14', 'Lisans aktivasyonu', null),
  (1, 'whatsapp', true, '2026-03-14', 'Lisans aktivasyonu', null),
  (3, 'whatsapp', true, '2025-11-06', 'Telefon görüşmesi', null),
  (3, 'arama', true, '2025-11-06', 'Telefon görüşmesi', null),
  (4, 'eposta', true, '2026-06-02', 'Lisans aktivasyonu', null),
  (4, 'whatsapp', true, '2026-06-02', 'Lisans aktivasyonu', null),
  (4, 'sms', true, '2026-06-02', 'Lisans aktivasyonu', null),
  (6, 'eposta', true, '2025-11-19', 'Fuar formu', null),
  (7, 'eposta', true, '2025-11-28', 'Sipariş', null),
  (8, 'whatsapp', true, '2026-04-11', 'WhatsApp onayı', null),
  (10, 'eposta', true, '2025-11-11', 'Web sitesi formu', null),
  (10, 'whatsapp', true, '2025-11-11', 'Web sitesi formu', null);

insert into public.musteri_olaylari (musteri_id, o_tur, o_metin, o_kaynak, created_at) values
  (1, 'teklif', 'Teklif EMB-2026-311 kabul edildi', null, '2026-10-21 12:00+03'),
  (1, 'demo', 'Demo: Mercedes kolon EPS simülasyonu', 'Online', '2026-10-28 12:00+03'),
  (1, 'destek', 'Destek #4821 açıldı · Flash sonrası ECU', 'E-posta', '2026-11-06 09:02+03'),
  (1, 'siparis', '2× ONE + Pro+ lisans siparişi', 'Sipariş', '2026-11-06 11:24+03'),
  (2, 'siparis', 'Lisans aktivasyonu', null, '2025-11-06 12:00+03'),
  (2, 'not', 'Fiyat sorusu: Pro → Pro+ geçiş', 'WhatsApp', '2026-10-22 12:00+03'),
  (2, 'arama', 'Lisans yenilemesi için arandı', 'Telefon', '2026-10-30 12:00+03'),
  (3, 'not', 'Eğitim videosu paylaşıldı: Flash adımları', null, '2026-10-25 12:00+03'),
  (3, 'destek', 'Destek #4817 · K-Line bağlantı hatası', 'Telefon', '2026-11-06 08:40+03'),
  (4, 'destek', 'Destek #4819 · Aktivasyon kodu', null, '2026-11-06 10:15+03'),
  (4, 'teklif', 'Distribütörlük başvurusu değerlendirmede', 'Bayi kaydı', '2026-11-06 12:00+03'),
  (5, 'teklif', 'Eğitim lisansı teklif talebi (4 cihaz)', 'E-posta', '2026-10-27 12:00+03'),
  (6, 'not', 'FlexRay test raporu paylaşıldı', null, '2026-10-19 12:00+03'),
  (7, 'destek', 'Yeni model talebi · Hyundai Tucson', 'Telefon', '2026-10-31 12:00+03'),
  (8, 'demo', 'Demo tarihi girildi · 5 Kas 14:00', 'Satış hattı', '2026-11-06 12:00+03'),
  (9, 'teklif', 'Yenileme teklifi gönderildi', null, '2026-11-01 12:00+03');

insert into public.cihazlar (id, c_serino, c_fw, musteri_id, c_model, c_durum, c_sahip_adi, c_ulke, plan_id, c_lisans_bat, c_lisans_bit, c_son_gorulme, bayi_id, c_stoga_giris) values
  (1, 'EO1-2402-0611', 'v2.4.1', 1, 'ONE', 'aktif', 'Volant Lenkung Service', 'Almanya', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-03-14', '2027-03-14', null, null, null),
  (2, 'EO1-2402-0612', 'v2.3.0', 1, 'ONE', 'aktif', 'Volant Lenkung Service', 'Almanya', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-03-14', '2027-03-14', null, null, null),
  (3, 'EO1-2309-0142', 'v2.2.4', 2, 'ONE', 'bitiyor', 'Akdeniz Direksiyon Servisi', 'Türkiye', (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-11-06', '2026-11-06', null, null, null),
  (4, 'EO1-2406-0455', 'v2.4.1', 3, 'ONE', 'aktif', 'Kaya Oto Elektronik', 'Türkiye', (select id from public.lisans_planlari where l_paket = 'Pro'), '2026-06-02', '2027-06-02', null, null, null),
  (5, 'EO1-2404-0390', 'v2.4.0', 4, 'ONE', 'aktif', 'Polska EPS Serwis', 'Polonya', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-01-30', '2027-01-30', null, null, null),
  (6, 'EO1-2310-0218', 'v2.4.1', 9, 'ONE', 'bitiyor', 'Bursa ECU Lab', 'Türkiye', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-11-11', '2026-11-11', null, null, null),
  (7, 'EO1-2311-0301', 'v2.3.2', null, 'ONE Lite', 'bitiyor', 'Atelier Direction Lyon', 'Fransa', (select id from public.lisans_planlari where l_paket = 'Basic'), '2025-11-14', '2026-11-14', null, null, null),
  (8, 'EO1-2404-0391', 'v2.4.0', 4, 'ONE', 'aktif', 'Polska EPS Serwis', 'Polonya', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-01-30', '2027-01-30', null, null, null),
  (9, 'EO1-2312-0412', 'v2.4.1', 6, 'ONE', 'lisanssiz', 'Nordic Steering AB', 'İsveç', (select id from public.lisans_planlari where l_paket = 'Pro+'), null, null, null, null, null),
  (10, 'EO1-2311-0322', 'v2.3.2', 5, 'ONE', 'bitiyor', 'Ege Meslek Yüksekokulu', 'Türkiye', (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-11-19', '2026-11-19', null, null, null),
  (11, 'EO1-2312-0390', 'v2.4.1', 6, 'ONE', 'bitiyor', 'Nordic Steering AB', 'İsveç', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-11-28', '2026-11-28', null, null, null),
  (12, 'EO1-2305-0077', 'v2.1.8', null, 'ONE Lite', 'aktif', 'Anadolu Teknik Lisesi', 'Türkiye', (select id from public.lisans_planlari where l_paket = 'Basic'), '2026-05-22', '2027-05-22', null, null, null),
  (13, 'EO1-2401-0533', 'v2.4.1', 7, 'ONE Lite', 'lisanssiz', 'Başkent Rot & Direksiyon', 'Türkiye', (select id from public.lisans_planlari where l_paket = 'Basic'), null, null, null, null, null),
  (14, 'EO1-2511-0705', 'v2.4.1', 10, 'ONE', 'bitiyor', 'Auto Volan Cluj', 'Romanya', (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-11-21', '2026-11-21', null, 6, null),
  (15, 'EO1-2511-0708', 'v2.4.1', 11, 'ONE', 'bitiyor', 'Servo Direct Iași', 'Romanya', (select id from public.lisans_planlari where l_paket = 'Basic'), '2025-12-03', '2026-12-03', null, 6, null),
  (16, 'EO1-2511-0711', 'v2.4.1', 12, 'ONE', 'bitiyor', 'Timiș Steering Lab', 'Romanya', (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-11-10', '2026-11-10', null, 6, null),
  (17, 'EO1-2601-0730', 'v2.4.1', 13, 'ONE', 'aktif', 'Brașov Auto Electric', 'Romanya', (select id from public.lisans_planlari where l_paket = 'Pro'), '2026-01-22', '2027-01-22', null, 6, null),
  (18, 'EO1-2603-0742', 'v2.4.1', 14, 'ONE', 'aktif', 'Constanța Moto Service', 'Romanya', (select id from public.lisans_planlari where l_paket = 'Basic'), '2026-03-18', '2027-03-18', null, 6, null),
  (19, 'EO1-2406-0456', 'v2.4.1', 3, 'ONE', 'aktif', 'Kaya Oto Elektronik', 'Türkiye', null, null, null, null, null, null),
  (20, 'EO1-2404-0418', 'v2.4.1', 7, 'ONE Lite', 'aktif', 'Başkent Rot & Direksiyon', 'Türkiye', null, null, null, null, null, null);

insert into public.lisanslar (cihaz_id, plan_id, l_bat, l_bit) values
  (1, (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-03-14', '2026-03-14'),
  (1, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-03-14', '2027-03-14'),
  (2, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-03-14', '2027-03-14'),
  (3, (select id from public.lisans_planlari where l_paket = 'Basic'), '2024-11-06', '2025-11-06'),
  (3, (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-11-06', '2026-11-06'),
  (4, (select id from public.lisans_planlari where l_paket = 'Pro'), '2026-06-02', '2027-06-02'),
  (5, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-01-30', '2027-01-30'),
  (6, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-11-11', '2026-11-11'),
  (7, (select id from public.lisans_planlari where l_paket = 'Basic'), '2025-11-14', '2026-11-14'),
  (8, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2026-01-30', '2027-01-30'),
  (9, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-12-04', '2026-12-04'),
  (10, (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-11-19', '2026-11-19'),
  (11, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-11-28', '2026-11-28'),
  (12, (select id from public.lisans_planlari where l_paket = 'Basic'), '2025-05-22', '2026-05-22'),
  (12, (select id from public.lisans_planlari where l_paket = 'Basic'), '2026-05-22', '2027-05-22'),
  (13, (select id from public.lisans_planlari where l_paket = 'Basic'), '2025-04-11', '2026-04-11'),
  (14, (select id from public.lisans_planlari where l_paket = 'Pro'), '2025-11-21', '2026-11-21'),
  (15, (select id from public.lisans_planlari where l_paket = 'Basic'), '2025-12-03', '2026-12-03'),
  (16, (select id from public.lisans_planlari where l_paket = 'Pro+'), '2025-11-10', '2026-11-10'),
  (17, (select id from public.lisans_planlari where l_paket = 'Pro'), '2026-01-22', '2027-01-22'),
  (18, (select id from public.lisans_planlari where l_paket = 'Basic'), '2026-03-18', '2027-03-18');

insert into public.kampanyalar (id, kp_ad, kp_kanal, kp_liste, kp_baslangic, kp_bitis, kp_durum, kp_not, kp_mesaj_konu, kp_mesaj_metin, kp_mesaj_sablon, kp_otomasyon_tur, kp_otomasyon_zaman) values
  (1, 'Lisans yenileme hatırlatması', 'E-posta', 'bitiyor', '2026-11-01', '2026-11-30', 'Aktif', 'Bitişe 30, 7 ve 1 gün kala', '{firma} · lisansınız yakında bitiyor', 'Merhaba {ad},

EmbedraONE lisansınızın bitiş tarihi yaklaşıyor. Kesintisiz kullanım için yenilemeyi şimdiden yapabilirsiniz.

Sorularınız için bu e-postayı yanıtlamanız yeterli.', '', 'surekli', null),
  (2, 'Basic → Pro yükseltme', 'WhatsApp', 'basic', '2026-10-20', '2026-11-20', 'Aktif', 'İlk yıl %10 indirim', '', 'Merhaba {ad}, {firma} için Basic''ten Pro''ya geçişte ilk yıl %10 indirim tanımladık. Detay için bu mesajı yanıtlayabilirsiniz.', 'pro_yukseltme_teklifi', 'yok', null),
  (3, 'Ekim duyurusu', 'E-posta', 'izinli', '2026-10-07', null, 'Tamamlandı', '', null, null, null, 'yok', null),
  (4, 'ONE ile 4 adımda EPS onarımı', 'Instagram', 'izinli', '2026-10-14', null, 'Tamamlandı', 'Reels paylaşımı', null, null, null, 'yok', null),
  (5, 'Kasım duyurusu', 'E-posta', 'izinli', '2026-11-05', null, 'Tamamlandı', '', null, null, null, 'yok', null),
  (6, 'Bayilere marka kiti', 'E-posta', 'bayiler', '2026-11-15', null, 'Taslak', 'Logo, broşür ve fiyat listesi', null, null, null, 'yok', null);

insert into public.icerikler (id, ic_tarih, ic_kanal, ic_baslik, ic_paylasildi, kampanya_id, ic_aciklama, ic_hashtaglar, ic_bayi_paylas) values
  (1, '2026-11-02', 'Instagram', 'Reels: AMOLED ekranda canlı voltaj', true, 4, '', '{}'::text[], false),
  (2, '2026-11-03', 'Blog', 'Kolon EPS''de en sık 10 hata kodu', true, null, '', '{}'::text[], true),
  (3, '2026-11-04', 'WhatsApp', 'Basic kullanıcılara Pro teklifi', true, 2, '', '{}'::text[], false),
  (4, '2026-11-04', 'Instagram', 'Story: müşteri atölyesi', false, null, '', '{}'::text[], false),
  (5, '2026-11-05', 'Bülten / e-posta', 'Kasım duyurusu', true, 5, '', '{}'::text[], false),
  (6, '2026-11-06', 'Instagram', 'Karusel: K-Line ve CAN-FD farkı', false, null, 'K-Line mi CAN-FD mi? Direksiyon kutusunun hangi hattan konuştuğunu bilmek teşhisin yarısı. Kaydırın 👉', array['EmbedraONE','CANFD','otoelektrik','EPS']::text[], false),
  (7, '2026-11-08', 'Instagram', 'Haftalık soru-cevap', false, null, '', '{}'::text[], false),
  (8, '2026-11-10', 'LinkedIn', 'Bayi ağımıza Romanya katıldı', false, null, '', '{}'::text[], false),
  (9, '2026-11-12', 'Blog', 'FlexRay nedir, hangi araçlarda var?', false, null, '', '{}'::text[], false),
  (10, '2026-11-13', 'WhatsApp', 'Lisansı bitenlere yenileme hatırlatması', false, 1, '', '{}'::text[], false),
  (11, '2026-11-18', 'Instagram', 'Reels: Flash öncesi besleme kontrolü', false, null, '', '{}'::text[], false),
  (12, '2026-11-24', 'Bülten / e-posta', 'Black Friday: Pro+ yükseltme', false, null, '', '{}'::text[], false);

insert into public.kampanya_gonderimleri (kampanya_id, kg_kanal, kg_zaman, kg_tur, kg_alici, kg_basarili, kg_hatali, kg_atlanan, kg_demo, kg_hatalar) values
  (5, 'eposta', '2026-11-05 10:00', 'elle', 6, 6, 0, 2, true, '{}'::text[]),
  (3, 'eposta', '2026-10-07 10:00', 'elle', 5, 5, 0, 1, true, '{}'::text[]),
  (2, 'whatsapp', '2026-10-21 11:30', 'elle', 2, 2, 0, 0, true, '{}'::text[]);

insert into public.satis_hatti (id, f_firma, f_konum, kaynak_id, f_icerik, f_tutar, asama_id, f_sonraki_adim, f_sonraki_tarih, f_kayip_nedeni, f_kayip_aciklama, kampanya_id, f_telefon, f_son_hareket, f_sira, f_kazanc_islendi, musteri_id) values
  (1, 'Mert Usta Oto', 'Kocaeli, TR', (select id from public.kaynak where f_kaynak = 'Instagram'), '1× ONE + Pro lisans', 184000, (select id from public.asama where kod = 'yeni'), 'İlk arama', '2026-11-03', null, null, 4, null, '2026-11-06', 0, false, null),
  (2, 'Sarajevo Auto Elektro', 'Bosna-Hersek', (select id from public.kaynak where f_kaynak = 'Web sitesi'), '1× ONE + Basic', 142000, (select id from public.asama where kod = 'yeni'), 'Fiyat listesi gönder', '2026-11-04', null, null, null, null, '2026-10-30', 1, false, null),
  (3, 'Konya Direksiyon Merkezi', 'Konya, TR', (select id from public.kaynak where f_kaynak = 'WhatsApp'), '2× ONE + Pro+', 356000, (select id from public.asama where kod = 'yeni'), 'İhtiyaç analizi', '2026-11-04', null, null, 2, '+905321112233', '2026-11-06', 2, false, null),
  (4, 'Iberia Dirección SL', 'Valencia, ES', (select id from public.kaynak where f_kaynak = 'Fuar'), '3× ONE + Pro+', 520000, (select id from public.asama where kod = 'demo'), 'Online demo 14:00', '2026-11-05', null, null, null, null, '2026-11-04', 0, false, 8),
  (5, 'Ege Meslek Yüksekokulu', 'Manisa, TR', (select id from public.kaynak where f_kaynak = 'Mevcut müşteri'), 'Eğitim seti · 4 cihaz', 520000, (select id from public.asama where kod = 'demo'), 'Laboratuvar ziyareti', '2026-11-07', null, null, 3, null, '2026-11-06', 1, false, 5),
  (6, 'Atelier Direction Lyon', 'Lyon, FR', (select id from public.kaynak where f_kaynak = 'Web sitesi'), 'Basic → Pro yükseltme', 106000, (select id from public.asama where kod = 'teklif'), 'Takip e-postası', '2026-10-31', null, null, 2, null, '2026-11-06', 0, false, null),
  (7, 'Başkent Rot & Direksiyon', 'Ankara, TR', (select id from public.kaynak where f_kaynak = 'Mevcut müşteri'), 'Pro yükseltme + 1 cihaz', 214000, (select id from public.asama where kod = 'teklif'), 'Teklif EMB-2026-342', '2026-11-06', null, null, null, null, '2026-11-06', 1, false, 7),
  (8, 'Polska EPS Serwis', 'Poznań, PL', (select id from public.kaynak where f_kaynak = 'Bayi'), '10× ONE · bayi stoğu', 1410000, (select id from public.asama where kod = 'muzakere'), 'MOQ ve bölge hakkı', '2026-11-08', null, null, null, null, '2026-11-02', 0, false, 4),
  (9, 'Nordic Steering AB', 'Göteborg, SE', (select id from public.kaynak where f_kaynak = 'Mevcut müşteri'), 'Pro+ yenileme · 2 yıl', 234000, (select id from public.asama where kod = 'muzakere'), 'İndirim onayı', '2026-11-12', null, null, 1, null, '2026-11-06', 1, false, 6),
  (10, 'Volant Lenkung Service', 'Stuttgart, DE', (select id from public.kaynak where f_kaynak = 'Fuar'), '2× ONE + Pro+', 359000, (select id from public.asama where kod = 'kazanildi'), 'Sevkiyat hazırlanıyor', '2026-11-03', null, null, null, null, '2026-11-06', 0, true, 1),
  (11, 'Bursa ECU Lab', 'Bursa, TR', (select id from public.kaynak where f_kaynak = 'WhatsApp'), 'Pro+ yenileme', 96000, (select id from public.asama where kod = 'kazanildi'), 'Fatura kesildi', '2026-11-01', null, null, 1, '+905441234567', '2026-11-06', 1, true, 9),
  (12, 'Rota Servis Konya', 'Konya, TR', (select id from public.kaynak where f_kaynak = 'Web sitesi'), '1× ONE + Pro', 178000, (select id from public.asama where kod = 'kaybedildi'), '6 ay sonra tekrar ara', '2027-04-15', 'Bütçe yok', null, 4, null, '2026-11-06', 0, false, null);

insert into public.whatsapp_mesajlari (satis_hatti_id, w_mesaj_id, w_metin, w_yon, w_tur, w_zaman) values
  (3, 'demo-wa-1', 'Merhaba, 2 adet ONE ve Pro+ lisans için fiyat alabilir miyim?', 'gelen', 'text', '2026-11-03T10:12:00.000Z');

insert into public.destek_talepleri (id, musteri_id, cihaz_id, t_kanal, t_konu, t_oncelik, t_baslik, t_aciklama, t_arac, t_durum, t_dosya, t_musteri_adi, t_yetkili, t_telefon, t_eposta, t_plan, t_firmware, bayi_id, created_at) overriding system value values
  (4821, 1, 1, 'E-posta', 'Flash / yazılım', 'Yüksek', 'Flash sonrası ECU yanıt vermiyor', 'Flash işlemi %96''da durmuş, ECU artık hiçbir protokolde yanıt vermiyor. Müşteri log dosyasını e-postayla gönderdi; dosya talebe eklendi.', 'VW Golf 7 · kremayer EPS', 'islemde', 'onesuite_log_0211.txt', 'Volant Lenkung Service GmbH', 'Jonas Weber', '+49 711 555 0142', 'j.weber@volant-service.de', 'Pro+', 'v2.4.1', null, '2026-11-04 09:02+03'),
  (4819, 4, 8, 'WhatsApp', 'Lisans', 'Yüksek', 'Lisans aktivasyon kodu geçersiz', 'İkinci cihazda aktivasyon kodu “geçersiz” hatası veriyor. Pro+ lisansı iki cihazı kapsıyor.', '—', 'yeni', null, 'Polska EPS Serwis', 'Marta Nowak', '+48 61 555 0198', 'marta@polskaeps.pl', 'Pro+', 'v2.4.0', null, '2026-11-04 10:15+03'),
  (4817, 3, 4, 'Telefon', 'Bağlantı', 'Orta', 'K-Line bağlantı hatası', 'Doblo kolonunda K-Line ile bağlantı kurulamıyor, cihaz “no response” gösteriyor.', 'Fiat Doblo · kolon EPS', 'islemde', null, 'Kaya Oto Elektronik', 'Serkan Kaya', '+90 533 290 41 77', 'serkan@kayaotoelektronik.com', 'Pro', 'v2.4.1', null, '2026-11-04 08:40+03'),
  (4815, 6, 9, 'E-posta', 'Donanım arızası', 'Orta', 'OLED ekran dokunmaya yanıt vermiyor', 'Cihaz açılıyor ama ekran dokunmaya tepki vermiyor. Yeniden başlatma işe yaramamış.', '—', 'beklemede', null, 'Nordic Steering AB', 'Erik Lindqvist', '+46 31 555 0170', 'erik@nordicsteering.se', 'Pro+', 'v2.4.1', null, '2026-11-03 16:20+03'),
  (4802, 9, 6, 'Telefon', 'Diğer', 'Düşük', 'ONESuite kurulumu macOS', 'macOS''ta kurulum sırasında güvenlik uyarısı alınıyor.', '—', 'cozuldu', null, 'Bursa ECU Lab', 'Burak Şen', '+90 224 555 30 14', 'burak@bursaeculab.com', 'Pro+', 'v2.4.1', null, '2026-10-28 11:10+03');

insert into public.talep_notlari (talep_id, n_tur, n_metin, n_dosya, created_at) values
  (4821, 'acilis', 'E-postadaki bilgilerle kaydedildi, log dosyası eklendi.', null, '2026-11-04 09:02+03'),
  (4821, 'gorusme', 'Flash sırasında besleme yaklaşık 11,4V imiş. Düşük voltaj kaynaklı kesinti olabilir.', null, '2026-11-04 09:35+03'),
  (4821, 'yapilacak', 'Harici 12V besleme ile kurtarma modu adımları müşteriye anlatılacak.', null, '2026-11-04 10:20+03'),
  (4819, 'acilis', 'WhatsApp mesajından kaydedildi.', null, '2026-11-04 10:15+03'),
  (4817, 'acilis', 'Telefonla bildirildi.', null, '2026-11-04 08:40+03'),
  (4817, 'not', 'Pin kablosunun bağlantı fotoğrafı istendi.', null, '2026-11-04 08:52+03'),
  (4815, 'acilis', 'E-postadan kaydedildi.', null, '2026-11-03 16:20+03'),
  (4815, 'beklemede', 'Cihazın servise gönderilmesi bekleniyor.', null, '2026-11-04 09:00+03'),
  (4802, 'acilis', 'Telefonla bildirildi.', null, '2026-10-28 11:10+03'),
  (4802, 'cozuldu', 'Sistem ayarlarından izin verme adımları anlatıldı.', null, '2026-10-28 11:40+03');

insert into public.teklifler (id, tk_no, tk_gorunen_no, tk_kok, tk_versiyon, satis_hatti_id, tk_firma, tk_konum, tk_iskonto, tk_kdv, tk_gecerlilik, tk_odeme_sartlari, tk_teslim_sartlari, tk_not, tk_durum, tk_olusturma, tk_gonderim, tk_sonuc, tk_siparis_no) values
  (1, 'TKL-2026-0001', 'TKL-2026-0001', 'TKL-2026-0001', 1, 7, 'Başkent Rot & Direksiyon', 'Ankara, TR', 5, 0.2, '2026-11-12', '%50 peşin, %50 teslimde · Havale/EFT', 'Siparişten itibaren 5 iş günü · Kargo dahil', 'Mevcut Basic lisans Pro''ya yükseltilir.', 'gonderildi', '2026-11-02', '2026-11-02', null, null),
  (2, 'TKL-2026-0002', 'TKL-2026-0002', 'TKL-2026-0002', 1, 6, 'Atelier Direction Lyon', 'Lyon, FR', 0, 0.2, '2026-11-15', 'Kartla peşin', 'Lisans anahtarı ödeme sonrası e-postayla', '', 'gonderildi', '2026-10-28', '2026-10-28', null, null);

insert into public.teklif_kalemleri (teklif_id, tkk_sira, tkk_tur, tkk_model, tkk_paket, tkk_aciklama, tkk_adet, tkk_birim_fiyat, tkk_kdvli) values
  (1, 0, 'cihaz', 'ONE', null, null, 1, 98000, true),
  (1, 1, 'lisans', null, 'Pro', null, 2, 70000, true),
  (2, 0, 'lisans', null, 'Pro', null, 1, 70000, true),
  (2, 1, 'ozel', null, null, 'Basic lisans kalan süre mahsubu', 1, -14000, false);

insert into public.siparisler (id, sp_no, sp_tarih, musteri_id, bayi_id, sp_musteri_adi, sp_ulke, sp_adres, teklif_id, sp_tutar, sp_para_birimi, sp_odeme, sp_durum, sp_seri_nolar, sp_kargo_firma, sp_kargo_takip, sp_teslim_tarihi, sp_fatura_no, sp_lisans_bat, sp_iptal_tarihi, sp_iptal_neden, sp_iptal_kim, sp_iptal_odeme_iadesi) values
  (1, 'S-26-1184', '2026-11-06 11:24', 1, null, 'Volant Lenkung Service GmbH', 'Almanya', 'Industriestr. 14, 70565 Stuttgart, DE', null, 9800, 'EUR', 'Kart', 'hazirlaniyor', '{}'::text[], null, null, null, 'EMB2026000431', null, null, null, null, null),
  (2, 'S-26-1181', '2026-11-06 09:10', null, null, 'Mert Usta Oto', 'Türkiye', 'Gebze OSB, Kocaeli', null, 168000, 'TRY', 'Havale/EFT', 'odeme', '{}'::text[], null, null, null, null, null, null, null, null, null),
  (3, 'S-26-1177', '2026-11-01 14:02', 9, null, 'Bursa ECU Lab', 'Türkiye', 'Nilüfer, Bursa', null, 100800, 'TRY', 'Kart', 'tamamlandi', array['EO1-2310-0218']::text[], null, null, '2026-11-01', 'EMB2026000412', '2025-11-11', null, null, null, null),
  (4, 'S-26-1172', '2026-10-31 10:15', null, 6, 'Direcție Pro SRL', 'Romanya', 'Bd. Unirii 22, București, RO', null, 31500, 'EUR', 'Proforma', 'kargoda', array['EO1-2610-0680','EO1-2610-0681','EO1-2610-0682','EO1-2610-0683','EO1-2610-0684','EO1-2610-0685','EO1-2610-0686','EO1-2610-0687','EO1-2610-0688','EO1-2610-0689']::text[], 'DHL Freight', '4471 0928 3315', null, 'EMB2026000398', null, null, null, null, null),
  (5, 'S-26-1169', '2026-10-30 15:40', 3, null, 'Kaya Oto Elektronik', 'Türkiye', 'Bornova, İzmir', null, 4200, 'TRY', 'Kart', 'teslim', '{}'::text[], 'Yurtiçi Kargo', '2210 4471 09', '2026-11-02', 'EMB2026000401', null, null, null, null, null),
  (6, 'S-26-1166', '2026-10-29 13:05', 2, null, 'Akdeniz Direksiyon Servisi', 'Türkiye', 'Muratpaşa, Antalya', null, 112000, 'TRY', 'Kart', 'kargoda', array['EO1-2610-0670']::text[], 'Yurtiçi Kargo', '2210 4480 17', null, null, null, null, null, null, null),
  (7, 'S-26-1163', '2026-10-28 10:00', 8, null, 'Iberia Dirección SL', 'İspanya', 'C/ de Colón 18, Valencia, ES', null, 4100, 'EUR', 'Kart', 'teslim', array['EO1-2610-0661']::text[], 'UPS Express', '1Z88F4E20444712210', '2026-11-03', 'EMB2026000389', null, null, null, null, null),
  (8, 'S-26-1158', '2026-10-27 11:30', null, null, 'Anadolu Teknik Lisesi', 'Türkiye', 'Melikgazi, Kayseri', null, 504000, 'TRY', 'Havale/EFT', 'hazirlaniyor', '{}'::text[], null, null, null, null, null, null, null, null, null);

insert into public.siparis_kalemleri (siparis_id, sk_sira, sk_tur, sk_model, sk_paket, sk_sure_ay, sk_stok_kodu, sk_adet) values
  (1, 0, 'cihaz', 'ONE', null, null, null, 2),
  (1, 1, 'lisans', null, 'Pro+', 12, null, 1),
  (2, 0, 'cihaz', 'ONE', null, null, null, 1),
  (2, 1, 'lisans', null, 'Pro', 12, null, 1),
  (3, 0, 'lisans', null, 'Pro+', 12, null, 1),
  (4, 0, 'cihaz', 'ONE', null, null, null, 10),
  (5, 0, 'aksesuar', null, null, null, 'EO1-CBL-MAIN', 1),
  (6, 0, 'cihaz', 'ONE Lite', null, null, null, 1),
  (6, 1, 'lisans', null, 'Basic', 12, null, 1),
  (7, 0, 'cihaz', 'ONE', null, null, null, 1),
  (7, 1, 'lisans', null, 'Basic', 12, null, 1),
  (8, 0, 'cihaz', 'ONE', null, null, null, 3),
  (8, 1, 'lisans', null, 'Pro', 12, null, 3);

insert into public.siparis_notlari (siparis_id, sn_metin, sn_sistem, sn_zaman) values
  (1, 'Web sitesinden kartla ödendi.', true, '2026-11-06 11:24'),
  (1, 'İhracat faturası kesildi: EMB2026000431', true, '2026-11-06 11:40'),
  (2, 'Sipariş açıldı, havale bekleniyor.', true, '2026-11-06 09:10'),
  (3, 'Yenileme siparişi, kartla ödendi.', true, '2026-11-01 14:02'),
  (3, 'Lisans anahtarı müşteriye iletildi.', true, '2026-11-01 14:30'),
  (4, 'Bayi stoğu siparişi, proforma ile ödendi.', true, '2026-10-31 10:15'),
  (4, 'DHL Freight ile kargoya verildi.', true, '2026-11-02 16:05'),
  (5, 'Yedek kablo siparişi.', true, '2026-10-30 15:40'),
  (5, 'Teslim edildi.', true, '2026-11-02 11:00'),
  (6, 'İkinci cihaz siparişi.', true, '2026-10-29 13:05'),
  (6, 'Yurtiçi Kargo ile kargoya verildi.', true, '2026-11-05 15:20'),
  (7, 'Kartla ödendi.', true, '2026-10-28 10:00'),
  (7, 'Teslim edildi, lisans anahtarı bekliyor.', true, '2026-11-03 09:40'),
  (8, 'Kamu alımı, havale ile ödendi. e-Fatura kamu kurumuna kesilecek.', true, '2026-10-28 09:00');
