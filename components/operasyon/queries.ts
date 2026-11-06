// Operasyon: üretim, tedarik, seri no havuzu ve uygulama ayarları (fiyat listesi, kargo firmaları, ekip).
// Şimdilik demo veri döner (sunucu belleğinde, sayfalar arasında paylaşılır).
// Supabase bağlanınca fonksiyonların içini supabase.from("production_batches" | "purchase_orders" | "settings" | "users")... ile değiştirin.
import { VARSAYILAN_FIYAT, type CihazModeli, type FiyatListesi } from "@/lib/urunler";

/* ---------- Üretim ---------- */

/** dis: tedarikçiden satın alınır · ic: atölyede kendimiz üretiriz (iç üretim emriyle stoğa girer) */
export type BilesenKaynagi = "dis" | "ic";
export type BilesenKalemi = { kod: string; ad: string; adet: number; kritik: number; hedef: number; kaynak: BilesenKaynagi };
/** Model başına bir cihazda harcanan bileşen kodları */
export type Recete = Record<CihazModeli, string[]>;

export { RECETE, ROLLER } from "./ortak";
import { RECETE } from "./ortak";

/** planlandi → uretimde (bileşen düşer) → kalite → depoda (sağlam cihazlar depo stoğuna, seri no'lar havuza) */
export type PartiDurumu = "planlandi" | "uretimde" | "kalite" | "depoda";
export type UretimPartisi = {
  id: string; // "P-2611-01"
  model: CihazModeli;
  adet: number;
  hedefTarih: string; // "2026-11-14"
  durum: PartiDurumu;
  saglam: number | null; // kalite kontrolden geçen (depoda)
  hatali: number | null;
  seriler: string[]; // depoya alınırken üretilen seri numaraları
  not: string;
  // Hatalı cihazların akıbeti (kalite kontrolde karar verilir; tamirdekiler sonra "Tamir sonucu" ile kapanır)
  tamirde?: number; // tamirde bekleyen
  onarilan?: number; // tamirden dönüp depoya giren (saglam'a dahil)
  sokulen?: number; // sökülüp parçaları geri alınan
  hurda?: number;
  geriAlinan?: Record<string, number>; // sökülen cihazlardan bileşen stoğuna dönen parçalar
};

/** Atölyede ürettiğimiz bileşen için iş emri: X günde Y adet. Personel her gün ürettiğini girer, adet bileşen stoğuna eklenir. */
export type IcUretimGirisi = { id: string; tarih: string; adet: number; personel: string; not: string };
export type IcUretimEmri = {
  id: string; // "IU-0003"
  kalemKodu: string;
  kalemAdi: string;
  hedef: number;
  baslangic: string;
  gun: number; // süre (gün); bitiş = başlangıç + gün - 1
  girisler: IcUretimGirisi[];
  not: string;
};

/** siparis → yolda → teslim (teslim alınınca stoğa girer) */
export type TedarikDurumu = "siparis" | "yolda" | "teslim";
export type TedarikSiparisi = {
  id: string; // "T-0031"
  tedarikci: string;
  kalemKodu: string; // bileşen kodu ya da sipariş deposundaki kablo kodu (EO1-CBL-…)
  kalemAdi: string;
  adet: number;
  tarih: string; // sipariş tarihi
  beklenen: string; // beklenen teslim
  durum: TedarikDurumu;
};

/** Üretilmiş, depoda bekleyen, henüz bir siparişe atanmamış seri numaraları */
export type HavuzSeri = { seriNo: string; model: CihazModeli; partiId: string };

/* ---------- Ayarlar ---------- */

import type { ROLLER } from "./ortak";
export type Rol = (typeof ROLLER)[number];
export type Kullanici = { id: string; ad: string; eposta: string; rol: Rol; aktif: boolean };

const BILESENLER: BilesenKalemi[] = [
  { kod: "PCB-MAIN", ad: "Ana kart (PCB)", adet: 45, kritik: 25, hedef: 150, kaynak: "dis" },
  { kod: "AMOLED", ad: "AMOLED dokunmatik ekran", adet: 18, kritik: 20, hedef: 100, kaynak: "dis" },
  { kod: "KASA-ONE", ad: "Kasa · ONE", adet: 40, kritik: 15, hedef: 100, kaynak: "ic" },
  { kod: "KASA-LITE", ad: "Kasa · ONE LITE", adet: 25, kritik: 10, hedef: 60, kaynak: "ic" },
  { kod: "KUTU", ad: "Ambalaj kutusu", adet: 60, kritik: 25, hedef: 150, kaynak: "dis" },
];

const giris = (id: string, tarih: string, adet: number, personel: string, not = ""): IcUretimGirisi => ({ id, tarih, adet, personel, not });
const IC_URETIM: IcUretimEmri[] = [
  {
    id: "IU-0003", kalemKodu: "KASA-ONE", kalemAdi: "Kasa · ONE", hedef: 100, baslangic: "2026-11-02", gun: 10, not: "Enjeksiyon kalıbı 2",
    girisler: [giris("g1", "2026-11-02", 10, "Selin Öz"), giris("g2", "2026-11-03", 12, "Selin Öz"), giris("g3", "2026-11-04", 9, "Deniz Arslan", "Kalıp ısınması 1 saat sürdü"), giris("g4", "2026-11-05", 8, "Selin Öz")],
  },
  {
    id: "IU-0002", kalemKodu: "KASA-LITE", kalemAdi: "Kasa · ONE LITE", hedef: 40, baslangic: "2026-10-19", gun: 5, not: "",
    girisler: [giris("g5", "2026-10-19", 8, "Selin Öz"), giris("g6", "2026-10-20", 9, "Selin Öz"), giris("g7", "2026-10-21", 8, "Selin Öz"), giris("g8", "2026-10-22", 7, "Selin Öz"), giris("g9", "2026-10-23", 8, "Selin Öz")],
  },
];

const PARTILER: UretimPartisi[] = [
  { id: "P-2611-02", model: "ONE Lite", adet: 10, hedefTarih: "2026-11-20", durum: "planlandi", saglam: null, hatali: null, seriler: [], not: "Eğitim seti siparişleri için" },
  { id: "P-2611-01", model: "ONE", adet: 20, hedefTarih: "2026-11-12", durum: "uretimde", saglam: null, hatali: null, seriler: [], not: "" },
  { id: "P-2610-04", model: "ONE", adet: 12, hedefTarih: "2026-11-04", durum: "kalite", saglam: null, hatali: null, seriler: [], not: "Firmware v2.4.1 yüklü" },
  {
    id: "P-2610-03", model: "ONE", adet: 8, hedefTarih: "2026-10-24", durum: "depoda", saglam: 6, hatali: 2,
    seriler: Array.from({ length: 6 }, (_, i) => `EO1-2610-${String(701 + i).padStart(4, "0")}`), not: "2 cihaz ekran arızası",
    tamirde: 1, sokulen: 1, hurda: 0, geriAlinan: { "PCB-MAIN": 1, "KASA-ONE": 1, KUTU: 1 },
  },
  {
    id: "P-2610-02", model: "ONE Lite", adet: 4, hedefTarih: "2026-10-20", durum: "depoda", saglam: 4, hatali: 0,
    seriler: Array.from({ length: 4 }, (_, i) => `EO1-2610-${String(710 + i).padStart(4, "0")}`), not: "",
  },
];

const TEDARIK: TedarikSiparisi[] = [
  { id: "T-0031", tedarikci: "Shenzhen Display Co.", kalemKodu: "AMOLED", kalemAdi: "AMOLED dokunmatik ekran", adet: 50, tarih: "2026-10-22", beklenen: "2026-11-10", durum: "yolda" },
  { id: "T-0032", tedarikci: "Ege Elektronik Kart A.Ş.", kalemKodu: "PCB-MAIN", kalemAdi: "Ana kart (PCB)", adet: 100, tarih: "2026-11-03", beklenen: "2026-11-24", durum: "siparis" },
  { id: "T-0030", tedarikci: "Kablo Teknik Ltd.", kalemKodu: "EO1-CBL-PIN", kalemAdi: "Universal pin kablosu", adet: 100, tarih: "2026-10-28", beklenen: "2026-11-07", durum: "yolda" },
  { id: "T-0029", tedarikci: "İzmir Ambalaj", kalemKodu: "KUTU", kalemAdi: "Ambalaj kutusu", adet: 80, tarih: "2026-10-10", beklenen: "2026-10-17", durum: "teslim" },
];

const EKIP: Kullanici[] = [
  { id: "u1", ad: "Deniz Arslan", eposta: "deniz@embedra.com", rol: "Yönetici", aktif: true },
  { id: "u2", ad: "Ayşe Kara", eposta: "ayse@embedra.com", rol: "Satış", aktif: true },
  { id: "u3", ad: "Emre Yalçın", eposta: "emre@embedra.com", rol: "Destek", aktif: true },
  { id: "u4", ad: "Selin Öz", eposta: "selin@embedra.com", rol: "Operasyon", aktif: true },
  { id: "u5", ad: "Can Demir", eposta: "can@embedra.com", rol: "Pazarlama", aktif: false },
];

type Depo = {
  bilesenler: BilesenKalemi[];
  recete: Recete;
  icUretim: IcUretimEmri[];
  partiler: UretimPartisi[];
  tedarik: TedarikSiparisi[];
  havuz: HavuzSeri[];
  fiyat: FiyatListesi;
  kargoFirmalari: string[];
  ekip: Kullanici[];
};
const g = globalThis as { __embedraOperasyon?: Depo };
const DEPO = (g.__embedraOperasyon ??= {
  bilesenler: structuredClone(BILESENLER),
  recete: structuredClone(RECETE),
  icUretim: structuredClone(IC_URETIM),
  partiler: structuredClone(PARTILER),
  tedarik: structuredClone(TEDARIK),
  havuz: PARTILER.filter((p) => p.durum === "depoda").flatMap((p) => p.seriler.map((seriNo) => ({ seriNo, model: p.model, partiId: p.id }))),
  fiyat: structuredClone(VARSAYILAN_FIYAT),
  kargoFirmalari: ["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "UPS Express", "DHL Express", "DHL Freight"],
  ekip: structuredClone(EKIP),
} as Depo);
// Bellekte eski yapıyla kurulmuş depo varsa (dev sunucusu yeniden başlamadan) yeni alanları tamamla
DEPO.recete ??= structuredClone(RECETE);
DEPO.icUretim ??= structuredClone(IC_URETIM);
for (const b of DEPO.bilesenler) b.kaynak ??= BILESENLER.find((x) => x.kod === b.kod)?.kaynak ?? "dis";

export async function getBilesenler() { return DEPO.bilesenler; }
export async function getRecete() { return DEPO.recete; }
export async function getIcUretim() { return DEPO.icUretim; }
export async function getPartiler() { return DEPO.partiler; }
export async function getTedarik() { return DEPO.tedarik; }
export async function getHavuz() { return DEPO.havuz; }
export async function getFiyatListesi(): Promise<FiyatListesi> { return DEPO.fiyat; }
export async function getKargoFirmalari() { return DEPO.kargoFirmalari; }
export async function getEkip() { return DEPO.ekip; }

// Aşağıdakiler yalnızca action dosyalarından çağrılır. TODO: Supabase bağlanınca insert/update sorgularına dönüşecek.
export async function bilesenGuncelle(kod: string, fark: number) {
  const b = DEPO.bilesenler.find((x) => x.kod === kod);
  if (b) b.adet = Math.max(0, b.adet + fark);
  return b ?? null;
}
export async function bilesenEkle(b: BilesenKalemi, modeller: CihazModeli[]) {
  DEPO.bilesenler.push(b);
  for (const m of modeller) if (!DEPO.recete[m].includes(b.kod)) DEPO.recete[m].push(b.kod);
}
export async function icUretimEkle(e: IcUretimEmri) { DEPO.icUretim.unshift(e); }
export async function icUretimiGuncelle(id: string, f: (e: IcUretimEmri) => void) {
  const e = DEPO.icUretim.find((x) => x.id === id);
  if (e) f(e);
  return e ?? null;
}
export async function partiEkle(p: UretimPartisi) { DEPO.partiler.unshift(p); }
export async function partiyiGuncelle(id: string, f: (p: UretimPartisi) => void) {
  const p = DEPO.partiler.find((x) => x.id === id);
  if (p) f(p);
  return p ?? null;
}
export async function tedarikEkle(t: TedarikSiparisi) { DEPO.tedarik.unshift(t); }
export async function tedarikiGuncelle(id: string, f: (t: TedarikSiparisi) => void) {
  const t = DEPO.tedarik.find((x) => x.id === id);
  if (t) f(t);
  return t ?? null;
}
export async function havuzaEkle(s: HavuzSeri[]) { DEPO.havuz.push(...s); }
/** Siparişe atanan seri numaraları havuzdan çıkar (sipariş tarafı çağırır) */
export async function havuzdanCikar(seriler: string[]) {
  const set = new Set(seriler);
  DEPO.havuz = DEPO.havuz.filter((h) => !set.has(h.seriNo));
}
export async function fiyatKaydet(f: FiyatListesi) { DEPO.fiyat = f; }
export async function kargoFirmalariKaydet(l: string[]) { DEPO.kargoFirmalari = l; }
export async function kullaniciKaydet(k: Kullanici) {
  const i = DEPO.ekip.findIndex((x) => x.id === k.id);
  if (i >= 0) DEPO.ekip[i] = k;
  else DEPO.ekip.push(k);
}
