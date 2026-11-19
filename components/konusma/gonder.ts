// Konuşmaya mesaj gönderir: pencereyi kanal adaptörüne sorar, metni adaptörün sınırına göre böler, adaptörle gönderir
// ve her parçayı kanalın verdiği dış kimlikle kaydeder (echo'su gelirse dis_mesaj_id tekilliği ikinci kez yazmaz).
// Kanal bilmez. Arayüzü P1.2'de (Bot › Gelen kutusu), bot kullanımı P2.1'de gelir.
//
// Pencere (değişmez kural 5): bot yalnızca "acik"ta yazar; temsilci "acik"ta ve kanal izin veriyorsa
// "yalnizca_temsilci"de (Instagram / Messenger HUMAN_AGENT; etiketi adaptör ekler, P4). "kapali"da serbest mesaj yok.
import { gidenMesajKaydet, konusmaOku, temsilciYazdi } from "@/components/konusma/queries";
import { adaptor } from "./kanallar";

export type GonderSonucu =
  | { ok: true; mesajIdleri: number[]; demo: boolean }
  | { ok: false; hata: string; gonderilen: number };

export async function mesajGonder(konusmaId: number, metin: string, gonderen: "bot" | "temsilci"): Promise<GonderSonucu> {
  const k = await konusmaOku(konusmaId);
  if (!k) return { ok: false, hata: "Konuşma bulunamadı.", gonderilen: 0 };
  const a = adaptor(k.kanal);
  const pencere = a.pencere(k.sonMusteriMesaji);
  const izinli = pencere.durum === "acik" || (gonderen === "temsilci" && pencere.durum === "yalnizca_temsilci");
  if (!izinli) {
    return { ok: false, hata: `${a.ad} mesaj penceresi kapalı: müşterinin son mesajından bu yana serbest mesaj gönderilemez.`, gonderilen: 0 };
  }
  const parcalar = a.bol(metin);
  if (!parcalar.length) return { ok: false, hata: "Boş mesaj gönderilemez.", gonderilen: 0 };

  const mesajIdleri: number[] = [];
  let demo = false;
  for (const parca of parcalar) {
    const r = await a.gonder({ kanalHesapId: k.kanalHesapId, disKullaniciId: k.disKullaniciId }, { tur: "metin", metin: parca });
    if (!r.ok) return { ok: false, hata: r.hata, gonderilen: mesajIdleri.length };
    demo ||= r.demo;
    mesajIdleri.push(await gidenMesajKaydet({
      konusmaId: k.id, gonderen, disMesajId: r.disMesajId ?? `crm-${crypto.randomUUID()}`, metin: parca, tur: "metin",
      zaman: new Date().toISOString(), satisHattiId: k.satisHattiId,
    }));
  }
  if (gonderen === "temsilci") await temsilciYazdi(k.id);
  return { ok: true, mesajIdleri, demo };
}
