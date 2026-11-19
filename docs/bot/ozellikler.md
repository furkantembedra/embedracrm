# ONESuite ve cihaz özellikleri (bot bilgi bankası)

> **Durum (19 Kasım 2026):** embedra.net'ten çıkarıldı, plan ve cihaz bilgileri Embedra'nın cevaplarıyla netleştirildi. `lib/urun-bilgisi.ts` içindeki `OZELLIK_KATALOGU` yalnızca bu belgeden doldurulur; belge değişirse katalog da elle güncellenir.
> **Katalogda olmayanlar:** `?` kalan özellikler (şu an ONEAssist) ve "Katalog dışı" bölümü. Bot bunlar sorulunca plan önermez, satışçıya devreder.
>
> - Her özelliğin bilgisi sitedeki kaynak sayfadan alındı; kaynak her başlığın altında yazıyor.
> - **"Müşteri nasıl söyler"** maddeleri sitede yok. Bunlar Claude'un önerisidir ve `(TASLAK)` ile işaretlidir; kataloğa model için ipucu olarak girdi, plan kararını etkilemez. Lütfen gerçek müşteri cümleleriyle düzeltin.
> - `?` olan yerler sitede net değil ya da sayfalar birbiriyle çelişiyor. Belgenin sonundaki "Açık sorular" bölümünde toplandı.
> - Fiyat ve lisansın kapsadığı cihaz sayısı burada tutulmaz; Operasyon › Ayarlar'daki fiyat listesinden okunur.
>
> **Plan sırası:** Basic → Pro → Pro+ → Premium → Enterprise. Üst plan alttakinin tüm özelliklerini kapsar. Sitedeki dayanaklar:
> - Pro+ "everything in Pro" (ana sayfa SSS'si)
> - Enterprise "All Premium features" (fiyat sayfası)
> - Pro+ ve Pro aynı özellik listesine sahip (fiyat sayfası); fark yalnızca cihaz sayısı: Pro+ = Pro'ya ek 2 cihaz, toplam 3 cihaz (onaylandı).
>
> **Basic'in tamamı (onaylandı):** 1 cihaz · temel direksiyon testi · CAN · K-Line · yılda bir kez 30 güne kadar dondurma. Basic'te bunların dışında hiçbir şey yok; hata kodu okuma/silme, canlı veri, test raporu Basic'te değil.

Kaynak sayfalar:
- [Fiyat](https://embedra.net/pricing)
- [Ürün](https://embedra.net/product)
- [Ana sayfa](https://embedra.net/)
- [SSS](https://embedra.net/faq)
- [Özel fonksiyonlar](https://embedra.net/special-functions)

---

## Lisans planına bağlı özellikler

### Temel direksiyon testi
- **Kimlik:** temel-direksiyon-testi
- **Açıklama:** Direksiyon ünitesini tezgâhta test etme ve onarım sonrası doğrulama. Sitedeki adı "Basic steering test".
- **En düşük plan:** Basic
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Arada bir gelen direksiyon kutularını tezgâhta test etmek istiyorum" (TASLAK)
  - "Tamirden sonra kutunun çalıştığını müşteriye vermeden kontrol edeyim" (TASLAK)
- **Kaynak:** pricing (Basic kartı ve "BASIC" açıklaması)

### CAN protokolü desteği
- **Kimlik:** can-protokolu
- **Açıklama:** CAN haberleşmeli direksiyon ECU'larıyla çalışma.
- **En düşük plan:** Basic
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Elime gelen araçların çoğu CAN'lı" (TASLAK)
- **Kaynak:** pricing

### K-Line protokolü desteği
- **Kimlik:** k-line-protokolu
- **Açıklama:** K-Line haberleşmeli direksiyon ECU'larıyla çalışma.
- **En düşük plan:** Basic
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Eski model araçlar da geliyor, K-Line lazım" (TASLAK)
- **Kaynak:** pricing

### CAN-FD protokolü desteği
- **Kimlik:** can-fd-protokolu
- **Açıklama:** CAN-FD haberleşmeli direksiyon ECU'larıyla çalışma.
- **En düşük plan:** Pro
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Yeni nesil araçlarla da çalışacak mı, CAN-FD var mı?" (TASLAK)
- **Kaynak:** pricing (Basic'te yok, Pro'da var; "PRO" açıklaması: "full protocol coverage including CAN-FD and FlexRay")

### FlexRay protokolü desteği
- **Kimlik:** flexray-protokolu
- **Açıklama:** FlexRay haberleşmeli direksiyon ECU'larıyla çalışma.
- **En düşük plan:** Pro
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "BMW/Audi'lerde FlexRay'li kutular geliyor" (TASLAK)
- **Kaynak:** pricing

### Arıza teşhisi (Diagnostics)
- **Kimlik:** ariza-teshisi
- **Açıklama:** Tam arıza teşhisi: hata kodlarını okuma, yorumlama ve silme. Ana sayfa SSS'sinde "Pro unlocks full diagnostics" deniyor.
- **En düşük plan:** Pro
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Arızanın nereden geldiğini bulmak istiyorum" (TASLAK)
  - "Hata kodlarını okuyup silebilecek miyim?" (TASLAK)
- **Kaynak:** pricing, ana sayfa SSS 4, product ("Fault Code Management")
- **Not:** Basic'te hata kodu işlemi olmadığı onaylandı. Ürün sayfasındaki "Fault Code Management" bu özelliğe bağlandı (Açık soru 9).

### Canlı veri (Live data)
- **Kimlik:** canli-veri
- **Açıklama:** ECU'dan gerçek zamanlı veri akışı: voltaj, akım, sinyaller ve hata kodları anlık izlenir.
- **En düşük plan:** Pro
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Kutu çalışırken değerleri canlı görmek istiyorum" (TASLAK)
  - "Tork sensörü değerlerini izleyebilir miyim?" (TASLAK)
- **Kaynak:** pricing, product ("Real-time Monitoring")

### Flash (yazılım yükleme)
- **Kimlik:** flash
- **Açıklama:** Direksiyon ECU'suna yazılım (firmware) güncelleme. Yalnızca desteklenen modellerde çalışır; liste güncellenebilir.
- **En düşük plan:** Pro
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Kutuya yazılım atmam lazım" (TASLAK)
  - "Değişen kutuya yazılım yükleyebilir miyim?" (TASLAK)
- **Kaynak:** pricing ("*Flashing is available for supported models and may be updated."), product ("Flash & Program")

### Programlama
- **Kimlik:** programlama
- **Açıklama:** Kalibrasyon verisi yazma ve direksiyon modülünü yeniden programlama.
- **En düşük plan:** Pro
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Kalibrasyon yazmam gerekiyor" (TASLAK)
- **Kaynak:** pricing, product ("write calibration data and reprogram steering modules")

### Özel fonksiyonlar
- **Kimlik:** ozel-fonksiyonlar
- **Açıklama:** Marka ve modele özel işlemler; normalde yalnızca OEM cihazlarıyla yapılabilen görevler. Örnek: VIN yazma, EEPROM okuma/yazma, belirli hata kodlarını silme, sağ/sol direksiyon dönüşümü. Modülerdir, araca göre değişir, her güncellemeyle yenileri eklenir.
- **En düşük plan:** Pro
- **Cihaz:** Yalnızca ONE (onaylandı; ONE Lite'ta yok)
- **Müşteri nasıl söyler:**
  - "Kutu değişince VIN yazmam lazım" (TASLAK)
  - "Focus'ta U3000 hatası var, çözebiliyor musunuz?" (TASLAK)
  - "Sağdan direksiyonluya çevirmem gerekiyor" (TASLAK)
- **Kaynak:** product ("*Available on Pro, Pro+, Premium and Enterprise plans."), special-functions
- **Not:** Sitedeki 18 fonksiyon (kod: ad): VW-G56-EEP Golf 5/6 EEPROM R/W · VW-PB8-DVI Passat B8 DEV CODE 1 Fault Clear · VW-P4-ASCD Polo IV Angle Sensor Coding · OP-AJ-VIN Astra J VIN Rewrite · OP-VC-PCD Vectra C Pump Coding · RN-GRP-VINVG Renault VIN & Virginize · FD-FM3-EEP Focus Mk3 EEPROM R/W (U3000 Fix) · FT-EGT-PCAL Egea/Tipo Proxy Calibration · FT-EGT-C1009 Egea C1009 Fault Erase · VW-G7-PFLHD Golf MkVII P-Flash RHD/LHD · FD-VBF-FLSH VBFflasher Ford ECU Programmer · FD-ASB-WRT Ford AsBuilt Writer · BMW-FS-VCD BMW F-Series VIN & Coding · VAG-UF-FLSH VAG Universal Flasher · VW-CRF-SFLSH Crafter Special Flash · PR-MCN-SFLSH Macan (95B) Special Flash · VW-T6-SFLSH Transporter T6 Special Flash · FD-RNG-EEPTQ Ranger EB/JB EEPROM & Torque Calibration. Hangi aracın hangi fonksiyonu desteklediği `uyumluluk.md`'ye girecek.

### ONEAssist (yapay zekâ teşhis asistanı)
- **Kimlik:** oneassist
- **Açıklama:** ONESuite'e gömülü yapay zekâ asistanı. Canlı ECU verisini analiz eder, arıza örüntülerini tanır, kök nedene yönlendirir ve onarım önerir. Otonom modda testten hata kodu okumaya ve kök neden analizine kadar tüm süreci kendisi yürütür; gerekirse flash işlemini de kendisi yapar.
- **En düşük plan:** Premium
- **Cihaz:** ? (sitede belirtilmemiş, Açık soru 8; cevaplanana kadar katalogda yok)
- **Müşteri nasıl söyler:**
  - "Günde onlarca kutu geliyor, teşhisi hızlandırmam lazım" (TASLAK)
  - "Teknisyen beklemeden cihaz kendisi arızayı bulsun" (TASLAK)
- **Kaynak:** faq ("ONEAssist is available on Premium and Enterprise plans."), product, pricing ("PREMIUM" açıklaması)

### Onarım dokümanları
- **Kimlik:** onarim-dokumanlari
- **Açıklama:** Onarım dokümanlarına erişim. Sitede yalnızca Premium açıklamasında "repair documents" diye geçiyor; içeriği tarif edilmemiş.
- **En düşük plan:** Premium
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Onarım adımlarını anlatan doküman var mı?" (TASLAK)
- **Kaynak:** pricing ("PREMIUM" açıklaması)

### Öncelikli destek talebi
- **Kimlik:** oncelikli-destek
- **Açıklama:** Destek taleplerine öncelik verilir.
- **En düşük plan:** Premium
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Sorun olursa beklemeden destek alabilir miyim?" (TASLAK)
- **Kaynak:** pricing ("priority ticket support")

### Özel hesap yöneticisi
- **Kimlik:** hesap-yoneticisi
- **Açıklama:** Müşteriye atanmış bir hesap yöneticisi.
- **En düşük plan:** Enterprise
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "Distribütörüz, bizimle ilgilenecek bir muhatap istiyoruz" (TASLAK)
- **Kaynak:** pricing (Enterprise kartı)

### Özel cihaz sayısı ve kurulum
- **Kimlik:** ozel-kurulum
- **Açıklama:** Cihaz sayısı, kurulum ve koşullar müşteriye göre belirlenir.
- **En düşük plan:** Enterprise
- **Cihaz:** Her ikisi
- **Müşteri nasıl söyler:**
  - "20 cihazlık bir servis ağımız var" (TASLAK)
- **Kaynak:** pricing (Enterprise kartı: "Custom device count", "Custom deployment")

---

## Cihaza bağlı özellikler (lisanstan bağımsız)

Bunlar planla değil cihaz modeliyle ilgili. Katalogda en düşük plan "Basic", cihaz koşulu "Yalnızca ONE" olarak tutulur. Kaynak: product sayfasındaki ONE / ONELite karşılaştırma tablosu.

### Bilgisayarsız kullanım
- **Kimlik:** bilgisayarsiz-kullanim
- **Açıklama:** Cihazın kendi ekranı ve sesli komutla bilgisayara bağlanmadan test yapma.
- **En düşük plan:** Basic
- **Cihaz:** Yalnızca ONE
- **Müşteri nasıl söyler:**
  - "Her seferinde laptop bağlamak istemiyorum" (TASLAK)
  - "Cihaz tek başına çalışabiliyor mu?" (TASLAK)
- **Kaynak:** product ("PC-Free Operation": ONE ✓, ONELite ✗)

### Dokunmatik ekran
- **Kimlik:** dokunmatik-ekran
- **Açıklama:** Cihaz üzerindeki dokunmatik ekran voltajı, akımı ve bağlantı durumunu anlık gösterir.
- **En düşük plan:** Basic
- **Cihaz:** Yalnızca ONE
- **Müşteri nasıl söyler:**
  - "Cihazın üstünde ekran var mı?" (TASLAK)
- **Kaynak:** pricing ("ONE LITE … Doesn't include AMOLED touchscreen"), product
- **Not:** Ekran türü bir yerde AMOLED, bir yerde OLED yazıyor (Açık soru 3).

### Kablosuz ve Ethernet bağlantısı
- **Kimlik:** kablosuz-baglanti
- **Açıklama:** Bilgisayara Wi-Fi, Bluetooth ya da Ethernet ile bağlanma; cihazı atölyenin başka yerinden yönetme. ONE Lite yalnızca USB-C ile bağlanır.
- **En düşük plan:** Basic
- **Cihaz:** Yalnızca ONE
- **Müşteri nasıl söyler:**
  - "Kablo uzatmadan atölyenin öbür ucundan kullanabilir miyim?" (TASLAK)
- **Kaynak:** product ("PC Connection": ONE "USB-C, Wi-Fi, Bluetooth, Ethernet", ONELite "USB-C")

---

## Katalog dışı bilgiler (bot SSS'den kullanır, plan seçimini etkilemez)

Bunlar her planda aynı olduğu için özellik kataloğuna girmez; `sss.md`'ye taşınacak.
- **Lisans dondurma:** Yılda bir kez, 30 güne kadar ücretsiz. Tüm Personal planlarda yazıyor (pricing).
- **Lisans süresi:** 12 ay, iptal edilmezse yenilenir (pricing).
- **Lisanssız kullanım:** Lisans bitince cihaz ONESuite ile haberleşemez (faq).
- **Çevrimdışı çalışma:** Aktivasyondan sonra çevrimdışı çalışır (ana sayfa SSS).
- **Güncellemeler:** Yeni araç modelleri, özellikler ve düzeltmeler aktif lisansa dahil (ana sayfa SSS, faq).
- **Test raporu:** Ayrıntılı test raporu oluşturma ve dışa aktarma var. Basic'te yok; hangi planda başladığı belli değil (Açık soru 6).
- **Plan yükseltme:** Her an yapılabilir, fark kalan süreye göre kıst hesaplanır (faq).
- **Deneme sürümü:** Ücretsiz deneme yok; Download sayfasında arayüz demosu var (faq).
- **İşletim sistemi:** ONESuite Windows ve macOS'ta çalışır.

---

## Cevaplanan sorular (19 Kasım 2026)

- **Pro+ cihaz sayısı:** 3 (Pro'ya ek 2 cihaz). Ana sayfa SSS'sindeki "2 devices" bu anlamda; sitede düzeltilmesi iyi olur.
- **Özel fonksiyonlar ONE Lite'ta:** Yok. Ürün sayfasındaki "ONELite … offers all the functions ONE offers" cümlesi yanıltıcı.
- **Premium fiyatı:** Şimdilik yazılmayacak. Ayarlar'da boş kalır, bot "özel fiyat" der ve satışçıya bırakır.
- **EUR fiyatları:** Şimdilik eklenmeyecek. Ayarlar'daki lisans tablosunda her plana isteğe bağlı "EUR" alanı var; boşsa TL fiyat kurla çevrilir. Karar verilince oradan girilir.
- **Basic'in kapsamı:** Yalnızca 1 cihaz, temel direksiyon testi, CAN, K-Line, yılda bir dondurma.

## Açık sorular

3. **Ekran AMOLED mi, OLED mi?** Fiyat ve ürün özellikleri AMOLED, ana sayfa ve SSS OLED diyor. Bot için önemsiz ama site tutarsız.
6. **Test raporu hangi planda başlıyor?** Basic'te olmadığı belli; Pro mu? Cevaplanınca kataloğa girer.
8. **ONEAssist ONE Lite'ta çalışıyor mu?** Cevaplanınca ONEAssist kataloğa girer.
9. **"Diagnostics" ile "Fault Code Management" aynı şey mi?** Katalogda aynı kabul edildi. Basic'te olmadığı kesin, Pro'nun tüm özellikleri Pro+'ta da var; bu yüzden önerilen plan değişmez.
10. **Araç sayısı:** Araç listesi sayfası "more than 500 hundred models" (yazım hatası), ana sayfa "50+ brands" diyor; listede 61 marka var. Bot hangi rakamı söylesin?
