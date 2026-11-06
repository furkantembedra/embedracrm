// Kampanyadan toplu e-posta / WhatsApp gönderimi ve zamanlayıcı. Yalnızca sunucuda (action, route handler) import edin.
// Kitle her gönderimde yeniden hesaplanır: izni olmayan, adresi eksik, abonelikten çıkmış ya da bu kampanyadan
// daha önce mesaj almış kişiler atlanır. Böylece "sürekli" kampanyada yalnızca listeye yeni girenlere gider.
import { abonelikJetonu, type AbonelikBilgisi } from "@/lib/abonelik";
import { epostaGonder, saglayicilar, sirayla, whatsappGonder, type GonderimSonucu } from "@/lib/ileti-gonder";
import { musteriyiGuncelle } from "@/components/musteriler/queries";
import { IZIN_KANAL_ADI } from "@/components/musteriler/izin";
import { getListeVerisi } from "./kitle";
import { KAMPANYA_IZNI, listeUyeleri, mesajDoldur, uyeAnahtari, type Uye } from "./ortak";
import {
  aktarilanKisiGuncelle, engelliEkle, getEngelli, getKampanyalar, getOzelListeler, getUlasilan, gonderimEkle, kampanyaKaydetDepo,
  type Gonderim, type GonderimKanali, type Kampanya,
} from "./queries";

const p2 = (n: number) => String(n).padStart(2, "0");
export function simdi() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export const gonderimKanali = (k: Kampanya): GonderimKanali | null => {
  const izin = KAMPANYA_IZNI[k.kanal];
  return izin === "eposta" || izin === "whatsapp" ? izin : null;
};

export type KitleOzeti = { gonderilecek: Uye[]; toplam: number; atlanan: { neden: string; sayi: number }[] };

/** Kampanyanın şu anki alıcıları ve atlananların nedenleri */
export async function kampanyaKitlesi(k: Kampanya): Promise<KitleOzeti | null> {
  const kanal = gonderimKanali(k);
  if (!kanal) return null;
  const [veri, ozel, engelli, ulasilan] = await Promise.all([getListeVerisi(), getOzelListeler(), getEngelli(), getUlasilan(k.id)]);
  const bugun = new Date().setHours(0, 0, 0, 0);
  const tumu = listeUyeleri(k.listeId, veri, ozel, bugun);
  const sayac = { izin: 0, adres: 0, engel: 0, once: 0, tekrar: 0 };
  const gorulen = new Set<string>();
  const ulasildi = new Set(ulasilan);
  const engel = new Set(engelli);
  const gonderilecek: Uye[] = [];
  for (const u of tumu) {
    const anahtar = uyeAnahtari(u, kanal);
    if (u.kanallar !== null && !u.kanallar.includes(kanal)) sayac.izin++;
    else if (!anahtar) sayac.adres++;
    else if (engel.has(`${kanal}:${anahtar}`)) sayac.engel++;
    else if (ulasildi.has(anahtar)) sayac.once++;
    else if (gorulen.has(anahtar)) sayac.tekrar++;
    else {
      gorulen.add(anahtar);
      gonderilecek.push(u);
    }
  }
  const adres = kanal === "eposta" ? "e-posta adresi yok" : "telefonu yok";
  return {
    gonderilecek,
    toplam: tumu.length,
    atlanan: [
      { neden: `${IZIN_KANAL_ADI[kanal]} izni yok`, sayi: sayac.izin },
      { neden: adres, sayi: sayac.adres },
      { neden: "abonelikten çıkmış", sayi: sayac.engel },
      { neden: "bu kampanyadan daha önce aldı", sayi: sayac.once },
      { neden: "aynı adres listede iki kez", sayi: sayac.tekrar },
    ].filter((x) => x.sayi > 0),
  };
}

const html = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Bir kişiye mesajı kişiselleştirip gönderir */
async function birineGonder(k: Kampanya, kanal: GonderimKanali, u: Uye, taban: string, kime?: string): Promise<GonderimSonucu> {
  const m = k.mesaj!;
  const anahtar = uyeAnahtari(kime ? { eposta: kime, telefon: kime } : u, kanal);
  const bilgi: AbonelikBilgisi = { ref: kime ? "test" : u.ref, kanal, anahtar };
  const abonelikUrl = `${taban}/api/abonelik?t=${abonelikJetonu(bilgi)}`;
  const metin = mesajDoldur(m.metin, u);
  if (kanal === "eposta") {
    const alt = `Bu e-postayı Embedra'dan duyuru almayı kabul ettiğiniz için aldınız. Almak istemiyorsanız: ${abonelikUrl}`;
    return epostaGonder({
      kime: anahtar,
      konu: mesajDoldur(m.konu, u),
      metin: `${metin}\n\n—\n${alt}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#0E0F0C">${html(metin).replace(/\n/g, "<br>")}</div>
<p style="margin-top:28px;font-family:system-ui,sans-serif;font-size:12px;color:#5E6259">Bu e-postayı Embedra'dan duyuru almayı kabul ettiğiniz için aldınız.
<a href="${html(abonelikUrl)}" style="color:#5E6259">Abonelikten çık</a></p>`,
      abonelikUrl,
    });
  }
  return whatsappGonder({ telefon: anahtar, sablon: m.sablon, parametreler: [(u.kisi || "").split(" ")[0] || u.ad, u.ad] });
}

export type GonderSonucu = { gonderim?: Gonderim; hata?: string };

/** Kampanyanın mesajını uygun herkese gönderir ve sonucu kaydeder. Gönderilecek kimse yoksa kayıt açılmaz. */
export async function kampanyaGonder(k: Kampanya, tur: Gonderim["tur"], taban: string): Promise<GonderSonucu> {
  const kanal = gonderimKanali(k);
  if (!kanal) return { hata: "Bu kanaldan (Instagram / fuar) toplu mesaj gönderilmez." };
  if (!k.mesaj?.metin.trim()) return { hata: "Önce mesajı yazın." };
  if (kanal === "eposta" && !k.mesaj.konu.trim()) return { hata: "E-posta konusunu yazın." };
  const kitle = await kampanyaKitlesi(k);
  if (!kitle || kitle.gonderilecek.length === 0) return { hata: "Gönderilecek kimse yok: listedeki herkes atlandı ya da daha önce aldı." };
  const sonuclar = await sirayla(kitle.gonderilecek, 5, (u) => birineGonder(k, kanal, u, taban));
  const hatalar = sonuclar.flatMap((s, i) => (s.ok ? [] : [`${uyeAnahtari(kitle.gonderilecek[i], kanal)}: ${s.hata}`]));
  const gonderim: Gonderim = {
    id: crypto.randomUUID(), kampanyaId: k.id, kanal, zaman: simdi(), tur,
    alici: kitle.gonderilecek.length, basarili: sonuclar.filter((s) => s.ok).length, hatali: hatalar.length,
    atlanan: kitle.atlanan.reduce((t, x) => t + x.sayi, 0), demo: !saglayicilar()[kanal], hatalar: hatalar.slice(0, 10),
  };
  // Hatalı olanlar "ulaşıldı" sayılmaz; adres düzeltilince bir sonraki gönderimde yeniden denenir
  await gonderimEkle(gonderim, kitle.gonderilecek.filter((_, i) => sonuclar[i].ok).map((u) => uyeAnahtari(u, kanal)));
  return { gonderim };
}

/** Tek bir adrese deneme gönderimi (listedeki ilk kişinin bilgileriyle doldurulur) */
export async function testGonder(k: Kampanya, kime: string, taban: string): Promise<GonderSonucu> {
  const kanal = gonderimKanali(k);
  if (!kanal || !k.mesaj?.metin.trim()) return { hata: "Önce mesajı yazın." };
  const kitle = await kampanyaKitlesi(k);
  const ornek: Uye = kitle?.gonderilecek[0] ?? { ad: "Örnek Firma", kisi: "Ali Yılmaz", telefon: kime, eposta: kime, ulke: "", bilgi: "", kanallar: null, ref: "test" };
  const s = await birineGonder(k, kanal, ornek, taban, kime.trim());
  if (!s.ok) return { hata: `Gönderilemedi: ${s.hata}` };
  const gonderim: Gonderim = {
    id: crypto.randomUUID(), kampanyaId: k.id, kanal, zaman: simdi(), tur: "test",
    alici: 1, basarili: 1, hatali: 0, atlanan: 0, demo: !saglayicilar()[kanal], hatalar: [],
  };
  await gonderimEkle(gonderim, []);
  return { gonderim };
}

/** Zamanı gelen planlı gönderimleri ve sürekli kampanyaları çalıştırır. Dakikada bir çağrılır (instrumentation / cron). */
export async function zamanlayiciCalistir(taban: string) {
  const an = simdi();
  const gun = an.slice(0, 10);
  const sonuc: Gonderim[] = [];
  for (const k of await getKampanyalar()) {
    if (k.durum !== "Aktif" || !k.mesaj || !gonderimKanali(k) || !k.otomasyon) continue;
    if (k.otomasyon.tur === "planli" && k.otomasyon.zaman && k.otomasyon.zaman <= an) {
      await kampanyaKaydetDepo({ ...k, otomasyon: { tur: "yok", zaman: null } }); // bir kez çalışır
      const s = await kampanyaGonder(k, "planli", taban);
      if (s.gonderim) sonuc.push(s.gonderim);
    } else if (k.otomasyon.tur === "surekli" && k.baslangic <= gun && (!k.bitis || gun <= k.bitis)) {
      const kitle = await kampanyaKitlesi(k);
      if (!kitle?.gonderilecek.length) continue;
      const s = await kampanyaGonder(k, "otomatik", taban);
      if (s.gonderim) sonuc.push(s.gonderim);
    }
  }
  return sonuc;
}

const bugunIso = () => simdi().slice(0, 10);

/** Abonelikten çıkma: adres engellenir ve kişinin kaydındaki izin geri çekilir (kayıt silinmez, kanıt olarak kalır) */
export async function abonelikIptal(b: AbonelikBilgisi) {
  await engelliEkle(`${b.kanal}:${b.anahtar}`);
  const [tur, a, c] = b.ref.split(":");
  if (tur === "m" && a && c) {
    await musteriyiGuncelle(a, (m) => {
      const y = m.yetkililer.find((x) => x.id === c);
      const eski = y?.izinler?.[b.kanal];
      if (!y || !eski?.verildi) return;
      y.izinler = { ...y.izinler, [b.kanal]: { ...eski, verildi: false, cekilme: bugunIso() } };
      m.olaylar.unshift({ metin: `${y.ad}: ${IZIN_KANAL_ADI[b.kanal]} izni geri çekildi (abonelikten çıktı)`, zaman: "Bugün · İletişim izni", tur: "not" });
    });
  } else if (tur === "a" && a && c) {
    await aktarilanKisiGuncelle(a, (l) => {
      const k = l[Number(c)];
      if (k) k.kanallar = k.kanallar.filter((x) => x !== b.kanal);
    });
  }
}
