-- Embedra CRM · demo verisi (2/3) — uygulamanın eski bellek içi deposundan aktarıldı.
-- Kimlikler sabit verilir; demo_verisi_2 sonunda identity dizileri en büyük id'ye ayarlanır.

insert into public.stok_kalemleri (st_kod, st_ad, st_adet, st_kritik, st_hedef, st_fiyat) values
  ('EO1-HW', 'EmbedraONE cihaz', 46, 10, 100, null),
  ('EO1L-HW', 'EmbedraONE LITE cihaz', 21, 8, 60, null),
  ('EO1-CBL-MAIN', 'Ana teşhis kablosu', 120, 30, 150, 4200),
  ('EO1-CBL-PIN', 'Universal pin kablosu', 18, 30, 130, 3500),
  ('EO1-CBL-BAT', 'Batarya kablosu', 88, 30, 130, 1200),
  ('EO1-CBL-USB', 'USB-C kablo', 140, 30, 150, 600);

insert into public.iadeler (ia_no, ia_siparis_no, siparis_id, ia_musteri_adi, ia_tur, ia_neden, ia_urunler, ia_tarih, ia_adim) values
  ('R-0042', 'S-26-1149', null, 'Atelier Direction Lyon', 'degisim', 'Yanlış ürün gönderildi · kablo seti eksik', array['1× Universal pin kablosu']::text[], '2026-11-03', 2),
  ('R-0041', 'S-26-1152', null, 'Sarajevo Auto Elektro', 'iade', 'Cayma hakkı · kutu açılmamış', array['EO1-2610-0655']::text[], '2026-11-02', 0);

insert into public.rma_kayitlari (id, r_no, r_seri_no, r_model, r_sahip_tur, musteri_id, bayi_id, r_sahip_adi, r_ariza_tipi, r_ariza, r_fotograflar, r_garantide, r_garanti_elle, r_ucret, r_adim, r_karar, r_kullanilan_parcalar, r_yeni_seri, destek_talebi_id, r_iade_no, r_kaynak, r_acilis, r_kapanis, r_gelis_kanal, r_gelis_takip, r_kargo_firma, r_kargo_takip, r_ucret_odendi, r_ucret_onay, r_oncelik) values
  (1, 'RMA-0006', 'EO1-2402-0612', 'ONE', 'musteri', 1, null, 'Volant Lenkung Service', 'Ekran / dokunmatik', 'Ekranın sağ alt köşesi dokunmaya yanıt vermiyor.', array['ekran-sag-alt.jpg']::text[], true, null, null, 'inceleme', null, '{}'::jsonb, null, 4815, null, 'crm', '2026-10-30', null, 'Kargo', 'UPS 1Z88F4E2', null, null, false, false, 'Acil'),
  (2, 'RMA-0005', 'EO1-2309-0142', 'ONE', 'musteri', 2, null, 'Akdeniz Direksiyon Servisi', 'Güç / batarya', 'Cihaz şarjda açılmıyor.', '{}'::text[], false, null, 6500, 'talep', null, '{}'::jsonb, null, null, null, 'crm', '2026-11-07', null, null, null, null, null, false, false, 'Normal'),
  (3, 'RMA-0004', 'EO1-2610-0661', 'ONE', 'musteri', 8, null, 'Iberia Dirección SL', 'Bağlantı (OBD / K-Line)', 'K-Line hattında kopma.', '{}'::text[], true, null, null, 'gonderildi', 'tamir', '{"PCB-MAIN": 1}'::jsonb, null, null, null, 'crm', '2026-10-12', '2026-10-19', 'Kargo', 'UPS 1Z77A1', 'UPS Express', '1Z88F4E20444719921', false, false, 'Normal');

insert into public.rma_gecmisi (rma_id, rg_zaman, rg_metin, rg_tur, rg_yazan) values
  (1, '2026-10-30 10:05', 'RMA açıldı (destek talebi #4815).', null, null),
  (1, '2026-11-03 09:40', 'Cihaz teslim alındı.', null, null),
  (1, '2026-11-03 14:10', 'İncelemeye alındı.', null, null),
  (2, '2026-11-07 11:20', 'RMA açıldı. Garanti dışı · servis ücreti ₺6.500 bildirildi.', null, null),
  (3, '2026-10-12 09:00', 'RMA açıldı.', null, null),
  (3, '2026-10-15 16:00', 'Karar: Tamir · Ana kart değiştirildi.', null, null),
  (3, '2026-10-19 10:30', 'Müşteriye gönderildi.', null, null);

insert into public.bilesenler (id, bs_kod, bs_ad, bs_adet, bs_kritik, bs_hedef, bs_kaynak) values
  (1, 'PCB-MAIN', 'Ana kart (PCB)', 45, 25, 150, 'dis'),
  (2, 'AMOLED', 'AMOLED dokunmatik ekran', 18, 20, 100, 'dis'),
  (3, 'KASA-ONE', 'Kasa · ONE', 40, 15, 100, 'ic'),
  (4, 'KASA-LITE', 'Kasa · ONE LITE', 25, 10, 60, 'ic'),
  (5, 'KUTU', 'Ambalaj kutusu', 60, 25, 150, 'dis');

insert into public.urun_receteleri (ur_model, bilesen_id, ur_sira) values
  ('ONE', 1, 0),
  ('ONE', 2, 1),
  ('ONE', 3, 2),
  ('ONE', 5, 3),
  ('ONE Lite', 1, 0),
  ('ONE Lite', 4, 1),
  ('ONE Lite', 5, 2);

insert into public.ic_uretim_emirleri (id, iu_no, bilesen_id, iu_hedef, iu_baslangic, iu_gun, iu_not) values
  (1, 'IU-0003', 3, 100, '2026-11-02', 10, 'Enjeksiyon kalıbı 2'),
  (2, 'IU-0002', 4, 40, '2026-10-19', 5, '');

insert into public.ic_uretim_girisleri (emir_id, iug_tarih, iug_adet, iug_personel, iug_not) values
  (1, '2026-11-02', 10, 'Selin Öz', ''),
  (1, '2026-11-03', 12, 'Selin Öz', ''),
  (1, '2026-11-04', 9, 'Deniz Arslan', 'Kalıp ısınması 1 saat sürdü'),
  (1, '2026-11-05', 8, 'Selin Öz', ''),
  (2, '2026-10-19', 8, 'Selin Öz', ''),
  (2, '2026-10-20', 9, 'Selin Öz', ''),
  (2, '2026-10-21', 8, 'Selin Öz', ''),
  (2, '2026-10-22', 7, 'Selin Öz', ''),
  (2, '2026-10-23', 8, 'Selin Öz', '');

insert into public.uretim_partileri (up_no, up_model, up_adet, up_hedef_tarih, up_durum, up_saglam, up_hatali, up_seriler, up_not, up_tamirde, up_onarilan, up_sokulen, up_hurda, up_geri_alinan) values
  ('P-2611-02', 'ONE Lite', 10, '2026-11-20', 'planlandi', null, null, '{}'::text[], 'Eğitim seti siparişleri için', null, null, null, null, null),
  ('P-2611-01', 'ONE', 20, '2026-11-12', 'uretimde', null, null, '{}'::text[], '', null, null, null, null, null),
  ('P-2610-04', 'ONE', 12, '2026-11-04', 'kalite', null, null, '{}'::text[], 'Firmware v2.4.1 yüklü', null, null, null, null, null),
  ('P-2610-03', 'ONE', 8, '2026-10-24', 'depoda', 6, 2, array['EO1-2610-0701','EO1-2610-0702','EO1-2610-0703','EO1-2610-0704','EO1-2610-0705','EO1-2610-0706']::text[], '2 cihaz ekran arızası', 1, null, 1, 0, '{"PCB-MAIN": 1, "KASA-ONE": 1, "KUTU": 1}'::jsonb),
  ('P-2610-02', 'ONE Lite', 4, '2026-10-20', 'depoda', 4, 0, array['EO1-2610-0710','EO1-2610-0711','EO1-2610-0712','EO1-2610-0713']::text[], '', null, null, null, null, null);

insert into public.tedarik_siparisleri (ts_no, ts_tedarikci, ts_kalem_kodu, ts_kalem_adi, ts_adet, ts_tarih, ts_beklenen, ts_durum) values
  ('T-0031', 'Shenzhen Display Co.', 'AMOLED', 'AMOLED dokunmatik ekran', 50, '2026-10-22', '2026-11-10', 'yolda'),
  ('T-0032', 'Ege Elektronik Kart A.Ş.', 'PCB-MAIN', 'Ana kart (PCB)', 100, '2026-11-03', '2026-11-24', 'siparis'),
  ('T-0030', 'Kablo Teknik Ltd.', 'EO1-CBL-PIN', 'Universal pin kablosu', 100, '2026-10-28', '2026-11-07', 'yolda'),
  ('T-0029', 'İzmir Ambalaj', 'KUTU', 'Ambalaj kutusu', 80, '2026-10-10', '2026-10-17', 'teslim');

insert into public.seri_havuzu (sh_seri_no, sh_model, sh_parti_no) values
  ('EO1-2610-0701', 'ONE', 'P-2610-03'),
  ('EO1-2610-0702', 'ONE', 'P-2610-03'),
  ('EO1-2610-0703', 'ONE', 'P-2610-03'),
  ('EO1-2610-0704', 'ONE', 'P-2610-03'),
  ('EO1-2610-0705', 'ONE', 'P-2610-03'),
  ('EO1-2610-0706', 'ONE', 'P-2610-03'),
  ('EO1-2610-0710', 'ONE Lite', 'P-2610-02'),
  ('EO1-2610-0711', 'ONE Lite', 'P-2610-02'),
  ('EO1-2610-0712', 'ONE Lite', 'P-2610-02'),
  ('EO1-2610-0713', 'ONE Lite', 'P-2610-02');

insert into public.otomasyon_kurallari (id, ok_ad, ok_aktif, ok_tetikleyici, ok_gun, ok_filtre, ok_engel, hatirlatma_sorumlu_id, ok_hatirlatma_onem, ok_eposta_konu, ok_eposta_metin, ok_son_calisma, created_at) values
  (1, 'Lisans bitmeden satışa görev aç', true, 'lisans-bitiyor', 45, '{}'::jsonb, null, 2, 'normal', null, null, null, '2026-11-01T09:00:00.000Z'),
  (2, 'Lisans yenileme e-postası', false, 'lisans-bitiyor', 30, '{}'::jsonb, null, null, null, '{firma} · lisansınızın süresi doluyor', 'Merhaba,

{detay}

Kesintisiz kullanım için yenileme teklifimizi iletmek isteriz. Bu e-postayı yanıtlayarak bize ulaşabilirsiniz.

Embedra Ekibi', null, '2026-11-01T09:00:00.000Z'),
  (3, 'Yanıtsız teklifi takip et', true, 'teklif-yanitsiz', 5, '{}'::jsonb, null, 2, 'yuksek', null, null, null, '2026-11-01T09:00:00.000Z'),
  (4, 'Uzayan RMA''yı destek ekibine bildir', false, 'rma-gecikti', 5, '{}'::jsonb, null, 3, 'yuksek', null, null, null, '2026-11-01T09:00:00.000Z'),
  (5, 'Kritik stokta operasyona haber ver', false, 'stok-kritik', 0, '{}'::jsonb, null, 4, 'yuksek', null, null, null, '2026-11-01T09:00:00.000Z'),
  (6, 'Uzun süredir bağlanmayan cihazı destekle kontrol et', false, 'cihaz-sessiz', 14, '{}'::jsonb, null, 3, 'normal', null, null, null, '2026-11-01T09:00:00.000Z'),
  (7, 'Ele alınmayan destek talebini uyar', false, 'destek-yanitsiz', 1, '{}'::jsonb, null, 3, 'yuksek', null, null, null, '2026-11-01T09:00:00.000Z');

insert into public.hatirlatmalar (h_baslik, h_aciklama, h_kayit_tur, h_kayit_id, h_kayit_ad, h_kayit_href, sorumlu_id, h_zaman, h_durum, h_onem, h_tamamlanma) values
  ('Nordic Steering · indirim onayı için ara', 'Satın alma müdürü Erik''e 2 yıllık yenileme indirimi.', 'firsat', '9', 'Nordic Steering AB', '/satis-hatti', 2, '2026-11-10 10:30', 'bekliyor', 'normal', null),
  ('Hellas Steering sözleşme imzası', 'Destek taahhüdü maddesi netleşti mi?', 'bayi', '4', 'Hellas Steering Tech', '/bayiler', 1, '2026-11-12 14:00', 'bekliyor', 'normal', null);

insert into public.bayi_hareketleri (id, bayi_id, bh_tur, bh_tarih, musteri_id, bh_musteri_adi, bh_plan, bh_sure_ay, bh_eski_seri, bh_not) values
  (1, 6, 'satis', '2026-11-03', null, 'Rota Servis', null, null, null, null),
  (2, 7, 'satis', '2026-11-03', null, 'Mega Oto', null, null, null, null),
  (3, 8, 'satis', '2026-11-03', null, 'Kale Oto', null, null, null, null),
  (4, 9, 'satis', '2026-11-03', null, 'Kale Oto', null, null, null, null),
  (5, 6, 'sevkiyat', '2026-10-27', null, null, null, null, null, null),
  (6, 7, 'sevkiyat', '2026-10-27', null, null, null, null, null, null),
  (7, 8, 'sevkiyat', '2026-10-27', null, null, null, null, null, null),
  (8, 9, 'sevkiyat', '2026-10-27', null, null, null, null, null, null),
  (9, 6, 'satis', '2026-10-15', null, 'Teknik Garaj', null, null, null, null),
  (10, 7, 'satis', '2026-10-15', null, 'Rota Servis', null, null, null, null),
  (11, 8, 'satis', '2026-10-15', null, 'Servis Point', null, null, null, null),
  (12, 9, 'satis', '2026-10-15', null, 'Servis Point', null, null, null, null),
  (13, 6, 'sevkiyat', '2026-10-06', null, null, null, null, null, null),
  (14, 7, 'sevkiyat', '2026-10-06', null, null, null, null, null, null),
  (15, 8, 'sevkiyat', '2026-10-06', null, null, null, null, null, null),
  (16, 9, 'sevkiyat', '2026-10-06', null, null, null, null, null, null),
  (17, 6, 'lisans', '2026-08-19', null, 'Prime Steering', 'Pro+', 12, null, null),
  (18, 7, 'lisans', '2026-08-19', null, 'Prime Steering', 'Pro', 12, null, null),
  (19, 8, 'lisans', '2026-08-19', null, 'Rota Servis', 'Pro+', 12, null, null),
  (20, 9, 'lisans', '2026-08-19', null, 'Direksiyon Usta', 'Pro+', 12, null, null),
  (21, 6, 'satis', '2026-08-18', null, 'Mega Oto', null, null, null, null),
  (22, 7, 'satis', '2026-08-18', null, 'Mega Oto', null, null, null, null),
  (23, 8, 'satis', '2026-08-18', null, 'Teknik Garaj', null, null, null, null),
  (24, 9, 'satis', '2026-08-18', null, 'Oto Elektrik Merkezi', null, null, null, null),
  (25, 6, 'sevkiyat', '2026-07-08', null, null, null, null, null, null),
  (26, 7, 'sevkiyat', '2026-07-08', null, null, null, null, null, null),
  (27, 8, 'sevkiyat', '2026-07-08', null, null, null, null, null, null),
  (28, 9, 'sevkiyat', '2026-07-08', null, null, null, null, null, null),
  (29, 7, 'lisans', '2026-05-19', null, 'Direksiyon Usta', 'Pro', 12, null, null),
  (30, 8, 'lisans', '2026-05-19', null, 'Servis Point', 'Pro+', 12, null, null),
  (31, 9, 'lisans', '2026-05-19', null, 'Mega Oto', 'Pro', 12, null, null),
  (32, 7, 'satis', '2026-05-18', null, 'Oto Elektrik Merkezi', null, null, null, null),
  (33, 8, 'satis', '2026-05-18', null, 'Direksiyon Usta', null, null, null, null),
  (34, 9, 'satis', '2026-05-18', null, 'Rota Servis', null, null, null, null),
  (35, 7, 'sevkiyat', '2026-04-08', null, null, null, null, null, null),
  (36, 8, 'sevkiyat', '2026-04-08', null, null, null, null, null, null),
  (37, 9, 'sevkiyat', '2026-04-08', null, null, null, null, null, null),
  (38, 7, 'lisans', '2026-02-19', null, 'Rota Servis', 'Pro', 12, null, null),
  (39, 8, 'lisans', '2026-02-19', null, 'Servis Point', 'Pro+', 12, null, null),
  (40, 9, 'lisans', '2026-02-19', null, 'Rota Servis', 'Pro', 12, null, null),
  (41, 7, 'satis', '2026-02-18', null, 'Teknik Garaj', null, null, null, null),
  (42, 8, 'satis', '2026-02-18', null, 'Direksiyon Usta', null, null, null, null),
  (43, 9, 'satis', '2026-02-18', null, 'Teknik Garaj', null, null, null, null),
  (44, 7, 'sevkiyat', '2026-01-08', null, null, null, null, null, null),
  (45, 8, 'sevkiyat', '2026-01-08', null, null, null, null, null, null),
  (46, 9, 'sevkiyat', '2026-01-08', null, null, null, null, null, null),
  (47, 7, 'lisans', '2025-11-19', null, 'Servis Point', 'Pro+', 12, null, null),
  (48, 8, 'lisans', '2025-11-19', null, 'Teknik Garaj', 'Pro', 12, null, null),
  (49, 9, 'lisans', '2025-11-19', null, 'Rota Servis', 'Pro', 12, null, null),
  (50, 7, 'satis', '2025-11-18', null, 'Direksiyon Usta', null, null, null, null),
  (51, 8, 'satis', '2025-11-18', null, 'Kale Oto', null, null, null, null),
  (52, 9, 'satis', '2025-11-18', null, 'Teknik Garaj', null, null, null, null),
  (53, 7, 'sevkiyat', '2025-10-08', null, null, null, null, null, null),
  (54, 8, 'sevkiyat', '2025-10-08', null, null, null, null, null, null),
  (55, 9, 'sevkiyat', '2025-10-08', null, null, null, null, null, null),
  (56, 7, 'lisans', '2025-08-19', null, 'Rota Servis', 'Pro', 12, null, null),
  (57, 8, 'lisans', '2025-08-19', null, 'Kale Oto', 'Pro', 12, null, null),
  (58, 9, 'lisans', '2025-08-19', null, 'Kale Oto', 'Pro', 12, null, null),
  (59, 7, 'satis', '2025-08-18', null, 'Teknik Garaj', null, null, null, null),
  (60, 8, 'satis', '2025-08-18', null, 'Servis Point', null, null, null, null),
  (61, 9, 'satis', '2025-08-18', null, 'Servis Point', null, null, null, null),
  (62, 7, 'sevkiyat', '2025-07-08', null, null, null, null, null, null),
  (63, 8, 'sevkiyat', '2025-07-08', null, null, null, null, null, null),
  (64, 9, 'sevkiyat', '2025-07-08', null, null, null, null, null, null),
  (65, 7, 'lisans', '2025-05-19', null, 'Direksiyon Usta', 'Pro', 12, null, null),
  (66, 8, 'lisans', '2025-05-19', null, 'Mega Oto', 'Pro', 12, null, null),
  (67, 9, 'lisans', '2025-05-19', null, 'Kale Oto', 'Pro', 12, null, null),
  (68, 7, 'satis', '2025-05-18', null, 'Oto Elektrik Merkezi', null, null, null, null),
  (69, 8, 'satis', '2025-05-18', null, 'Rota Servis', null, null, null, null),
  (70, 9, 'satis', '2025-05-18', null, 'Servis Point', null, null, null, null),
  (71, 7, 'sevkiyat', '2025-04-08', null, null, null, null, null, null),
  (72, 8, 'sevkiyat', '2025-04-08', null, null, null, null, null, null),
  (73, 9, 'sevkiyat', '2025-04-08', null, null, null, null, null, null),
  (74, 7, 'lisans', '2025-02-19', null, 'Prime Steering', 'Pro', 12, null, null),
  (75, 8, 'lisans', '2025-02-19', null, 'Kale Oto', 'Pro+', 12, null, null),
  (76, 7, 'satis', '2025-02-18', null, 'Mega Oto', null, null, null, null),
  (77, 8, 'satis', '2025-02-18', null, 'Servis Point', null, null, null, null),
  (78, 7, 'sevkiyat', '2025-01-08', null, null, null, null, null, null),
  (79, 8, 'sevkiyat', '2025-01-08', null, null, null, null, null, null);

insert into public.bayi_lisans_havuzu (bayi_id, blh_paket, blh_sure_ay, blh_adet, blh_kaynak, blh_tarih) values
  (6, 'Pro', 12, 2, 'S-26-1172', '2026-11-02');

insert into public.bayi_leadleri (id, bayi_id, bl_firma, bl_yetkili, bl_telefon, bl_eposta, bl_sehir, bl_kaynak, bl_ilgi_model, bl_ilgi_adet, bl_ilgi_plan, bl_tutar, bl_asama, bl_kayip_nedeni, bl_sonraki_adim, bl_sonraki_tarih, bl_olusturma, bl_kapanis, bl_satilan_seriler) values
  (1, 6, 'Auto Expert Sibiu', 'Radu Ionescu', '+40 744 120 330', 'radu@autoexpert.ro', 'Sibiu', 'Fuar', 'ONE', 2, 'Pro', 5200, 'demo', null, 'Atölyede canlı demo', '2026-11-14', '2026-10-22', null, '{}'::text[]),
  (2, 6, 'Pitești Direcție Service', 'Elena Dumitru', '+40 731 555 210', '', 'Pitești', 'Referans', 'ONE Lite', 1, 'Basic', 1900, 'yeni', null, 'İlk arama', '2026-11-16', '2026-11-12', null, '{}'::text[]),
  (3, 6, 'Galați Steering Center', 'Andrei Matei', '+40 722 410 870', 'andrei@gsc.ro', 'Galați', 'Sosyal medya', 'ONE', 1, 'Pro+', 3600, 'teklif', null, 'Teklif takibi', '2026-11-19', '2026-10-30', null, '{}'::text[]),
  (4, 6, 'Craiova Auto Lab', 'Mihai Popa', '+40 755 300 900', '', 'Craiova', 'Saha ziyareti', 'ONE', 1, 'Pro', 2600, 'kaybedildi', 'Rakip ürün', '6 ay sonra tekrar ara', '2027-04-01', '2026-09-18', '2026-10-20', '{}'::text[]),
  (5, 6, 'Timiș Steering Lab', 'Ioana Stan', '+40 766 101 202', 'ioana@tsl.ro', 'Timișoara', 'Mevcut müşteri', 'ONE', 1, 'Pro+', 3600, 'kazanildi', null, '', null, '2026-10-01', '2026-10-15', '{}'::text[]);

insert into public.bayi_lead_notlari (lead_id, bln_zaman, bln_metin, bln_sistem) values
  (1, '2026-10-22 15:10', 'Automechanika standında tanıştık, 2 atölyesi var.', false),
  (1, '2026-11-05 11:00', 'Telefonda görüştük, demo istiyor.', false),
  (2, '2026-11-12 09:30', 'Auto Volan Cluj önerdi.', false),
  (3, '2026-10-30 16:45', 'Instagram reklamından yazdı.', false),
  (3, '2026-11-10 10:00', 'Teklif DP-2026-014 gönderildi.', true),
  (4, '2026-10-20 14:00', 'Kaybedildi · Rakip ürün', true),
  (5, '2026-10-15 12:00', 'Kazanıldı', true);

insert into public.bayi_lead_teklifleri (id, lead_id, blt_no, blt_gorunen_no, blt_versiyon, blt_iskonto, blt_kdv, blt_gecerlilik, blt_odeme_sartlari, blt_teslim_sartlari, blt_not, blt_durum, blt_olusturma, blt_gonderim, blt_sonuc) values
  (1, 3, 'DP-2026-014', 'DP-2026-014', 1, 0, 0.21, '2026-11-30', '%100 peşin · Banka havalesi', 'Siparişten itibaren 3 iş günü · Kurulum dahil', 'Kurulum ve 2 saatlik eğitim dahil.', 'gonderildi', '2026-11-10', '2026-11-10', null);

insert into public.bayi_lead_teklif_kalemleri (teklif_id, bltk_sira, bltk_tur, bltk_model, bltk_paket, bltk_aciklama, bltk_adet, bltk_birim_fiyat, bltk_kdvli) values
  (1, 0, 'cihaz', 'ONE', null, null, 1, 2450, true),
  (1, 1, 'lisans', null, 'Pro+', null, 1, 1150, true);

insert into public.bayi_dokumanlari (id, bd_kod, bd_baslik, bd_aciklama, bd_kategori, bd_tur, bd_dosya_adi, bd_mime, bd_boyut, bd_tarih, bd_hepsine, bd_sure, bd_demo) values
  (1, 'd-brosur-one', 'EmbedraONE ürün broşürü', 'AMOLED dokunmatik ekranlı model: özellikler, kutu içeriği, desteklenen protokoller.', 'Ürün broşürleri', 'pdf', 'EmbedraONE-brosur.pdf', null, 2400000, '2026-10-05', true, null, true),
  (2, 'd-brosur-lite', 'EmbedraONE LITE ürün broşürü', 'Ekransız model ve ONE ile karşılaştırma tablosu.', 'Ürün broşürleri', 'pdf', 'EmbedraONE-LITE-brosur.pdf', null, 1800000, '2026-10-05', true, null, true),
  (3, 'd-onesuite', 'ONESuite lisans paketleri', 'Basic, Pro, Pro+, Premium ve Enterprise paketlerinin farkları.', 'Ürün broşürleri', 'pdf', 'ONESuite-paketler.pdf', null, 950000, '2026-11-03', true, null, true),
  (4, 'd-kurulum', 'Kurulum kılavuzu', 'Kutudan çıkarma, ilk açılış, ONESuite eşleştirme ve lisans aktivasyonu.', 'Teknik dokümanlar', 'pdf', 'Kurulum-kilavuzu.pdf', null, 3100000, '2026-09-12', true, null, true),
  (5, 'd-kullanim', 'Kullanım kılavuzu', 'Teşhis, kalibrasyon ve raporlama ekranları adım adım.', 'Teknik dokümanlar', 'pdf', 'Kullanim-kilavuzu.pdf', null, 5600000, '2026-09-12', true, null, true),
  (6, 'd-sss', 'Sık sorulan sorular', 'Bağlantı, lisans ve garanti hakkında en çok sorulanlar.', 'Teknik dokümanlar', 'pdf', 'SSS.pdf', null, 420000, '2026-11-08', true, null, true),
  (7, 'd-fw241', 'Firmware v2.4.1 sürüm notları', 'K-Line kararlılık düzeltmesi, yeni araç kapsamı, ekran parlaklığı ayarı.', 'Teknik dokümanlar', 'pdf', 'Firmware-v2.4.1-notlar.pdf', null, 180000, '2026-11-11', true, null, true),
  (8, 'd-kapsam', 'Araç kapsam listesi (Kasım 2026)', 'Marka / model / yıl bazında desteklenen EPS ve direksiyon sistemleri.', 'Teknik dokümanlar', 'pdf', 'Arac-kapsam-listesi.pdf', null, 1200000, '2026-11-01', true, null, true),
  (9, 'e-kurulum', 'Modül 1 · Kurulum ve ilk çalıştırma', 'Cihazı müşteride kurma, ONESuite hesabı açma ve lisans aktivasyonu.', 'Eğitim', 'pdf', 'Egitim-1-kurulum.pdf', null, 1400000, '2026-09-15', true, '12 dk', true),
  (10, 'e-lisans', 'Modül 2 · Lisans ve yenileme yönetimi', 'Bitiş takibi, yenileme siparişi, paket yükseltme.', 'Eğitim', 'pdf', 'Egitim-2-lisans.pdf', null, 900000, '2026-09-15', true, '8 dk', true),
  (11, 'e-teshis', 'Modül 3 · Arıza teşhisi ve RMA', 'Sık arızalar, sahada kontrol listesi, RMA açma ve cihaz gönderimi.', 'Eğitim', 'pdf', 'Egitim-3-teshis.pdf', null, 2000000, '2026-10-01', true, '20 dk', true),
  (12, 'e-satis', 'Modül 4 · Satış sunumu ve demo', 'Atölyede 15 dakikalık demo akışı ve sık itirazlara cevaplar.', 'Eğitim', 'pdf', 'Egitim-4-satis.pdf', null, 1100000, '2026-10-20', true, '15 dk', true),
  (13, 'd-kosullar', 'Bayilik genel koşulları', 'Sipariş, ödeme, iade ve garanti koşulları (sözleşme eki 1).', 'Sözleşme ekleri', 'pdf', 'Bayilik-genel-kosullari.pdf', null, 640000, '2026-09-14', true, null, true),
  (14, 'd-marka', 'Marka kullanım kılavuzu', 'Logo, renk, yazı tipi ve ''Yetkili Embedra bayisi'' rozeti kullanımı (sözleşme eki 2).', 'Sözleşme ekleri', 'pdf', 'Marka-kullanim-kilavuzu.pdf', null, 3800000, '2026-09-14', true, null, true);

insert into public.bayi_duyurulari (id, bdu_baslik, bdu_metin, bdu_onem, bdu_tarih, bdu_hepsine) values
  (1, 'Firmware v2.4.1 yayında', 'K-Line bağlantı kopması düzeltildi ve 38 yeni araç modeli kapsama eklendi. Müşterilerinize cihazlarını ONESuite üzerinden güncellemelerini hatırlatın.', 'onemli', '2026-11-11 09:30', true),
  (2, 'Q1 2027 fiyat listesi 1 Ocak''ta güncelleniyor', 'Cihaz fiyatlarında %4 artış planlanıyor; lisans fiyatları değişmiyor. 31 Aralık''a kadar verilen siparişler mevcut fiyatlardan işlenir.', 'onemli', '2026-11-05 14:00', true),
  (3, 'Automechanika Bükreş stand desteği', 'Mart 2027 fuarı için Romanya bayimize stand malzemesi ve demo cihaz desteği verilecek. Detaylar için temsilcinizle görüşün.', 'normal', '2026-10-28 11:00', false);

insert into public.bayi_duyuru_hedefleri (duyuru_id, bayi_id) values
  (3, 6);

insert into public.bayi_duyuru_okumalari (duyuru_id, bayi_id) values
  (2, 8);

insert into public.bayi_egitim_tamamlamalari (dokuman_id, bayi_id) values
  (9, 6),
  (10, 6);

do $$
declare t record;
begin
  for t in
    select c.table_name, c.column_name from information_schema.columns c
    where c.table_schema = 'public' and c.is_identity = 'YES'
  loop
    execute format(
      'select setval(pg_get_serial_sequence(%L, %L), greatest(coalesce((select max(%I) from public.%I), 0), 1))',
      'public.' || t.table_name, t.column_name, t.column_name, t.table_name);
  end loop;
end $$;
-- bayiler, bayi_basvurulari dizisini paylaşır
select setval(pg_get_serial_sequence('public.bayi_basvurulari', 'id'), (select greatest(max(id), 1) from public.bayiler));
