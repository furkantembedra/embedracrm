// Bayi portalı "Dokümanlar" verisi: duyurular, bayiye açık dokümanlar, eğitim durumu, sözleşme özeti,
// bayinin para biriminde fiyat listesi ve "Bayiyle paylaş" işaretli pazarlama içerikleri.
import { getDokumanlar, getDuyurular, getEgitimTamamlanan } from "@/components/bayi-dokumanlar/queries";
import { hedefteMi } from "@/components/bayi-dokumanlar/ortak";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getIcerikler } from "@/components/pazarlama/queries";
import { getStok } from "@/components/siparisler/queries";
import { bayiFiyati, katalogOlustur, ticariKosullar } from "./katalog";
import { bayiVerisi, gunler } from "./veri";

const ayEkle = (t: string, ay: number) => { const d = new Date(t + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + ay); return d.toISOString().slice(0, 10); };

/** Fiyat listesi satırları (bayinin para biriminde): liste, bayi (iskontolu), önerilen satış */
export async function bayiFiyatListesi() {
  const v = await bayiVerisi();
  const [fiyat, stok] = await Promise.all([getFiyatListesi(), getStok()]);
  const indirim = v.basvuru?.sozlesme.moq.indirim ?? 0;
  const kosul = ticariKosullar(v.bayi.ulkeKodu, fiyat);
  const cevir = (tl: number) => Math.round(tl / kosul.kur);
  const satirlar = katalogOlustur(fiyat, stok).map((u) => ({
    grup: u.tur === "cihaz" ? "Cihazlar" : u.tur === "lisans" ? "ONESuite lisans (12 ay)" : "Aksesuar ve yedek parça",
    ad: u.ad, aciklama: u.aciklama, liste: cevir(u.liste), bayi: cevir(bayiFiyati(u.liste, indirim)), kdvli: u.kdvli,
  }));
  return { v, satirlar, indirim, paraBirimi: kosul.paraBirimi, kur: kosul.kur, yurtDisi: kosul.yurtDisi, kdv: kosul.kdv };
}

export async function dokumanlarVerisi() {
  const f = await bayiFiyatListesi();
  const { v } = f;
  const id = v.bayi.id;
  const [dokumanlar, duyurular, tamamlanan, icerikler] = await Promise.all([getDokumanlar(), getDuyurular(), getEgitimTamamlanan(id), getIcerikler()]);
  const { bugun } = gunler();
  const s = v.basvuru?.sozlesme ?? null;
  const baslangic = v.bayi.sozlesmeBaslangic ?? v.basvuru?.tarih ?? null;
  const sureAy = v.bayi.sozlesmeSureAy ?? 24;
  const yillik = s?.moq.yillik ?? null;
  return {
    bugun,
    bayi: { ad: v.bayi.ad, bolge: v.bayi.bolge },
    duyurular: duyurular.filter((d) => hedefteMi(d.hedef, id)).map((d) => ({ ...d, okundu: d.okuyanlar.includes(id), okuyanlar: [] as string[] })),
    dokumanlar: dokumanlar.filter((d) => hedefteMi(d.hedef, id)).map((d) => ({ ...d, hedef: undefined })), // hangi bayilerle paylaşıldığı bayiye gösterilmez
    tamamlanan,
    sozlesme: s && {
      bolge: s.bolge.kapsam, munhasir: !!s.bolge.munhasir, yillik, indirim: s.moq.indirim ?? 0, destek: s.destek.bayi,
      ilkSiparis: `${s.moq.one ?? 0} ONE + ${s.moq.lite ?? 0} ONE LITE`, kitTarihi: s.marka.kitTarihi || null,
      baslangic, bitis: baslangic ? ayEkle(baslangic, sureAy) : null, // CRM › Bayi detayı › Portal
      ceyrek: { hedef: v.bayi.moqHedef, gerceklesen: v.bayi.moqGerceklesen, sonraki: yillik ? Math.ceil(yillik / 4) : v.bayi.moqHedef },
    },
    fiyat: { satirlar: f.satirlar, indirim: f.indirim, paraBirimi: f.paraBirimi, kur: f.kur, yurtDisi: f.yurtDisi, kdv: f.kdv },
    pazarlama: icerikler.filter((i) => i.bayiPaylas).sort((a, b) => b.tarih.localeCompare(a.tarih))
      .map((i) => ({ id: i.id, baslik: i.baslik, kanal: i.kanal, tarih: i.tarih, aciklama: i.aciklama, hashtaglar: i.hashtaglar, medya: i.medya })),
  };
}
