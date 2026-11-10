"use client";

// Satış hattının etkileşimli kısmı: kart aşamaları ve "Fırsat ekle" paneli burada yönetilir,
// özet kartlar ve kanban aynı veriden beslenir. Kazanıldı'ya geçen firma müşterilere eklenir.
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle, Plus, X } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import OzetKartlari from "./ozet-kartlari";
import Kanban from "./kanban";
import { yerlestir, type BirakmaKonumu } from "./ortak";
import FirsatFormu from "./firsat-formu";
import { firsatAsamasiGuncelle, type AsamaSonucu } from "./actions";
import { ASAMA_BILGI, KAYIP_NEDENLERI, type Asama, type Firsat, type KayipBilgisi, type KayipNedeni } from "./queries";
import MusteriDetay from "@/components/musteriler/musteri-detay";
import TeklifFormu from "@/components/teklifler/teklif-formu";
import HatirlatmaFormu from "@/components/hatirlatmalar/hatirlatma-formu";
import { MesajGecmisi, WhatsappSimulasyonu } from "./whatsapp-pencereleri";
import type { KartEylemi } from "./firsat-karti";
import type { Musteri } from "@/components/musteriler/queries";
import type { FiyatListesi } from "@/lib/urunler";

type Bildirim = NonNullable<AsamaSonucu["musteri"]>;

function MusteriBildirimi({ bildirim, onKapat, onAc }: { bildirim: Bildirim; onKapat: () => void; onAc: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(onKapat, 7000);
    return () => clearTimeout(t);
  }, [bildirim, onKapat]);

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex w-[calc(100%-40px)] max-w-sm items-start gap-3 rounded-card border border-lime bg-card p-4 shadow-[0_16px_40px_rgba(14,15,12,0.18)]"
    >
      <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[#3A4D00]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-sm">{bildirim.yeni ? "Müşterilere eklendi" : "Müşteri kaydına işlendi"}</b>
        <span className="text-[13px] text-muted">
          {bildirim.ad} {bildirim.yeni ? "yeni müşteri olarak kaydedildi." : "zaten müşteriydi; kazanılan satış geçmişine eklendi."}
          {bildirim.siparisNo && (
            <>
              {" "}Ödeme bekleyen sipariş açıldı:{" "}
              <Link href={`/siparisler/${bildirim.siparisNo}`} className="font-bold text-info hover:underline">#{bildirim.siparisNo}</Link>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            onAc(bildirim.id);
            onKapat();
          }}
          className="cursor-pointer self-start text-[13px] font-bold text-info hover:text-[#1A2A9E]"
        >
          Müşteriyi aç →
        </button>
      </div>
      <button
        type="button"
        onClick={onKapat}
        aria-label="Bildirimi kapat"
        className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-[#474A42] hover:bg-bg"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// Kart Kaybedildi'ye taşınınca nedeni sorulur (raporlarda "neden kaybediyoruz" için)
function KayipNedeniFormu({ firsat, onOnayla, onVazgec }: { firsat: Firsat; onOnayla: (k: KayipBilgisi) => void; onVazgec: () => void }) {
  const [neden, setNeden] = useState<KayipNedeni | null>(null);
  const [aciklama, setAciklama] = useState("");
  const diger = neden === "Diğer";
  const hazir = neden !== null && (!diger || aciklama.trim().length > 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!neden || !hazir) return;
        onOnayla(diger ? { neden, aciklama: aciklama.trim() } : { neden });
      }}
      className="flex w-full flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold">{firsat.firma} neden kaybedildi?</legend>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {KAYIP_NEDENLERI.map((n) => (
            <label
              key={n}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border border-line-strong px-3 text-sm font-semibold has-checked:border-ink has-checked:bg-err-bg has-focus-visible:outline-2 has-focus-visible:outline-blue"
            >
              <input type="radio" name="neden" value={n} checked={neden === n} onChange={() => setNeden(n)} className="accent-ink" />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
      {diger && (
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Sebebi yazın *
          <textarea
            autoFocus
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Örn. Firma kapandı, karar vericiye ulaşılamadı…"
            className="w-full resize-y rounded-control border border-line-strong bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-ink"
          />
          <span className="self-end text-xs font-medium tabular-nums text-muted">{aciklama.length}/300</span>
        </label>
      )}
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
        <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          Vazgeç
        </button>
        <button type="submit" disabled={!hazir} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50">
          Kaybedildi olarak işaretle
        </button>
      </div>
    </form>
  );
}

export default function SatisHattiGorunumu({
  firsatlar: ilk,
  musteriler,
  kampanyalar = [],
  fiyatListesi,
  bayiler = [],
}: {
  firsatlar: Firsat[];
  musteriler: Musteri[]; // "Müşteriyi aç" penceresi için
  kampanyalar?: { id: string; ad: string; durum: string }[];
  fiyatListesi?: FiyatListesi;
  bayiler?: { id: string; ad: string }[];
}) {
  const router = useRouter();
  const [firsatlar, setFirsatlar] = useState(ilk);
  // Sunucudan yeni liste gelince (ör. teklif sonrası tutar / aşama, WhatsApp'tan yeni lead) yerel sırayı koruyarak güncelle
  const [oncekiIlk, setOncekiIlk] = useState(ilk);
  if (ilk !== oncekiIlk) {
    setOncekiIlk(ilk);
    setFirsatlar((l) => {
      const yeni = new Map(ilk.map((f) => [f.id, f]));
      return [...l.filter((f) => yeni.has(f.id)).map((f) => yeni.get(f.id)!), ...ilk.filter((f) => !l.some((x) => x.id === f.id))];
    });
  }
  const [eylem, setEylem] = useState<{ id: string; tur: KartEylemi } | null>(null);
  const eylemFirsat = eylem ? firsatlar.find((f) => f.id === eylem.id) ?? null : null;
  const eylemKapat = useCallback(() => setEylem(null), []);
  const [simulasyon, setSimulasyon] = useState(false);
  const simulasyonKapat = useCallback(() => setSimulasyon(false), []);
  const [duyuru, setDuyuru] = useState<string | null>(null);
  const teklifKaydedildi = useCallback(
    (t: { id: string; durum: string }) => {
      setEylem(null);
      if (t.durum === "gonderildi") router.refresh();
      router.push(`/teklifler/${t.id}`);
    },
    [router],
  );
  const hatirlatmaEklendi = useCallback(() => {
    setEylem(null);
    setDuyuru("Hatırlatma eklendi.");
  }, []);
  const whatsappIslendi = useCallback((f: Firsat, yeni: boolean) => {
    setSimulasyon(false);
    setFirsatlar((l) => (yeni ? [...l, f] : l.map((x) => (x.id === f.id ? f : x))));
    setDuyuru(yeni ? `WhatsApp'tan yeni lead: ${f.firma}` : `${f.firma} fırsatına WhatsApp mesajı eklendi.`);
  }, []);
  useEffect(() => {
    if (!duyuru) return;
    const t = setTimeout(() => setDuyuru(null), 5000);
    return () => clearTimeout(t);
  }, [duyuru]);
  const [ekleAsama, setEkleAsama] = useState<Asama | null>(null);
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const duzenlenen = firsatlar.find((f) => f.id === duzenleId) ?? null;
  const duzenleKapat = useCallback(() => setDuzenleId(null), []);
  // Düzenlemede aşama ve kayıp nedeni korunur (onlar kart üzerinden değişir)
  const duzenlendi = useCallback((f: Firsat) => {
    setFirsatlar((l) => l.map((x) => (x.id === f.id ? { ...f, asama: x.asama, kayipNedeni: x.kayipNedeni, kayipAciklama: x.kayipAciklama, mesajlar: x.mesajlar } : x)));
    setDuzenleId(null);
  }, []);
  const [bildirim, setBildirim] = useState<Bildirim | null>(null);
  const [acikMusteri, setAcikMusteri] = useState<string | null>(null);
  const musteriKapat = useCallback(() => setAcikMusteri(null), []);
  const musteriKaydi = musteriler.find((m) => m.id === acikMusteri) ?? null;
  const [, baslat] = useTransition();
  const [kayipId, setKayipId] = useState<string | null>(null);
  const kayipFirsat = firsatlar.find((f) => f.id === kayipId) ?? null;
  const kayipKapat = useCallback(() => setKayipId(null), []);

  /** Kartı sütununda bir yukarı (-1) ya da aşağı (+1) kaydırır (klavye / dokunmatik için). */
  function sirala(id: string, yon: -1 | 1) {
    setFirsatlar((l) => {
      const f = l.find((x) => x.id === id);
      if (!f) return l;
      const sutun = l.filter((x) => x.asama === f.asama);
      const i = sutun.findIndex((x) => x.id === id);
      const komsu = sutun[i + yon];
      return komsu ? yerlestir(l, f, { hedefId: komsu.id, once: yon === -1 }) : l;
    });
  }

  function tasi(id: string, asama: Asama, kayip?: KayipBilgisi, konum?: BirakmaKonumu) {
    const firsat = firsatlar.find((f) => f.id === id);
    if (!firsat) return;
    if (firsat.asama === asama) {
      // Aynı sütun: yalnızca sıra değişir
      if (konum) setFirsatlar((l) => yerlestir(l, firsat, konum));
      // TODO: Supabase bağlanınca sıra satis_hatti.f_sira sütununa yazılacak
      return;
    }
    if (asama === "kaybedildi" && !kayip) {
      setKayipId(id); // önce nedeni sor, kart onaylanınca taşınır
      return;
    }
    // Taşınan kart bırakıldığı yere, yer belli değilse yeni sütununun en altına gider
    const guncel: Firsat = { ...firsat, asama, kayipNedeni: kayip?.neden, kayipAciklama: kayip?.aciklama };
    setFirsatlar((l) => yerlestir(l, guncel, konum));
    baslat(async () => {
      const sonuc = await firsatAsamasiGuncelle(firsat, asama, kayip);
      if (sonuc.musteri) setBildirim(sonuc.musteri);
    });
  }

  const kapat = useCallback(() => setEkleAsama(null), []);
  const bildirimiKapat = useCallback(() => setBildirim(null), []);
  const eklendi = useCallback((f: Firsat, musteri?: AsamaSonucu["musteri"]) => {
    setFirsatlar((l) => [...l, f]); // yeni fırsat sütunun en altına eklenir
    setEkleAsama(null);
    if (musteri) setBildirim(musteri);
  }, []);

  return (
    <>
      <PageHeader title="Satış Hattı" description="Cihaz + lisans fırsatları · Kazanıldı'ya taşınan firma müşterilere eklenir">
        <button
          type="button"
          onClick={() => setSimulasyon(true)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]"
        >
          <MessageCircle size={18} aria-hidden="true" className="text-[#1F8F4E]" />
          WhatsApp mesajı simüle et
        </button>
        <button
          type="button"
          onClick={() => setEkleAsama("yeni")}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Fırsat ekle
        </button>
      </PageHeader>

      <OzetKartlari firsatlar={firsatlar} />
      <Kanban
        firsatlar={firsatlar}
        onTasi={(id, asama, konum) => tasi(id, asama, undefined, konum)}
        onSirala={sirala}
        onEkle={setEkleAsama}
        onDuzenle={setDuzenleId}
        onEylem={(id, tur) => setEylem({ id, tur })}
      />

      <Modal acik={simulasyon} onKapat={simulasyonKapat} baslik="WhatsApp mesajı simüle et" aciklama="Webhook'a gelen mesajla aynı akış">
        <WhatsappSimulasyonu onIslendi={whatsappIslendi} onVazgec={simulasyonKapat} />
      </Modal>

      <Modal acik={eylem?.tur === "mesajlar" && !!eylemFirsat} onKapat={eylemKapat} baslik="WhatsApp mesajları" aciklama={eylemFirsat?.firma}>
        {eylemFirsat && <MesajGecmisi firsat={eylemFirsat} />}
      </Modal>

      <Modal acik={eylem?.tur === "teklif" && !!eylemFirsat} onKapat={eylemKapat} baslik="Teklif oluştur" aciklama={eylemFirsat ? `${eylemFirsat.firma} · ${eylemFirsat.icerik}` : undefined}>
        {eylemFirsat && <TeklifFormu key={eylemFirsat.id} firsat={eylemFirsat} fiyatListesi={fiyatListesi} onKaydedildi={teklifKaydedildi} onVazgec={eylemKapat} />}
      </Modal>

      <Modal acik={eylem?.tur === "hatirlatma" && !!eylemFirsat} onKapat={eylemKapat} baslik="Hatırlatma ekle" aciklama={eylemFirsat?.firma}>
        {eylemFirsat && (
          <HatirlatmaFormu
            key={eylemFirsat.id}
            kayit={{ tur: "firsat", id: eylemFirsat.id, ad: eylemFirsat.firma, href: "/satis-hatti" }}
            varsayilanBaslik={`${eylemFirsat.firma} · ${eylemFirsat.sonrakiAdim}`}
            onKaydedildi={hatirlatmaEklendi}
            onVazgec={eylemKapat}
          />
        )}
      </Modal>

      {duyuru && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-40px)] max-w-sm -translate-x-1/2 rounded-card bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-[0_16px_40px_rgba(14,15,12,0.25)]">
          {duyuru}
        </div>
      )}

      <Modal acik={duzenlenen !== null} onKapat={duzenleKapat} baslik="Fırsatı düzenle" aciklama={duzenlenen ? `${duzenlenen.firma} · ${ASAMA_BILGI[duzenlenen.asama].ad}` : undefined}>
        {duzenlenen && <FirsatFormu key={duzenlenen.id} firsat={duzenlenen} kampanyalar={kampanyalar} fiyatListesi={fiyatListesi} bayiler={bayiler} onKaydedildi={duzenlendi} onVazgec={duzenleKapat} />}
      </Modal>

      <Modal
        acik={ekleAsama !== null}
        onKapat={kapat}
        baslik="Yeni fırsat"
        aciklama={ekleAsama ? `${ASAMA_BILGI[ekleAsama].ad} aşamasına eklenecek` : undefined}
      >
        {ekleAsama && (
          <FirsatFormu key={ekleAsama} baslangicAsamasi={ekleAsama} kampanyalar={kampanyalar} fiyatListesi={fiyatListesi} bayiler={bayiler} onKaydedildi={eklendi} onVazgec={kapat} />
        )}
      </Modal>

      <Modal acik={kayipFirsat !== null} onKapat={kayipKapat} baslik="Fırsat kaybedildi" aciklama={kayipFirsat ? `${kayipFirsat.firma} · ${kayipFirsat.icerik}` : undefined}>
        {kayipFirsat && (
          <KayipNedeniFormu
            key={kayipFirsat.id}
            firsat={kayipFirsat}
            onOnayla={(k) => {
              tasi(kayipFirsat.id, "kaybedildi", k);
              setKayipId(null);
            }}
            onVazgec={kayipKapat}
          />
        )}
      </Modal>

      {bildirim && <MusteriBildirimi key={bildirim.id} bildirim={bildirim} onKapat={bildirimiKapat} onAc={setAcikMusteri} />}

      <Modal
        acik={acikMusteri !== null}
        onKapat={musteriKapat}
        baslik="Müşteri"
        aciklama={musteriKaydi ? `${musteriKaydi.sehir}, ${musteriKaydi.ulke}` : undefined}
      >
        {musteriKaydi ? (
          <MusteriDetay musteri={musteriKaydi} yalin />
        ) : (
          <p className="pb-5 text-sm text-muted">Müşteri kaydı yükleniyor…</p>
        )}
      </Modal>
    </>
  );
}
