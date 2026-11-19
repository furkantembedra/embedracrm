# Embedra CRM ve AI satış botu: kurulum rehberi

Bu belge, CRM'i ve WhatsApp / Instagram / Messenger satış botunu canlıya almak için gereken hesap, anahtar ve ortam değişkeni adımlarını anlatır. Kod bilgisi gerekmez. Değişkenlerin şablonu `.env.example` dosyasındadır.

> Bu belgeye hiçbir gerçek anahtar yazılmaz. Anahtarlar yalnızca `.env.local` dosyasına (bilgisayarında) ve Vercel'deki ortam değişkenlerine girilir. `.env.local` git'e eklenmez.

Son güncelleme: 19 Kasım 2026 (P1.0: tek Meta uygulaması, ortak webhook, Messenger). Meta ayrıntıları bu tarihte resmi Meta dokümanından kontrol edildi; doğrulanamayanlar **(doğrulanmadı)** diye işaretli. Panellerdeki menü adları Meta, Anthropic ve Vercel tarafında zaman zaman değişir. Burada yazandan farklı görürsen en yakın karşılığını seç.

---

## 1. Senin yapman gerekenler (kontrol listesi)

Sıra önemli: Meta işletme doğrulaması ve Instagram App Review günler, hatta haftalar sürebilir. Bu yüzden en başta başlat.

**Meta uygulaması (üç kanal için tek uygulama) ve WhatsApp**
- [ ] Meta Business hesabında **işletme doğrulamasını** tamamla (Business Settings › Security Center). Kalıcı token ve App Review bu olmadan ilerlemez.
- [ ] developers.facebook.com'da **Business** türünde **tek** bir Meta uygulaması oluştur; WhatsApp, Instagram ve Messenger ürünleri aynı uygulamaya eklenir (Bölüm 2.1).
- [ ] WhatsApp Business hesabına (WABA) **gerçek telefon numarasını** ekle, doğrula, görünen adı onaylat (Bölüm 2.2).
- [ ] **App Secret** değerini al → `META_APP_SECRET` (eski kurulumda `WHATSAPP_APP_SECRET` da çalışır).
- [ ] Uzun ve rastgele bir **doğrulama token'ı** belirle → `META_VERIFY_TOKEN` (eski adı `WHATSAPP_VERIFY_TOKEN` da çalışır).
- [ ] **Phone number ID** değerini al → `WHATSAPP_PHONE_ID`.
- [ ] Bir **System User** oluştur ve süresiz token üret → `WHATSAPP_TOKEN` (Bölüm 4).
- [ ] Webhook adresini (`/api/meta/webhook`) gir, doğrula ve alanlara abone ol (Bölüm 3).
- [ ] Gerçek numara bağlandıktan sonra eski konuşmaları o numaraya taşı (Bölüm 3, "varsayilan" hesap).
- [ ] Pazarlama gönderimleri için mesaj şablonlarını Meta'da onaylat (Bölüm 2.3).
- [ ] **Gizlilik politikası** ve **veri silme talimatı** adresini uygulama ayarlarına gir (Bölüm 5.6). App Review için gerekli.

**Instagram ve Messenger (Faz 4; App Review başvurusunu P1.0 sırasında başlat)**
- [ ] **Hangi hesaplar:** kaç Facebook sayfası / Instagram hesabı bağlanacağına karar ver (yol haritası "Senin yapman gerekenler").
- [ ] Instagram hesabını **Professional** (İşletme) hesaba çevir ve Embedra'nın Facebook sayfasına bağla (Bölüm 5.1).
- [ ] Facebook sayfasını Embedra'nın Business hesabına ekle; System User'a sayfa ve Instagram hesabı varlıklarını ata → `META_SAYFA_ID`, `META_SAYFA_TOKEN`, `INSTAGRAM_HESAP_ID` (Bölüm 5.3, 5.4).
- [ ] Instagram ve Messenger izinleri için **App Review** başvurusunu yap (Bölüm 5.2, 5.4, 5.7).
- [ ] **Meta gelen kutusu kararı** ve sayfanın **Conversation Routing** ayarı (Bölüm 5.5).

**Anthropic**
- [ ] console.anthropic.com'da organizasyonu kur ve ödeme yöntemini ekle.
- [ ] Bot için ayrı bir **workspace** aç ve o workspace'te bir **API anahtarı** oluştur → `ANTHROPIC_API_KEY` (Bölüm 6).
- [ ] Organizasyon ve workspace için **aylık harcama limiti** koy (Bölüm 6.2).

**Supabase** (proje hazır: `wglfzzbzifszwkugamjj`, Frankfurt)
- [x] Proje oluşturuldu, şema ve RLS kuruldu.
- [ ] Canlı alan adını Auth › URL Configuration'a ekle: Site URL ve Redirect URL (Bölüm 7).

**Uygulama sırları** (kendin üretirsin; Bölüm 8.3'teki komutu kullan)
- [ ] `PORTAL_OTURUM_SECRET`, `ABONELIK_SIRRI`, `CIHAZ_BILDIRIM_SIRRI`, `CRON_SECRET`

**E-posta (Resend)**
- [ ] Resend'de gönderen alan adını doğrula, API anahtarı al → `RESEND_API_KEY`, `EPOSTA_GONDEREN`.

**Vercel**
- [ ] Tüm değişkenleri Production ortamına gir. Gizli olanları **Sensitive** olarak işaretle (Bölüm 9).
- [ ] `SITE_URL` değerini canlı alan adı olarak ayarla.
- [ ] `CRON_SECRET` tanımlı olsun; Vercel Cron `vercel.json`'dan otomatik kurulur. Dakikalık çalışma gerekiyorsa ek zamanlayıcıyı kur (Bölüm 9.3).
- [ ] **Konuşma işleyicisi:** Supabase'de `pg_cron` + `pg_net` ile `/api/konusma/isleyici`'yi 10 saniyede bir çağıran işi kur (Bölüm 9.4). Bu olmadan canlıda webhook mesajları yalnızca kaydedilir, satış hattına işlenmez (webhook'un `after()` dürtmesi yardımcıdır, garanti değildir).

---

## 2. Meta uygulaması ve WhatsApp Business numarası

### 2.1 Uygulama
1. developers.facebook.com › **My Apps › Create App**. Uygulama türü olarak **Business** seç ve uygulamayı Embedra'nın Business hesabına bağla.
2. Uygulama panelinde **Add product › WhatsApp › Set up**. Meta bu adımda bir test WABA'sı ve test numarası açar. Geliştirme için yeterlidir.
3. **App settings › Basic** sayfasındaki **App Secret** değerini (Show'a basarak) `META_APP_SECRET` olarak kaydet. Üç kanaldan gelen her webhook isteğinin `X-Hub-Signature-256` imzası bu değerle doğrulanır (ham gövdenin HMAC-SHA256'sı). Eski kurulumda değer `WHATSAPP_APP_SECRET` adıyla girildiyse o da çalışır; ikisi birden tanımlıysa `META_APP_SECRET` kullanılır.
   - Tek uygulama kullanmanın nedeni: tek secret, tek webhook adresi, tek App Review ve tek System User. Instagram ve Messenger ürünleri bu uygulamaya **Add product** ile eklenir.
4. Canlıya çıkmadan önce uygulamayı **Live** moda al. Bunun için Basic sayfasında gizlilik politikası adresi gerekir.

### 2.2 Gerçek numara
1. WhatsApp › **API Setup** (ya da WhatsApp Manager › Phone numbers) › **Add phone number**.
2. Numara başka bir WhatsApp hesabında (telefondaki WhatsApp ya da WhatsApp Business uygulaması) kullanılıyorsa önce oradan silinmesi gerekir.
3. SMS veya sesli arama koduyla doğrula, ardından görünen adı (display name) onaya gönder.
4. API Setup sayfasında numaranın altında görünen **Phone number ID** değerini `WHATSAPP_PHONE_ID` olarak kaydet. Bu değer telefon numarasının kendisi değil, Meta'nın verdiği sayısal kimliktir.
5. WhatsApp Business Account ID'yi de bir yere not et. Şablon yönetiminde gerekir, kodda henüz kullanılmıyor.

### 2.3 Şablonlar ve 24 saat penceresi
- Müşterinin son mesajından sonraki 24 saat içinde serbest metin gönderilebilir. Pencere kapandıktan sonra yalnızca Meta'nın onayladığı **şablonlar** gönderilebilir (Değişmez kural 5). Bot hiçbir zaman şablon göndermez.
- Bugün kodda şablonu yalnızca toplu pazarlama gönderimi kullanır (`lib/ileti-gonder.ts`). Şablon gövdesinde `{{1}}` kişi adı, `{{2}}` firma adıdır. Şablon dili `WHATSAPP_SABLON_DILI` ile belirlenir, varsayılanı `tr`.
- Türkiye'deki alıcılara ticari ileti göndermeden önce izinlerin **İYS**'ye kayıtlı olması gerekir.

---

## 3. Webhook adresi ve doğrulama

CRM'de Meta ve diğer sistemlerden gelen çağrılar için açık adresler vardır. Hepsi `lib/supabase/proxy.ts` içindeki `ACIK_YOLLAR` listesinde tanımlıdır, yani giriş istemezler. Her biri kendi doğrulamasını yapar.

| Adres | Kim çağırır | Nasıl doğrulanır |
|---|---|---|
| `GET /api/meta/webhook` | Meta (kurulumda bir kez, her ürün için) | `hub.verify_token` değeri `META_VERIFY_TOKEN` (yoksa `WHATSAPP_VERIFY_TOKEN`) ile aynıysa `hub.challenge` geri döner, değilse 403. |
| `POST /api/meta/webhook` | Meta (WhatsApp, Instagram, Messenger olayları) | `X-Hub-Signature-256` imzası `META_APP_SECRET` (yoksa `WHATSAPP_APP_SECRET`; Instagram bildirimlerinde tanımlıysa `INSTAGRAM_APP_SECRET` de) ile kontrol edilir; geçersizse 401. |
| `GET/POST /api/whatsapp/webhook` | Eski WhatsApp kurulumu | Geriye uyumluluk: `/api/meta/webhook` ile birebir aynı işleyici. Yeni kurulumda kullanma. |
| `GET/POST /api/abonelik?t=…` | Kampanya e-postasındaki "abonelikten çık" bağlantısı | Jeton `ABONELIK_SIRRI` ile imzalanmıştır, başkası adına uydurulamaz. |
| `POST /api/cihaz-bildirimi` | ONESuite (cihaz) | Seri numarasından `CIHAZ_BILDIRIM_SIRRI` ile üretilen cihaz anahtarı. `GET` isteği ise oturum ister. |
| `GET /api/zamanlayici` | Vercel Cron (`vercel.json`) ya da harici zamanlayıcı | `Authorization: Bearer <CRON_SECRET>` başlığı. Kampanya ve otomasyonu birlikte çalıştırır. |
| `GET /api/kampanya-zamanlayici` | Harici zamanlayıcı (yalnızca kampanya) | `Authorization: Bearer <CRON_SECRET>` başlığı. |
| `POST /api/konusma/isleyici` (GET de olur) | Supabase pg_cron + pg_net (10 sn'de bir, Bölüm 9.4) | `Authorization: Bearer <CRON_SECRET>` başlığı. Konuşma kuyruğunu işler. |

### Ortak webhook: nasıl yönlendirilir
Üç ürün de aynı adrese yazar; kod gövdedeki `object` alanına bakar (`components/konusma/meta-webhook.ts`):

| `object` | Kanal | Bugün (P1.0) |
|---|---|---|
| `whatsapp_business_account` | WhatsApp | Mesaj satış hattına işlenir. Konuşma `metadata.phone_number_id` hesabında açılır. |
| `instagram` | Instagram (`entry[].id` = Instagram hesap kimliği) | 200 döner, işlenmez (P4.1). Loga yalnızca olay türü sayıları yazılır. |
| `page` | Messenger (`entry[].id` = Facebook sayfa kimliği) | 200 döner, işlenmez (P4.2). Loga yalnızca olay türü sayıları yazılır. |

Loga mesaj içeriği, kullanıcı kimliği (IGSID / PSID / telefon) ya da sayfa kimliği yazılmaz; örnek: `[meta-webhook] messenger bildirimi henüz işlenmiyor: message×1, read×2, standby:message×1`.

Meta 200 almayan teslimatı tekrar dener. Messenger dokümanı cevabın 5 saniye içinde dönmesini, App Review sayfası 20 saniye içinde dönmesini ister; teslimat bir saat boyunca başarısız olursa Meta webhook'u devre dışı bırakır ve sayfanın aboneliğini kaldırır. Hızlı 200 için kuyruk P1.1'de gelecek.

### WhatsApp webhook'unu bağlama
1. Uygulama panelinde **WhatsApp › Configuration › Webhook › Edit**.
2. **Callback URL:** `https://<canlı-alan-adı>/api/meta/webhook` (daha önce `/api/whatsapp/webhook` girildiyse çalışmaya devam eder; fırsat bulunca yenisiyle değiştir). Meta yalnızca geçerli sertifikalı HTTPS kabul eder, yani `localhost` çalışmaz. Yerelde denemek istersen bir tünel (ör. ngrok, cloudflared) kullanabilirsin.
3. **Verify token:** `META_VERIFY_TOKEN` değerinin aynısı. Bu değeri sen belirlersin; uzun ve rastgele olsun.
4. **Verify and save.** Meta bu adımda yukarıdaki `GET` isteğini atar. Değişken sunucuda tanımlı değilse doğrulama 403 ile başarısız olur, o yüzden önce Vercel'e girip yeniden deploy et.
5. **Webhook fields** listesinde **messages** alanına abone ol (Subscribe).
6. Davranış: Meta, 200 almadığı bildirimi tekrar gönderir. Aynı mesaj kimliği (`dis_mesaj_id` UNIQUE) ikinci kez işlenmez. Okundu ve iletildi gibi durum bildirimleri bugün atlanıyor; P1.2'de işlenecek.
7. Geliştirmede hiçbir secret (`META_APP_SECRET`, `WHATSAPP_APP_SECRET`, `INSTAGRAM_APP_SECRET`) tanımlı değilse imzasız istek kabul edilir. **Production'da secret yoksa her istek reddedilir.**
8. Kullanıcı adı kullanan WhatsApp kullanıcılarında mesajda telefon (`from`) gelmeyebilir, yalnızca `from_user_id` gelir. Bugün bu mesajlar atlanır (telefon çözülemez); P1.1'de ele alınacak.

### Konuşmanın hesabı ve "varsayilan"
Her konuşma kanal + **kanal hesabı** + müşteri kimliğiyle tekildir (`konusmalar.kanal_hesap_id`): WhatsApp'ta numaranın `phone_number_id`'si, Instagram'da Instagram hesap kimliği, Messenger'da sayfa kimliği. Instagram (IGSID) ve Messenger (PSID) kullanıcı kimlikleri hesaba / sayfaya özgü olduğu için birden fazla hesap bağlanınca bu gerekli.

P1.0'dan önce açılmış WhatsApp konuşmaları ve `phone_number_id` bilinmeden yazılanlar (satış hattındaki simülasyon, `WHATSAPP_PHONE_ID` tanımsızken) `varsayilan` hesabında durur. Gerçek numara bağlanınca Supabase SQL Editor'da bir kez şunu çalıştır (değeri kendi Phone number ID'nle değiştir), yoksa aynı müşterinin yeni mesajları ayrı bir konuşma açar (fırsat yine telefonla eşleştiği için mesajlar aynı fırsata düşer):

```sql
update public.konusmalar set kanal_hesap_id = '<PHONE_NUMBER_ID>'
where kanal = 'whatsapp' and kanal_hesap_id = 'varsayilan';
```

### Instagram ve Messenger webhook'unu bağlama
Uygulama panelinde **Webhooks** ürünü (ya da Instagram / Messenger ürününün ayar sayfası) üzerinden, aynı Callback URL (`/api/meta/webhook`) ve aynı Verify token ile:
- **Page** nesnesi (Messenger): `messages`, `messaging_postbacks`, `message_echoes`, `message_reads`, `message_deliveries`, `messaging_referrals`, `message_reactions`, `messaging_handovers`, `standby`.
- **Instagram** nesnesi: `messages` (echo'lar da bu alanla `is_echo: true` olarak gelir; ayrı `message_echoes` alanı yok), `messaging_postbacks`, `message_reactions`, `messaging_seen`, `messaging_referral`, `messaging_handover`, `standby`. Yorumlar (`comments`) yalnızca P4.3 yapılırsa.
- Uygulama düzeyindeki abonelik yetmez: **sayfanın da uygulamaya abone edilmesi** gerekir, `POST /{sayfa-id}/subscribed_apps?subscribed_fields=…` (sayfa token'ıyla; Messenger ürün sayfasındaki "Add subscriptions" düğmesi aynı işi yapar). Instagram Login yolunda karşılığı `POST graph.instagram.com/<IG_ID>/subscribed_apps`.

---

## 4. Kalıcı erişim token'ı (System User)

API Setup sayfasındaki geçici token 24 saatte geçersiz olur. Canlı ortam için System User token'ı kullan.

1. **business.facebook.com › Business Settings › Users › System users › Add.** Ad ver (ör. `embedra-crm-bot`), rol olarak **Admin** seç.
2. **Assign assets:**
   - **Apps:** CRM uygulaması, *Manage app* (tam yetki).
   - **WhatsApp accounts:** Embedra'nın WABA'sı, *Manage WhatsApp Business Accounts* (tam yetki).
3. **Generate new token:** uygulamayı seç. Süre (Token expiration) olarak **Never** seç. İzinler:
   - `whatsapp_business_messaging` (mesaj gönderme)
   - `whatsapp_business_management` (numara ve şablon yönetimi)
4. Üretilen token'ı **hemen** `WHATSAPP_TOKEN` olarak kaydet. Meta onu bir daha göstermez.
5. Token sızarsa aynı ekrandan iptal et (Revoke) ve yenisini üret.
6. Kod bu token'ı yalnızca sunucuda, `Authorization: Bearer` başlığında kullanır. Hiçbir zaman loglanmaz (Değişmez kural 7).

`WHATSAPP_TOKEN` ve `WHATSAPP_PHONE_ID` ikisi birden tanımlı değilse gönderim **demo modundadır**: adres doğrulanır, sonuç kaydedilir, ama Meta'ya hiçbir şey gitmez.

---

## 5. Instagram ve Messenger: hesaplar, izinler, App Review

Instagram (P4.1) ve Messenger (P4.2) Faz 4'te bağlanacak. App Review uzun sürdüğü için başvuruyu P1.0 sırasında başlat. Bugün kod bu kanallardan gelen bildirimi yalnızca kabul edip olay türünü logluyor (Bölüm 3).

### 5.1 Ön koşullar
- Embedra'nın **Facebook sayfası** Business hesabına eklenmiş olmalı (Messenger bu sayfadan çalışır). Uygulama ile sayfa aynı Business hesabında olmalı.
- Instagram hesabı **Professional** (İşletme veya İçerik Üreticisi) olmalı. Facebook Login yolunda (önerilen, 5.2) Facebook sayfasına **bağlı** olmalı.
- Instagram uygulamasında **Ayarlar › Mesajlar ve hikâye yanıtları › Bağlı araçlar › Mesajlara erişime izin ver** açık olmalı.
- Meta işletme doğrulaması tamamlanmış olmalı.

### 5.2 Instagram: hangi giriş yolu?
Meta'nın Instagram mesajlaşması için iki yolu var (resmi doküman: Instagram Platform › Overview, 19 Kasım 2026):

| | Instagram API with **Instagram Login** | Instagram API with **Facebook Login for Business** |
|---|---|---|
| Facebook sayfası | Gerekmez | Gerekir (Instagram hesabı sayfaya bağlı) |
| Token | Instagram kullanıcı token'ı; uzun ömürlüsü **60 gün**, süresi dolmadan yenilenmesi gerekir | **Sayfa erişim token'ı** (System User ile süresiz alınabilir) |
| Gereken kimlikler | Instagram hesap kimliği | Sayfa kimliği + Instagram hesap kimliği |
| API adresi | `graph.instagram.com` | `graph.facebook.com` |
| İzinler | `instagram_business_basic`, `instagram_business_manage_messages` | `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list` (genel bakış sayfası `business_management`'ı da listeler) |
| Webhook imzası | Uygulama secret'ı; panelde ayrıca bir "Instagram app secret" görünür, webhook imzasının hangisiyle atıldığı dokümanda açık değil **(doğrulanmadı)** | Uygulama secret'ı |

**Öneri: Facebook Login.** Messenger için zaten sayfa ve sayfa token'ı gerekiyor; aynı System User token'ı Instagram'a da yeter, 60 günlük yenileme işi olmaz, tek imza anahtarı kullanılır. Instagram Login ancak sayfası olmayan bir Instagram hesabı bağlanacaksa gerekir. Karar P4.1'de kesinleşir.

Değişkenler (kod P4.1 / P4.2'de okuyacak; bugün tanımlamak zararsız):

| Değişken | Facebook Login | Instagram Login | Messenger |
|---|---|---|---|
| `META_SAYFA_ID` | Gerekli (gönderim `/{sayfa-id}/messages`) | — | Gerekli |
| `META_SAYFA_TOKEN` | Gerekli (Instagram mesajları da sayfa token'ıyla gider) | — | Gerekli |
| `INSTAGRAM_HESAP_ID` | Gerekli (gelen olayı hesapla eşleştirmek için, `entry[].id`) | Gerekli | — |
| `INSTAGRAM_TOKEN` | — | Gerekli (60 günde bir yenilenir) | — |
| `INSTAGRAM_APP_SECRET` | — | Yalnızca webhook imzası uygulama secret'ıyla doğrulanamazsa | — |

Birden fazla sayfa / hesap bağlanacaksa bu değişkenler yetmez; hesaplar P4'te bir tabloya (hesap kimliği, token referansı, dil, satış ekibi) taşınır. Veritabanı buna hazır: konuşmalar `kanal_hesap_id` ile ayrılıyor.

### 5.3 Instagram App Review
1. Uygulama panelinde **App Review › Permissions and Features**. 5.2'deki seçilen yolun izinleri için **Advanced Access** iste. Standard Access yalnızca uygulamada rolü olan kişilerle çalışır; gerçek müşteriler için Advanced Access şart.
2. Her izin için kullanım açıklaması yaz: "Müşterilerin Instagram DM'lerine CRM'deki satış ekibi ve bir yapay zekâ asistanı cevap verir. Asistan kendini tanıtır ve her zaman insana devreder."
3. Her izin için bir **ekran kaydı** (screencast) yükle. Kayıtta şunlar görünmeli:
   - Giriş ve izin onayı ekranı.
   - Instagram'dan gönderilen bir DM'in CRM'de belirmesi.
   - CRM'den cevap yazılması ve cevabın Instagram'da görünmesi.
   - Botun asistan olduğunu söylemesi ve "insanla konuşmak istiyorum" denince devretmesi.
   - Ayrıntılı ekran kaydı adımları P4.1'de bu belgeye eklenecek.
4. Test için bir Instagram test kullanıcısı ve gerekirse CRM giriş bilgisi ver (gerçek müşteri verisi olmadan).
5. Gizlilik politikası adresi ve veri silme talimatı (5.6) dolu olmalı.
6. Başvuruyu gönder. Reddedilirse gerekçeye göre ekran kaydını düzelt ve yeniden başvur.

**Human Agent** (`HUMAN_AGENT` etiketi): müşterinin son mesajından sonraki 24 saat geçince temsilcinin 7 güne kadar **elle** cevap verebilmesi için. Instagram'da `instagram_business_manage_messages` istenince otomatik eklendiği yazıyor; Messenger'da App Review'da ayrıca "Human Agent" özelliği istenir, Standard Access'te ve geliştirme modunda çalışmaz (bu ikinci kısım yalnızca arama özetinden, **doğrulanmadı**). Değişmez kural gereği **bot bu etiketi asla kullanmaz**.

### 5.4 Messenger: sayfa, token, izinler
1. Uygulamaya **Messenger** ürününü ekle (Add product).
2. **System User** (Bölüm 4) ile süresiz sayfa token'ı: Business Settings › System users › kullanıcıyı seç › **Assign assets › Pages** › Embedra sayfası, *Manage Page* (ya da en az mesaj yönetme / MODERATE görevi). Sonra **Generate new token**, uygulamayı seç, süre **Never**, izinler: `pages_messaging`, `pages_manage_metadata`, `pages_show_list` (Facebook Login yolunda Instagram için 5.2'deki Instagram izinlerini de aynı token'a ekle). Bu System User token'ı kullanıcı token'ıdır; sayfa token'ı `GET /me/accounts` (ya da `GET /{sayfa-id}?fields=access_token`) ile bu token'dan alınır → `META_SAYFA_TOKEN`. Token'ın ömrü resmi dokümanda açıkça yazmıyor **(doğrulanmadı)**; "Never" seçilen System User'dan alınan sayfa token'ının süresiz olması beklenir, ilk kurulumda Access Token Debugger'da "Expires: Never" olduğunu kontrol et.
3. Sayfa kimliğini (Sayfa › Hakkında › Sayfa şeffaflığı ya da `/me/accounts` çıktısı) → `META_SAYFA_ID`.
4. Sayfayı uygulamaya abone et (Bölüm 3, `subscribed_apps`).
5. **App Review:** `pages_messaging` ve `pages_manage_metadata` için Advanced Access (gerekiyorsa Human Agent). Messenger ekran kaydında 5.3'teki adımların Messenger karşılığı gösterilir (P4.2'de ayrıntılandırılacak).
6. Gönderim: `POST graph.facebook.com/v…/{sayfa-id}/messages`, gövde `{ recipient: { id: PSID }, messaging_type: "RESPONSE", message: { text } }`, cevap `{ recipient_id, message_id }`. Metin sınırı Messenger'da 2000 karakter (**doğrulanmadı**, yalnızca arama özeti), Instagram'da 1000 bayt (UTF-8).
7. Pencere: müşterinin son mesajından sonraki 24 saat (Click-to-Messenger / Instagram reklamından gelen konuşmada 7 gün); sonrasında yalnızca temsilci `HUMAN_AGENT` etiketiyle 7 güne kadar.

### 5.5 Meta gelen kutusu ve uygulama aynı konuşmada (Conversation Routing)
Sayfanın Messenger ve Instagram mesajlarına hem **Meta Business Suite gelen kutusundan** (ya da Instagram / Facebook uygulamasından) hem **CRM'den / bottan** cevap verilebilir. Meta bunu **Conversation Routing** ile yönetir; eski Handover Protocol Messenger'da artık desteklenmiyor, Conversation Routing büyük ölçüde onunla uyumlu. Instagram DM'leri için de geçerli.
- **Varsayılan (ayarsız) durum:** sayfaya bağlı tüm uygulamalar webhook alır; "Take Thread Control" bir varsayılan uygulama seçilene kadar engellidir.
- **Ayar yeri:** Facebook sayfası ayarları › **Conversation Routing** sekmesi. Burada CRM uygulamasını varsayılan (default) uygulama seçebilirsin.
- **Gelen kutusu da bir uygulamadır:** Page Inbox'ın uygulama kimliği `263902037430900` (Meta'nın bir sayfasında `26390203743090` diye bir hane eksik yazıyor; P1.1 ikisini de tanımalı), Instagram gelen kutusununki `1217981644879628`. Gelen kutusundan cevap yazmak ya da konuşmayı "Ana" klasöre taşımak konuşmanın kontrolünü gelen kutusuna geçirir; bu sırada mesajlar uygulamaya `standby` olayı olarak gelir.
- **Elle yazılan cevaplar:** gelen kutusundan yazılan cevap uygulamaya `is_echo: true` ve `app_id` = gelen kutusu uygulaması olarak gelir. P1.1'de bu echo "temsilci yazdı" sayılır ve bot susar (değişmez kural 4); `standby` olayları da aynı şekilde işlenmeli.
- **Karar senin (yol haritası "Meta gelen kutusu kararı"):** ekip gelen kutusundan cevap vermeye devam edecekse Conversation Routing'i varsayılan bırakmak ya da CRM'i varsayılan seçmek ikisi de çalışır, bot her iki durumda echo / standby gördüğünde susar. Ekip yalnızca CRM'den cevap verecekse bunu ekibe duyur; gelen kutusundan yanlışlıkla yazılan cevap yine "temsilci yazdı" sayılır.

### 5.6 Gizlilik politikası ve veri silme
- **App settings › Basic** sayfasında **Privacy Policy URL** ve **User data deletion** alanı dolu olmalı. Meta iki seçenek sunar: **Data Deletion Instructions URL** (kullanıcının verisini nasıl sildireceğini anlatan sayfa) ya da **Data Deletion Request Callback URL** (Meta'nın `signed_request` ile çağırdığı, `{ url, confirmation_code }` dönen adres). App Review ve Live mod için bunlardan birinin zorunlu olduğu genel kabul; resmi sayfada bu kesin ifadeyle bulunamadı **(doğrulanmadı)**.
- Planlanan adres: `https://<canlı-alan-adı>/veri-silme` (P5.3 bu sayfayı ya da geri çağrıyı yazacak; gelen talep silme talebi kaydı açar ve telefon / IGSID / PSID ile eşleşen konuşmaları kapsar). P5.3'ten önce App Review'a girilecekse geçici olarak, silme talebinin hangi e-posta adresine yazılacağını anlatan statik bir sayfa yeterli.

### 5.7 App Review özeti

| Kanal | İzinler (Advanced Access) | Ek özellik |
|---|---|---|
| WhatsApp | `whatsapp_business_messaging`, `whatsapp_business_management` (kendi işletmen için App Review gerekmeyebilir) | — |
| Instagram (Facebook Login) | `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list` | Human Agent |
| Instagram (Instagram Login) | `instagram_business_basic`, `instagram_business_manage_messages` | Human Agent |
| Messenger | `pages_messaging`, `pages_manage_metadata` (+ `pages_show_list`) | Human Agent |

---

## 6. Anthropic API anahtarı ve harcama limiti

Bot katmanı P2.1'de gelecek. Bugün kodda `ANTHROPIC_API_KEY` kullanılmıyor. P2.1'e göre **anahtar yoksa bot kapalıdır**.

### 6.1 Anahtar
1. **console.anthropic.com**'da organizasyonu kur ve **Billing** altında ödeme yöntemini ekle (ön ödemeli kredi).
2. **Settings › Workspaces** altında bot için ayrı bir workspace aç (ör. `embedra-bot`). Böylece botun harcaması ve limiti diğer işlerden ayrı izlenir.
3. Bu workspace içinde **API Keys › Create Key**. Anahtarı (`sk-ant-…`) `ANTHROPIC_API_KEY` olarak kaydet. Console onu bir daha göstermez.
4. Yerel geliştirme ve production için ayrı anahtar kullan. Sızan anahtarı Console'dan hemen devre dışı bırak.
5. Model adı ortam değişkeni değildir. P2.1'e göre botun modeli ve effort ayarı tek bir yapılandırma dosyasında tutulacak. Yol haritası botta `claude-haiku-5-5` ile başlamayı, P5.1 değerlendirmesinden sonra Haiku 5.5 ile Sonnet 5.5 arasında karar vermeyi öngörüyor. Anthropic'in genel varsayılan modeli `claude-opus-5-5`'tir.

### 6.2 Harcama limiti
- **Organizasyon limiti:** Console › Settings › **Limits**. Aylık harcama limitini belirle; limite ulaşılınca API istekleri reddedilir.
- **Workspace limiti:** Settings › Workspaces › `embedra-bot` › **Limits**. Bot workspace'ine organizasyon limitinden düşük bir aylık harcama limiti koy. Gerekirse hız limitini de (rate limit) düşür.
- **Bildirim:** Limits sayfasında e-posta uyarı eşiklerini aç (ör. %50 ve %80).
- **Uygulama içi sınır:** P2.4'te Bot Ayarları'na günlük maliyet sınırı ve acil durdurma anahtarı eklenecek. Bu sınır aşılınca bot hiç çağrılmaz, konuşmalar insana kalır. Console limiti son güvenlik ağıdır, uygulama içi sınır ise ilk.

### 6.3 Test ve gerçek API
- Testler gerçek API'ye gitmez: `test/sahte/anthropic.ts` sahte sunucusu `ANTHROPIC_BASE_URL` ile kullanılır, `test/kurulum.ts` localhost dışındaki her isteği durdurur.
- Gerçek API'ye istek atan bir test ya da değerlendirme, önce tahmini maliyet söylenip onay alınmadan çalıştırılmaz (Değişmez kural 8).

---

## 7. Supabase ortam değişkenleri

Aktif proje: `wglfzzbzifszwkugamjj` (Frankfurt, `eu-central-1`). Değerler: Supabase panelinde **Project Settings › API Keys** ve **Data API**.

| Değişken | Nereden | Ne işe yarar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://<proje>.supabase.co`) | Tarayıcı, sunucu ve proxy istemcileri. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) | Oturumlu kullanıcı istemcisi. Herkese açıktır; güvenliği RLS sağlar. |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`; eski projelerde `service_role`) | **RLS'i atlar.** Yalnızca oturumsuz sunucu işlerinde kullanılır: Meta webhook'u, cihaz bildirimi, abonelikten çıkma, kampanya ve otomasyon zamanlayıcıları. Tanımlı değilse bu işler çalışmaz, zamanlayıcı bir kez uyarı yazar. |

Auth ayarları (Authentication › URL Configuration):
- **Site URL:** canlı adres (ör. `https://crm.embedra.net`). Bugün `http://localhost:3000`.
- **Redirect URLs:** `https://<canlı-alan-adı>/**` ekle; yerel geliştirme için `http://localhost:3000/**` kalabilir.
- Şifre kuralı: en az 8 karakter, harf ve rakam. Sızdırılmış şifre koruması yalnızca Pro planda var.

---

## 8. Tüm ortam değişkenleri

Bu liste `grep -rn "process.env"` ile koddan çıkarıldı (`node_modules`, `.next` hariç; 19 Kasım 2026).

### 8.1 Herkese açık (`NEXT_PUBLIC_`)
Bu değerler derleme sırasında tarayıcı paketine gömülür, yani gizli değildir. Değiştirince **yeniden deploy** gerekir.

| Değişken | Kullanıldığı yer | Not |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `server.ts`, `proxy.ts`, `admin.ts` | Zorunlu |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `lib/supabase/client.ts`, `server.ts`, `proxy.ts` | Zorunlu |

### 8.2 Gizli (Vercel'de Sensitive)

| Değişken | Kullanıldığı yer | Ne işe yarar | Tanımlı değilse |
|---|---|---|---|
| `SUPABASE_SECRET_KEY` | `lib/supabase/admin.ts` | RLS'i atlayan sunucu istemcisi | Webhook, cihaz bildirimi, abonelik ve zamanlayıcılar çalışmaz |
| `META_VERIFY_TOKEN` | `components/konusma/meta-webhook.ts` | Meta webhook doğrulaması (üç ürün için aynı) | `WHATSAPP_VERIFY_TOKEN`'a düşer; o da yoksa doğrulama 403 döner |
| `META_APP_SECRET` | `components/konusma/meta-webhook.ts` | Webhook imza kontrolü (Meta uygulamasının App Secret'ı) | `WHATSAPP_APP_SECRET`'e düşer; hiçbiri yoksa geliştirmede imzasız kabul, **production'da her istek 401** |
| `WHATSAPP_VERIFY_TOKEN` | `components/konusma/meta-webhook.ts` | Eski ad, geriye uyumluluk | `META_VERIFY_TOKEN` tanımlıysa kullanılmaz |
| `WHATSAPP_APP_SECRET` | `components/konusma/meta-webhook.ts` | Eski ad, geriye uyumluluk | `META_APP_SECRET` tanımlıysa kullanılmaz |
| `INSTAGRAM_APP_SECRET` | `components/konusma/meta-webhook.ts` | İsteğe bağlı ikinci imza anahtarı (Instagram Login, Bölüm 5.2); yalnızca `object: instagram` gövdelerinde kabul edilir, WhatsApp / Messenger bildirimini imzalayamaz | Yalnızca uygulama secret'ı denenir |
| `META_SAYFA_ID`, `META_SAYFA_TOKEN` | (P4.1 / P4.2) | Messenger ve Facebook Login yolunda Instagram gönderimi | Kanal demo / kapalı |
| `INSTAGRAM_HESAP_ID`, `INSTAGRAM_TOKEN` | (P4.1) | Instagram hesabı; token yalnızca Instagram Login yolunda | Kanal demo / kapalı |
| `WHATSAPP_TOKEN` | `lib/ileti-gonder.ts` | WhatsApp Cloud API ile gönderim | Demo modu (gönderilmez) |
| `WHATSAPP_PHONE_ID` | `lib/ileti-gonder.ts`, `components/whatsapp/isle.ts` | Gönderen numaranın kimliği; webhook'ta numara kimliği yoksa konuşmanın hesabı | Demo modu; konuşmalar `varsayilan` hesabında |
| `PORTAL_OTURUM_SECRET` | `components/portal/oturum.ts` | Bayi portalı oturum çerezini imzalar | Production'da hata fırlatır |
| `ABONELIK_SIRRI` | `lib/abonelik.ts` | Abonelikten çıkma bağlantısını imzalar | Production'da hata; geliştirmede demo sırrı |
| `CIHAZ_BILDIRIM_SIRRI` | `lib/cihaz-anahtari.ts`, `scripts/cihaz-simulator.mjs` | Cihaz anahtarlarını üretir ve doğrular. **Değiştirilirse sahadaki cihazların anahtarları geçersiz olur.** | Production'da hata; geliştirmede demo sırrı |
| `CRON_SECRET` | `lib/cron.ts` (`/api/zamanlayici`, `/api/kampanya-zamanlayici`, `/api/konusma/isleyici`) | Zamanlayıcı ve kuyruk işleyicisi çağrısının doğrulaması | Bu adresler her isteğe 401 döner; Vercel'de zamanlı işler ve konuşma kuyruğu çalışmaz |
| `RESEND_API_KEY` | `lib/ileti-gonder.ts` | Resend ile e-posta gönderimi | Demo modu |
| `ANTHROPIC_API_KEY` | (P2.1'de `components/bot/`) | Claude API | Bot kapalı |

### 8.3 Gizli olmayan sunucu ayarları
Tarayıcıya gitmez ama sır da değildir. Vercel'de normal (Sensitive olmayan) değişken olarak girilebilir.

| Değişken | Kullanıldığı yer | Ne işe yarar |
|---|---|---|
| `SITE_URL` | `instrumentation.ts`, `components/giris/actions.ts`, `components/pazarlama/actions.ts`, `components/otomasyon/actions.ts`, `app/api/zamanlayici/route.ts`, `app/api/kampanya-zamanlayici/route.ts` | Uygulamanın açık adresi: şifre sıfırlama ve e-posta onay bağlantıları, kampanya içindeki bağlantılar, zamanlayıcı. Sonunda `/` olmasın. Tanımlı değilse istekteki adres kullanılır. **Boş değer (`SITE_URL=`) girme:** bazı yerler `??` ile okuduğu için boş metin adres sanılır. |
| `EPOSTA_GONDEREN` | `lib/ileti-gonder.ts` | Gönderen, ör. `Embedra <bulten@embedra.net>`. Alan adı Resend'de doğrulanmış olmalı. |
| `WHATSAPP_SABLON_DILI` | `lib/ileti-gonder.ts` | Şablon dil kodu, isteğe bağlı (varsayılan `tr`). |

### 8.4 Yalnızca test ve araçlar
Production'da **tanımlanmamalı**.

| Değişken | Kullanıldığı yer | Ne işe yarar |
|---|---|---|
| `META_GRAPH_URL` | `lib/ileti-gonder.ts`, `test/sahte/meta.ts` | Graph API adresini sahte sunucuya yönlendirir (varsayılan `https://graph.facebook.com`) |
| `ANTHROPIC_BASE_URL` | `test/sahte/anthropic.ts` (Anthropic SDK'sı da okur) | Claude API adresini sahte sunucuya yönlendirir |
| `CRM_ADRESI` | `scripts/cihaz-simulator.mjs` | `npm run cihaz-bildir` simülatörünün hedefi (varsayılan `http://localhost:3000`) |

### 8.5 Platformun kendi değişkenleri
Elle girilmez: `NODE_ENV`, `NEXT_RUNTIME`, `VERCEL` (Vercel'de tanımlıysa yerleşik zamanlayıcı kapanır), `PORT`.

### Rastgele sır üretme
`PORTAL_OTURUM_SECRET`, `ABONELIK_SIRRI`, `CIHAZ_BILDIRIM_SIRRI`, `CRON_SECRET` ve `META_VERIFY_TOKEN` için her biri ayrı olacak şekilde:

```bash
openssl rand -base64 48
```

---

## 9. Vercel

### 9.1 Değişkenleri girme
1. Vercel › Proje › **Settings › Environment Variables**.
2. Bölüm 8.2'deki her değişkeni **Sensitive** işaretiyle ekle. Sensitive değişkenler kaydedildikten sonra panelde bir daha okunamaz, yalnızca değiştirilebilir. Değerin bir kopyasını parola yöneticinde sakla.
3. Production ile Preview için ayrı değer kullan. Özellikle `WHATSAPP_TOKEN` ve `ANTHROPIC_API_KEY` Preview'da ya hiç olmasın (demo modu, bot kapalı) ya da ayrı, düşük limitli bir anahtar olsun.
4. Değişken ekledikten veya değiştirdikten sonra **yeniden deploy** et. Mevcut deploy eski değerlerle çalışmaya devam eder.

### 9.2 Özet: hangisi gizli?

| Sensitive (gizli) | Normal |
|---|---|
| `SUPABASE_SECRET_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_SAYFA_TOKEN`, `INSTAGRAM_TOKEN`, `INSTAGRAM_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_ID`*, `PORTAL_OTURUM_SECRET`, `ABONELIK_SIRRI`, `CIHAZ_BILDIRIM_SIRRI`, `CRON_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SITE_URL`, `EPOSTA_GONDEREN`, `WHATSAPP_SABLON_DILI`, `META_SAYFA_ID`, `INSTAGRAM_HESAP_ID` |

\* `WHATSAPP_PHONE_ID` tek başına sır değildir, ama token ile birlikte gönderim yetkisini tamamladığı için gizli tutmak zararsızdır.

### 9.3 Zamanlayıcılar
- Zamanlı işler iki tanedir: **kampanya** gönderimleri (planlı / sürekli kampanyalar) ve **otomasyon** kuralları. İkisi de `GET /api/zamanlayici` adresinden tek çağrıyla çalışır. Biri hata verirse diğeri yine çalışır; yanıt 500 olur ve hangisinin hata verdiği yanıtta görünür.
- Geliştirmede ve kendi sunucunda (`next start`) `instrumentation.ts` bu işleri dakikada bir çalıştırır. Vercel'de (`VERCEL` tanımlı) bu döngü kapalıdır, işi Vercel Cron yapar.
- **Vercel Cron:** `vercel.json` bu adresi her gün **06:00 UTC'de (09:00 TSİ)** çağırır. Vercel, `CRON_SECRET` tanımlıysa `Authorization: Bearer <CRON_SECRET>` başlığını kendisi ekler. Ayrıca bir şey kurman gerekmez; deploy sonrası Vercel › Proje › **Settings › Cron Jobs** sayfasında görünür, oradan elle de tetiklenebilir.
- **Hobby plan sınırı:** cron günde en fazla bir kez çalışır (Vercel, saat içinde dakikayı kendisi kaydırabilir). Bu yüzden Vercel'de planlı bir kampanya, zamanı geldikten sonraki ilk sabah gönderilir; otomasyon kuralları da günde bir kez değerlendirilir. Daha sık gerekiyorsa iki yol var:
  - **Supabase `pg_cron` + `pg_net`:** veritabanından dakikada / saatte bir `GET https://<canlı-alan-adı>/api/zamanlayici` çağrısı, aynı başlıkla. `CRON_SECRET` değerini Supabase Vault'ta sakla, SQL'e düz metin yazma.
  - **Harici zamanlayıcı** (ör. bir uptime / cron servisi): aynı adres ve başlık.
  - Pro plana geçersen `vercel.json`'daki `schedule` değerini `* * * * *` yapman yeterli.
- Otomasyon motoru kendi kilidini tutar: iki çağrı aynı anda gelirse ikincisi otomasyonu atlar (yanıtta `"otomasyon": null`). Kampanya tarafında planlı kampanya bir kez çalışır (çalışınca zamanlaması kaldırılır); sürekli kampanya her turda yalnızca kitlede kalan kişilere gönderir.
- Konuşma kuyruğu işleyicisi (P1.1) saniyeler mertebesinde çalışmalı; günlük Vercel Cron bunun için **uygun değildir**, Bölüm 9.4.

### 9.4 Konuşma işleyicisi (Supabase pg_cron)

Webhook Meta'ya hızlı 200 dönmek için mesajı yalnızca kaydeder ve `konusma_isleri` kuyruğuna yazar; fırsat eşleştirme, yeni lead ve (P2.1'de) bot cevabı **işleyicide** yapılır (`components/konusma/kuyruk.ts`, `POST /api/konusma/isleyici`). Aynı konuşmanın işleri konuşma kilidiyle sırayla işlenir; birden fazla çağrının üst üste binmesi güvenlidir.

**Neden pg_cron:** Vercel Hobby cron günde bir kez çalışır (Pro'da bile en sık dakikada bir); Supabase Cron saniye aralıklı iş kurabiliyor (supabase.com/docs/guides/cron), projede zaten var, ek hesap ya da sır gerektirmez. Kuyruk servisi (ör. QStash) ayrı hesap, ayrı imza doğrulaması ve ek maliyet demek; bugünkü hacimde gerekmiyor. Webhook ayrıca `after()` ile işleyiciyi yanıt gittikten sonra bir kez dürtür; bu çoğu mesajı anında işler ama sunucusuz ortamda garanti değildir, asıl güvence cron'dur.

Kurulum (Supabase › SQL Editor; `pg_cron` ve `pg_net` eklentileri Database › Extensions'tan açık olmalı). Değerleri Vault'a koy, SQL'e düz metin yazma:

```sql
select vault.create_secret('https://<canlı-alan-adı>/api/konusma/isleyici', 'konusma_isleyici_url');
select vault.create_secret('<CRON_SECRET değeri>', 'cron_secret');

select cron.schedule(
  'konusma-isleyici',
  '10 seconds',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'konusma_isleyici_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);
```

- Kontrol: `select * from cron.job_run_details order by start_time desc limit 5;` ve `select status_code, error_msg from net._http_response order by created desc limit 5;` (200 beklenir; 401 → `CRON_SECRET` uyuşmuyor).
- Durdurmak: `select cron.unschedule('konusma-isleyici');`
- Takılan işler: `select durum, count(*) from public.konusma_isleri group by 1;` 5 denemede başaramayan iş `hata` durumunda kalır, `son_hata` sütununda nedeni (müşteri metni içermez) yazar.
- Geliştirmede ve `next start` ile `instrumentation.ts` işleyiciyi 5 saniyede bir zaten çalıştırır; pg_cron gerekmez. pg_cron'un saniye aralıklı schedule biçimi (`'10 seconds'`) Supabase belgesinde "every second" olarak geçiyor; canlıda ilk kurulumda `cron.job_run_details`'ten çalıştığını doğrula.

---

## 10. Kontrol: kurulum çalışıyor mu?

- **Supabase:** CRM'e giriş yap ve satış hattının açıldığını gör.
- **Webhook doğrulaması:** Meta panelinde "Verify and save" başarılı olmalı.
- **Gelen mesaj:** Kayıtlı test numarasından işletme numarasına yaz. Mesaj birkaç saniye içinde satış hattında bir fırsatın altında görünmeli. Görünmezse Vercel loglarında `/api/meta/webhook` isteğinin durum koduna bak: 401 imza / `META_APP_SECRET` sorunudur, 500 genellikle `SUPABASE_SECRET_KEY` eksikliğidir.
- **Instagram / Messenger (P4 öncesi):** sayfaya ya da Instagram hesabına bir DM at. Vercel loglarında `[meta-webhook] messenger bildirimi henüz işlenmiyor: message×1` (ya da `instagram`) satırı görünmeli; görünmüyorsa sayfanın `subscribed_apps` aboneliğini ve webhook alanlarını kontrol et.
- **Gönderim:** Pazarlama'da kampanya gönderim penceresinde "Demo modu: … anahtarı tanımlı değil" uyarısı **görünmemeli**. Görünüyorsa ilgili anahtarlar eksik. Kendi numarana bir deneme mesajı gönder.
- **Zamanlayıcı:** `/api/zamanlayici` adresini `CRON_SECRET` ile elle çağır (ya da Vercel › Cron Jobs › Run). `{"ok":true,"kampanya":…,"otomasyon":…}` dönmeli; başlıksız çağrı 401 dönmeli.

### Kaynaklar (Meta, 19 Kasım 2026'da okundu)
- Webhook doğrulama ve imza: developers.facebook.com/docs/graph-api/webhooks/getting-started, /docs/messenger-platform/webhooks
- Instagram webhook örnekleri ve alanları: developers.facebook.com/documentation/instagram-platform/webhooks/examples, …/webhooks/fields
- Instagram giriş yolları: developers.facebook.com/documentation/instagram-platform/overview
- Messenger gönderim: developers.facebook.com/docs/messenger-platform/send-messages
- Conversation Routing: developers.facebook.com/documentation/business-messaging/messenger-platform/conversation-routing
- Mesajlaşma politikası (pencere, etiketler): developers.facebook.com/documentation/business-messaging/messenger-platform/policy
- WhatsApp mesaj webhook'u: developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages
- Veri silme geri çağrısı: developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
