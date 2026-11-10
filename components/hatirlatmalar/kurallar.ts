// Otomatik hatırlatma kuralları: satış, teklif, sipariş, stok, lisans ve RMA verisinden hesaplanır.
// Anahtar kaydın o anki durumunu içerir (ör. fırsatın sonraki adım tarihi). Kayıt güncellenince
// eski hatırlatma kendiliğinden düşer, gerekirse yenisi oluşur; "tamam" denen anahtar tekrar çıkmaz.
import { getFirsatlar, KAPALI_ASAMALAR } from "@/components/satis-hatti/queries";
import { getTeklifler } from "@/components/teklifler/queries";
import { getSiparisler, getStok } from "@/components/siparisler/queries";
import { getBilesenler } from "@/components/operasyon/queries";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getRmalar } from "@/components/rma/queries";
import type { Hatirlatma } from "./queries";

// Kural → sorumlu rol (Operasyon › Ekip): Satış u2, Destek u3, Operasyon u4
const SATIS = "u2";
const DESTEK = "u3";
const OPERASYON = "u4";

export const gunEkle = (tarih: string, gun: number) => {
  const d = new Date(tarih + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
};

const oto = (anahtar: string, h: Omit<Hatirlatma, "id" | "durum" | "otomatik">): Hatirlatma => ({ id: `oto:${anahtar}`, durum: "bekliyor", otomatik: true, ...h });

export async function otomatikHatirlatmalar(bugun: string): Promise<Hatirlatma[]> {
  const [firsatlar, teklifler, siparisler, stok, bilesenler, cihazlar, rmalar] = await Promise.all([
    getFirsatlar(), getTeklifler(), getSiparisler(), getStok(), getBilesenler(), getCihazlar(), getRmalar(),
  ]);
  const l: Hatirlatma[] = [];

  for (const f of firsatlar) {
    if (KAPALI_ASAMALAR.includes(f.asama)) continue;
    const kayit = { tur: "firsat" as const, id: f.id, ad: f.firma, href: "/satis-hatti" };
    if (f.sonrakiTarih < bugun) {
      l.push(oto(`firsat-gecikti:${f.id}:${f.sonrakiTarih}`, { baslik: `Gecikti: ${f.firma} · ${f.sonrakiAdim}`, aciklama: "Fırsatın sonraki adım tarihi geçti.", kayit, sorumluId: SATIS, zaman: `${f.sonrakiTarih}T09:00`, onem: "yuksek" }));
    } else if (f.sonrakiTarih === bugun) {
      l.push(oto(`firsat-bugun:${f.id}:${f.sonrakiTarih}`, { baslik: `Bugün: ${f.firma} · ${f.sonrakiAdim}`, aciklama: "Fırsatın sonraki adımı bugün.", kayit, sorumluId: SATIS, zaman: `${bugun}T09:00`, onem: "normal" }));
    }
    if (f.sonHareket && f.sonHareket <= gunEkle(bugun, -3)) {
      const gun = Math.round((Date.parse(bugun) - Date.parse(f.sonHareket)) / 86_400_000);
      l.push(oto(`firsat-hareketsiz:${f.id}:${f.sonHareket}`, { baslik: `${f.firma} ${gun} gündür hareketsiz`, aciklama: "Açık fırsatta 3+ gündür değişiklik yok. Arayıp durumu güncelleyin.", kayit, sorumluId: SATIS, zaman: `${gunEkle(f.sonHareket, 3)}T09:00`, onem: "normal" }));
    }
  }

  for (const t of teklifler) {
    if (t.durum !== "gonderildi") continue;
    const kayit = { tur: "teklif" as const, id: t.id, ad: `${t.no} · ${t.firma}`, href: `/teklifler/${t.id}` };
    if (t.gecerlilik < bugun) {
      l.push(oto(`teklif-doldu:${t.id}:${t.gecerlilik}`, { baslik: `Teklif süresi doldu: ${t.no}`, aciklama: `${t.firma} yanıt vermedi. Revize edip yeniden gönderin ya da kapatın.`, kayit, sorumluId: SATIS, zaman: `${t.gecerlilik}T18:00`, onem: "yuksek" }));
    } else if (t.gecerlilik <= gunEkle(bugun, 2)) {
      l.push(oto(`teklif-bitiyor:${t.id}:${t.gecerlilik}`, { baslik: `Teklif geçerliliği bitiyor: ${t.no}`, aciklama: `${t.firma} · son gün ${t.gecerlilik.split("-").reverse().join(".")}`, kayit, sorumluId: SATIS, zaman: `${gunEkle(t.gecerlilik, -2)}T09:00`, onem: "normal" }));
    }
  }

  for (const s of siparisler) {
    const kayit = { tur: "siparis" as const, id: s.id, ad: `#${s.id} · ${s.musteri}`, href: `/siparisler/${s.id}` };
    const gun = s.tarih.slice(0, 10);
    if (s.durum === "hazirlaniyor" && gun <= gunEkle(bugun, -2)) {
      l.push(oto(`siparis-kargo:${s.id}`, { baslik: `Kargoya verilmedi: #${s.id}`, aciklama: `${s.musteri} siparişi ${gun.split("-").reverse().join(".")} tarihinden beri hazırlanıyor.`, kayit, sorumluId: OPERASYON, zaman: `${gunEkle(gun, 2)}T09:00`, onem: "yuksek" }));
    }
    const kargoNotu = [...s.notlar].reverse().find((n) => /kargoya verildi/i.test(n.metin));
    const kargoGun = (kargoNotu?.zaman ?? s.tarih).slice(0, 10);
    if (s.durum === "kargoda" && kargoGun <= gunEkle(bugun, -7)) {
      l.push(oto(`siparis-gecikti:${s.id}`, { baslik: `Teslimat gecikti: #${s.id}`, aciklama: `${s.kargo?.firma ?? "Kargo"} ile 7+ gündür yolda. Takip numarasını kontrol edin.`, kayit, sorumluId: OPERASYON, zaman: `${gunEkle(kargoGun, 7)}T09:00`, onem: "yuksek" }));
    }
  }

  for (const b of bilesenler) {
    if (b.adet > b.kritik) continue;
    l.push(oto(`bilesen-kritik:${b.kod}:${bugun}`, { baslik: `Kritik stok: ${b.ad}`, aciklama: `Stokta ${b.adet} adet (kritik seviye ${b.kritik}). Malzeme ihtiyacı sekmesinden sipariş verin.`, kayit: { tur: "stok", id: b.kod, ad: b.ad, href: "/operasyon?sekme=ihtiyac" }, sorumluId: OPERASYON, zaman: `${bugun}T08:30`, onem: "yuksek" }));
  }
  for (const k of stok) {
    if (k.adet > k.kritik) continue;
    l.push(oto(`stok-kritik:${k.kod}:${bugun}`, { baslik: `Kritik stok: ${k.ad}`, aciklama: `Depoda ${k.adet} adet (kritik seviye ${k.kritik}).`, kayit: { tur: "stok", id: k.kod, ad: k.ad, href: "/siparisler" }, sorumluId: OPERASYON, zaman: `${bugun}T08:30`, onem: "normal" }));
  }

  for (const c of cihazlar) {
    if (!c.lisansBitis || !c.musteriId || c.lisansBitis < bugun || c.lisansBitis > gunEkle(bugun, 30)) continue;
    l.push(oto(`lisans:${c.seriNo}:${c.lisansBitis}`, { baslik: `Lisans süresi doluyor: ${c.musteri}`, aciklama: `${c.seriNo} · ${c.plan} · bitiş ${c.lisansBitis.split("-").reverse().join(".")}. Yenileme teklifi hazırlayın.`, kayit: { tur: "cihaz", id: c.seriNo, ad: `${c.seriNo} · ${c.musteri}`, href: `/cihaz-lisans/${c.seriNo}` }, sorumluId: SATIS, zaman: `${gunEkle(c.lisansBitis, -30) > bugun ? gunEkle(c.lisansBitis, -30) : bugun}T09:00`, onem: "normal" }));
  }

  for (const r of rmalar) {
    if (r.adim === "tamamlandi" || r.adim === "gonderildi" || r.acilis > gunEkle(bugun, -7)) continue;
    l.push(oto(`rma-7:${r.id}`, { baslik: `RMA 7 günü aştı: ${r.id}`, aciklama: `${r.sahip.ad} · ${r.seriNo} · şu an: ${r.adim.replace("_", " ")}`, kayit: { tur: "rma", id: r.id, ad: `${r.id} · ${r.sahip.ad}`, href: `/rma?kayit=${r.id}` }, sorumluId: DESTEK, zaman: `${gunEkle(r.acilis, 7)}T09:00`, onem: "yuksek" }));
  }
  return l;
}
