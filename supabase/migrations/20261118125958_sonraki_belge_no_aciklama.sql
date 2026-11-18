-- Supabase güvenlik uyarısı (0029, authenticated SECURITY DEFINER) bilinçli: CRM ekibi ve bayi portalı sipariş / iade / RMA
-- numarasını kendi oturumuyla bu fonksiyondan alır (RLS diğer satırları gizlediği için en büyük numarayı göremezler).
-- Fonksiyon içeride yetkiyi denetler: oturumlu çağıran CRM ekibi ya da erişimi açık bayi değilse 42501; anon'un yetkisi yok.
comment on function public.sonraki_belge_no(text) is
  'Sonraki belge numarası (siparis | iade | rma). SECURITY DEFINER bilinçli: RLS altındaki kullanıcı en büyük numarayı göremez. '
  'Yalnızca CRM ekibi, erişimi açık bayi ve service_role; içeride denetlenir. anon çalıştıramaz.';
