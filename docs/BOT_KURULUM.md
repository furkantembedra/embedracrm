# Embedra CRM ve AI satış botu: kurulum rehberi

Bu belge, CRM'i ve WhatsApp / Instagram satış botunu canlıya almak için gereken hesap, anahtar ve ortam değişkeni adımlarını anlatır. Kod bilgisi gerekmez. Değişkenlerin şablonu `.env.example` dosyasındadır.

> Bu belgeye hiçbir gerçek anahtar yazılmaz. Anahtarlar yalnızca `.env.local` dosyasına (bilgisayarında) ve Vercel'deki ortam değişkenlerine girilir. `.env.local` git'e eklenmez.

Son güncelleme: 19 Kasım 2026 (P0.4). Panellerdeki menü adları Meta, Anthropic ve Vercel tarafında zaman zaman değişir. Burada yazandan farklı görürsen en yakın karşılığını seç.

---

## 1. Senin yapman gerekenler (kontrol listesi)

Sıra önemli: Meta işletme doğrulaması ve Instagram App Review günler, hatta haftalar sürebilir. Bu yüzden en başta başlat.

**Meta / WhatsApp**
- [ ] Meta Business hesabında **işletme doğrulamasını** tamamla (Business Settings › Security Center). Kalıcı token ve App Review bu olmadan ilerlemez.
- [ ] developers.facebook.com'da **Business** türünde bir Meta uygulaması oluştur ve ona **WhatsApp** ürününü ekle (Bölüm 2.1).
- [ ] WhatsApp Business hesabına (WABA) **gerçek telefon numarasını** ekle, doğrula, görünen adı onaylat (Bölüm 2.2).
- [ ] **App Secret** değerini al → `WHATSAPP_APP_SECRET`.
- [ ] Uzun ve rastgele bir **doğrulama token'ı** belirle → `WHATSAPP_VERIFY_TOKEN`.
- [ ] **Phone number ID** değerini al → `WHATSAPP_PHONE_ID`.
- [ ] Bir **System User** oluştur ve süresiz token üret → `WHATSAPP_TOKEN` (Bölüm 4).
- [ ] Webhook adresini gir, doğrula ve `messages` alanına abone ol (Bölüm 3).
- [ ] Pazarlama gönderimleri için mesaj şablonlarını Meta'da onaylat (Bölüm 2.3).

**Instagram (Faz 4; başvuruyu Faz 1 sırasında başlat)**
- [ ] Instagram hesabını **Professional** (İşletme) hesaba çevir ve bir Facebook sayfasına bağla.
- [ ] Gerekli izinler için **App Review** başvurusunu yap (Bölüm 5).

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

---

## 2. Meta uygulaması ve WhatsApp Business numarası

### 2.1 Uygulama
1. developers.facebook.com › **My Apps › Create App**. Uygulama türü olarak **Business** seç ve uygulamayı Embedra'nın Business hesabına bağla.
2. Uygulama panelinde **Add product › WhatsApp › Set up**. Meta bu adımda bir test WABA'sı ve test numarası açar. Geliştirme için yeterlidir.
3. **App settings › Basic** sayfasındaki **App Secret** değerini (Show'a basarak) `WHATSAPP_APP_SECRET` olarak kaydet. Gelen her webhook isteğinin `X-Hub-Signature-256` imzası bu değerle doğrulanır.
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

CRM'de Meta ve diğer sistemlerden gelen çağrılar için beş açık adres vardır. Hepsi `lib/supabase/proxy.ts` içindeki `ACIK_YOLLAR` listesinde tanımlıdır, yani giriş istemezler. Her biri kendi doğrulamasını yapar.

| Adres | Kim çağırır | Nasıl doğrulanır |
|---|---|---|
| `GET /api/whatsapp/webhook` | Meta (kurulumda bir kez) | `hub.verify_token` değeri `WHATSAPP_VERIFY_TOKEN` ile aynıysa `hub.challenge` geri döner, değilse 403. |
| `POST /api/whatsapp/webhook` | Meta (her mesajda) | `X-Hub-Signature-256` imzası `WHATSAPP_APP_SECRET` ile kontrol edilir; geçersizse 401. |
| `GET/POST /api/abonelik?t=…` | Kampanya e-postasındaki "abonelikten çık" bağlantısı | Jeton `ABONELIK_SIRRI` ile imzalanmıştır, başkası adına uydurulamaz. |
| `POST /api/cihaz-bildirimi` | ONESuite (cihaz) | Seri numarasından `CIHAZ_BILDIRIM_SIRRI` ile üretilen cihaz anahtarı. `GET` isteği ise oturum ister. |
| `GET /api/zamanlayici` | Vercel Cron (`vercel.json`) ya da harici zamanlayıcı | `Authorization: Bearer <CRON_SECRET>` başlığı. Kampanya ve otomasyonu birlikte çalıştırır. |
| `GET /api/kampanya-zamanlayici` | Harici zamanlayıcı (yalnızca kampanya) | `Authorization: Bearer <CRON_SECRET>` başlığı. |

### WhatsApp webhook'unu bağlama
1. Uygulama panelinde **WhatsApp › Configuration › Webhook › Edit**.
2. **Callback URL:** `https://<canlı-alan-adı>/api/whatsapp/webhook`. Meta yalnızca geçerli sertifikalı HTTPS kabul eder, yani `localhost` çalışmaz. Yerelde denemek istersen bir tünel (ör. ngrok, cloudflared) kullanabilirsin.
3. **Verify token:** `WHATSAPP_VERIFY_TOKEN` değerinin aynısı. Bu değeri sen belirlersin; uzun ve rastgele olsun.
4. **Verify and save.** Meta bu adımda yukarıdaki `GET` isteğini atar. Değişken sunucuda tanımlı değilse doğrulama 403 ile başarısız olur, o yüzden önce Vercel'e girip yeniden deploy et.
5. **Webhook fields** listesinde **messages** alanına abone ol (Subscribe).
6. Davranış: Meta, 200 almadığı bildirimi tekrar gönderir. Aynı mesaj kimliği (`dis_mesaj_id` UNIQUE) ikinci kez işlenmez. Okundu ve iletildi gibi durum bildirimleri bugün atlanıyor; P1.2'de işlenecek.
7. Geliştirmede `WHATSAPP_APP_SECRET` tanımlı değilse imzasız istek kabul edilir. **Production'da secret yoksa her istek reddedilir.**

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

## 5. Instagram Messaging: izinler ve App Review

Instagram kanalı Faz 4'te (P4.1) gelecek. App Review uzun sürdüğü için başvuruyu P1.1 sırasında başlat.

### 5.1 Ön koşullar
- Instagram hesabı **Professional** (İşletme veya İçerik Üreticisi) olmalı ve bir **Facebook sayfasına** bağlı olmalı.
- Instagram uygulamasında **Ayarlar › Mesajlar ve hikâye yanıtları › Bağlı araçlar › Mesajlara erişime izin ver** açık olmalı.
- Meta işletme doğrulaması tamamlanmış olmalı.
- Meta uygulamasına **Instagram** ürünü eklenmeli. Webhook'ta `messages` alanına abone olunacak; adres P4.1'de `app/api/instagram/webhook` olarak eklenecek.

### 5.2 İzinler
Meta'nın iki giriş yolu var. Hangisinin kullanılacağına P4.1'de karar verilecek. Başvurudan önce güncel dokümanı kontrol et.

| Yol | Gereken izinler |
|---|---|
| Instagram API with **Instagram Login** (önerilen, yeni yol) | `instagram_business_basic`, `instagram_business_manage_messages` |
| Instagram API with **Facebook Login** (sayfa üzerinden) | `instagram_basic`, `instagram_manage_messages`, `pages_show_list`, `pages_manage_metadata`, `business_management` |

Ek özellik: **Human Agent** (`human_agent` etiketi). Temsilcinin CRM'den 24 saat sonrası 7 güne kadar cevap verebilmesi için ayrıca istenir. Değişmez kural gereği **bot bu etiketi asla kullanmaz**; yalnızca insan temsilcinin mesajlarında kullanılır.

### 5.3 App Review adımları
1. Uygulama panelinde **App Review › Permissions and Features**. Yukarıdaki izinler için **Advanced Access** iste.
2. Her izin için kullanım açıklaması yaz: "Müşterilerin Instagram DM'lerine CRM'deki satış ekibi ve bir yapay zekâ asistanı cevap verir. Asistan kendini tanıtır ve her zaman insana devreder."
3. Her izin için bir **ekran kaydı** (screencast) yükle. Kayıtta şunlar görünmeli:
   - Instagram hesabıyla giriş ve izin onayı ekranı.
   - Instagram'dan gönderilen bir DM'in CRM'de belirmesi.
   - CRM'den cevap yazılması ve cevabın Instagram'da görünmesi.
   - Botun asistan olduğunu söylemesi ve "insanla konuşmak istiyorum" denince devretmesi.
   - Ayrıntılı ekran kaydı adımları P4.1'de bu belgeye eklenecek.
4. Test için bir Instagram test kullanıcısı ve gerekirse CRM giriş bilgisi ver (gerçek müşteri verisi olmadan).
5. Gizlilik politikası adresi ve veri silme talimatı (Data Deletion Instructions URL) dolu olmalı.
6. Başvuruyu gönder. Reddedilirse gerekçeye göre ekran kaydını düzelt ve yeniden başvur.

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
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`; eski projelerde `service_role`) | **RLS'i atlar.** Yalnızca oturumsuz sunucu işlerinde kullanılır: WhatsApp webhook'u, cihaz bildirimi, abonelikten çıkma, kampanya ve otomasyon zamanlayıcıları. Tanımlı değilse bu işler çalışmaz, zamanlayıcı bir kez uyarı yazar. |

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
| `WHATSAPP_VERIFY_TOKEN` | `app/api/whatsapp/webhook/route.ts` | Meta webhook doğrulaması | Doğrulama 403 döner |
| `WHATSAPP_APP_SECRET` | `app/api/whatsapp/webhook/route.ts` | Webhook imza kontrolü | Geliştirmede imzasız kabul; **production'da her istek 401** |
| `WHATSAPP_TOKEN` | `lib/ileti-gonder.ts` | WhatsApp Cloud API ile gönderim | Demo modu (gönderilmez) |
| `WHATSAPP_PHONE_ID` | `lib/ileti-gonder.ts` | Gönderen numaranın kimliği | Demo modu |
| `PORTAL_OTURUM_SECRET` | `components/portal/oturum.ts` | Bayi portalı oturum çerezini imzalar | Production'da hata fırlatır |
| `ABONELIK_SIRRI` | `lib/abonelik.ts` | Abonelikten çıkma bağlantısını imzalar | Production'da hata; geliştirmede demo sırrı |
| `CIHAZ_BILDIRIM_SIRRI` | `lib/cihaz-anahtari.ts`, `scripts/cihaz-simulator.mjs` | Cihaz anahtarlarını üretir ve doğrular. **Değiştirilirse sahadaki cihazların anahtarları geçersiz olur.** | Production'da hata; geliştirmede demo sırrı |
| `CRON_SECRET` | `lib/cron.ts` (`/api/zamanlayici`, `/api/kampanya-zamanlayici`) | Zamanlayıcı çağrısının doğrulaması | Zamanlayıcı adresleri her isteğe 401 döner, Vercel'de zamanlı işler çalışmaz |
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
`PORTAL_OTURUM_SECRET`, `ABONELIK_SIRRI`, `CIHAZ_BILDIRIM_SIRRI`, `CRON_SECRET` ve `WHATSAPP_VERIFY_TOKEN` için her biri ayrı olacak şekilde:

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
| `SUPABASE_SECRET_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_ID`*, `PORTAL_OTURUM_SECRET`, `ABONELIK_SIRRI`, `CIHAZ_BILDIRIM_SIRRI`, `CRON_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SITE_URL`, `EPOSTA_GONDEREN`, `WHATSAPP_SABLON_DILI` |

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
- P1.1'deki kuyruk işleyicisi (bot cevapları) dakikalık değil saniyeler mertebesinde tetiklenmeli; günlük Vercel Cron bunun için **uygun değildir**. P1.1'de pg_cron ya da bir kuyruk servisi seçilecek.

---

## 10. Kontrol: kurulum çalışıyor mu?

- **Supabase:** CRM'e giriş yap ve satış hattının açıldığını gör.
- **Webhook doğrulaması:** Meta panelinde "Verify and save" başarılı olmalı.
- **Gelen mesaj:** Kayıtlı test numarasından işletme numarasına yaz. Mesaj birkaç saniye içinde satış hattında bir fırsatın altında görünmeli. Görünmezse Vercel loglarında `/api/whatsapp/webhook` isteğinin durum koduna bak: 401 imza / `WHATSAPP_APP_SECRET` sorunudur, 500 genellikle `SUPABASE_SECRET_KEY` eksikliğidir.
- **Gönderim:** Pazarlama'da kampanya gönderim penceresinde "Demo modu: … anahtarı tanımlı değil" uyarısı **görünmemeli**. Görünüyorsa ilgili anahtarlar eksik. Kendi numarana bir deneme mesajı gönder.
- **Zamanlayıcı:** `/api/zamanlayici` adresini `CRON_SECRET` ile elle çağır (ya da Vercel › Cron Jobs › Run). `{"ok":true,"kampanya":…,"otomasyon":…}` dönmeli; başlıksız çağrı 401 dönmeli.
