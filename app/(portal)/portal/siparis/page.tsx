import { tl } from "@/lib/format";
import { getFiyatListesi } from "@/components/operasyon/queries";
import { IADE_ADIMLARI, getIadeler, getSiparisler, getStok } from "@/components/siparisler/queries";
import { DURUM_ADI, DURUM_TONU, tamamlananAdim } from "@/components/siparisler/ortak";
import { enErkenTeslim, katalogOlustur, kayitliAdres, ticariKosullar } from "@/components/portal/katalog";
import SiparisSepeti, { type GecmisSiparis } from "@/components/portal/siparis-sepeti";
import { bayiVerisi, gunler, tarihTr } from "@/components/portal/veri";
import { CIHAZ_MODELLERI } from "@/lib/urunler";

export default async function PortalSiparisPage() {
  const [v, fiyat, stok, tumSiparisler, iadeler] = await Promise.all([bayiVerisi(), getFiyatListesi(), getStok(), getSiparisler(), getIadeler()]);
  const kosul = ticariKosullar(v.bayi.ulkeKodu, fiyat);
  const indirim = v.basvuru?.sozlesme.moq.indirim ?? 0;
  const katalog = katalogOlustur(fiyat, stok);
  const gecmis: GecmisSiparis[] = [...v.siparisler]
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
    .map((s) => ({
      id: s.id,
      tarih: tarihTr(s.tarih),
      ozet: s.kalemler.map((k) => `${k.adet}× ${k.tur === "cihaz" ? k.model : k.tur === "lisans" ? `ONESuite ${k.paket}` : (stok.find((x) => x.kod === k.stokKodu)?.ad ?? k.stokKodu)}`).join(" · "),
      tutar: s.paraBirimi === "TRY" ? tl(s.tutar) : `€${s.tutar.toLocaleString("tr-TR")}`,
      durumAdi: DURUM_ADI[s.durum],
      ton: DURUM_TONU[s.durum],
      adim: s.durum === "iptal" ? -1 : Math.min(4, tamamlananAdim(s)), // iptalde hiçbir adım vurgulanmaz
      kargo: s.kargo ? `${s.kargo.firma} · takip ${s.kargo.takipNo}` : null,
      faturaNo: s.faturaNo,
      iptalEdilebilir: s.durum === "odeme",
      iptal: s.iptal ? `${s.iptal.kim === "bayi" ? "Siz iptal ettiniz" : "Embedra iptal etti"} · ${s.iptal.neden}${s.iptal.odemeIadesi ? " · ödeme iadesi yapılacak" : ""}` : null,
      iadeler: iadeler.filter((r) => r.siparisId === s.id).map((r) => ({
        id: r.id, tur: r.tur === "iade" ? "İade" : "Değişim", adim: IADE_ADIMLARI[r.tur][r.adim] ?? "", urunler: (r.urunler ?? []).join(", "),
      })),
    }));
  // Tekrar sipariş: her geçmiş siparişin sepet karşılığı (katalogda olmayan kalemler atlanır)
  const anahtarlar = new Set(katalog.map((u) => u.anahtar));
  const tekrarSepetleri: Record<string, Record<string, number>> = {};
  for (const s of v.siparisler) {
    const sepet: Record<string, number> = {};
    for (const k of s.kalemler) {
      const a = k.tur === "cihaz" ? `cihaz:${k.model}` : k.tur === "lisans" ? `lisans:${k.paket}` : `aksesuar:${k.stokKodu}`;
      if (anahtarlar.has(a)) sepet[a] = (sepet[a] ?? 0) + k.adet;
    }
    if (Object.keys(sepet).length) tekrarSepetleri[s.id] = sepet;
  }

  // Stok önerisi: model başına son 3 ayın ortalama aylık satışının 1,5 katı (~6 hafta) stok hedeflenir;
  // eldeki stok ve yoldaki (henüz teslim edilmemiş) sipariş düşülür.
  const { bugun } = gunler();
  const ucAyOnce = new Date(Date.parse(bugun) - 90 * 86_400_000).toISOString().slice(0, 10);
  const oneri = CIHAZ_MODELLERI.map((m) => {
    const satis = v.hareketler.filter((h) => h.tur === "satis" && h.tarih >= ucAyOnce).flatMap((h) => h.kalemler).filter((k) => k.model === m).length;
    const aylik = satis / 3;
    const elde = v.stokSeriler.filter((s) => s.model === m).length;
    const yolda = v.siparisler.filter((s) => s.durum === "odeme" || s.durum === "hazirlaniyor" || s.durum === "kargoda") // iptal edilenler hariç
      .reduce((t, s) => t + s.kalemler.reduce((n, k) => n + (k.tur === "cihaz" && k.model === m ? k.adet : 0), 0), 0);
    return { model: m, anahtar: `cihaz:${m}`, aylik: Math.round(aylik), elde, yolda, adet: Math.max(0, Math.ceil(aylik * 1.5) - elde - yolda) };
  }).filter((o) => o.adet > 0);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold">Sipariş ver</h1>
        <p className="text-sm text-muted">
          Bayi iskontonuz: <b className="text-ink">%{indirim}</b> · Fiyatlar {kosul.paraBirimi === "EUR" ? <>EUR <span className="text-xs">(1 € = {kosul.kur} TL)</span> · ihracat, KDV uygulanmaz</> : "TL, KDV hariç"}.
        </p>
      </header>
      <SiparisSepeti
        katalog={katalog}
        indirim={indirim}
        kdv={kosul.kdv}
        paraBirimi={kosul.paraBirimi}
        kur={kosul.kur}
        kayitliAdres={kayitliAdres(v.bayi, tumSiparisler)}
        enErkenTarih={enErkenTeslim(bugun)}
        moq={{ gerceklesen: v.bayi.moqGerceklesen, hedef: v.bayi.moqHedef }}
        siparisler={gecmis}
        tekrarSepetleri={tekrarSepetleri}
        oneri={oneri}
      />
    </>
  );
}
