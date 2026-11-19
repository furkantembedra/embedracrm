-- P1.0 Çok kanal ön hazırlığı: Messenger kanalı, hesap/sayfa kapsamlı konuşma kimliği, mesaj türleri ve ek bilgi.
-- Eski migration'lara dokunulmaz; bu dosya hem canlı veritabanını hem sıfırdan kurulumu aynı hâle getirir.

-- 1) Kanal listesine Messenger
alter table public.konusmalar drop constraint konusmalar_kanal_check;
alter table public.konusmalar add constraint konusmalar_kanal_check check (kanal in ('whatsapp', 'instagram', 'messenger'));

-- 2) Kanal hesabı: konuşmanın hangi numara / hesap / sayfa üzerinden yürüdüğü.
--    WhatsApp: phone_number_id, Instagram: Instagram profesyonel hesap kimliği, Messenger: Facebook sayfa kimliği.
--    Instagram (IGSID) ve Messenger (PSID) kullanıcı kimlikleri hesaba / sayfaya özgüdür; birden fazla hesap
--    bağlanınca aynı kimlik iki farklı kişiyi gösterebilir, bu yüzden tekillik hesabı da içerir.
--    Mevcut satırlar (hepsi WhatsApp) tek bir 'varsayilan' hesapla doldurulur; uygulama phone_number_id'yi bilmeden
--    gelen WhatsApp mesajlarını da (simülasyon, metadata'sız gövde) bu değerle yazar (docs/BOT_KURULUM.md).
--    Varsayılan yalnızca mevcut satırları doldurmak içindir, hemen kaldırılır: yeni satır hesabı açıkça vermeli.
alter table public.konusmalar add column kanal_hesap_id text not null default 'varsayilan'
  constraint konusmalar_kanal_hesap_id_check check (length(kanal_hesap_id) > 0);
alter table public.konusmalar alter column kanal_hesap_id drop default;
alter table public.konusmalar drop constraint konusmalar_kanal_kullanici_key;
alter table public.konusmalar add constraint konusmalar_kanal_hesap_kullanici_key unique (kanal, kanal_hesap_id, dis_kullanici_id);
comment on column public.konusmalar.kanal_hesap_id is
  'Konuşmanın yürüdüğü işletme hesabı: WhatsApp phone_number_id | Instagram hesap kimliği | Messenger sayfa kimliği ("varsayilan": phone_number_id bilinmeden yazılmış WhatsApp)';
comment on column public.konusmalar.dis_kullanici_id is
  'Müşterinin kanaldaki kimliği: WhatsApp normalize telefon (+90…), Instagram IGSID, Messenger PSID (son ikisi hesaba / sayfaya özgü)';
comment on table public.konusmalar is
  'Kanaldan bağımsız müşteri konuşması (WhatsApp, Instagram, Messenger); kanal + kanal hesabı + dış kullanıcı kimliği tekil';

-- 3) dis_mesaj_id tekilliği: KARAR global tekil kalır (kanal bazına indirilmez).
--    - Meta mesaj kimlikleri kendi başına benzersizdir ve kanallar arasında biçimleri farklıdır (WhatsApp "wamid.…",
--      Instagram / Messenger "m_…" / "aWdf…"); CRM'in ürettikleri "sim-<uuid>". Kanallar arası çakışma beklenmez.
--    - Global tekillik en sıkı tekrar korumasıdır: aynı olay iki adresten (/api/meta/webhook ve eski /api/whatsapp/webhook)
--      ya da kendi gönderdiğimiz mesajın echo'su olarak gelse de ikinci kez yazılmaz.
--    - Kanal bazında tekillik mesaj tablosuna kanal kopyası (ya da konuşmaya join) gerektirirdi; ek koruma getirmez.

-- 4) Mesaj ek bilgisi: reklam / yönlendirme (referral), hikâye yanıtı, yanıtlanan mesaj, ek dosya türü, kaynak türü.
--    Alanlar components/konusma/queries.ts › MesajEki'de belgelidir. Kişisel veri (telefon, ad, konum) ve token yazılmaz.
alter table public.konusma_mesajlari add column ek jsonb not null default '{}'::jsonb
  constraint konusma_mesajlari_ek_check check (jsonb_typeof(ek) = 'object');
comment on column public.konusma_mesajlari.ek is
  'Ek bilgi (components/konusma/queries.ts › MesajEki): yonlendirme, yanitlanan_mesaj_id, hikaye, ek_dosya_turu, kaynak_tur. Kişisel veri ve token yazılmaz';

-- 5) Mesaj türü: kanaldan bağımsız sabit liste.
--    metin, gorsel, ses, video, dosya, hikaye_yaniti, hikaye_bahsetme, paylasim, tepki, yorum, diger
--    Eski WhatsApp türleri taşınır; ortak listede karşılığı birebir olmayan türün aslı ek->>'kaynak_tur'da kalır
--    (ör. sticker → gorsel, location → diger).
update public.konusma_mesajlari set
  ek = case when tur in ('text', 'image', 'audio', 'video', 'document') then ek else ek || jsonb_build_object('kaynak_tur', tur) end,
  tur = case tur
    when 'text' then 'metin' when 'button' then 'metin' when 'interactive' then 'metin'
    when 'image' then 'gorsel' when 'sticker' then 'gorsel'
    when 'audio' then 'ses' when 'voice' then 'ses'
    when 'video' then 'video'
    when 'document' then 'dosya'
    when 'reaction' then 'tepki'
    else 'diger'
  end
where tur not in ('metin', 'gorsel', 'ses', 'video', 'dosya', 'hikaye_yaniti', 'hikaye_bahsetme', 'paylasim', 'tepki', 'yorum', 'diger');
alter table public.konusma_mesajlari alter column tur set default 'metin';
alter table public.konusma_mesajlari add constraint konusma_mesajlari_tur_check check (tur in (
  'metin', 'gorsel', 'ses', 'video', 'dosya', 'hikaye_yaniti', 'hikaye_bahsetme', 'paylasim', 'tepki', 'yorum', 'diger'));
comment on column public.konusma_mesajlari.tur is
  'metin | gorsel | ses | video | dosya | hikaye_yaniti | hikaye_bahsetme | paylasim | tepki | yorum | diger';

-- 6) Lead kaynağı "Messenger" (lib/constants.ts › LEAD_KAYNAKLARI ile aynı liste).
--    Boş (sıfırdan kurulan) veritabanında eklenmez: kaynak listesini orada supabase/seed.sql sabit kimliklerle yazar.
--    Kimlik açıkça en büyük + 1 verilir: veri aktarımı sabit kimliklerle yapıldığı için identity sayacı geride olabilir.
insert into public.kaynak (id, f_kaynak) overriding system value
select max(id) + 1, 'Messenger' from public.kaynak
having count(*) > 0 and not bool_or(f_kaynak = 'Messenger');
