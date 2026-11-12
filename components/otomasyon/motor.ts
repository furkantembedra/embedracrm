// Otomasyon motoru: her tetikleyici güncel veriden "eşleşen kayıtları" hesaplar, motor da her kayıt için kuralın
// eylemlerini bir kez çalıştırır. Aynı kural + aynı kayıt anahtarı ikinci kez çalışmaz (anahtar kaydın durumunu içerir:
// ör. lisans bitişi değişirse yeni anahtar çıkar). Yalnızca sunucuda import edin.
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getTeklifler } from "@/components/teklifler/queries";
import { getRmalar } from "@/components/rma/queries";
import { getSiparisler } from "@/components/siparisler/queries";
import { getTalepler } from "@/components/destek/queries";
import { getFirsatlar, KAPALI_ASAMALAR } from "@/components/satis-hatti/queries";
import { getBilesenler, getEkip } from "@/components/operasyon/queries";
import { getMusteri, musteriBulAdla } from "@/components/musteriler/queries";
import { izinVar } from "@/components/musteriler/ortak";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { gunEkle } from "@/components/hatirlatmalar/kurallar";
import { getEngelli } from "@/components/pazarlama/queries";
import { abonelikJetonu } from "@/lib/abonelik";
import { epostaGonder, saglayicilar } from "@/lib/ileti-gonder";
import { EPOSTA_TUR_LIMITI, FILTRE_ALANLARI, gunYaz } from "./ortak";
import { getKurallar, islendiIsaretle, islendiMi, kayitEkle, kilitAl, kilitBirak, kuralGuncelle, type CalismaKaydi, type EylemSonucu, type Kural, type KuralFiltresi, type TetikleyiciId } from "./queries";

export type Eslesme = {
  anahtar: string;
  kayitAd: string;
  href: string;
  firma: string;
  detay: string;
  musteriId: string | null;
  kayit: { tur: "firsat" | "teklif" | "siparis" | "rma" | "stok" | "cihaz" | "destek"; id: string };
  nitelik?: KuralFiltresi; // filtrelenebilir özellikler (kayıtta yoksa o filtre bu kayda uygulanmaz)
};

const ayni = (a: string | undefined, b: string) => (a ?? "").toLocaleLowerCase("tr-TR").trim() === b.toLocaleLowerCase("tr-TR").trim();
/** Kuralın filtresi bu kayda uyuyor mu. Yalnızca o tetikleyicide geçerli alanlar kontrol edilir. */
export function filtreUyar(e: Eslesme, t: TetikleyiciId, f: KuralFiltresi) {
  return FILTRE_ALANLARI[t].every((alan) => !f[alan] || ayni(e.nitelik?.[alan], f[alan]!));
}

const p2 = (n: number) => String(n).padStart(2, "0");
const bugunYerel = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Bir tetikleyicinin şu an eşleşen kayıtları */
export async function eslesmeler(t: TetikleyiciId, gun: number, bugun = bugunYerel()): Promise<Eslesme[]> {
  switch (t) {
    case "lisans-bitiyor": {
      const son = gunEkle(bugun, gun);
      return (await getCihazlar())
        .filter((c) => c.musteriId && c.lisansBitis && c.lisansBitis >= bugun && c.lisansBitis <= son)
        .map((c) => ({
          anahtar: `${c.seriNo}:${c.lisansBitis}`, kayitAd: `${c.seriNo} · ${c.musteri}`, href: `/cihaz-lisans/${c.seriNo}`, firma: c.musteri, musteriId: c.musteriId,
          detay: `${c.seriNo} cihazının ${c.plan} lisansı ${gunYaz(c.lisansBitis!)} tarihinde sona eriyor.`, kayit: { tur: "cihaz" as const, id: c.seriNo },
          nitelik: { ulke: c.ulke, plan: c.plan, model: c.model },
        }));
    }
    case "teklif-yanitsiz": {
      const esik = gunEkle(bugun, -gun);
      const l = (await getTeklifler()).filter((x) => x.durum === "gonderildi" && x.gonderim && x.gonderim.slice(0, 10) <= esik);
      return Promise.all(l.map(async (x) => ({
        anahtar: x.id, kayitAd: `${x.no} · ${x.firma}`, href: `/teklifler/${x.id}`, firma: x.firma, musteriId: (await musteriBulAdla(x.firma))?.id ?? null,
        detay: `${x.no} numaralı teklifimiz ${gunYaz(x.gonderim!.slice(0, 10))} tarihinde gönderildi, henüz yanıt alınmadı.`, kayit: { tur: "teklif" as const, id: x.id },
      })));
    }
    case "rma-gecikti": {
      const esik = gunEkle(bugun, -gun);
      return (await getRmalar())
        .filter((r) => r.adim !== "tamamlandi" && r.adim !== "gonderildi" && r.acilis <= esik)
        .map((r) => ({
          anahtar: r.id, kayitAd: `${r.id} · ${r.sahip.ad}`, href: `/rma?kayit=${r.id}`, firma: r.sahip.ad, musteriId: r.sahip.tur === "musteri" ? r.sahip.id : null,
          detay: `${r.id} numaralı servis kaydınız ${gunYaz(r.acilis)} tarihinden beri devam ediyor.`, kayit: { tur: "rma" as const, id: r.id },
          nitelik: { model: r.model },
        }));
    }
    case "siparis-kargolanmadi": {
      const esik = gunEkle(bugun, -gun);
      return (await getSiparisler())
        .filter((s) => s.durum === "hazirlaniyor" && s.tarih.slice(0, 10) <= esik)
        .map((s) => ({
          anahtar: s.id, kayitAd: `#${s.id} · ${s.musteri}`, href: `/siparisler/${s.id}`, firma: s.musteri, musteriId: s.musteriId,
          detay: `${s.id} numaralı siparişiniz hazırlanıyor, kargoya verildiğinde bilgilendirileceksiniz.`, kayit: { tur: "siparis" as const, id: s.id },
          nitelik: { ulke: s.ulke },
        }));
    }
    case "firsat-hareketsiz": {
      const esik = gunEkle(bugun, -gun);
      const l = (await getFirsatlar()).filter((f) => !KAPALI_ASAMALAR.includes(f.asama) && f.sonHareket && f.sonHareket <= esik);
      return Promise.all(l.map(async (f) => ({
        anahtar: `${f.id}:${f.sonHareket}`, kayitAd: f.firma, href: "/satis-hatti", firma: f.firma, musteriId: (await musteriBulAdla(f.firma))?.id ?? null,
        detay: `${f.firma} fırsatında ${gunYaz(f.sonHareket!)} tarihinden beri değişiklik yok (${f.sonrakiAdim}).`, kayit: { tur: "firsat" as const, id: f.id },
      })));
    }
    case "destek-yanitsiz": {
      const esik = gunEkle(bugun, -gun);
      return (await getTalepler())
        .filter((x) => x.durum === "yeni" && x.acilis.slice(0, 10) <= esik)
        .map((x) => ({
          anahtar: x.id, kayitAd: `#${x.id} · ${x.musteri}`, href: `/destek/${x.id}`, firma: x.musteri, musteriId: x.musteriId,
          detay: `“${x.baslik}” başlıklı destek talebiniz alındı (${gunYaz(x.acilis.slice(0, 10))}), ekibimiz en kısa sürede dönecek.`, kayit: { tur: "destek" as const, id: x.id },
          nitelik: { plan: x.plan },
        }));
    }
    case "cihaz-sessiz": {
      const esik = gunEkle(bugun, -gun);
      return (await getCihazlar())
        .filter((c) => c.musteriId && c.durum !== "stokta" && c.sonGorulme && c.sonGorulme.slice(0, 10) <= esik)
        .map((c) => ({
          anahtar: `${c.seriNo}:${c.sonGorulme!.slice(0, 10)}`, kayitAd: `${c.seriNo} · ${c.musteri}`, href: `/cihaz-lisans/${c.seriNo}`, firma: c.musteri, musteriId: c.musteriId,
          detay: `${c.seriNo} cihazından ${gunYaz(c.sonGorulme!.slice(0, 10))} tarihinden beri bildirim gelmedi.`, kayit: { tur: "cihaz" as const, id: c.seriNo },
          nitelik: { ulke: c.ulke, plan: c.plan, model: c.model },
        }));
    }
    case "stok-kritik":
      return (await getBilesenler())
        .filter((b) => b.adet <= b.kritik)
        .map((b) => ({
          anahtar: `${b.kod}:${b.adet}`, kayitAd: b.ad, href: "/operasyon?sekme=ihtiyac", firma: "", musteriId: null,
          detay: `${b.ad} stoğu ${b.adet} adet (kritik seviye ${b.kritik}).`, kayit: { tur: "stok" as const, id: b.kod },
        }));
  }
}

const doldur = (s: string, e: Eslesme) => s.replaceAll("{firma}", e.firma).replaceAll("{detay}", e.detay);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function hatirlatmaEylemi(k: Kural, e: Eslesme, simdi: Date): Promise<EylemSonucu> {
  const h = k.hatirlatma!;
  const ekip = await getEkip();
  const sorumlu = ekip.find((u) => u.id === h.sorumluId && u.aktif);
  if (!sorumlu) return { eylem: "hatirlatma", durum: "hata", ayrinti: "Sorumlu kullanıcı bulunamadı ya da pasif." };
  await hatirlatmaEkleDepo({
    id: crypto.randomUUID(),
    baslik: `${k.ad}: ${e.kayitAd}`.slice(0, 140),
    aciklama: `${e.detay}\n(Otomasyon kuralı: ${k.ad})`.slice(0, 500),
    kayit: { tur: e.kayit.tur, id: e.kayit.id, ad: e.kayitAd.slice(0, 120), href: e.href },
    sorumluId: h.sorumluId,
    zaman: `${bugunYerel(simdi)}T${p2(simdi.getHours())}:${p2(simdi.getMinutes())}`,
    durum: "bekliyor",
    otomatik: false,
    onem: h.onem,
  });
  return { eylem: "hatirlatma", durum: "yapildi", ayrinti: `${sorumlu.ad} için hatırlatma açıldı.` };
}

async function epostaEylemi(k: Kural, e: Eslesme, taban: string): Promise<EylemSonucu> {
  const atla = (ayrinti: string): EylemSonucu => ({ eylem: "eposta", durum: "atlandi", ayrinti });
  if (!e.musteriId) return atla("Kayıt bir müşteriye bağlı değil.");
  const m = await getMusteri(e.musteriId);
  if (!m) return atla("Müşteri kaydı bulunamadı.");
  const engel = new Set(await getEngelli());
  // İzni olan, adresi dolu ve abonelikten çıkmamış ilk yetkili (KVKK / İYS: izinsiz kişiye ticari olmayan bile olsa otomatik ileti gitmez)
  const y = m.yetkililer.find((x) => x.eposta && izinVar(x, "eposta") && !engel.has(`eposta:${x.eposta}`));
  if (!y) return atla("E-posta izni olan yetkili yok.");
  const metin = doldur(k.eposta!.metin, e);
  const abonelikUrl = `${taban}/api/abonelik?t=${abonelikJetonu({ ref: `m:${m.id}:${y.id}`, kanal: "eposta", anahtar: y.eposta })}`;
  const alt = `Bu e-postayı Embedra ile iletişim tercihleriniz doğrultusunda aldınız. Almak istemiyorsanız: ${abonelikUrl}`;
  const s = await epostaGonder({
    kime: y.eposta,
    konu: doldur(k.eposta!.konu, e).slice(0, 150),
    metin: `${metin}\n\n—\n${alt}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#0E0F0C">${esc(metin).replace(/\n/g, "<br>")}</div>
<p style="margin-top:28px;font-family:system-ui,sans-serif;font-size:12px;color:#5E6259">Bu e-postayı iletişim tercihleriniz doğrultusunda aldınız.
<a href="${esc(abonelikUrl)}" style="color:#5E6259">Abonelikten çık</a></p>`,
    abonelikUrl,
  });
  if (!s.ok) return { eylem: "eposta", durum: "hata", ayrinti: `${y.ad}: ${s.hata}` };
  return { eylem: "eposta", durum: "yapildi", ayrinti: saglayicilar().eposta ? `${y.ad} kişisine gönderildi.` : `${y.ad} için hazırlandı (DEMO: e-posta sağlayıcısı bağlı değil, gerçekte gönderilmedi).` };
}

export type CalismaOzeti = { kural: number; eslesme: number; yeni: number; eylem: number; durdurulan: number };

/**
 * Etkin kuralların (ya da tek bir kuralın) yeni eşleşmeleri için eylemleri çalıştırır.
 * yalnizKuralId verilirse bu, kullanıcının elle başlattığı çalıştırmadır ve e-posta güvenlik sınırını onaylamış sayılır.
 */
export async function otomasyonCalistir(taban: string, yalnizKuralId?: string): Promise<CalismaOzeti | null> {
  if (!(await kilitAl())) return null; // başka bir çalıştırma sürüyor
  const ozet: CalismaOzeti = { kural: 0, eslesme: 0, yeni: 0, eylem: 0, durdurulan: 0 };
  try {
    const simdi = new Date();
    const bugun = bugunYerel(simdi);
    const kurallar = (await getKurallar()).filter((k) => (yalnizKuralId ? k.id === yalnizKuralId : k.aktif));
    // Aynı tetikleyici + eşik kullanan kurallar listeyi bir kez okur
    const onbellek = new Map<string, Promise<Eslesme[]>>();
    const oku = (t: TetikleyiciId, gun: number) => {
      const a = `${t}|${gun}`;
      if (!onbellek.has(a)) onbellek.set(a, eslesmeler(t, gun, bugun));
      return onbellek.get(a)!;
    };
    for (const k of kurallar) {
      if (!k.hatirlatma && !k.eposta) continue;
      ozet.kural++;
      const liste = (await oku(k.tetikleyici, k.gun)).filter((e) => filtreUyar(e, k.tetikleyici, k.filtre ?? {}));
      ozet.eslesme += liste.length;
      const yeniler: Eslesme[] = [];
      for (const e of liste) if (!(await islendiMi(k.id, e.anahtar))) yeniler.push(e);

      // Güvenlik sınırı: otomatik turda tek kuralın e-posta sayısı sınırı aşarsa hiçbir şey gönderme, yöneticiden onay iste
      if (k.eposta && !yalnizKuralId && yeniler.length > EPOSTA_TUR_LIMITI) {
        const neden = `${yeniler.length} kayıt eşleşti (otomatik gönderim sınırı ${EPOSTA_TUR_LIMITI}). Listeyi kontrol edip "Çalıştır" ile onaylayın.`;
        await kuralGuncelle(k.id, (x) => void (x.engel = neden));
        ozet.durdurulan++;
        continue;
      }
      if (yalnizKuralId) await kuralGuncelle(k.id, (x) => void (x.engel = null));

      for (const e of yeniler) {
        ozet.yeni++;
        const sonuclar: EylemSonucu[] = [];
        if (k.hatirlatma) sonuclar.push(await hatirlatmaEylemi(k, e, simdi).catch((): EylemSonucu => ({ eylem: "hatirlatma", durum: "hata", ayrinti: "Beklenmeyen hata." })));
        if (k.eposta) sonuclar.push(await epostaEylemi(k, e, taban).catch((): EylemSonucu => ({ eylem: "eposta", durum: "hata", ayrinti: "Beklenmeyen hata." })));
        ozet.eylem += sonuclar.filter((s) => s.durum === "yapildi").length;
        // Hata olsa da işlenmiş say: yarım kalan bir çalıştırmayı yeniden denemek hatırlatmayı ikilerdi. Hata geçmişte görünür.
        await islendiIsaretle(k.id, e.anahtar);
        const kayit: CalismaKaydi = { id: crypto.randomUUID(), zaman: new Date().toISOString(), kuralId: k.id, kuralAd: k.ad, kayitAd: e.kayitAd, href: e.href, sonuclar };
        await kayitEkle(kayit);
      }
      await kuralGuncelle(k.id, (x) => void (x.sonCalisma = new Date().toISOString()));
    }
    return ozet;
  } finally {
    await kilitBirak();
  }
}
