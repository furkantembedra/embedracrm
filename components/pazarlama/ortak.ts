// Pazarlama bileşenlerinin paylaştığı yardımcılar: kanal renkleri, hafta hesabı ve hedef liste üyeleri
import type { ChipTon } from "@/components/ui/chip";
import { gunFarki } from "@/lib/use-bugun";
import { IZIN_KANAL_ADI, type IzinKanali } from "@/components/musteriler/izin";
import { HAZIR_LISTELER, type IcerikKanali, type KampanyaDurumu, type KampanyaKanali, type ListeFiltresi, type OzelListe } from "./queries";

export const ICERIK_RENGI: Record<IcerikKanali, string> = {
  Instagram: "#2F4BFF",
  "Bülten / e-posta": "#0E0F0C",
  Blog: "#B6DD2E",
  WhatsApp: "#1F8A4C",
  LinkedIn: "#E58A2B",
};
export const KANAL_TONU: Record<KampanyaKanali, ChipTon> = { "E-posta": "ink", Instagram: "info", WhatsApp: "ok", Fuar: "warn" };
export const DURUM_TONU: Record<KampanyaDurumu, ChipTon> = { Aktif: "ok", Tamamlandı: "gray", Taslak: "warn" };

const p2 = (n: number) => String(n).padStart(2, "0");
export const isoGun = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
/** Haftanın pazartesisi (ms). kaydir: kaç hafta ileri / geri */
export function haftaBasi(bugun: number, kaydir = 0) {
  const d = new Date(bugun);
  const fark = (d.getDay() + 6) % 7; // pazartesi = 0
  d.setDate(d.getDate() - fark + kaydir * 7);
  return d.setHours(0, 0, 0, 0);
}
export const GUN_ADI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/* ---------- Dönem (tarih aralığı) ---------- */

export type DonemTuru = "hafta" | "ay" | "son30" | "gelecek30" | "ozel";
export type Donem = { tur: DonemTuru; bas: string; bit: string }; // "2026-11-02" – "2026-11-08", ikisi de dahil
export const DONEM_ADI: Record<Exclude<DonemTuru, "ozel">, string> = { hafta: "Bu hafta", ay: "Bu ay", son30: "Son 30 gün", gelecek30: "Önümüzdeki 30 gün" };

const GUN = 86_400_000;
/** Gün ekler (yaz saatinden etkilenmez) */
export const gunEkle = (iso: string, n: number) => isoGun(new Date(iso + "T12:00:00").getTime() + n * GUN);
export const gunSayisi = (bas: string, bit: string) => Math.round((new Date(bit + "T12:00:00").getTime() - new Date(bas + "T12:00:00").getTime()) / GUN) + 1;

export function hazirDonem(tur: Exclude<DonemTuru, "ozel">, bugun: number): Donem {
  const b = isoGun(bugun);
  if (tur === "hafta") {
    const bas = isoGun(haftaBasi(bugun) + 3_600_000);
    return { tur, bas, bit: gunEkle(bas, 6) };
  }
  if (tur === "ay") {
    const d = new Date(bugun);
    return { tur, bas: `${b.slice(0, 7)}-01`, bit: isoGun(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime()) };
  }
  return tur === "son30" ? { tur, bas: gunEkle(b, -29), bit: b } : { tur, bas: b, bit: gunEkle(b, 29) };
}

/** Önceki / sonraki dönem: ay seçiliyse bir ay, diğerlerinde dönemin uzunluğu kadar kayar */
export function donemKaydir(d: Donem, yon: 1 | -1): Donem {
  if (d.tur === "ay") {
    const t = new Date(d.bas + "T12:00:00");
    const bas = new Date(t.getFullYear(), t.getMonth() + yon, 1);
    return { tur: "ay", bas: isoGun(bas.getTime()), bit: isoGun(new Date(bas.getFullYear(), bas.getMonth() + 1, 0).getTime()) };
  }
  const n = gunSayisi(d.bas, d.bit) * yon;
  return { tur: d.tur === "hafta" ? "hafta" : "ozel", bas: gunEkle(d.bas, n), bit: gunEkle(d.bit, n) };
}

/** "2 – 8 Kasım 2026" / "28 Ekim – 26 Kasım 2026" */
export function donemYaz(d: Donem) {
  const a = new Date(d.bas + "T00:00:00");
  const b = new Date(d.bit + "T00:00:00");
  const ayniAy = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const bas = a.toLocaleDateString("tr-TR", ayniAy ? { day: "numeric" } : { day: "numeric", month: "long", ...(a.getFullYear() !== b.getFullYear() ? { year: "numeric" } : {}) });
  return `${bas} – ${b.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`;
}

/** Kampanya dönemle çakışıyor mu (tek günlük kampanyada bitiş = başlangıç) */
export const donemde = (bas: string, bit: string | null, d: Donem) => bas <= d.bit && (bit ?? bas) >= d.bas;
export const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
export const kampanyaTarihi = (bas: string, bit: string | null) => (bit ? `${tarihKisa(bas)} – ${tarihKisa(bit)}` : tarihKisa(bas));

/* ---------- Hedef listeler ---------- */

/** Kampanya kanalının gerektirdiği iletişim izni (Instagram ve fuar kişiye mesaj değildir) */
export const KAMPANYA_IZNI: Record<KampanyaKanali, IzinKanali | null> = { "E-posta": "eposta", WhatsApp: "whatsapp", Instagram: null, Fuar: null };

type VeriYetkili = { id: string; ad: string; telefon: string; eposta: string; kanallar: IzinKanali[] }; // kanallar: verilmiş izinler
export type ListeVerisi = {
  musteriler: { id: string; ad: string; ulke: string; segment: string; plan: string; lisansBitis: string | null; yetkililer: VeriYetkili[] }[];
  bayiler: { id: string; ad: string; bolge: string; yetkili: string; telefon: string; eposta: string }[];
  firsatlar: { firma: string; konum: string; asama: string; kayipNedeni?: string }[];
};
/** Listedeki bir kişi. Müşteri listeleri yetkili başına satırdır; izinler kanal bazındadır.
 *  ref: kaydın kaynağı (abonelikten çıkınca izni geri çekmek için) "m:<müşteri>:<yetkili>" · "b:<bayi>" · "a:<liste>:<sıra>" · "f:<sıra>" */
export type Uye = { ad: string; kisi: string; telefon: string; eposta: string; ulke: string; bilgi: string; kanallar: IzinKanali[] | null; ref: string }; // kanallar null: izin bilgisi yok (bayi)

type VeriMusteri = ListeVerisi["musteriler"][number];
export const musteriIzinli = (m: VeriMusteri, kanal?: IzinKanali) => m.yetkililer.some((y) => (kanal ? y.kanallar.includes(kanal) : y.kanallar.length > 0));

/** Müşterinin yetkilileri ayrı satır; yetkilisi yoksa firma tek satır */
const musteriUyeleri = (m: VeriMusteri, bilgi: string): Uye[] =>
  m.yetkililer.length
    ? m.yetkililer.map((y) => ({ ad: m.ad, kisi: y.ad, telefon: y.telefon, eposta: y.eposta, ulke: m.ulke, bilgi, kanallar: y.kanallar, ref: `m:${m.id}:${y.id}` }))
    : [{ ad: m.ad, kisi: "", telefon: "", eposta: "", ulke: m.ulke, bilgi, kanallar: [], ref: `m:${m.id}:` }];

export function filtreUygun(m: VeriMusteri, f: ListeFiltresi) {
  const izin = f.izin === "" || (f.izin === "herhangi" ? musteriIzinli(m) : musteriIzinli(m, f.izin));
  return (!f.segment || m.segment === f.segment) && (!f.plan || m.plan === f.plan) && (!f.ulke || m.ulke === f.ulke) && izin;
}

/** Listenin üyeleri. kanal verilirse yalnızca o kanalda izni (ve ulaşma bilgisi) olan kişiler kalır.
 *  "bitiyor" bugüne göre hesaplandığından bugun bilinmiyorsa boş döner. */
export function listeUyeleri(listeId: string, v: ListeVerisi, ozel: OzelListe[], bugun: number | null, kanal?: IzinKanali | null): Uye[] {
  let uyeler: Uye[];
  switch (listeId) {
    case "bitiyor":
      uyeler = v.musteriler
        .filter((m) => {
          const kalan = m.lisansBitis ? gunFarki(m.lisansBitis, bugun) : null;
          return kalan !== null && kalan >= 0 && kalan <= 30;
        })
        .flatMap((m) => musteriUyeleri(m, `${m.plan} · bitiş ${m.lisansBitis}`));
      break;
    case "basic":
      uyeler = v.musteriler.filter((m) => m.plan === "Basic").flatMap((m) => musteriUyeleri(m, "Basic"));
      break;
    case "izinli":
      uyeler = v.musteriler.flatMap((m) => musteriUyeleri(m, m.plan)).filter((u) => u.kanallar?.length);
      break;
    case "bayiler":
      uyeler = v.bayiler.map((b) => ({ ad: b.ad, kisi: b.yetkili, telefon: b.telefon, eposta: b.eposta, ulke: b.bolge, bilgi: "Aktif bayi · sözleşmeli iş ortağı", kanallar: null, ref: `b:${b.id}` }));
      break;
    case "kayip":
      uyeler = v.firsatlar
        .filter((f) => f.asama === "kaybedildi")
        .map((f, i) => ({ ad: f.firma, kisi: "", telefon: "", eposta: "", ulke: f.konum, bilgi: f.kayipNedeni ?? "Kaybedildi", kanallar: [], ref: `f:${i}` }));
      break;
    default: {
      const l = ozel.find((x) => x.id === listeId);
      if (l?.aktarim) {
        uyeler = l.aktarim.kisiler.map((k, i) => ({
          ad: k.firma || k.kisi, kisi: k.firma ? k.kisi : "", telefon: k.telefon, eposta: k.eposta, ulke: k.ulke,
          bilgi: `İçe aktarıldı · ${l.aktarim!.kaynak}`, kanallar: k.kanallar, ref: `a:${l.id}:${i}`,
        }));
        break;
      }
      uyeler = l ? v.musteriler.filter((m) => filtreUygun(m, l.filtre)).flatMap((m) => musteriUyeleri(m, `${m.plan} · ${m.segment}`)) : [];
      if (l?.filtre.izin) uyeler = uyeler.filter((u) => (l.filtre.izin === "herhangi" ? u.kanallar?.length : u.kanallar?.includes(l.filtre.izin as IzinKanali)));
    }
  }
  if (!kanal) return uyeler;
  // Bayilerle sözleşme ilişkisi var: izin kaydı aranmaz, yalnızca ulaşma bilgisi gerekir
  const ulasilir = (u: Uye) => (kanal === "eposta" ? !!u.eposta : !!u.telefon);
  return uyeler.filter((u) => (u.kanallar === null || u.kanallar.includes(kanal)) && ulasilir(u));
}

/** Gönderimde aynı kişiyi tanımak için anahtar: e-posta küçük harf, telefon yalnızca rakam */
export function telefonRakam(t: string) {
  const d = t.replace(/[^\d]/g, "").replace(/^00/, "");
  if (/^0\d{10}$/.test(d)) return `90${d.slice(1)}`; // 0532… → 90532… (ülke kodu yazılmamış Türkiye numarası)
  if (/^5\d{9}$/.test(d)) return `90${d}`; // 532…
  return d;
}
export const uyeAnahtari = (u: Pick<Uye, "eposta" | "telefon">, kanal: "eposta" | "whatsapp") =>
  kanal === "eposta" ? u.eposta.trim().toLocaleLowerCase("en") : telefonRakam(u.telefon);

/** "{ad}" ve "{firma}" alanlarını kişiye göre doldurur; kişi adı yoksa "Merhaba {ad}" → "Merhaba" */
export function mesajDoldur(metin: string, u: Pick<Uye, "ad" | "kisi">) {
  const ad = (u.kisi || "").split(" ")[0];
  return metin
    .replace(/ \{ad\}/g, ad ? ` ${ad}` : "")
    .replace(/\{ad\}/g, ad)
    .replace(/\{firma\}/g, u.ad);
}

/** Hashtag'i "#" olmadan, boşluksuz yazar: "#Oto elektrik" → "Otoelektrik" */
export const hashtagTemizle = (h: string) => h.replace(/^#+/, "").replace(/[\s#,]+/g, "").slice(0, 60);

/** Liste içe aktarılmış mı (tarih ve dosya adıyla) yoksa filtre mi */
export const listeTuru = (l: OzelListe) => (l.aktarim ? "aktarim" : "filtre");

export function listeAdi(listeId: string, ozel: OzelListe[]) {
  return HAZIR_LISTELER.find((l) => l.id === listeId)?.ad ?? ozel.find((l) => l.id === listeId)?.ad ?? "Silinmiş liste";
}

export const IZIN_FILTRESI_ADI = (izin: ListeFiltresi["izin"]) => (izin === "" ? "" : izin === "herhangi" ? "izinliler" : `${IZIN_KANAL_ADI[izin]} izinliler`);

/** Filtreyi okunur metne çevirir: "Servis · Pro · Türkiye · E-posta izinliler" */
export function filtreOzeti(f: ListeFiltresi, segmentAdi: Record<string, string>) {
  return [f.segment && segmentAdi[f.segment], f.plan, f.ulke, IZIN_FILTRESI_ADI(f.izin)].filter(Boolean).join(" · ") || "Tüm müşteriler";
}
