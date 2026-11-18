// Genel Bakış ve Raporlar'ın ortak hesapları: tüm sayılar CRM kayıtlarından (siparişler, cihaz lisansları, destek
// talepleri, satış hattı, bayi hareketleri) hesaplanır. Yalnızca sunucuda import edin.
// Gelir = ödemesi alınmış, iptal edilmemiş siparişlerin KDV hariç tutarı (EUR siparişler fiyat listesindeki kurla TL'ye çevrilir).
// TODO: Supabase bağlanınca aynı hesaplar orders / licenses / tickets tablolarından SQL ile toplanabilir.
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import type { FiyatListesi } from "@/lib/urunler";
import type { Siparis, StokKalemi } from "@/components/siparisler/queries";
import { ULKELER } from "@/components/bayiler/sabitler";

export const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const AY_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const p2 = (n: number) => String(n).padStart(2, "0");
/** Yerel gün "2026-11-17" */
export const gunStr = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const gunEkle = (gun: string, n: number) => {
  const d = new Date(gun + "T12:00:00");
  d.setDate(d.getDate() + n);
  return gunStr(d);
};
/** "2026-11" ayının n ay öncesi/sonrası */
export const ayEkle = (ay: string, n: number) => {
  const d = new Date(Number(ay.slice(0, 4)), Number(ay.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
};

/** Gelire sayılan sipariş: ödemesi alınmış ve iptal edilmemiş */
export const gelireSayilir = (s: Siparis) => s.durum !== "odeme" && s.durum !== "iptal";

/** Siparişin TL karşılığı ve donanım / lisans kırılımı (kalemlerin liste fiyatı ağırlığıyla bölünür) */
export function siparisGeliri(s: Siparis, fiyat: FiyatListesi, stok: StokKalemi[]) {
  const toplam = s.tutar * (s.paraBirimi === "EUR" ? fiyat.eurKur : 1);
  let donanim = 0, lisans = 0;
  for (const k of s.kalemler) {
    if (k.tur === "cihaz") donanim += fiyat.cihaz[k.model] * k.adet;
    else if (k.tur === "lisans") lisans += (fiyat.lisans[k.paket as keyof FiyatListesi["lisans"]]?.fiyat ?? 0) * k.adet * (k.sureAy / 12);
    else donanim += (stok.find((x) => x.kod === k.stokKodu)?.fiyat ?? 0) * k.adet;
  }
  const agirlik = donanim + lisans;
  const donanimPay = agirlik ? donanim / agirlik : 1;
  return { toplam, donanim: toplam * donanimPay, lisans: toplam * (1 - donanimPay) };
}

export const cihazSayisi = (s: Siparis) => s.kalemler.reduce((t, k) => t + (k.tur === "cihaz" ? k.adet : 0), 0);

/** Sipariş ülke adı → ISO kodu ("Romanya" → "RO") */
const ULKE_KODU = new Map(Object.entries(ULKELER).map(([kod, ad]) => [ad, kod]));
export const ulkeKodu = (ad: string) => ULKE_KODU.get(ad) ?? ad.slice(0, 2).toLocaleUpperCase("tr-TR");

/** Aralıkta biten lisanslar ve bunlardan yenilenenler (lisans geçmişinden; bitişinden en geç 30 gün önce başlayan
 *  yeni dönem varsa yenilenmiş sayılır) */
export function yenilemeSayaci(cihazlar: Cihaz[], bas: string, son: string) {
  let biten = 0, yenilenen = 0;
  for (const c of cihazlar) {
    for (const e of c.gecmis) {
      if (e.bitis < bas || e.bitis > son) continue;
      biten++;
      if (c.gecmis.some((f) => f !== e && f.baslangic > e.baslangic && f.baslangic >= gunEkle(e.bitis, -30))) yenilenen++;
    }
  }
  return { biten, yenilenen, oran: biten ? (yenilenen / biten) * 100 : null };
}

/** "12 dk önce" / "3 sa önce" / "2 gün önce" / "31 Eki" */
export function oncelikZaman(zaman: string, simdi: number) {
  const t = new Date(zaman.length === 10 ? zaman + "T12:00:00" : zaman).getTime();
  const dk = Math.max(0, Math.round((simdi - t) / 60_000));
  if (dk < 60) return `${Math.max(1, dk)} dk önce`;
  if (dk < 24 * 60) return `${Math.round(dk / 60)} sa önce`;
  if (dk < 7 * 24 * 60) return `${Math.round(dk / 1440)} gün önce`;
  const d = new Date(t);
  return `${d.getDate()} ${AY_KISA[d.getMonth()]}`;
}
