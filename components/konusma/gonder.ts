// Konuşmaya mesaj gönderir: pencereyi kanal adaptörüne sorar, metni adaptörün sınırına göre böler, adaptörle gönderir
// ve her parçayı kanalın verdiği dış kimlikle kaydeder (echo'su gelirse dis_mesaj_id tekilliği ikinci kez yazmaz).
// Kanal bilmez. Arayüzü Bot › Gelen kutusu (components/bot), bot kullanımı P2.1'de gelir.
//
// Pencere (değişmez kural 5): bot yalnızca "acik"ta yazar; temsilci "acik"ta ve kanal izin veriyorsa
// "yalnizca_temsilci"de (Instagram / Messenger HUMAN_AGENT; etiketi adaptör ekler, P4). "kapali"da serbest mesaj yok;
// kanal izin veriyorsa (kapaliPencereYolu "sablon", WhatsApp) temsilci onaylı şablon gönderebilir (sablonGonder).
import { gidenMesajKaydet, konusmaOku, temsilciYazdi, type MesajEki } from "@/components/konusma/queries";
import { adaptor } from "./kanallar";
import type { PencereDurumu, SablonIcerigi } from "./kanallar/tur";

export type GonderSonucu =
  | { ok: true; mesajIdleri: number[]; demo: boolean }
  /** hata: temsilciye gösterilecek açıklama; gonderilen: hata öncesi gönderilmiş parça sayısı (uzun metin bölündüyse) */
  | { ok: false; hata: string; gonderilen: number; kod?: string };

/** Temsilcinin bu pencerede ne yapabileceği (arayüz ve sunucu aynı kuralı kullanır) */
export function pencereIzni(pencere: PencereDurumu, gonderen: "bot" | "temsilci") {
  return pencere.durum === "acik" || (gonderen === "temsilci" && pencere.durum === "yalnizca_temsilci");
}

export async function mesajGonder(
  konusmaId: number,
  metin: string,
  gonderen: "bot" | "temsilci",
  /** CRM'den yazan temsilcinin kullanicilar.id'si (gonderen_kullanici_id) */
  gonderenKullaniciId?: number | null,
): Promise<GonderSonucu> {
  const k = await konusmaOku(konusmaId);
  if (!k) return { ok: false, hata: "Konuşma bulunamadı.", gonderilen: 0 };
  const a = adaptor(k.kanal);
  const pencere = a.pencere(k.sonMusteriMesaji);
  if (!pencereIzni(pencere, gonderen)) {
    const yol = a.kapaliPencereYolu === "sablon" ? " Yalnızca onaylı şablon gönderilebilir." : " Müşteriye e-posta ya da telefonla ulaşın.";
    return { ok: false, hata: `${a.ad} mesaj penceresi kapalı: müşterinin son mesajından bu yana serbest mesaj gönderilemez.${gonderen === "temsilci" ? yol : ""}`, gonderilen: 0 };
  }
  const insanTemsilci = pencere.durum === "yalnizca_temsilci";
  const parcalar = a.bol(metin);
  if (!parcalar.length) return { ok: false, hata: "Boş mesaj gönderilemez.", gonderilen: 0 };

  const mesajIdleri: number[] = [];
  let demo = false;
  for (const parca of parcalar) {
    const r = await a.gonder({ kanalHesapId: k.kanalHesapId, disKullaniciId: k.disKullaniciId }, { tur: "metin", metin: parca, insanTemsilci });
    if (!r.ok) {
      if (gonderen === "temsilci" && mesajIdleri.length) await temsilciYazdi(k.id);
      return { ok: false, hata: r.hata, gonderilen: mesajIdleri.length, ...(r.kod ? { kod: r.kod } : {}) };
    }
    demo ||= r.demo;
    const ek: MesajEki = {};
    if (r.demo) ek.demo = true;
    if (insanTemsilci) ek.insan_etiketi = true;
    mesajIdleri.push(await gidenMesajKaydet({
      konusmaId: k.id, gonderen, gonderenKullaniciId, disMesajId: r.disMesajId ?? `crm-${crypto.randomUUID()}`, metin: parca, tur: "metin",
      ek, zaman: new Date().toISOString(), satisHattiId: k.satisHattiId,
    }));
  }
  if (gonderen === "temsilci") await temsilciYazdi(k.id);
  return { ok: true, mesajIdleri, demo };
}

/**
 * Onaylı şablon (yalnızca temsilci; bot hiçbir zaman şablon kullanmaz, değişmez kural 5). Kanal şablonu desteklemiyorsa
 * reddedilir. Pencere açıkken de gönderilebilir (Meta izin verir), arayüz yalnızca kapalıyken önerir.
 */
export async function sablonGonder(konusmaId: number, sablon: SablonIcerigi, gonderenKullaniciId: number | null): Promise<GonderSonucu> {
  const k = await konusmaOku(konusmaId);
  if (!k) return { ok: false, hata: "Konuşma bulunamadı.", gonderilen: 0 };
  const a = adaptor(k.kanal);
  if (a.kapaliPencereYolu !== "sablon" || !a.sablonGonder) {
    return { ok: false, hata: `${a.ad} onaylı şablon desteklemiyor; müşteriye e-posta ya da telefonla ulaşın.`, gonderilen: 0 };
  }
  const r = await a.sablonGonder({ kanalHesapId: k.kanalHesapId, disKullaniciId: k.disKullaniciId }, sablon);
  if (!r.ok) return { ok: false, hata: r.hata, gonderilen: 0, ...(r.kod ? { kod: r.kod } : {}) };
  const ozet = `Şablon: ${sablon.ad}${sablon.parametreler.length ? ` · ${sablon.parametreler.join(" · ")}` : ""}`;
  const ek: MesajEki = { sablon: { ad: sablon.ad, dil: sablon.dil } };
  if (r.demo) ek.demo = true;
  const id = await gidenMesajKaydet({
    konusmaId: k.id, gonderen: "temsilci", gonderenKullaniciId, disMesajId: r.disMesajId ?? `crm-${crypto.randomUUID()}`,
    metin: ozet.slice(0, 4096), tur: "metin", ek, zaman: new Date().toISOString(), satisHattiId: k.satisHattiId,
  });
  await temsilciYazdi(k.id);
  return { ok: true, mesajIdleri: [id], demo: r.demo };
}
