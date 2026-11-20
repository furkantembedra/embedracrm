-- P2.2 Botun araçları ve lead kartı.
--  1) satis_hatti.lead_karti: botun konuşmada topladığı bilgiler (firma, yetkili, şehir / ülke, kullanım alanı, cihaz
--     adedi, ekranlı / ekransız tercihi, lisans ihtiyacı, mevcut lisans, aciliyet, bütçe notu, telefon, e-posta), lead
--     skoru, plan önerisi, demo talebi, bölgedeki münhasır bayi uyarısı ve henüz müşteri yetkilisine yazılamamış
--     pazarlama izinleri. Alanların tipi components/bot/lead-karti.ts › LeadKarti; doğrulamayı uygulama yapar, burada
--     yalnızca nesne ve boyut kısıtı var.
--  2) lead_karti_birlestir(): kartı tek ifadede birleştirir (jsonb ||, üst düzey anahtarlar), yarışta alan kaybolmaz.
--  3) munhasir_bayi(): ülkede sözleşmesi süren, sözleşme bölgesi münhasır işaretli aktif bayiler (bayiler +
--     bayi_basvurulari.s_sozlesme.bolge.munhasir). Bayi bölgesi kuralı: satışçı karar verir; bot kendiliğinden bayiye
--     yönlendirmez, fırsat kartında uyarı çıkar.
--  4) Yetkiliyi e-postayla eşleştirmek için ifade indeksi (lower(y_eposta)).
--  5) firsat_notlari.tur 'bot': botun araçlarının fırsata düştüğü bilgi notları (demo talebi, münhasır bayi).

-- 1) Lead kartı
alter table public.satis_hatti
  add column lead_karti jsonb not null default '{}'::jsonb
    constraint satis_hatti_lead_karti_nesne check (jsonb_typeof(lead_karti) = 'object' and pg_column_size(lead_karti) <= 16384);
comment on column public.satis_hatti.lead_karti is
  'Botun topladığı lead bilgileri (P2.2; şema components/bot/lead-karti.ts). Satış hattı kartında ve botun her turunda görünür';

-- 2) Atomik birleştirme (üst düzey anahtarlar; null değerli anahtar silinir)
create or replace function public.lead_karti_birlestir(p_firsat_id bigint, p_yama jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  update public.satis_hatti
     set lead_karti = jsonb_strip_nulls(lead_karti || coalesce(p_yama, '{}'::jsonb))
   where id = p_firsat_id and jsonb_typeof(coalesce(p_yama, '{}'::jsonb)) = 'object'
  returning lead_karti;
$$;
comment on function public.lead_karti_birlestir(bigint, jsonb) is
  'Fırsatın lead kartına yamayı üst düzey anahtarlarla birleştirir (null değer anahtarı siler); yeni kartı döner';
revoke all on function public.lead_karti_birlestir(bigint, jsonb) from public, anon;
grant execute on function public.lead_karti_birlestir(bigint, jsonb) to authenticated, service_role;

-- 3) Ülkedeki münhasır bayi(ler)
create or replace function public.munhasir_bayi(p_ulke_kodu text)
returns table (bayi_id bigint, ad text, kapsam text)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.by_ad, nullif(trim(s.s_sozlesme -> 'bolge' ->> 'kapsam'), '')
    from public.bayiler b
    join public.bayi_basvurulari s on s.id = b.basvuru_id
   where b.by_ulke_kodu = upper(p_ulke_kodu)
     and (s.s_sozlesme -> 'bolge' ->> 'munhasir') = 'true'
     -- Sözleşme süresi bitmişse münhasırlık da biter; süre girilmemişse süresiz sayılır
     and (b.by_sozlesme_bat is null or b.by_sozlesme_sure_ay is null
          or (b.by_sozlesme_bat + make_interval(months => b.by_sozlesme_sure_ay))::date >= current_date)
   order by b.id;
$$;
comment on function public.munhasir_bayi(text) is
  'Ülkede (ISO-2) sözleşmesi süren ve sözleşme bölgesi münhasır işaretli aktif bayiler (P2.2 bayi bölgesi uyarısı)';
revoke all on function public.munhasir_bayi(text) from public, anon;
grant execute on function public.munhasir_bayi(text) to authenticated, service_role;

-- 4) Telefon / e-postayla yetkili eşleşmesi (fırsat mevcut müşteriye bağlanır, yeni müşteri açılmaz)
create index musteri_yetkilileri_eposta_idx on public.musteri_yetkilileri (lower(y_eposta)) where y_eposta <> '';

create or replace function public.yetkili_eslestir(p_telefon text, p_eposta text)
returns table (yetkili_id bigint, musteri_id bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select y.id, y.musteri_id
    from public.musteri_yetkilileri y
   -- p_telefon uygulamada normalize edilmiş gelir (telefonNormalize = private.telefon_normal, test/telefon.test.ts);
   -- private şemasına service_role'ün erişimi yok, bu yüzden burada çağrılmaz
   where (nullif(p_telefon, '') is not null and y.y_tel_normal = p_telefon)
      or (nullif(p_eposta, '') is not null and y.y_eposta <> '' and lower(y.y_eposta) = lower(trim(p_eposta)))
   order by y.musteri_id, y.y_sira, y.id
   limit 20;
$$;
comment on function public.yetkili_eslestir(text, text) is
  'Normalize telefonu (+905321234567) ya da e-postası (büyük/küçük harf duyarsız) eşleşen müşteri yetkilileri (P2.2 ihtiyac_kaydet)';
revoke all on function public.yetkili_eslestir(text, text) from public, anon;
grant execute on function public.yetkili_eslestir(text, text) to authenticated, service_role;

-- 5) Botun bilgi notları
alter table public.firsat_notlari drop constraint firsat_notlari_tur_check;
alter table public.firsat_notlari add constraint firsat_notlari_tur_check check (tur in ('not', 'bot_devretti', 'bot'));
