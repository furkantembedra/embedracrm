// Bayi bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import { URUN_BILGI } from "@/lib/urunler";
import { tl } from "@/lib/format";
import { ASAMALAR, HEDEF_ULKELER, ULKELER, type AktifBayi, type Basvuru, type BayiAsamasi, type BayiHareketi, type SozlesmeDetayi } from "./queries";

export const ASAMA_TONU: Record<BayiAsamasi, ChipTon> = { basvuru: "gray", degerlendirme: "info", sozlesme: "warn", lansman: "lime" };

/* ---------- Sözleşme kontrol listesi ---------- */

/** İlk sipariş tutarı (KDV hariç, bayi indirimi düşülmüş) */
export function moqTutari(m: SozlesmeDetayi["moq"]) {
  const brut = (m.one ?? 0) * URUN_BILGI.ONE.fiyat + (m.lite ?? 0) * URUN_BILGI["ONE Lite"].fiyat;
  return Math.round(brut * (1 - (m.indirim ?? 0) / 100));
}

/** Maddenin zorunlu alanları dolu mu? (sira: KONTROL_LISTESI sırası) */
export function maddeTamam(sira: number, s: SozlesmeDetayi): boolean {
  switch (sira) {
    case 0: return !!s.bolge.kapsam.trim() && s.bolge.munhasir !== null;
    case 1: return (s.moq.one ?? 0) + (s.moq.lite ?? 0) > 0 && s.moq.indirim !== null;
    case 2: return !!s.marka.kitTarihi && s.marka.logoOnay;
    case 3: return s.destek.bayi.length > 0;
    default: return false;
  }
}

/** Kapalı satırda görünen tek satırlık özet; hiçbir şey girilmediyse null */
export function maddeOzeti(sira: number, s: SozlesmeDetayi): string | null {
  const p: string[] = [];
  switch (sira) {
    case 0:
      if (s.bolge.kapsam.trim()) p.push(s.bolge.kapsam.trim());
      if (s.bolge.munhasir !== null) p.push(s.bolge.munhasir ? "tek bayi" : "başka bayi de olabilir");
      break;
    case 1: {
      const adet = [s.moq.one ? `${s.moq.one}× ONE` : "", s.moq.lite ? `${s.moq.lite}× ONE LITE` : ""].filter(Boolean).join(" + ");
      if (adet) p.push(adet);
      if (s.moq.indirim !== null) p.push(`%${s.moq.indirim} indirim`);
      if (adet) p.push(tl(moqTutari(s.moq)));
      break;
    }
    case 2:
      if (s.marka.kitTarihi) p.push(`Kit gönderildi · ${tarihYaz(s.marka.kitTarihi)}`);
      if (s.marka.logoOnay) p.push("logo onaylı");
      break;
    case 3:
      if (s.destek.bayi.length) p.push(`Bayi: ${s.destek.bayi.join(", ")}`);
      break;
  }
  return p.length ? p.join(" · ") : null;
}

export const sonrakiAsama = (a: BayiAsamasi): BayiAsamasi | null => ASAMALAR[ASAMALAR.indexOf(a) + 1] ?? null;

export function puanRengi(p: number) {
  if (p >= 80) return "bg-[#1F8A4C]";
  if (p >= 65) return "bg-[#E58A2B]";
  return "bg-[#D93F3F]";
}

export function stokDurumu(stok: number): { ad: string; ton: ChipTon } {
  if (stok <= 1) return { ad: "Kritik", ton: "err" };
  if (stok <= 4) return { ad: "Sipariş zamanı", ton: "warn" };
  return { ad: "Yeterli", ton: "ok" };
}

export const moqYuzde = (b: AktifBayi) => (b.moqHedef ? Math.min(100, Math.round((b.moqGerceklesen / b.moqHedef) * 100)) : 0);

/** "2026-10-28" → "28 Eki" */
export const tarihYaz = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** "2026-11-06T14:00" → "6 Kas 14:00" */
export function gorusmeYaz(t: string) {
  const d = new Date(t);
  return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

type BolgeDurumu = { kod: string; ad: string; durum: string; ton: ChipTon; aktif: number; surecte: number }; // surecte: lansmana gelmemiş başvuru

/** Ülke başına en ileri durum: aktif bayi > lansman > sözleşme > değerlendirme > başvuru > bayi aranıyor */
export function bolgeKapsamasi(basvurular: Basvuru[], aktif: AktifBayi[]): BolgeDurumu[] {
  const sira = (kod: string) => {
    if (aktif.some((b) => b.ulkeKodu === kod)) return 5;
    const ust = basvurular.filter((b) => b.ulkeKodu === kod).map((b) => ASAMALAR.indexOf(b.asama) + 1);
    return ust.length ? Math.max(...ust) : 0;
  };
  const kodlar = [...new Set([...HEDEF_ULKELER, ...aktif.map((b) => b.ulkeKodu), ...basvurular.map((b) => b.ulkeKodu)])];
  const ETIKET: [string, ChipTon][] = [
    ["Bayi aranıyor", "gray"],
    ["Başvuru", "gray"],
    ["Değerlendirme", "info"],
    ["Sözleşme", "warn"],
    ["Lansman", "lime"],
    ["Aktif", "ok"],
  ];
  return kodlar
    .map((kod) => ({ kod, s: sira(kod) }))
    .sort((a, b) => b.s - a.s || (ULKELER[a.kod] ?? a.kod).localeCompare(ULKELER[b.kod] ?? b.kod, "tr"))
    .map(({ kod, s }) => ({
      kod,
      ad: ULKELER[kod] ?? kod,
      durum: ETIKET[s][0],
      ton: ETIKET[s][1],
      aktif: aktif.filter((b) => b.ulkeKodu === kod).length,
      surecte: basvurular.filter((b) => b.ulkeKodu === kod && b.asama !== "lansman").length,
    }));
}

/* ---------- Bayi hareketleri: dönem hesapları ---------- */

export type Donem = { yil: number; ceyrekler: number[] }; // ceyrekler: 1–4, hepsi = tüm yıl

/** "2026-10-14" → { yil: 2026, ceyrek: 4 } */
export const ceyregi = (tarih: string) => ({ yil: Number(tarih.slice(0, 4)), ceyrek: Math.floor((Number(tarih.slice(5, 7)) - 1) / 3) + 1 });

/** Bugünün yılı ve çeyreği; bugun: useBugun() değeri (ms) */
export function buCeyrek(bugun: number) {
  const d = new Date(bugun);
  return { yil: d.getFullYear(), ceyrek: Math.floor(d.getMonth() / 3) + 1 };
}

export const donemde = (tarih: string, d: Donem) => {
  const c = ceyregi(tarih);
  return c.yil === d.yil && d.ceyrekler.includes(c.ceyrek);
};

type ModelSayisi = { ONE: number; "ONE Lite": number; toplam: number };
const say = (hareketler: BayiHareketi[]): ModelSayisi => {
  const s = { ONE: 0, "ONE Lite": 0, toplam: 0 };
  for (const h of hareketler) for (const k of h.kalemler) { s[k.model]++; s.toplam++; }
  return s;
};

/** Seçilen dönemde bayiye sevk edilen, bayinin sattığı, lisans satışları ve MOQ; stok her zaman bugünkü durumdur */
export function bayiOzeti(bayi: AktifBayi, tum: BayiHareketi[], d: Donem) {
  const kendi = tum.filter((h) => h.bayiId === bayi.id);
  const donemdeki = kendi.filter((h) => donemde(h.tarih, d));
  const tur = (l: BayiHareketi[], t: BayiHareketi["tur"]) => l.filter((h) => h.tur === t);
  const sevkTum = say(tur(kendi, "sevkiyat"));
  const satisTum = say(tur(kendi, "satis"));
  const sevk = say(tur(donemdeki, "sevkiyat"));
  const moqHedef = bayi.moqHedef * d.ceyrekler.length;
  return {
    sevk,
    satis: say(tur(donemdeki, "satis")),
    lisans: tur(donemdeki, "lisans").reduce((t, h) => t + h.kalemler.length, 0),
    stok: { ONE: sevkTum.ONE - satisTum.ONE, "ONE Lite": sevkTum["ONE Lite"] - satisTum["ONE Lite"], toplam: sevkTum.toplam - satisTum.toplam },
    moqHedef,
    moqYuzde: moqHedef ? Math.min(100, Math.round((sevk.toplam / moqHedef) * 100)) : 0,
    hareketler: donemdeki,
  };
}

/** Bayinin stoktaki, seri numarası bilinen cihazları (satışta seçilebilsin) */
export function stoktakiSeriler(bayiId: string, tum: BayiHareketi[]) {
  const satilan = new Set(tum.filter((h) => h.bayiId === bayiId && h.tur === "satis").flatMap((h) => h.kalemler.map((k) => k.seriNo)));
  return tum
    .filter((h) => h.bayiId === bayiId && h.tur === "sevkiyat")
    .flatMap((h) => h.kalemler)
    .filter((k): k is { model: typeof k.model; seriNo: string } => !!k.seriNo && !satilan.has(k.seriNo));
}

export const moqRengi = (yuzde: number) => (yuzde >= 80 ? "bg-[#1F8A4C]" : yuzde >= 50 ? "bg-[#E58A2B]" : "bg-[#D93F3F]");
