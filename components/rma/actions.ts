"use server";
// Garanti & RMA (Server Actions): seri sorgulama, kayıt açma, adım ilerletme ve kararların stok / cihaz / iade etkileri.
import { getBilesenler, bilesenGuncelle, getHavuz, havuzdanCikar } from "@/components/operasyon/queries";
import { cihazEkleDepo, cihaziGuncelle, getCihaz } from "@/components/cihaz-lisans/queries";
import { musteriyiGuncelle } from "@/components/musteriler/queries";
import { getSiparisler, iadeEkle, sonrakiIadeNo } from "@/components/siparisler/queries";
import { garantiBilgisi, type GarantiBilgisi } from "./garanti";
import { rmaOlustur, rmaYenile, simdiYerel } from "./islemler";
import { kapsamda } from "./ortak";
import { garantiAyKaydet, GELIS_KANALLARI, ONCELIKLER, type GelisKanali, type RmaOncelik, getRma, getRmalar, rmayiGuncelle, RMA_ADIMLARI, KARAR_ADI, type RmaKaydi, type RmaKarari } from "./queries";

const SERI = /^EO1-\d{4}-\d{4}$/;

export async function seriSorgula(seriNo: string): Promise<GarantiBilgisi | { hata: string }> {
  const s = seriNo.trim().toUpperCase();
  if (!SERI.test(s)) return { hata: "Seri no EO1-YYAA-NNNN biçiminde olmalı." };
  return (await garantiBilgisi(s, simdiYerel().slice(0, 10))) ?? { hata: "Bu seri no CRM'de kayıtlı değil." };
}

export type RmaFormDurumu = { hatalar?: Record<string, string>; rma?: RmaKaydi; zaman?: number };

export async function rmaAc(_o: RmaFormDurumu, form: FormData): Promise<RmaFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const ucretMetni = metin("ucret");
  const sonuc = await rmaOlustur({
    seriNo: metin("seriNo").toUpperCase(),
    arizaTipi: metin("arizaTipi"),
    ariza: metin("ariza"),
    fotograflar: metin("fotograflar").split(/[\n,]+/).map((x) => x.trim()).filter(Boolean),
    destekTalebiId: metin("destekTalebiId") || null,
    kaynak: "crm",
    oncelik: metin("oncelik"),
    ucret: ucretMetni ? Number(ucretMetni.replace(/\./g, "")) : null,
  });
  return sonuc.rma ? { rma: sonuc.rma, zaman: Date.now() } : { hatalar: sonuc.hatalar };
}

export type RmaIslemSonucu = { rma?: RmaKaydi; hata?: string; liste?: RmaKaydi[] };

const gecmisEkle = (r: RmaKaydi, metin: string, tur: "sistem" | "not" | "gorusme" = "sistem") => r.gecmis.push({ zaman: simdiYerel(), metin, tur, yazan: "Deniz Arslan" });

async function musteriyeIsle(r: RmaKaydi, metin: string) {
  if (r.sahip.tur === "musteri" && r.sahip.id) await musteriyiGuncelle(r.sahip.id, (m) => m.olaylar.unshift({ metin, zaman: "Bugün · RMA", tur: "destek" }));
}

export type AdimEki = { gelisKanali?: string; gelisTakip?: string; kargoFirma?: string; kargoTakip?: string };

/** Karar dışındaki adımları bir ileri taşır (karar adımı kararVer ile geçilir) */
export async function rmaIlerlet(id: string, not = "", ek: AdimEki = {}): Promise<RmaIslemSonucu> {
  const r = await getRma(id);
  if (!r) return { hata: "Kayıt bulunamadı." };
  const i = RMA_ADIMLARI.indexOf(r.adim);
  const sonraki = RMA_ADIMLARI[i + 1];
  if (!sonraki) return { hata: "Kayıt zaten kapandı." };
  if (sonraki === "karar") return { hata: "Önce karar verin." };
  if (sonraki === "gonderildi" && r.karar === "iade") return { hata: "İade kararında cihaz geri gönderilmez." };
  if (sonraki === "teslim_alindi" && !GELIS_KANALLARI.includes(ek.gelisKanali as GelisKanali)) return { hata: "Cihazın nasıl geldiğini seçin." };
  if (sonraki === "gonderildi" && (!ek.kargoFirma?.trim() || !ek.kargoTakip?.trim())) return { hata: "Kargo firması ve takip numarasını girin." };
  if (sonraki === "gonderildi" && r.ucret && !kapsamda(r) && !r.ucretOdendi) return { hata: "Garanti dışı servis ücreti tahsil edilmeden cihaz gönderilemez." };
  const metin: Record<string, string> = { teslim_alindi: "Cihaz teslim alındı", inceleme: "İncelemeye alındı", tamamlandi: "İşlem tamamlandı", gonderildi: "Müşteriye gönderildi" };
  await rmayiGuncelle(id, (x) => {
    x.adim = sonraki;
    if (sonraki === "teslim_alindi") x.gelis = { kanal: ek.gelisKanali as GelisKanali, takipNo: (ek.gelisTakip ?? "").trim().slice(0, 60) };
    if (sonraki === "gonderildi") x.kargo = { firma: ek.kargoFirma!.trim().slice(0, 60), takipNo: ek.kargoTakip!.trim().slice(0, 60) };
    if (sonraki === "tamamlandi" || sonraki === "gonderildi") x.kapanis = simdiYerel().slice(0, 10);
    const ekMetin = sonraki === "teslim_alindi" ? ` (${ek.gelisKanali}${ek.gelisTakip?.trim() ? ` · ${ek.gelisTakip.trim()}` : ""})` : sonraki === "gonderildi" ? ` (${ek.kargoFirma} · ${ek.kargoTakip})` : "";
    gecmisEkle(x, `${metin[sonraki]}${ekMetin}.${not.trim() ? ` ${not.trim().slice(0, 300)}` : ""}`);
  });
  if (sonraki === "gonderildi") await musteriyeIsle(r, `${r.id}: cihaz servisten gönderildi (${ek.kargoFirma} · ${ek.kargoTakip})`);
  rmaYenile();
  return { rma: (await getRma(id))!, liste: await getRmalar() };
}

export async function kararVer(id: string, v: { karar: RmaKarari; parcalar?: Record<string, number>; yeniSeri?: string; not?: string }): Promise<RmaIslemSonucu> {
  const r = await getRma(id);
  if (!r) return { hata: "Kayıt bulunamadı." };
  if (r.adim !== "inceleme") return { hata: "Karar inceleme adımında verilir." };
  if (!(v.karar in KARAR_ADI)) return { hata: "Karar seçin." };
  let ek = "";

  if (v.karar === "tamir") {
    const bilesenler = await getBilesenler();
    const parcalar = Object.entries(v.parcalar ?? {}).filter(([, n]) => n > 0);
    for (const [kod, n] of parcalar) {
      const b = bilesenler.find((x) => x.kod === kod);
      if (!b || !Number.isInteger(n) || n > 20) return { hata: `Geçersiz parça: ${kod}` };
      if (b.adet < n) return { hata: `${b.ad} stokta yetersiz (${b.adet}).` };
    }
    for (const [kod, n] of parcalar) await bilesenGuncelle(kod, -n);
    ek = parcalar.length ? ` Kullanılan parçalar: ${parcalar.map(([kod, n]) => `${n}× ${bilesenler.find((b) => b.kod === kod)?.ad}`).join(", ")}.` : "";
    await rmayiGuncelle(id, (x) => void (x.kullanilanParcalar = Object.fromEntries(parcalar)));
  }

  if (v.karar === "degisim") {
    const yeni = (v.yeniSeri ?? "").toUpperCase();
    const havuz = await getHavuz();
    const h = havuz.find((x) => x.seriNo === yeni);
    if (!h) return { hata: "Depodaki seri no havuzundan yeni cihaz seçin." };
    if (h.model !== r.model) return { hata: `Aynı model seçin (${r.model}).` };
    const eski = await getCihaz(r.seriNo);
    if (!eski) return { hata: "Eski cihaz kaydı bulunamadı." };
    await havuzdanCikar([yeni]);
    await cihazEkleDepo({ ...structuredClone(eski), seriNo: yeni, firmware: "v2.4.1", sonGorulme: null, surumGecmisi: [], stogaGiris: null });
    await cihaziGuncelle(r.seriNo, (c) => ({ ...c, musteriId: null, musteri: `Embedra · ${r.id}`, bayiId: null, durum: "lisanssiz", lisansBaslangic: null, lisansBitis: null }));
    if (eski.musteriId) {
      await musteriyiGuncelle(eski.musteriId, (m) => {
        m.cihazlar = m.cihazlar.map((c) => (c.seriNo === r.seriNo ? { ...c, seriNo: yeni, firmware: "v2.4.1" } : c));
        m.olaylar.unshift({ metin: `${r.id}: ${r.seriNo} yerine ${yeni} verildi (lisans aktarıldı)`, zaman: "Bugün · RMA", tur: "destek" });
      });
    }
    ek = ` Yeni cihaz: ${yeni} (lisans aktarıldı, eski cihaz servise alındı).`;
    await rmayiGuncelle(id, (x) => void (x.yeniSeri = yeni));
  }

  if (v.karar === "iade") {
    const siparis = (await getSiparisler()).find((s) => s.seriNolar.includes(r.seriNo));
    if (siparis) {
      const iadeId = await sonrakiIadeNo();
      await iadeEkle({ id: iadeId, siparisId: siparis.id, musteri: siparis.musteri, tur: "iade", neden: `Arızalı ürün · ${r.id}`, urunler: [r.seriNo], tarih: simdiYerel().slice(0, 10), adim: 1 });
      await rmayiGuncelle(id, (x) => void (x.iadeId = iadeId));
      ek = ` Sipariş › İadeler'e ${iadeId} açıldı (para iadesi bekliyor).`;
    } else ek = " Cihaz bir siparişle eşleşmedi; para iadesini bayi / muhasebe üzerinden yapın.";
  }

  await rmayiGuncelle(id, (x) => {
    x.karar = v.karar;
    x.adim = "karar";
    gecmisEkle(x, `Karar: ${KARAR_ADI[v.karar]}.${ek}${v.not?.trim() ? ` Not: ${v.not.trim().slice(0, 300)}` : ""}`);
  });
  if (v.karar !== "degisim") await musteriyeIsle(r, `${r.id}: karar ${KARAR_ADI[v.karar].toLocaleLowerCase("tr-TR")}`);
  rmaYenile();
  return { rma: (await getRma(id))!, liste: await getRmalar() };
}

export async function garantiKapsami(id: string, garantide: boolean | null, ucret: number | null): Promise<RmaIslemSonucu> {
  if (ucret !== null && (!Number.isFinite(ucret) || ucret < 0)) return { hata: "Ücret geçersiz." };
  const r = await rmayiGuncelle(id, (x) => {
    x.garantiElle = garantide;
    const kapsam = garantide ?? x.garantide;
    x.ucret = kapsam ? null : ucret;
    gecmisEkle(x, garantide === null ? "Garanti kapsamı otomatik hesaba döndü." : `Garanti kapsamı elle ${garantide ? "verildi" : "kaldırıldı"}${!kapsam && ucret ? ` · servis ücreti ₺${ucret.toLocaleString("tr-TR")}` : ""}.`);
  });
  if (!r) return { hata: "Kayıt bulunamadı." };
  rmaYenile();
  return { rma: r, liste: await getRmalar() };
}

export async function garantiSuresiKaydet(ay: number): Promise<{ hata?: string }> {
  if (![12, 18, 24, 36].includes(ay)) return { hata: "Süre seçin." };
  await garantiAyKaydet(ay);
  rmaYenile();
  return {};
}

/** İç teknik not ya da müşteriyle görüşme kaydı */
export async function rmaNotEkle(id: string, tur: "not" | "gorusme", metin: string): Promise<RmaIslemSonucu> {
  const m = metin.trim();
  if (m.length < 2) return { hata: "Notu yazın." };
  const r = await rmayiGuncelle(id, (x) => gecmisEkle(x, m.slice(0, 1000), tur));
  if (!r) return { hata: "Kayıt bulunamadı." };
  if (tur === "gorusme") await musteriyeIsle(r, `${r.id} görüşmesi: ${m.slice(0, 120)}`);
  rmaYenile();
  return { rma: r, liste: await getRmalar() };
}

export async function ucretOdendi(id: string, odendi: boolean): Promise<RmaIslemSonucu> {
  const r = await rmayiGuncelle(id, (x) => {
    x.ucretOdendi = odendi;
    gecmisEkle(x, odendi ? "Servis ücreti tahsil edildi." : "Ücret tahsilatı geri alındı.");
  });
  if (!r) return { hata: "Kayıt bulunamadı." };
  rmaYenile();
  return { rma: r, liste: await getRmalar() };
}

export async function oncelikDegistir(id: string, oncelik: RmaOncelik): Promise<RmaIslemSonucu> {
  if (!ONCELIKLER.includes(oncelik)) return { hata: "Öncelik seçin." };
  const r = await rmayiGuncelle(id, (x) => {
    x.oncelik = oncelik;
    gecmisEkle(x, `Öncelik: ${oncelik}.`);
  });
  if (!r) return { hata: "Kayıt bulunamadı." };
  rmaYenile();
  return { rma: r, liste: await getRmalar() };
}
