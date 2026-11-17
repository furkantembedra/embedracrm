// Bayi lead'leri deposu (demo: sunucu belleğinde). Yalnızca portal işlemleri okur / yazar; CRM bu kayıtları göstermez.
// TODO: Supabase bağlanınca bayi_leadleri tablosu (RLS: yalnızca kendi bayi_id'si).
import type { BayiLead } from "./lead-ortak";

const DEMO: BayiLead[] = [
  {
    id: "bl-1", bayiId: "directie", firma: "Auto Expert Sibiu", yetkili: "Radu Ionescu", telefon: "+40 744 120 330", eposta: "radu@autoexpert.ro", sehir: "Sibiu",
    kaynak: "Fuar", ilgi: { model: "ONE", adet: 2, plan: "Pro" }, tutar: 5200, asama: "demo", kayipNedeni: null,
    sonrakiAdim: "Atölyede canlı demo", sonrakiTarih: "2026-11-14", olusturma: "2026-10-22", kapanis: null, teklifler: [], satilanSeriler: [],
    notlar: [{ zaman: "2026-10-22T15:10", metin: "Automechanika standında tanıştık, 2 atölyesi var." }, { zaman: "2026-11-05T11:00", metin: "Telefonda görüştük, demo istiyor." }],
  },
  {
    id: "bl-2", bayiId: "directie", firma: "Pitești Direcție Service", yetkili: "Elena Dumitru", telefon: "+40 731 555 210", eposta: "", sehir: "Pitești",
    kaynak: "Referans", ilgi: { model: "ONE Lite", adet: 1, plan: "Basic" }, tutar: 1900, asama: "yeni", kayipNedeni: null,
    sonrakiAdim: "İlk arama", sonrakiTarih: "2026-11-16", olusturma: "2026-11-12", kapanis: null, teklifler: [], satilanSeriler: [],
    notlar: [{ zaman: "2026-11-12T09:30", metin: "Auto Volan Cluj önerdi." }],
  },
  {
    id: "bl-3", bayiId: "directie", firma: "Galați Steering Center", yetkili: "Andrei Matei", telefon: "+40 722 410 870", eposta: "andrei@gsc.ro", sehir: "Galați",
    kaynak: "Sosyal medya", ilgi: { model: "ONE", adet: 1, plan: "Pro+" }, tutar: 3600, asama: "teklif", kayipNedeni: null,
    sonrakiAdim: "Teklif takibi", sonrakiTarih: "2026-11-19", olusturma: "2026-10-30", kapanis: null, satilanSeriler: [],
    teklifler: [{
      id: "DP-2026-014", no: "DP-2026-014", versiyon: 1, iskonto: 0, kdv: 0.21, gecerlilik: "2026-11-30",
      kalemler: [{ tur: "cihaz", model: "ONE", adet: 1, birimFiyat: 2450 }, { tur: "lisans", paket: "Pro+", adet: 1, birimFiyat: 1150 }],
      odemeSartlari: "%100 peşin · Banka havalesi", teslimSartlari: "Siparişten itibaren 3 iş günü · Kurulum dahil", not: "Kurulum ve 2 saatlik eğitim dahil.",
      durum: "gonderildi", olusturma: "2026-11-10", gonderim: "2026-11-10", sonuc: null,
    }],
    notlar: [{ zaman: "2026-10-30T16:45", metin: "Instagram reklamından yazdı." }, { zaman: "2026-11-10T10:00", metin: "Teklif DP-2026-014 gönderildi.", sistem: true }],
  },
  {
    id: "bl-4", bayiId: "directie", firma: "Craiova Auto Lab", yetkili: "Mihai Popa", telefon: "+40 755 300 900", eposta: "", sehir: "Craiova",
    kaynak: "Saha ziyareti", ilgi: { model: "ONE", adet: 1, plan: "Pro" }, tutar: 2600, asama: "kaybedildi", kayipNedeni: "Rakip ürün",
    sonrakiAdim: "6 ay sonra tekrar ara", sonrakiTarih: "2027-04-01", olusturma: "2026-09-18", kapanis: "2026-10-20", teklifler: [], satilanSeriler: [],
    notlar: [{ zaman: "2026-10-20T14:00", metin: "Kaybedildi · Rakip ürün", sistem: true }],
  },
  {
    id: "bl-5", bayiId: "directie", firma: "Timiș Steering Lab", yetkili: "Ioana Stan", telefon: "+40 766 101 202", eposta: "ioana@tsl.ro", sehir: "Timișoara",
    kaynak: "Mevcut müşteri", ilgi: { model: "ONE", adet: 1, plan: "Pro+" }, tutar: 3600, asama: "kazanildi", kayipNedeni: null,
    sonrakiAdim: "", sonrakiTarih: null, olusturma: "2026-10-01", kapanis: "2026-10-15", teklifler: [], satilanSeriler: [],
    notlar: [{ zaman: "2026-10-15T12:00", metin: "Kazanıldı", sistem: true }],
  },
];

const g = globalThis as { __embedraBayiLeadleri?: BayiLead[] };
const DEPO = (g.__embedraBayiLeadleri ??= structuredClone(DEMO));
// Teklif yapısı değişti: bellekte eski biçimle kalmış kayıtları yeni biçime getir (sunucu yeniden başlatılmadan)
for (const l of DEPO as (BayiLead & { teklif?: unknown })[]) {
  if (!Array.isArray(l.teklifler)) {
    l.teklifler = structuredClone(DEMO.find((d) => d.id === l.id)?.teklifler ?? []);
    delete l.teklif;
  }
}

export async function getBayiLeadleri(bayiId: string) {
  return DEPO.filter((l) => l.bayiId === bayiId);
}
export async function getBayiLead(bayiId: string, id: string) {
  return DEPO.find((l) => l.id === id && l.bayiId === bayiId) ?? null;
}
export async function bayiLeadEkle(l: BayiLead) {
  DEPO.push(l);
}
export async function bayiLeadGuncelle(bayiId: string, id: string, f: (l: BayiLead) => void) {
  const l = DEPO.find((x) => x.id === id && x.bayiId === bayiId);
  if (!l) return null;
  f(l);
  return l;
}
/** Bayinin sıradaki teklif numarası: "DP-2026-015" (bayi adının baş harfleri) */
export async function sonrakiTeklifNo(bayiId: string, bayiAd: string, yil: string) {
  const onek = bayiAd.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toLocaleUpperCase("en")).join("").replace(/[^A-Z]/g, "X");
  const n = DEPO.filter((l) => l.bayiId === bayiId).flatMap((l) => l.teklifler).filter((t) => t.id.includes(`-${yil}-`)).map((t) => Number(t.id.split("-")[2]));
  return `${onek}-${yil}-${String(Math.max(13, ...n) + 1).padStart(3, "0")}`;
}
