// Genel Bakış: kartların verisi CRM kayıtlarından hesaplanır (siparişler, cihaz lisansları, destek, satış hattı,
// bayi hareketleri, RMA). Bayi portalından gelen siparişler, satışlar ve destek talepleri de aynı kayıtlarda olduğu için
// buraya kendiliğinden yansır. TODO: Supabase bağlanınca aynı hesaplar SQL toplamlarına dönüşebilir.
import { connection } from "next/server";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getTalepler } from "@/components/destek/queries";
import { getFirsatlar, ASAMA_BILGI } from "@/components/satis-hatti/queries";
import { getRmalar } from "@/components/rma/queries";
import { getSiparisler, getStok } from "@/components/siparisler/queries";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { getAktifBayiler, getBayiHareketleri, HAREKET_ADI } from "@/components/bayiler/queries";
import { AY_KISA, AY_UZUN, ayEkle, gelireSayilir, gunEkle, gunStr, oncelikZaman, siparisGeliri } from "@/components/raporlar/hesap";
import type { OzetVerisi } from "./ozet-kartlari";
import type { GelirAyi } from "./gelir-grafigi";
import type { LisansDagilimiVerisi } from "./lisans-dagilimi";
import type { HatAsamasi } from "./satis-hatti-ozeti";
import type { Islem } from "./son-islemler";
import type { SonTalep } from "./son-talepler";
import type { LeadKaynaklariVerisi } from "./lead-kaynaklari";

export async function getGenelBakis() {
  await connection(); // "bu ay", "bugün" istek anında hesaplanır
  const simdi = new Date();
  const bugun = gunStr(simdi);
  const buAy = bugun.slice(0, 7);
  const [siparisler, cihazlar, talepler, firsatlar, rmalar, fiyat, stok, hareketler, bayiler] = await Promise.all([
    getSiparisler(), getCihazlar(), getTalepler(), getFirsatlar(), getRmalar(), getFiyatListesi(), getStok(), getBayiHareketleri(), getAktifBayiler(),
  ]);

  // Gelir: son 12 ay
  const aylar = Array.from({ length: 12 }, (_, i) => ayEkle(buAy, i - 11));
  const aylik = new Map(aylar.map((a) => [a, { donanim: 0, lisans: 0 }]));
  for (const s of siparisler) {
    const a = aylik.get(s.tarih.slice(0, 7));
    if (!a || !gelireSayilir(s)) continue;
    const g = siparisGeliri(s, fiyat, stok);
    a.donanim += g.donanim;
    a.lisans += g.lisans;
  }
  const gelirAylari: GelirAyi[] = aylar.map((a) => ({ ay: AY_KISA[Number(a.slice(5, 7)) - 1], donanim: Math.round(aylik.get(a)!.donanim), lisans: Math.round(aylik.get(a)!.lisans) }));
  const bu = aylik.get(buAy)!, onceki = aylik.get(ayEkle(buAy, -1))!;
  const buToplam = bu.donanim + bu.lisans, oncekiToplam = onceki.donanim + onceki.lisans;

  // Lisanslar: bugün geçerli olanlar
  const gecerli = cihazlar.filter((c) => c.lisansBitis && c.lisansBitis >= bugun);
  const lisans: LisansDagilimiVerisi = {
    basic: gecerli.filter((c) => c.plan === "Basic").length,
    pro: gecerli.filter((c) => c.plan === "Pro").length,
    proPlus: gecerli.filter((c) => c.plan === "Pro+").length,
  };
  const buAyYeni = cihazlar.reduce((t, c) => t + c.gecmis.filter((g) => g.baslangic.startsWith(buAy)).length, 0);

  // Yenileme: 30 gün içinde bitecekler ve liste fiyatıyla potansiyel gelir
  const son30 = gunEkle(bugun, 30);
  const bitecek = gecerli.filter((c) => c.lisansBitis! <= son30);
  const potansiyel = bitecek.reduce((t, c) => t + (fiyat.lisans[c.plan as keyof typeof fiyat.lisans]?.fiyat ?? 0), 0);

  // Destek
  const acikTalepler = talepler.filter((t) => t.durum !== "cozuldu");
  const haftaOnce = gunEkle(bugun, -7);
  const ozet: OzetVerisi = {
    gelir: {
      toplam: Math.round(buToplam), donanim: Math.round(bu.donanim), lisans: Math.round(bu.lisans), ay: AY_UZUN[simdi.getMonth()],
      degisimYuzde: oncekiToplam ? Math.round(((buToplam - oncekiToplam) / oncekiToplam) * 1000) / 10 : null,
      son12Ay: gelirAylari.map((a) => Math.round((a.donanim + a.lisans) / 1000)),
    },
    lisans: { ...lisans, buAyYeni },
    destek: {
      acik: acikTalepler.length,
      yuksekOncelik: acikTalepler.filter((t) => t.oncelik === "Yüksek").length,
      beklemede: talepler.filter((t) => t.durum === "beklemede").length,
      buHaftaCozulen: talepler.filter((t) => t.durum === "cozuldu" && t.notlar.some((n) => n.tur === "cozuldu" && n.zaman.slice(0, 10) >= haftaOnce)).length,
    },
    yenileme: { adet: bitecek.length, potansiyelGelir: potansiyel },
  };

  // Satış hattı
  const hat: HatAsamasi[] = (["yeni", "demo", "teklif", "muzakere"] as const).map((a, i) => {
    const l = firsatlar.filter((f) => f.asama === a);
    return { ad: ASAMA_BILGI[a].ad, adet: l.length, tutar: l.reduce((t, f) => t + f.tutar, 0), ton: (["acik", "orta", "koyu", "ink"] as const)[i] };
  });
  const kazanilan = firsatlar.filter((f) => f.asama === "kazanildi");
  hat.push({ ad: "Kazanıldı", adet: kazanilan.length, tutar: kazanilan.reduce((t, f) => t + f.tutar, 0), ton: "lime", kazanildi: true });

  // Son destek talepleri (açık olanlar, en yeni)
  const bugunGun = bugun;
  const sonTalepler: SonTalep[] = [...acikTalepler].sort((a, b) => b.acilis.localeCompare(a.acilis)).slice(0, 5).map((t) => ({
    no: Number(t.id), konu: t.baslik, musteri: t.bayiId ? `${t.musteri} · bayi` : t.musteri, oncelik: t.oncelik,
    acilis: t.acilis.slice(0, 10) === bugunGun ? `Bugün ${t.acilis.slice(11, 16)}` : `${Number(t.acilis.slice(8, 10))} ${AY_KISA[Number(t.acilis.slice(5, 7)) - 1]}`,
  }));

  // Son işlemler: sipariş notları, bayi hareketleri, RMA geçmişi ve yeni destek talepleri tek zaman çizelgesinde
  const bayiAdi = new Map(bayiler.map((b) => [b.id, b.ad]));
  const olaylar: (Islem & { t: string })[] = [
    ...siparisler.flatMap((s) => s.notlar.map((n) => ({ t: n.zaman, kim: `#${s.id} · ${s.musteri}`, ne: n.metin, zaman: "", kaynak: s.bayiId ? "Bayi siparişi" : "Sipariş kaydı", tur: "siparis" as const }))),
    ...hareketler.filter((h) => h.bayiId && bayiAdi.has(h.bayiId) && h.tarih <= bugun).map((h) => ({
      t: `${h.tarih}T12:00`, kim: bayiAdi.get(h.bayiId)!, ne: `${HAREKET_ADI[h.tur].toLocaleLowerCase("tr-TR")} · ${h.kalemler.length} cihaz${h.musteri ? ` → ${h.musteri.ad}` : ""}`, zaman: "", kaynak: "Bayi kaydı", tur: "bayi" as const,
    })),
    ...rmalar.flatMap((r) => r.gecmis.map((g) => ({ t: g.zaman, kim: `${r.id} · ${r.seriNo}`, ne: g.metin, zaman: "", kaynak: "RMA kaydı", tur: "cihaz" as const }))),
    ...talepler.map((t) => ({ t: t.acilis, kim: t.musteri, ne: `destek talebi açtı: ${t.baslik}`, zaman: "", kaynak: t.kanal === "Bayi portalı" ? "Bayi portalı" : "Destek", tur: "destek" as const })),
  ];
  // Aynı dakikadaki olaylarda sonra yazılan önce gelir; her kayıttan yalnızca en son olay gösterilir
  const gorulen = new Set<string>();
  const sonIslemler: Islem[] = olaylar
    .map((o, i) => ({ ...o, i }))
    .filter((o) => o.t.slice(0, 10) <= bugun)
    .sort((a, b) => b.t.localeCompare(a.t) || b.i - a.i)
    .filter((o) => (gorulen.has(o.kim) ? false : (gorulen.add(o.kim), true)))
    .slice(0, 6)
    .map((o) => ({ kim: o.kim, ne: o.ne, kaynak: o.kaynak, tur: o.tur, zaman: oncelikZaman(o.t, simdi.getTime()) }));

  // Lead kaynakları: satış hattındaki tüm fırsatlar
  const kaynakSay = new Map<string, number>();
  for (const f of firsatlar) kaynakSay.set(f.kaynak, (kaynakSay.get(f.kaynak) ?? 0) + 1);
  const leadKaynaklari: LeadKaynaklariVerisi = {
    donem: "Satış hattındaki tüm fırsatlar",
    toplam: firsatlar.length,
    kaynaklar: [...kaynakSay.entries()].sort((a, b) => b[1] - a[1]).map(([ad, n]) => ({ ad, yuzde: Math.round((n / Math.max(1, firsatlar.length)) * 100) })),
  };

  return { ozet, gelirAylari, lisans, hat, sonTalepler, sonIslemler, leadKaynaklari, cihazlar };
}
