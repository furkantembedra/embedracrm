-- Embedra CRM · şema (4/4): RLS, politikalar, storage bucket'ları ve politikaları
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy crm_tam_erisim on public.%I as permissive for all to authenticated using ((select private.crm_kullanicisi())) with check ((select private.crm_kullanicisi()))', t);
  end loop;
end $$;

create policy oturumlu_okur on public.asama for select to authenticated using (true);
create policy oturumlu_okur on public.kaynak for select to authenticated using (true);
create policy oturumlu_okur on public.lisans_planlari for select to authenticated using (true);
create policy kendi_kaydi on public.kullanicilar for select to authenticated using (auth_id = (select auth.uid()));
create policy bayi_temsilcisini_okur on public.kullanicilar for select to authenticated using (id = (select b.temsilci_id from public.bayiler b where b.id = (select private.bayi_id())));
create policy kendi_hesabi on public.bayi_kullanicilari for select to authenticated using (auth_id = (select auth.uid()));
create policy kendi_hesabi_guncelle on public.bayi_kullanicilari for update to authenticated using (auth_id = (select auth.uid())) with check (auth_id = (select auth.uid()));

create policy bayi_okur on public.ayarlar for select to authenticated using ((select private.bayi_id()) is not null);
create policy bayi_okur on public.bayi_basvurulari for select to authenticated using (id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_dokuman_hedefleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_dokumanlari for select to authenticated using (((select private.bayi_id()) is not null) and (bd_hepsine or exists (select 1 from public.bayi_dokuman_hedefleri h where h.dokuman_id = bayi_dokumanlari.id and h.bayi_id = (select private.bayi_id()))));
create policy bayi_okur on public.bayi_duyuru_hedefleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_yonetir on public.bayi_duyuru_okumalari for all to authenticated using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_duyurulari for select to authenticated using (((select private.bayi_id()) is not null) and (bdu_hepsine or exists (select 1 from public.bayi_duyuru_hedefleri h where h.duyuru_id = bayi_duyurulari.id and h.bayi_id = (select private.bayi_id()))));
create policy bayi_ekler on public.bayi_duzeltme_talepleri for insert to authenticated with check (bayi_id = (select private.bayi_id()) and bdt_durum = 'acik' and bdt_cozum is null);
create policy bayi_okur on public.bayi_duzeltme_talepleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_yonetir on public.bayi_egitim_tamamlamalari for all to authenticated using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_ekler on public.bayi_hareket_kalemleri for insert to authenticated with check (exists (select 1 from public.bayi_hareketleri h where h.id = bayi_hareket_kalemleri.hareket_id and h.bayi_id = (select private.bayi_id()) and h.bh_tur = any (array['satis', 'lisans'])));
create policy bayi_okur on public.bayi_hareket_kalemleri for select to authenticated using (exists (select 1 from public.bayi_hareketleri h where h.id = bayi_hareket_kalemleri.hareket_id and h.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.bayi_hareketleri for insert to authenticated with check (bayi_id = (select private.bayi_id()) and bh_tur = any (array['satis', 'lisans']));
create policy bayi_okur on public.bayi_hareketleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_yonetir on public.bayi_lead_notlari for all to authenticated
  using (exists (select 1 from public.bayi_leadleri l where l.id = bayi_lead_notlari.lead_id and l.bayi_id = (select private.bayi_id())))
  with check (exists (select 1 from public.bayi_leadleri l where l.id = bayi_lead_notlari.lead_id and l.bayi_id = (select private.bayi_id())));
create policy bayi_yonetir on public.bayi_lead_teklif_kalemleri for all to authenticated
  using (exists (select 1 from public.bayi_lead_teklifleri t join public.bayi_leadleri l on l.id = t.lead_id where t.id = bayi_lead_teklif_kalemleri.teklif_id and l.bayi_id = (select private.bayi_id())))
  with check (exists (select 1 from public.bayi_lead_teklifleri t join public.bayi_leadleri l on l.id = t.lead_id where t.id = bayi_lead_teklif_kalemleri.teklif_id and l.bayi_id = (select private.bayi_id())));
create policy bayi_yonetir on public.bayi_lead_teklifleri for all to authenticated
  using (exists (select 1 from public.bayi_leadleri l where l.id = bayi_lead_teklifleri.lead_id and l.bayi_id = (select private.bayi_id())))
  with check (exists (select 1 from public.bayi_leadleri l where l.id = bayi_lead_teklifleri.lead_id and l.bayi_id = (select private.bayi_id())));
create policy bayi_yonetir on public.bayi_leadleri for all to authenticated using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_gunceller on public.bayi_lisans_havuzu for update to authenticated using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_lisans_havuzu for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_ekler on public.bayi_yenileme_talepleri for insert to authenticated with check (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayi_yenileme_talepleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_siler on public.bayi_yenileme_talepleri for delete to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.bayiler for select to authenticated using (id = (select private.bayi_id()));
create policy bayi_okur on public.cihaz_surum_gecmisi for select to authenticated using (exists (select 1 from public.cihazlar c where c.id = cihaz_surum_gecmisi.cihaz_id and c.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.cihazlar for insert to authenticated with check (bayi_id = (select private.bayi_id()) and c_lisans_bat is null and c_lisans_bit is null);
create policy bayi_gunceller on public.cihazlar for update to authenticated using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.cihazlar for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_ekler on public.destek_talepleri for insert to authenticated with check (bayi_id = (select private.bayi_id()) and t_kanal = 'Bayi portalı' and t_durum = 'yeni' and musteri_id is null
  and (cihaz_id is null or exists (select 1 from public.cihazlar c where c.id = destek_talepleri.cihaz_id and c.bayi_id = (select private.bayi_id()))));
create policy bayi_gunceller on public.destek_talepleri for update to authenticated using (bayi_id = (select private.bayi_id())) with check (bayi_id = (select private.bayi_id()) and t_durum = any (array['yeni', 'islemde']));
create policy bayi_okur on public.destek_talepleri for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.garanti_uzatmalari for select to authenticated using (exists (select 1 from public.cihazlar c where c.id = garanti_uzatmalari.cihaz_id and c.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.hatirlatmalar for insert to authenticated with check (((select private.bayi_id()) is not null) and h_durum = 'bekliyor' and h_tamamlanma is null
  and h_kayit_tur = any (array['siparis', 'bayi', 'rma', 'cihaz', 'destek', 'firsat']));
create policy bayi_okur on public.icerik_medyalari for select to authenticated using (exists (select 1 from public.icerikler i where i.id = icerik_medyalari.icerik_id and i.ic_bayi_paylas) and ((select private.bayi_id()) is not null));
create policy bayi_okur on public.icerikler for select to authenticated using (ic_bayi_paylas and ((select private.bayi_id()) is not null));
create policy bayi_ekler on public.lisanslar for insert to authenticated with check (exists (select 1 from public.cihazlar c where c.id = lisanslar.cihaz_id and c.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.lisanslar for select to authenticated using (exists (select 1 from public.cihazlar c where c.id = lisanslar.cihaz_id and c.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.medya_dosyalari for select to authenticated using (((select private.bayi_id()) is not null)
  and exists (select 1 from public.icerik_medyalari im join public.icerikler i on i.id = im.icerik_id where im.medya_id = medya_dosyalari.id and i.ic_bayi_paylas));
create policy bayi_okur on public.musteri for select to authenticated using (
  exists (select 1 from public.cihazlar c where c.musteri_id = musteri.id and c.bayi_id = (select private.bayi_id()))
  or exists (select 1 from public.bayi_hareketleri h where h.musteri_id = musteri.id and h.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.musteri_olaylari for insert to authenticated with check (o_tur = any (array['siparis', 'destek']) and exists (select 1 from public.musteri m where m.id = musteri_olaylari.musteri_id));
create policy bayi_cihaz_rmasi_okur on public.rma_ekleri for select to authenticated using ((select private.bayinin_rmasi(rma_ekleri.rma_id::text)));
create policy bayi_ekler on public.rma_ekleri for insert to authenticated with check ((select private.bayinin_rmasi(rma_ekleri.rma_id::text)));
create policy bayi_okur on public.rma_ekleri for select to authenticated using (exists (select 1 from public.rma_kayitlari r where r.id = rma_ekleri.rma_id and r.bayi_id = (select private.bayi_id())));
create policy bayi_cihaz_rmasi_okur on public.rma_gecmisi for select to authenticated using ((select private.bayinin_rmasi(rma_gecmisi.rma_id::text)));
create policy bayi_ekler on public.rma_gecmisi for insert to authenticated with check (coalesce(rg_tur, 'sistem') = any (array['sistem', 'gorusme']) and (select private.bayinin_rmasi(rma_gecmisi.rma_id::text)));
create policy bayi_okur on public.rma_gecmisi for select to authenticated using (exists (select 1 from public.rma_kayitlari r where r.id = rma_gecmisi.rma_id and r.bayi_id = (select private.bayi_id())));
create policy bayi_cihaz_rmasi_okur on public.rma_kayitlari for select to authenticated using ((select private.bayinin_cihazi(rma_kayitlari.r_seri_no)));
create policy bayi_ekler on public.rma_kayitlari for insert to authenticated with check (r_kaynak = 'bayi-portali' and r_adim = 'talep' and r_karar is null and r_ucret is null and r_yeni_seri is null
  and not r_ucret_onay and not r_ucret_odendi and (select private.bayinin_cihazi(rma_kayitlari.r_seri_no))
  and ((r_sahip_tur = 'bayi' and bayi_id = (select private.bayi_id())) or (r_sahip_tur = 'musteri' and bayi_id is null)));
create policy bayi_gunceller on public.rma_kayitlari for update to authenticated using ((select private.bayinin_rmasi(rma_kayitlari.id::text))) with check ((select private.bayinin_rmasi(rma_kayitlari.id::text)));
create policy bayi_okur on public.rma_kayitlari for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_ekler on public.siparis_kalemleri for insert to authenticated with check (exists (select 1 from public.siparisler s where s.id = siparis_kalemleri.siparis_id and s.bayi_id = (select private.bayi_id()) and s.sp_durum = 'odeme'));
create policy bayi_okur on public.siparis_kalemleri for select to authenticated using (exists (select 1 from public.siparisler s where s.id = siparis_kalemleri.siparis_id and s.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.siparis_lisans_atamalari for insert to authenticated with check (exists (select 1 from public.siparisler s where s.id = siparis_lisans_atamalari.siparis_id and s.bayi_id = (select private.bayi_id()) and s.sp_durum = 'odeme'));
create policy bayi_okur on public.siparis_lisans_atamalari for select to authenticated using (exists (select 1 from public.siparisler s where s.id = siparis_lisans_atamalari.siparis_id and s.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.siparis_notlari for insert to authenticated with check (exists (select 1 from public.siparisler s where s.id = siparis_notlari.siparis_id and s.bayi_id = (select private.bayi_id()) and s.sp_durum = any (array['odeme', 'iptal'])));
create policy bayi_okur on public.siparis_notlari for select to authenticated using (exists (select 1 from public.siparisler s where s.id = siparis_notlari.siparis_id and s.bayi_id = (select private.bayi_id())));
create policy bayi_ekler on public.siparisler for insert to authenticated with check (bayi_id = (select private.bayi_id()) and sp_durum = 'odeme' and musteri_id is null and teklif_id is null
  and sp_seri_nolar = '{}'::text[] and sp_iptal_tarihi is null and sp_fatura_no is null);
create policy bayi_iptal_eder on public.siparisler for update to authenticated using (bayi_id = (select private.bayi_id()) and sp_durum = 'odeme')
  with check (bayi_id = (select private.bayi_id()) and sp_durum = 'iptal' and sp_iptal_kim = 'bayi');
create policy bayi_okur on public.siparisler for select to authenticated using (bayi_id = (select private.bayi_id()));
create policy bayi_okur on public.stok_kalemleri for select to authenticated using ((select private.bayi_id()) is not null);
create policy bayi_ekler on public.talep_notlari for insert to authenticated with check (n_tur = any (array['acilis', 'bayi', 'yeniden'])
  and exists (select 1 from public.destek_talepleri t where t.id = talep_notlari.talep_id and t.bayi_id = (select private.bayi_id())));
create policy bayi_okur on public.talep_notlari for select to authenticated using (n_tur <> all (array['not', 'gorusme', 'yapilacak'])
  and exists (select 1 from public.destek_talepleri t where t.id = talep_notlari.talep_id and t.bayi_id = (select private.bayi_id())));

-- Storage: üç özel (public olmayan) bucket ve politikaları
insert into storage.buckets (id, name, public, file_size_limit) values
  ('pazarlama-medya', 'pazarlama-medya', false, 26214400),
  ('bayi-dokumanlari', 'bayi-dokumanlari', false, 26214400),
  ('rma-ekleri', 'rma-ekleri', false, 10485760)
on conflict (id) do nothing;

create policy crm_tam_erisim on storage.objects for all to authenticated
  using (bucket_id = any (array['pazarlama-medya', 'bayi-dokumanlari', 'rma-ekleri']) and (select private.crm_kullanicisi()))
  with check (bucket_id = any (array['pazarlama-medya', 'bayi-dokumanlari', 'rma-ekleri']) and (select private.crm_kullanicisi()));
create policy bayi_cihaz_rma_eki on storage.objects for select to authenticated using (bucket_id = 'rma-ekleri' and (select private.bayinin_rmasi((storage.foldername(objects.name))[1])));
create policy bayi_cihaz_rma_eki_yukler on storage.objects for insert to authenticated with check (bucket_id = 'rma-ekleri' and (select private.bayinin_rmasi((storage.foldername(objects.name))[1])));
create policy bayi_dokuman_okur on storage.objects for select to authenticated using (bucket_id = 'bayi-dokumanlari' and exists (select 1 from public.bayi_dokumanlari d where d.bd_yol = objects.name));
create policy bayi_medya_okur on storage.objects for select to authenticated using (bucket_id = 'pazarlama-medya' and exists (select 1 from public.medya_dosyalari m where m.id::text = objects.name));
create policy bayi_rma_eki on storage.objects for select to authenticated using (bucket_id = 'rma-ekleri'
  and exists (select 1 from public.rma_kayitlari r where r.id::text = (storage.foldername(objects.name))[1] and r.bayi_id = (select private.bayi_id())));
create policy bayi_rma_eki_yukler on storage.objects for insert to authenticated with check (bucket_id = 'rma-ekleri'
  and exists (select 1 from public.rma_kayitlari r where r.id::text = (storage.foldername(objects.name))[1] and r.bayi_id = (select private.bayi_id())));
