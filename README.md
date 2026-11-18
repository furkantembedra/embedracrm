Embedra CRM
Müşteri ilişkilerini, satış süreçlerini ve ekip çalışmalarını tek merkezden yönetmek için geliştirilen modern CRM uygulaması.

Embedra CRM; müşteri ve firma bilgilerini düzenlemeyi, satış fırsatlarını takip etmeyi, görevleri planlamayı ve iş süreçlerini daha görünür hâle getirmeyi amaçlayan, Türkçe arayüze sahip bir müşteri ilişkileri yönetimi (CRM) projesidir.
Proje durumu: Aktif geliştirme. Bu dokümanda yer alan modüller ürün kapsamını ve geliştirme hedeflerini açıklar; her özelliğin mevcut sürümde tamamlandığı anlamına gelmez.

🎯 Projenin Amacı
- Müşteri ve firma kayıtlarını merkezi bir yapıda toplamak.
- Potansiyel müşterilerden satışa uzanan süreci takip etmek.
- Ekip görevlerini, görüşmeleri ve planlanan aktiviteleri düzenlemek.
- Performans verilerini anlaşılır bir panelde sunmak.
- Günlük CRM işlemlerini hızlı ve kullanışlı bir arayüzde birleştirmek.
🧩 Proje Kapsamındaki Modüller
Modül	Açıklama
Genel Bakış	Temel göstergeler, son aktiviteler ve özet bilgiler.
Kişiler	İletişim bilgileri, müşteri kayıtları ve ilişki takibi.
Firmalar	Kurumsal müşteri hesapları ve firma detayları.
Satış Fırsatları	Satış aşamaları, fırsat detayları ve Kanban/tablo görünümleri.
Görevler	Yapılacak işler, öncelikler, durumlar ve sorumlular.
Takvim	Toplantılar, hatırlatmalar ve planlanan aktiviteler.
Raporlar	CRM verilerine yönelik özetler ve performans takibi.
Ayarlar	Kullanıcı ve uygulama tercihleri.


✨ Tasarım ve Kullanım Hedefleri
- Modern, sade ve profesyonel Türkçe kullanıcı arayüzü
- Masaüstü odaklı, farklı ekran boyutlarına uyumlu responsive tasarım
- Daraltılabilir yan menü ve kolay gezinme
- Arama, filtreleme, sıralama ve sayfalama akışları
- Kayıt oluşturma, görüntüleme, güncelleme ve silme (CRUD) işlemleri
- Form doğrulama, kullanıcı geri bildirimleri ve bildirimler
- Modüller arasında tutarlı bileşen ve tasarım sistemi
🛠️ Teknoloji Yaklaşımı
Projenin başlangıç geliştirme planında aşağıdaki teknolojiler yer alır. Kesin bağımlılıklar için repodaki package.json dosyasını esas alın.
Teknoloji	Kullanım alanı
Next.js (App Router)	Uygulama mimarisi ve sayfa yönlendirme
React	Bileşen tabanlı arayüz
TypeScript	Tip güvenliği
Tailwind CSS	Arayüz stilleri
shadcn/ui	Yeniden kullanılabilir arayüz bileşenleri
Lucide Icons	İkon seti

🧪 Testler
Testler Vitest ile yazılır ve `test/` klasöründedir. Gerçek ağa çıkmazlar: `localhost` dışına atılan her istek
testi düşürür (`test/kurulum.ts`). Meta Graph API ve Anthropic API için `test/sahte/` altında sahte sunucular vardır.
Testler `.env.local`'i okumaz; gerçek anahtar ya da Supabase projesi kullanılmaz.

Komut	Ne yapar
`npm test`	Tüm testleri bir kez çalıştırır (CI ve iş bitiminde bu kullanılır)
`npm run test:izle`	Dosya değiştikçe testleri yeniden çalıştırır
`npx vitest run test/isle.test.ts`	Tek bir test dosyasını çalıştırır
`npx vitest run -t "aynı mesaj"`	Adında bu metin geçen testleri çalıştırır

Test dosyası	Kapsam
`test/webhook-imza.test.ts`	WhatsApp webhook imzası (geçerli, geçersiz, değiştirilmiş, eksik; production'da secret yoksa red) ve Meta doğrulaması
`test/isle.test.ts`	Gelen WhatsApp mesajı kuralları: açık fırsata ekleme, yeni lead, müşteri yetkilisi eşleşmesi, aynı mesajın iki kez (sırayla / aynı anda) gelmesi, hata olursa geri alma
`test/telefon.test.ts`	Telefon normalizasyonu
`test/veritabani.test.ts`	`supabase/migrations` + `supabase/seed.sql` boş Postgres 17'de (PGlite) sıfırdan kurulur; SQL telefon normalizasyonu TS ile aynı mı, tekillik kuralları, RLS (anon, ekip dışı, ekip, bayi), auth bağlama tetikleyicisi, kimlik sayaçları
`test/sahte-sunucular.test.ts`	Ağ koruması, WhatsApp şablon gönderiminin sahte Meta'ya attığı istek, sahte Anthropic'in Messages API biçimi

Sahte sunucular: `META_GRAPH_URL` sahte Meta'ya (`test/sahte/meta.ts`), `ANTHROPIC_BASE_URL` sahte Anthropic'e
(`test/sahte/anthropic.ts`) yönlendirir. Gerçek Meta veya Anthropic API'sine istek atan bir test yazılacaksa önce
proje sahibine sorulur (yol haritası, değişmez kural 8).
