-- P2.4b Bilgi kaynağı yükleme (Bot › Ayarlar › Bilgi kaynakları).
--  1) bot_bilgi_kaynaklari: Yönetici'nin yüklediği PDF / ekran görüntüsü / Excel / CSV / elle metin kaynakları. Her kaynak
--     ayrı kayıt: başlık, hedef alan (bilgi bankası / itirazlar / örnek konuşmalar), metne çevrilmiş ve kişisel verisi
--     maskelenmiş TASLAK metin, işaretli satırlar (kişisel / fiyat / talimat şüphesi), çıkarım maliyeti ve durum
--     (taslak → onayli | reddedildi; onayli ↔ devre_disi). Taslak hiçbir zaman bota gitmez: bot yalnızca
--     bot_istem_surumleri.bilgi_kaynaklari'ndaki (onaylanınca açılan sürümdeki) kopyayı okur.
--     Ham dosya yalnızca metne çevrilene kadar Storage'da durur (dosya_yolu); sonra silinir ve dosya_yolu null olur
--     (KVKK): kalıcı olan yalnızca dosya adı, tür, boyut, yükleyen ve tarihtir.
--  2) Storage: özel "bot-bilgi-kaynaklari" bucket'ı (4 MB, yalnızca PDF / PNG / JPEG / CSV / XLSX); yalnızca Yönetici.
--     Boyut ve tür uygulamada da (sihirli baytlarla) denetlenir.
--  3) bot_bilgi_kaynagi_durumu: onay / reddetme / devre dışı bırakma / yeniden etkinleştirme. Onay ve devre dışı bırakma,
--     AKTİF sürümün kopyası olan yeni bir ayar sürümü açar; yalnızca bilgi_kaynaklari dizisinde bu kaynak eklenir,
--     güncellenir ya da çıkarılır (önceki sürüme dönüş P2.4'teki gibi çalışır). Toplam metin sınırı (40.000; docs
--     kaynakları ve ayar metinleriyle birlikte) uygulamada denetlenir; burada yalnızca kaba üst sınır var.

-- 1) Kaynaklar
create table public.bot_bilgi_kaynaklari (
  id                   bigint generated always as identity primary key,
  baslik               text not null check (length(btrim(baslik)) between 1 and 200),
  hedef                text not null check (hedef in ('bilgi_bankasi', 'itirazlar', 'ornek_konusmalar')),
  girdi_turu           text not null check (girdi_turu in ('pdf', 'gorsel', 'xlsx', 'csv', 'metin')),
  dosya_adi            text check (length(dosya_adi) <= 255),
  dosya_turu           text check (length(dosya_turu) <= 100),
  dosya_boyutu         integer check (dosya_boyutu >= 0),
  -- Geçici: ham dosyanın Storage nesne adı; metin çıkarılınca null
  dosya_yolu           text unique check (length(dosya_yolu) <= 200),
  taslak_metin         text not null default '' check (length(taslak_metin) <= 60000),
  -- [{"satir": 3, "tur": "kisisel" | "fiyat" | "talimat", "not": "..."}]; metin içermez
  isaretler            jsonb not null default '[]'::jsonb check (jsonb_typeof(isaretler) = 'array'),
  maskelenen           integer not null default 0 check (maskelenen >= 0),
  cikarim_maliyet_usd  numeric(12, 6) not null default 0 check (cikarim_maliyet_usd >= 0),
  durum                text not null default 'taslak' check (durum in ('taslak', 'onayli', 'reddedildi', 'devre_disi')),
  yukleyen_id          bigint references public.kullanicilar (id) on delete set null,
  onaylayan_id         bigint references public.kullanicilar (id) on delete set null,
  onay_zamani          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.bot_bilgi_kaynaklari is
  'Bot › Ayarlar: yüklenen bilgi kaynakları (taslak / onaylı / reddedildi / devre dışı). Onaylanan metin bot_istem_surumleri.bilgi_kaynaklari''na yeni sürümle girer; ham dosya metin çıkarılınca silinir';
comment on column public.bot_bilgi_kaynaklari.dosya_yolu is 'Ham dosyanın geçici Storage nesne adı (bot-bilgi-kaynaklari); metin çıkarılınca dosya silinir ve bu alan null olur';
create index bot_bilgi_kaynaklari_yukleyen_id_idx on public.bot_bilgi_kaynaklari (yukleyen_id) where yukleyen_id is not null;
create index bot_bilgi_kaynaklari_onaylayan_id_idx on public.bot_bilgi_kaynaklari (onaylayan_id) where onaylayan_id is not null;
-- Yetim dosya temizliği: hâlâ dosyası olan eski kayıtlar
create index bot_bilgi_kaynaklari_dosya_idx on public.bot_bilgi_kaynaklari (created_at) where dosya_yolu is not null;

revoke all on public.bot_bilgi_kaynaklari from anon;
alter table public.bot_bilgi_kaynaklari enable row level security;
-- Okuma CRM ekibi (Bot menüsünde Satış / Pazarlama salt okunur görür); ekleme ve değiştirme yalnızca Yönetici.
-- Silme politikası yok: kayıt (dosya adı, tür, yükleyen, tarih) kalır.
create policy crm_okur on public.bot_bilgi_kaynaklari for select to authenticated using ((select private.crm_kullanicisi()));
create policy yonetici_ekler on public.bot_bilgi_kaynaklari for insert to authenticated with check ((select private.yonetici_mi()));
create policy yonetici_gunceller on public.bot_bilgi_kaynaklari for update to authenticated
  using ((select private.yonetici_mi())) with check ((select private.yonetici_mi()));

-- 2) Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('bot-bilgi-kaynaklari', 'bot-bilgi-kaynaklari', false, 4194304,
   array['application/pdf', 'image/png', 'image/jpeg', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy bot_bilgi_kaynagi_yonetici on storage.objects for all to authenticated
  using (bucket_id = 'bot-bilgi-kaynaklari' and (select private.yonetici_mi()))
  with check (bucket_id = 'bot-bilgi-kaynaklari' and (select private.yonetici_mi()));

-- 3) Onay / ret / devre dışı / yeniden etkinleştirme.
--    p_durum: onayli (taslak ya da devre_disi kaynaktan), reddedildi (taslaktan), devre_disi (onaylıdan).
--    Onayda p_baslik / p_metin verilirse taslak bunlarla güncellenir (Yönetici düzenledi). Dönüş: açılan sürüm no
--    (ret ya da etkin kaynak dizisi değişmediyse null). security invoker: RLS (yalnızca Yönetici) uygulanır.
create function public.bot_bilgi_kaynagi_durumu(
  p_kaynak_id bigint, p_durum text, p_baslik text, p_metin text, p_kullanici_id bigint
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_k public.bot_bilgi_kaynaklari;
  v_eski public.bot_istem_surumleri;
  v_eski_dizi jsonb;
  v_dizi jsonb;
  v_no integer;
  v_id bigint;
begin
  -- Sürüm sırası kilidi (P2.4 ile aynı); Yönetici değilse satır görünmez → yetki hatası
  perform 1 from public.bot_ayarlari b where b.id = 1 for update;
  if not found then
    raise exception 'Bot ayarlarını değiştirme yetkiniz yok' using errcode = '42501';
  end if;
  select * into v_k from public.bot_bilgi_kaynaklari k where k.id = p_kaynak_id for update;
  if not found then
    raise exception 'Kaynak bulunamadı' using errcode = '22023';
  end if;

  if p_durum = 'onayli' then
    if v_k.durum not in ('taslak', 'devre_disi') then
      raise exception 'Bu kaynak onaylanamaz (durum: %)', v_k.durum using errcode = '22023';
    end if;
    if v_k.dosya_yolu is not null then
      raise exception 'Kaynak henüz metne çevrilmedi' using errcode = '22023';
    end if;
    update public.bot_bilgi_kaynaklari k set
      baslik = coalesce(nullif(btrim(p_baslik), ''), k.baslik),
      taslak_metin = coalesce(p_metin, k.taslak_metin),
      durum = 'onayli', onaylayan_id = p_kullanici_id, onay_zamani = now(), updated_at = now()
    where k.id = p_kaynak_id
    returning * into v_k;
    if length(btrim(v_k.taslak_metin)) = 0 then
      raise exception 'Boş kaynak onaylanamaz' using errcode = '22023';
    end if;
  elsif p_durum = 'reddedildi' then
    if v_k.durum <> 'taslak' then
      raise exception 'Yalnızca taslak reddedilebilir' using errcode = '22023';
    end if;
    update public.bot_bilgi_kaynaklari k set durum = 'reddedildi', updated_at = now() where k.id = p_kaynak_id;
    return null;
  elsif p_durum = 'devre_disi' then
    if v_k.durum <> 'onayli' then
      raise exception 'Yalnızca onaylı kaynak devre dışı bırakılabilir' using errcode = '22023';
    end if;
    update public.bot_bilgi_kaynaklari k set durum = 'devre_disi', updated_at = now() where k.id = p_kaynak_id;
  else
    raise exception 'Geçersiz durum' using errcode = '22023';
  end if;

  -- Aktif sürümün kaynak dizisinden: bu kaynak çıkarılır, onaylandıysa (güncel metniyle) sona eklenir
  select s.* into v_eski from public.bot_ayarlari b join public.bot_istem_surumleri s on s.id = b.aktif_surum_id where b.id = 1;
  v_eski_dizi := coalesce(v_eski.bilgi_kaynaklari, '[]'::jsonb);
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_dizi
  from jsonb_array_elements(v_eski_dizi) with ordinality as x(e, o)
  where (e ->> 'id')::bigint is distinct from p_kaynak_id;
  if p_durum = 'onayli' then
    v_dizi := v_dizi || jsonb_build_array(jsonb_build_object('id', v_k.id, 'baslik', v_k.baslik, 'hedef', v_k.hedef, 'metin', v_k.taslak_metin));
  end if;
  if v_dizi = v_eski_dizi then
    return null;
  end if;
  -- Kaba üst sınır (asıl sınır uygulamada, docs kaynakları ve ayar metinleriyle birlikte 40.000)
  if (select coalesce(sum(length(e ->> 'metin')), 0) from jsonb_array_elements(v_dizi) e) > 40000 then
    raise exception 'Bilgi kaynakları toplam sınırı aşıyor' using errcode = '22023';
  end if;

  select coalesce(max(s.surum_no), 0) + 1 into v_no from public.bot_istem_surumleri s;
  insert into public.bot_istem_surumleri (surum_no, bot_adi, acilis_mesaji, ton_notu, bilgi_bankasi, itirazlar,
    ornek_konusmalar, mesai_saatleri, mesai_disi_notu, bilgi_kaynaklari, aciklama, olusturan_id)
  values (v_no, coalesce(v_eski.bot_adi, ''), coalesce(v_eski.acilis_mesaji, ''), coalesce(v_eski.ton_notu, ''),
    coalesce(v_eski.bilgi_bankasi, ''), coalesce(v_eski.itirazlar, ''), coalesce(v_eski.ornek_konusmalar, ''),
    coalesce(v_eski.mesai_saatleri, '{}'::jsonb), coalesce(v_eski.mesai_disi_notu, ''), v_dizi,
    left(format('Bilgi kaynağı %s: %s', case when p_durum = 'onayli' then 'onaylandı' else 'devre dışı' end, v_k.baslik), 300),
    p_kullanici_id)
  returning bot_istem_surumleri.id into v_id;
  update public.bot_ayarlari b set aktif_surum_id = v_id, guncelleyen_id = p_kullanici_id, updated_at = now() where b.id = 1;
  return v_no;
end;
$$;
comment on function public.bot_bilgi_kaynagi_durumu is
  'Bilgi kaynağını onaylar / reddeder / devre dışı bırakır; onay ve devre dışı aktif sürümden yeni ayar sürümü açar. Yalnızca Yönetici';
revoke all on function public.bot_bilgi_kaynagi_durumu(bigint, text, text, text, bigint) from public, anon, authenticated, service_role;
grant execute on function public.bot_bilgi_kaynagi_durumu(bigint, text, text, text, bigint) to authenticated;
