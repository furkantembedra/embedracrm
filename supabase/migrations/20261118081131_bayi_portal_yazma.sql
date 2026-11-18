-- Embedra CRM · bayi portalının yazma yetkileri (RLS)
--
-- 20261118074523_rls_ve_auth.sql bayiye yalnızca kendi satırlarını OKUMA verir (lead / duyuru okuma / eğitim tabloları hariç).
-- Bu dosya portal işlemlerinin bayi oturumuyla yaptığı insert / update / delete'ler için gereken en dar policy'leri ekler.
-- Kodda karşılığı olan işlemler:
--   • Sipariş ver / lisans siparişi (portalSiparisVer, bayiLisansSiparisiAc) → siparisler, siparis_kalemleri, siparis_notlari, siparis_lisans_atamalari
--   • Sipariş iptali (portalSiparisIptal → siparisiIptalEt)                  → siparisler (odeme → iptal), siparis_notlari
--   • Satış bildir (portalTopluSatis → satisBildir)                          → cihazlar (insert / update), bayi_hareketleri (+ kalemleri), musteri_olaylari
--   • Havuzdan lisans (havuzdanDus, bayiCihazinaLisansIsle)                  → bayi_lisans_havuzu (adet düşer), cihazlar, lisanslar, bayi_hareketleri, bayi_yenileme_talepleri (delete)
--   • Yenileme / düzeltme talebi                                             → bayi_yenileme_talepleri, bayi_duzeltme_talepleri
--   • Destek talebi + bayi mesajı (portalDestekAc / portalDestekMesaj)      → destek_talepleri (insert, durum yeniden açılır), talep_notlari
--   • RMA aç / ücret onayı / kargo / not / ek (portal/rma-actions.ts)        → rma_kayitlari, rma_gecmisi, rma_ekleri, storage rma-ekleri, musteri_olaylari
--   • Temsilciye / destek ekibine hatırlatma bırakma (bildir)               → hatirlatmalar (yalnızca insert; bayi okuyamaz → returning KULLANILMAMALI)
--   • Son giriş                                                              → bayi_kullanicilari (mevcut kendi_hesabi_guncelle + bayi_hesabi_koru yeterli)
--   • Lead / duyuru okuma / eğitim                                           → mevcut "bayi_yonetir" policy'leri yeterli
-- Yeni müşteri kartı (satış bildiriminde "yeni müşteri") bayi oturumuyla yazılmaz: insert…returning bayi müşteriyi henüz
-- göremediği için hata verir; satisBildir bu tek kaydı sistemOlarak ile açar. Bu yüzden musteri tablosuna bayi insert'i yok.
--
-- Satır policy'leri sütun kısıtlamaz; bayinin bir satırda yalnızca portalın değiştirdiği sütunlara dokunabilmesi
-- private.bayi_alanlari_koru tetikleyicisiyle sağlanır (CRM ekibi ve service role etkilenmez).

-- ─────────────────────────────────────────────────────────────
-- 1. Yardımcılar
-- ─────────────────────────────────────────────────────────────

-- Seri numarası oturumdaki bayinin cihazı mı? (stokta ya da bayinin sattığı müşteride)
create or replace function private.bayinin_cihazi(p_seri text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cihazlar c
    where c.c_serino = p_seri and c.bayi_id = (select private.bayi_id())
  );
$$;

-- RMA bu bayinin mi? Bayi sahibi ya da cihaz bayinin (bayinin sattığı cihaz için açılan RMA'da sahip müşteridir, bayi_id boş kalır).
-- p_rma: rma_kayitlari.id metin olarak (Storage yolunun ilk klasörü de bu id'dir)
create or replace function private.bayinin_rmasi(p_rma text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rma_kayitlari r
    where r.id::text = p_rma
      and (r.bayi_id = (select private.bayi_id())
           or exists (select 1 from public.cihazlar c where c.c_serino = r.r_seri_no and c.bayi_id = (select private.bayi_id())))
  );
$$;

revoke all on function private.bayinin_cihazi(text) from public;
revoke all on function private.bayinin_rmasi(text) from public;
grant execute on function private.bayinin_cihazi(text) to authenticated;
grant execute on function private.bayinin_rmasi(text) to authenticated;

-- Bayi bir satırda yalnızca tetikleyici argümanlarında sayılan sütunları değiştirebilir
create or replace function private.bayi_alanlari_koru()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or private.crm_kullanicisi() then
    return new;   -- service role / CRM ekibi
  end if;
  if (to_jsonb(new) - tg_argv) is distinct from (to_jsonb(old) - tg_argv) then
    raise exception 'Bu alanı yalnızca Embedra ekibi değiştirebilir (%)', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.bayi_alanlari_koru() from public;

-- Lisans havuzu: bayi adedi yalnızca düşürebilir (havuza lisans girişi CRM'den, ödenmiş siparişle)
create or replace function private.bayi_havuz_koru()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or private.crm_kullanicisi() then
    return new;
  end if;
  if new.blh_adet > old.blh_adet then
    raise exception 'Lisans havuzuna yalnızca Embedra ekibi lisans ekleyebilir' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.bayi_havuz_koru() from public;

-- ─────────────────────────────────────────────────────────────
-- 2. Okuma genişletmesi: bayinin sattığı cihazların RMA'ları
-- ─────────────────────────────────────────────────────────────
-- Portal (Arıza / RMA, Cihazlarım) bayinin müşterisindeki cihazın RMA'larını da gösterir; bu kayıtlarda bayi_id boştur.
create policy bayi_cihaz_rmasi_okur on public.rma_kayitlari for select to authenticated
  using ((select private.bayinin_cihazi(r_seri_no)));
create policy bayi_cihaz_rmasi_okur on public.rma_gecmisi for select to authenticated
  using ((select private.bayinin_rmasi(rma_id::text)));
create policy bayi_cihaz_rmasi_okur on public.rma_ekleri for select to authenticated
  using ((select private.bayinin_rmasi(rma_id::text)));
create policy bayi_cihaz_rma_eki on storage.objects for select to authenticated
  using (bucket_id = 'rma-ekleri' and (select private.bayinin_rmasi((storage.foldername(name))[1])));

-- ─────────────────────────────────────────────────────────────
-- 3. Siparişler
-- ─────────────────────────────────────────────────────────────
-- Yeni sipariş yalnızca "ödeme bekleniyor" durumunda, kendi adına, seri no / teklif / iptal bilgisi olmadan
create policy bayi_ekler on public.siparisler for insert to authenticated
  with check (bayi_id = (select private.bayi_id()) and sp_durum = 'odeme' and musteri_id is null and teklif_id is null
              and sp_seri_nolar = '{}' and sp_iptal_tarihi is null and sp_fatura_no is null);
-- İptal: yalnızca ödemesi alınmamış sipariş, yalnızca "bayi iptal etti" olarak
create policy bayi_iptal_eder on public.siparisler for update to authenticated
  using (bayi_id = (select private.bayi_id()) and sp_durum = 'odeme')
  with check (bayi_id = (select private.bayi_id()) and sp_durum = 'iptal' and sp_iptal_kim = 'bayi');
create trigger bayi_alanlari_koru before update on public.siparisler
  for each row execute function private.bayi_alanlari_koru('sp_durum', 'sp_iptal_tarihi', 'sp_iptal_neden', 'sp_iptal_kim', 'sp_iptal_odeme_iadesi');

create policy bayi_ekler on public.siparis_kalemleri for insert to authenticated
  with check (exists (select 1 from public.siparisler s where s.id = siparis_id and s.bayi_id = (select private.bayi_id()) and s.sp_durum = 'odeme'));
create policy bayi_ekler on public.siparis_lisans_atamalari for insert to authenticated
  with check (exists (select 1 from public.siparisler s where s.id = siparis_id and s.bayi_id = (select private.bayi_id()) and s.sp_durum = 'odeme'));
-- Not: siparişi verirken ve iptal ederken (iptalde sipariş önce "iptal" olur, not sonra yazılır)
create policy bayi_ekler on public.siparis_notlari for insert to authenticated
  with check (exists (select 1 from public.siparisler s where s.id = siparis_id and s.bayi_id = (select private.bayi_id()) and s.sp_durum in ('odeme', 'iptal')));

-- ─────────────────────────────────────────────────────────────
-- 4. Cihazlar ve lisanslar
-- ─────────────────────────────────────────────────────────────
-- Seri numarası girilmeden sevk edilmiş stok satılırken cihaz kaydı açılır (lisans süresi olmadan)
create policy bayi_ekler on public.cihazlar for insert to authenticated
  with check (bayi_id = (select private.bayi_id()) and c_lisans_bat is null and c_lisans_bit is null);
-- Satış (cihaz müşteriye geçer) ve havuzdan lisans işleme
create policy bayi_gunceller on public.cihazlar for update to authenticated
  using (bayi_id = (select private.bayi_id()))
  with check (bayi_id = (select private.bayi_id()));
create trigger bayi_alanlari_koru before update on public.cihazlar
  for each row execute function private.bayi_alanlari_koru('musteri_id', 'c_sahip_adi', 'c_ulke', 'plan_id', 'c_lisans_bat', 'c_lisans_bit', 'c_durum');

create policy bayi_ekler on public.lisanslar for insert to authenticated
  with check (exists (select 1 from public.cihazlar c where c.id = cihaz_id and c.bayi_id = (select private.bayi_id())));

-- ─────────────────────────────────────────────────────────────
-- 5. Bayi hareketleri, lisans havuzu, portal talepleri
-- ─────────────────────────────────────────────────────────────
-- Portal yalnızca satış ve lisans hareketi yazar (sevkiyat / iade / değişim CRM'den)
create policy bayi_ekler on public.bayi_hareketleri for insert to authenticated
  with check (bayi_id = (select private.bayi_id()) and bh_tur in ('satis', 'lisans'));
create policy bayi_ekler on public.bayi_hareket_kalemleri for insert to authenticated
  with check (exists (select 1 from public.bayi_hareketleri h
                      where h.id = hareket_id and h.bayi_id = (select private.bayi_id()) and h.bh_tur in ('satis', 'lisans')));

create policy bayi_gunceller on public.bayi_lisans_havuzu for update to authenticated
  using (bayi_id = (select private.bayi_id()))
  with check (bayi_id = (select private.bayi_id()));
create trigger bayi_alanlari_koru before update on public.bayi_lisans_havuzu
  for each row execute function private.bayi_alanlari_koru('blh_adet');
create trigger bayi_havuz_koru before update on public.bayi_lisans_havuzu
  for each row execute function private.bayi_havuz_koru();

create policy bayi_ekler on public.bayi_yenileme_talepleri for insert to authenticated
  with check (bayi_id = (select private.bayi_id()));
-- Lisans havuzdan işlenince talep kalkar
create policy bayi_siler on public.bayi_yenileme_talepleri for delete to authenticated
  using (bayi_id = (select private.bayi_id()));

create policy bayi_ekler on public.bayi_duzeltme_talepleri for insert to authenticated
  with check (bayi_id = (select private.bayi_id()) and bdt_durum = 'acik' and bdt_cozum is null);

-- ─────────────────────────────────────────────────────────────
-- 6. Destek talepleri
-- ─────────────────────────────────────────────────────────────
create policy bayi_ekler on public.destek_talepleri for insert to authenticated
  with check (bayi_id = (select private.bayi_id()) and t_kanal = 'Bayi portalı' and t_durum = 'yeni' and musteri_id is null
              and (cihaz_id is null or exists (select 1 from public.cihazlar c where c.id = cihaz_id and c.bayi_id = (select private.bayi_id()))));
-- Bayinin mesajı çözülmüş / beklemedeki talebi yeniden "işlemde"ye alır; bayi talebi kapatamaz / bekletemez
create policy bayi_gunceller on public.destek_talepleri for update to authenticated
  using (bayi_id = (select private.bayi_id()))
  with check (bayi_id = (select private.bayi_id()) and t_durum in ('yeni', 'islemde'));
create trigger bayi_alanlari_koru before update on public.destek_talepleri
  for each row execute function private.bayi_alanlari_koru('t_durum');
-- Açılış, bayi mesajı ve "yeniden açıldı" kaydı; iç not türleri yazılamaz
create policy bayi_ekler on public.talep_notlari for insert to authenticated
  with check (n_tur in ('acilis', 'bayi', 'yeniden')
              and exists (select 1 from public.destek_talepleri t where t.id = talep_id and t.bayi_id = (select private.bayi_id())));

-- ─────────────────────────────────────────────────────────────
-- 7. RMA
-- ─────────────────────────────────────────────────────────────
-- Portaldan açılan talep: kendi stoğundaki (sahip bayi) ya da sattığı (sahip müşteri) cihaz için, ilk adımda, karar / ücret olmadan
create policy bayi_ekler on public.rma_kayitlari for insert to authenticated
  with check (r_kaynak = 'bayi-portali' and r_adim = 'talep' and r_karar is null and r_ucret is null and r_yeni_seri is null
              and not r_ucret_onay and not r_ucret_odendi
              and (select private.bayinin_cihazi(r_seri_no))
              and ((r_sahip_tur = 'bayi' and bayi_id = (select private.bayi_id())) or (r_sahip_tur = 'musteri' and bayi_id is null)));
-- Ücret onayı ve servise gönderim bilgisi (diğer sütunlar tetikleyiciyle kilitli)
create policy bayi_gunceller on public.rma_kayitlari for update to authenticated
  using ((select private.bayinin_rmasi(id::text)))
  with check ((select private.bayinin_rmasi(id::text)));
create trigger bayi_alanlari_koru before update on public.rma_kayitlari
  for each row execute function private.bayi_alanlari_koru('r_ucret_onay', 'r_gelis_kanal', 'r_gelis_takip');
-- Açılış kaydı (sistem) ve bayi notları (gorusme, yazan = bayi adı); iç teknik not ("not") yazamaz
create policy bayi_ekler on public.rma_gecmisi for insert to authenticated
  with check (coalesce(rg_tur, 'sistem') in ('sistem', 'gorusme') and (select private.bayinin_rmasi(rma_id::text)));
create policy bayi_ekler on public.rma_ekleri for insert to authenticated
  with check ((select private.bayinin_rmasi(rma_id::text)));
-- Ek dosyası: mevcut bayi_rma_eki_yukler yalnızca bayi_id'li RMA'yı kapsıyor; satılan cihazın RMA'sı için de
create policy bayi_cihaz_rma_eki_yukler on storage.objects for insert to authenticated
  with check (bucket_id = 'rma-ekleri' and (select private.bayinin_rmasi((storage.foldername(name))[1])));

-- ─────────────────────────────────────────────────────────────
-- 8. Müşteri zaman çizelgesi ve hatırlatmalar
-- ─────────────────────────────────────────────────────────────
-- Satış / RMA olayı yalnızca bayinin görebildiği (cihazı ya da hareketiyle bağlı) müşteriye; bayi olayları okuyamaz
create policy bayi_ekler on public.musteri_olaylari for insert to authenticated
  with check (o_tur in ('siparis', 'destek') and exists (select 1 from public.musteri m where m.id = musteri_id));

-- Portal işlemleri Embedra ekibine hatırlatma bırakır. Bayi hatırlatmaları OKUYAMAZ: insert'te returning kullanılmamalı.
create policy bayi_ekler on public.hatirlatmalar for insert to authenticated
  with check ((select private.bayi_id()) is not null and h_durum = 'bekliyor' and h_tamamlanma is null
              and h_kayit_tur in ('siparis', 'bayi', 'rma', 'cihaz', 'destek', 'firsat'));

-- ─────────────────────────────────────────────────────────────
-- 9. Belge numaraları: bayi yalnızca kendi kayıtlarını gördüğü için sıradaki numara tüm tablodan hesaplanır
-- ─────────────────────────────────────────────────────────────
create or replace function public.sonraki_belge_no(p_tur text)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare n integer;
begin
  if not (private.crm_kullanicisi() or private.bayi_id() is not null) then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_tur = 'siparis' then
    select coalesce(max(split_part(sp_no, '-', 3)::int), 0) + 1 into n from public.siparisler where sp_no ~ '^S-\d+-\d+$';
    return 'S-26-' || n;
  elsif p_tur = 'rma' then
    select coalesce(max(substr(r_no, 5)::int), 0) + 1 into n from public.rma_kayitlari where r_no ~ '^RMA-\d+$';
    return 'RMA-' || lpad(n::text, 4, '0');
  elsif p_tur = 'iade' then
    select coalesce(max(substr(ia_no, 3)::int), 0) + 1 into n from public.iadeler where ia_no ~ '^R-\d+$';
    return 'R-' || lpad(n::text, 4, '0');
  end if;
  raise exception 'Bilinmeyen belge türü: %', p_tur;
end;
$$;
revoke all on function public.sonraki_belge_no(text) from public, anon;
grant execute on function public.sonraki_belge_no(text) to authenticated;

-- Bayi teklif numarası bayinin kendi sırasıdır (aynı baş harfli iki bayi aynı numarayı üretebilir): lead bazında tekil
alter table public.bayi_lead_teklifleri drop constraint bayi_lead_teklifleri_blt_no_key;
alter table public.bayi_lead_teklifleri add constraint bayi_lead_teklifleri_lead_no_key unique (lead_id, blt_no);
