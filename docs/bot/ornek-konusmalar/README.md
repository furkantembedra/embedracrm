# Örnek satış konuşmaları (bot istemi kaynağı)

Bu klasöre en iyi satışçının gerçek konuşmalarını koyun. Her konuşma ayrı bir `.md` dosyasıdır (ör. `01-servis-basic.md`). Bu `README.md` ve adı `_` ile başlayan dosyalar isteme girmez.

**Biçim (öneri):**

```text
Kanal: WhatsApp
Sonuç: demo ayarlandı

Müşteri: Merhaba, direksiyon kutusu test cihazınız var mı?
Satışçı: Merhaba! Var. Elinize ayda kaç kutu geliyor, daha çok hangi araçlar?
Müşteri: ...
```

**Kurallar:**
- Kişisel bilgileri temizleyin: ad, soyad, telefon, e-posta, adres, plaka, firma adı yerine `[Müşteri]`, `[Firma]` yazın. Betik telefon ya da e-postaya benzeyen bir şey görürse dosyayı üretmez.
- Konuşmada geçen fiyat, indirim ve tarihleri silin ya da `[fiyat]` yazın. Bot fiyatı yalnızca `plan_oner` aracından söyler, örnekteki rakamları kullanmaz.
- Toplam (konuşmalar + `itirazlar.md`) 40.000 karakteri geçmesin. Her istekte giden sabit istemin içine girer.

**İtirazlar:** `docs/bot/itirazlar.md` dosyası. Her itiraz bir başlık, altında satış ekibinin önerdiği cevap:

```text
## "Çok pahalı"
Önce neyle kıyasladığını sor; kutu başına kazancı ve geri dönen arıza maliyetini konuş. İndirim sözü verme.
```

**Ekledikten sonra:**

```bash
npm run bot:istem-kaynaklari
```

Komut `components/bot/istem-kaynaklari.ts` dosyasını yeniden üretir; ardından `components/bot/istem.ts` içindeki `ISTEM_SURUMU`'nu artırın (ör. `p2.3-1` → `p2.3-2`), böylece Bot raporunda hangi istemle konuşulduğu ayrılır. `npm test` üretilen dosyanın belgelerle aynı olduğunu denetler. Betiği çalıştırmayı unutursanız test düşer.

P2.4'te bu içerik Bot › Ayarlar'a taşınacak (sürümlü, arayüzden düzenlenebilir). O zamana kadar kaynak bu klasördür.
