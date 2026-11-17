// Bayi portalı Özet sayfasının hesapları: yapılacaklar, lisans yenileme, aylık satış, stok, son hareketler.
// Hepsi bayinin kendi kayıtlarından (bayiVerisi) türetilir; yeni veri kaynağı yok.
import { getBayiLeadleri } from "./lead-queries";
import { ACIK_ASAMALAR } from "./lead-ortak";
import { getRmalar, ADIM_ADI, HEDEF_GUN } from "@/components/rma/queries";
import { acikMi } from "@/components/rma/ortak";
import { getEkip, getFiyatListesi } from "@/components/operasyon/queries";
import { getIcerikler } from "@/components/pazarlama/queries";
import { getYenilemeTalepleri } from "./queries";
import { bayiVerisi, gunler } from "./veri";
import { ticariKosullar } from "./katalog";

const GUN = 86_400_000;
const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / GUN);
const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export type Yapilacak = { tur: "lisans" | "stok" | "rma" | "lead"; baslik: string; detay: string; href: string; acil: boolean; seriNo?: string; talepVar?: boolean };
export type Olay = { tarih: string; tur: "sevkiyat" | "satis" | "lisans" | "iade" | "degisim" | "rma" | "siparis"; metin: string };

/** Bayiye atanmış Embedra temsilcisi: CRM › Bayi detayı › Portal'da seçilen ekip üyesi (Operasyon › Ekip) */
async function temsilci(id: string | null | undefined) {
  const ekip = await getEkip();
  const k = ekip.find((x) => x.id === id && x.aktif) ?? ekip.find((x) => x.rol === "Satış" && x.aktif) ?? null;
  return k && { ad: k.ad, rol: `${k.rol} · Embedra`, telefon: k.telefon ?? "", eposta: k.eposta };
}

export async function portalOzeti() {
  const v = await bayiVerisi();
  const [leadler, rmalar, fiyat, icerikler, talepler] = await Promise.all([getBayiLeadleri(v.bayi.id), getRmalar(), getFiyatListesi(), getIcerikler(), getYenilemeTalepleri(v.bayi.id)]);
  const { bugun, ileri: otuzGun } = gunler(30);
  const doksanGun = gunler(90).ileri;
  const talepSeri = new Set(talepler.map((t) => t.seriNo));

  // --- Lisans: 30 gün içinde biten (yapılacak) ve 90 günlük yenileme potansiyeli
  const musteride = v.cihazlar.filter((c) => c.musteriId && c.lisansBitis);
  const yakinda = musteride.filter((c) => c.lisansBitis! <= otuzGun).sort((a, b) => a.lisansBitis!.localeCompare(b.lisansBitis!));
  const doksan = musteride.filter((c) => c.lisansBitis! >= bugun && c.lisansBitis! <= doksanGun);
  // Bayinin para biriminde (yurt dışı bayi EUR, kur Operasyon › Ayarlar'dan)
  const kosul = ticariKosullar(v.bayi.ulkeKodu, fiyat);
  const yenilemeTutari = Math.round(doksan.reduce((t, c) => t + (fiyat.lisans[c.plan]?.fiyat ?? 0), 0) / kosul.kur);
  const birYilOnce = new Date(Date.parse(bugun) - 365 * GUN).toISOString().slice(0, 10);
  const yenilenen = v.hareketler.filter((h) => h.tur === "lisans" && h.tarih >= birYilOnce).reduce((t, h) => t + Math.max(1, h.kalemler.length), 0);
  const dolmus = musteride.filter((c) => c.lisansBitis! < bugun && c.lisansBitis! >= birYilOnce).length;
  const yenilemeOrani = yenilenen + dolmus ? Math.round((yenilenen / (yenilenen + dolmus)) * 100) : null;

  // --- Stok: seri başına sevk tarihi, model dağılımı, en eski stok
  const sevkTarihi = new Map<string, string>();
  for (const h of v.hareketler) if (h.tur === "sevkiyat") for (const k of h.kalemler) if (k.seriNo) sevkTarihi.set(k.seriNo, h.tarih);
  const stok = v.stokSeriler.map((s) => ({ ...s, gun: sevkTarihi.has(s.seriNo) ? gunFarki(sevkTarihi.get(s.seriNo)!, bugun) : 0 }));
  const modelStok = stok.reduce<Record<string, number>>((t, s) => ((t[s.model] = (t[s.model] ?? 0) + 1), t), {});
  const enEski = stok.reduce((m, s) => Math.max(m, s.gun), 0);
  const bekleyenStok = stok.filter((s) => s.gun >= 60);
  const yolda = v.siparisler.filter((s) => s.durum === "kargoda");

  // --- RMA ve lead
  const seriler = new Set(v.cihazlar.map((c) => c.seriNo));
  const acikRma = rmalar.filter((r) => (r.sahip.id === v.bayi.id || seriler.has(r.seriNo)) && acikMi(r));
  const bekleyenLead = leadler.filter((f) => ACIK_ASAMALAR.includes(f.asama) && !!f.sonrakiTarih && f.sonrakiTarih <= bugun);

  // --- Yapılacaklar (acil olanlar önce)
  const yapilacaklar: Yapilacak[] = [
    ...yakinda.map((c): Yapilacak => {
      const kalan = gunFarki(bugun, c.lisansBitis!);
      return { tur: "lisans", baslik: `${c.musteri} · lisans ${kalan < 0 ? `${-kalan} gün önce doldu` : kalan === 0 ? "bugün bitiyor" : `${kalan} gün sonra bitiyor`}`, detay: `${c.seriNo} · ${c.plan}`, href: "/portal/lisanslar", acil: kalan <= 7, seriNo: c.seriNo, talepVar: talepSeri.has(c.seriNo) };
    }),
    ...acikRma.map((r): Yapilacak => {
      const gun = gunFarki(r.acilis, bugun);
      return { tur: "rma", baslik: `${r.id} · ${ADIM_ADI[r.adim]} · ${gun}. gün`, detay: `${r.seriNo} · ${r.arizaTipi}`, href: "/portal/rma", acil: gun > HEDEF_GUN };
    }),
    ...bekleyenLead.map((f): Yapilacak => {
      const gecikme = gunFarki(f.sonrakiTarih!, bugun);
      return { tur: "lead", baslik: `${f.firma} · ${f.sonrakiAdim || "takip"}`, detay: `${f.sehir || f.kaynak} · ${gecikme ? `${gecikme} gün gecikti` : "bugün"}`, href: "/portal/leadler", acil: gecikme > 3 };
    }),
    ...(bekleyenStok.length
      ? [{ tur: "stok" as const, baslik: `${bekleyenStok.length} cihaz 60 günden uzun stokta`, detay: "Sattıysanız Cihazlarım'dan satış bildirin", href: "/portal/cihazlar", acil: false }]
      : []),
  ].sort((a, b) => Number(b.acil) - Number(a.acil));

  // --- Son 6 ay satış (cihaz adedi) ve çeyrek hedefinin aylık karşılığı
  const simdi = new Date(bugun + "T12:00:00");
  const aylar = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() - 5 + i, 1);
    const anahtar = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const adet = v.hareketler.filter((h) => h.tur === "satis" && h.tarih.startsWith(anahtar)).reduce((t, h) => t + h.kalemler.length, 0);
    return { anahtar, ad: AY_KISA[d.getMonth()], adet, buAy: i === 5 };
  });
  const aylikHedef = Math.ceil(v.bayi.moqHedef / 3);

  // --- Çeyrek temposu: hedefe kalan / kalan hafta
  const ceyrekSonu = new Date(simdi.getFullYear(), Math.floor(simdi.getMonth() / 3) * 3 + 3, 0);
  const kalanHafta = Math.max(1, Math.ceil((ceyrekSonu.getTime() - simdi.getTime()) / (7 * GUN)));
  const kalanCihaz = Math.max(0, v.bayi.moqHedef - v.bayi.moqGerceklesen);

  // --- Son hareketler: bayi hareketleri + siparişler + RMA açılışları
  const olaylar: Olay[] = [
    ...v.hareketler.map((h): Olay => ({
      tarih: h.tarih,
      tur: h.tur,
      metin: h.tur === "sevkiyat" ? `${h.kalemler.length} cihaz stoğunuza sevk edildi` : h.tur === "satis" ? `${h.kalemler.length} cihaz satıldı${h.musteri ? ` · ${h.musteri.ad}` : ""}`
        : h.tur === "iade" ? `${h.kalemler.length} cihaz Embedra'ya iade edildi` : h.tur === "degisim" ? `${h.eskiSeri} yerine ${h.kalemler[0]?.seriNo} verildi (RMA)`
        : `${h.plan ?? ""} lisans yenilendi${h.musteri ? ` · ${h.musteri.ad}` : ""}`,
    })),
    ...v.siparisler.map((s): Olay => ({ tarih: s.tarih, tur: "siparis", metin: `#${s.id} siparişi verildi` })),
    ...rmalar.filter((r) => r.sahip.id === v.bayi.id || seriler.has(r.seriNo)).map((r): Olay => ({ tarih: r.acilis, tur: "rma", metin: `${r.id} servis kaydı açıldı · ${r.seriNo}` })),
  ]
    .filter((o) => o.tarih.slice(0, 10) <= bugun)
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
    .slice(0, 6);

  const duyurular = icerikler.filter((i) => i.bayiPaylas).sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 3);

  return {
    v, bugun, yapilacaklar, olaylar, duyurular, yolda, aylar, aylikHedef, temsilci: await temsilci(v.bayi.temsilciId),
    lisans: { otuzGun: yakinda.length, doksanGun: doksan.length, yenilemeTutari, yenilemeOrani, paraBirimi: kosul.paraBirimi },
    stok: { toplam: stok.length, modelStok, enEski },
    tempo: { kalanCihaz, kalanHafta, haftalik: Math.ceil(kalanCihaz / kalanHafta) },
    acikLead: leadler.filter((f) => ACIK_ASAMALAR.includes(f.asama)).length,
  };
}
