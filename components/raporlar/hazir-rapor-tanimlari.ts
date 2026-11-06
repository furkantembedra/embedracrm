// Hazır raporlar: her biri mevcut kayıtlardan bir tablo üretir (Excel/CSV ve PDF olarak indirilir)
import type { ChipTon } from "@/components/ui/chip";
import type { Cihaz } from "@/components/cihaz-lisans/queries";
import { lisansIlerleme, tarihYaz as cihazTarihi } from "@/components/cihaz-lisans/ortak";
import { DURUM_ADI as TALEP_DURUMU, type Talep } from "@/components/destek/queries";
import type { AktifBayi } from "@/components/bayiler/queries";
import { moqYuzde, stokDurumu } from "@/components/bayiler/ortak";
import { DONEM_BILGI, type Donem, type RaporOzeti } from "./queries";

export type RaporKategorisi = "satis" | "lisans" | "destek" | "bayi";

export const KATEGORI_BILGI: Record<RaporKategorisi, { ad: string; ton: ChipTon }> = {
  satis: { ad: "Satış", ton: "ink" },
  lisans: { ad: "Lisans", ton: "lime" },
  destek: { ad: "Destek", ton: "info" },
  bayi: { ad: "Bayi", ton: "warn" },
};

export type RaporKaynaklari = {
  ozet: RaporOzeti;
  donem: Donem;
  cihazlar: Cihaz[];
  talepler: Talep[];
  bayiler: AktifBayi[];
  bugun: number | null;
};

export type HazirRapor = {
  id: string;
  kategori: RaporKategorisi;
  baslik: string;
  aciklama: string;
  /** İlk satır başlıklar */
  tablo: (k: RaporKaynaklari) => (string | number)[][];
};

const tl = (n: number) => n.toLocaleString("tr-TR");
const talepTarihi = (iso: string) => new Date(iso).toLocaleDateString("tr-TR");

export const HAZIR_RAPORLAR: HazirRapor[] = [
  {
    id: "satis-ozeti",
    kategori: "satis",
    baslik: "Satış özeti",
    aciklama: "Seçili dönemin göstergeleri ve ülke kırılımı",
    tablo: ({ ozet, donem }) => {
      const r = ozet.donemler[donem];
      return [
        ["Bölüm", "Kalem", "Değer", "Önceki döneme göre"],
        ...r.kpi.map((k) => ["Gösterge", k.etiket, k.deger, k.degisim]),
        ...r.ulkeler.map((u) => ["Ülke geliri (TL)", `${u.ad} (${u.kod})`, tl(u.tutar), ""]),
      ];
    },
  },
  {
    id: "lead-kaynak",
    kategori: "satis",
    baslik: "Lead kaynak performansı",
    aciklama: "Web, WhatsApp, Instagram, fuar ve öneri dönüşüm oranları",
    tablo: ({ ozet, donem }) => [
      ["Kaynak", "Lead", "Müşteri", "Dönüşüm %"],
      ...ozet.donemler[donem].kaynaklar.map((k) => [k.ad, k.lead, k.musteri, Math.round((k.musteri / k.lead) * 100)]),
    ],
  },
  {
    id: "yenileme-90",
    kategori: "lisans",
    baslik: "Yenileme listesi (90 gün)",
    aciklama: "90 gün içinde biten veya süresi geçmiş lisanslar, en acilden",
    tablo: ({ cihazlar, bugun }) => {
      const satirlar = cihazlar
        .map((c) => ({ c, i: lisansIlerleme(c.lisansBaslangic, c.lisansBitis, bugun) }))
        .filter((x) => x.i && x.i.kalan <= 90)
        .sort((a, b) => a.i!.kalan - b.i!.kalan);
      return [
        ["Seri no", "Müşteri", "Ülke", "Plan", "Lisans bitişi", "Kalan gün"],
        ...satirlar.map(({ c, i }) => [c.seriNo, c.musteri, c.ulke, c.plan, cihazTarihi(c.lisansBitis), i!.kalan]),
      ];
    },
  },
  {
    id: "plan-gecisleri",
    kategori: "lisans",
    baslik: "Plan geçişleri",
    aciklama: "Lisans yenilemelerinde Basic → Pro → Pro+ yükseltmeleri ve düşüşler",
    tablo: ({ cihazlar }) => {
      const sira = { Basic: 0, Pro: 1, "Pro+": 2 } as const;
      const satirlar = cihazlar.flatMap((c) =>
        c.gecmis.slice(0, -1).flatMap((yeni, i) => {
          const eski = c.gecmis[i + 1];
          if (eski.plan === yeni.plan) return [];
          return [[cihazTarihi(yeni.baslangic), c.seriNo, c.musteri, eski.plan, yeni.plan, sira[yeni.plan] > sira[eski.plan] ? "Yükseltme" : "Düşüş"]];
        }),
      );
      return [["Tarih", "Seri no", "Müşteri", "Eski plan", "Yeni plan", "Tür"], ...satirlar];
    },
  },
  {
    id: "destek-ozeti",
    kategori: "destek",
    baslik: "Destek talepleri özeti",
    aciklama: "Konu, öncelik ve durum bazında tüm talepler",
    tablo: ({ talepler }) => [
      ["Talep no", "Açılış", "Müşteri", "Başlık", "Konu", "Öncelik", "Kanal", "Durum"],
      ...talepler.map((t) => [`#${t.id}`, talepTarihi(t.acilis), t.musteri, t.baslik, t.konu, t.oncelik, t.kanal, TALEP_DURUMU[t.durum]]),
    ],
  },
  {
    id: "arac-kapsami",
    kategori: "destek",
    baslik: "Araç kapsamı talepleri",
    aciklama: "Ar-Ge için müşterilerin istediği marka ve modeller",
    tablo: ({ talepler }) => [
      ["Talep no", "Açılış", "Müşteri", "Araç / sistem", "Açıklama"],
      ...talepler.filter((t) => t.konu === "Araç kapsamı isteği").map((t) => [`#${t.id}`, talepTarihi(t.acilis), t.musteri, t.arac, t.aciklama]),
    ],
  },
  {
    id: "bayi-sellout",
    kategori: "bayi",
    baslik: "Bayi sell-out ve stok",
    aciklama: "Bölge bazında satış, stok ve MOQ gerçekleşmesi",
    tablo: ({ bayiler }) => [
      ["Bayi", "Bölge", "Satılan", "Stok", "Stok durumu", "MOQ hedefi", "MOQ gerçekleşen", "MOQ %"],
      ...bayiler.map((b) => [b.ad, b.bolge, b.satilan, b.stok, stokDurumu(b.stok).ad, b.moqHedef, b.moqGerceklesen, moqYuzde(b)]),
    ],
  },
];

/** Her raporun alt başlığı: dönem bazlı olanlar dönemi, diğerleri "Güncel kayıtlar" */
export function raporAltBasligi(r: HazirRapor, donem: Donem) {
  return r.kategori === "satis" ? DONEM_BILGI[donem].uzun : "Güncel kayıtlar";
}
