"use client";

// Pazarlama & Bülten sayfasının etkileşimli kısmı: dönem seçimi, içerik takvimi, kampanya kayıtları (toplu e-posta / WhatsApp
// gönderimi dahil) ve hedef listeler (filtreli ya da CSV / Excel'den içe aktarılmış).
import { useCallback, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { csvIndir } from "@/lib/disa-aktar";
import { useBugun } from "@/lib/use-bugun";
import { icerikPaylasildi, icerikSil, icerikTasi, listeSil, type IcerikSonucu, type KampanyaSonucu, type ListeSonucu } from "./actions";
import type { Gonderim, Icerik, Kampanya, KampanyaKanali, ListeFiltresi, OzelListe } from "./queries";
import { IZIN_KANAL_ADI, type IzinKanali } from "@/components/musteriler/izin";
import { KAMPANYA_IZNI, filtreOzeti, filtreUygun, hazirDonem, isoGun, listeAdi, listeUyeleri, musteriIzinli, type Donem, type ListeVerisi } from "./ortak";
import OzetKartlari from "./ozet-kartlari";
import IcerikTakvimi from "./icerik-takvimi";
import KampanyaTablosu from "./kampanya-tablosu";
import HedefListeler from "./hedef-listeler";
import { IcerikFormu, KampanyaFormu, ListeFormu } from "./kampanya-formu";
import IceAktarFormu from "./ice-aktar-formu";
import GonderPenceresi from "./gonder-penceresi";
import DonemSecimi from "./donem-secimi";

const IKINCIL_BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-sm font-bold transition-colors hover:bg-[#F4F5F0]";

type Pencere =
  | null
  | { tur: "icerik"; tarih: string; id?: string }
  | { tur: "kampanya"; id?: string }
  | { tur: "liste" }
  | { tur: "aktar" }
  | { tur: "gonder"; id: string };

/** "Lisansı 30 gün içinde bitenler" → "lisansi-30-gun-icinde-bitenler" */
const dosyaAdi = (ad: string) =>
  ad.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function PazarlamaGorunumu({
  icerikler: ilkIcerik,
  kampanyalar: ilkKampanya,
  ozelListeler: ilkListeler,
  gonderimler: ilkGonderimler,
  veri,
  firsatlar,
  segmentler,
}: {
  icerikler: Icerik[];
  kampanyalar: Kampanya[];
  ozelListeler: OzelListe[];
  gonderimler: Gonderim[];
  veri: ListeVerisi;
  firsatlar: { kampanyaId: string | null; asama: string }[];
  segmentler: Record<string, string>;
}) {
  const bugun = useBugun();
  const [icerikler, setIcerikler] = useState(ilkIcerik);
  const [kampanyalar, setKampanyalar] = useState(ilkKampanya);
  const [listeler, setListeler] = useState(ilkListeler);
  const [gonderimler, setGonderimler] = useState(ilkGonderimler);
  const [secilenDonem, setDonem] = useState<Donem | null>(null);
  const donem = secilenDonem ?? (bugun === null ? null : hazirDonem("hafta", bugun)); // varsayılan: bu hafta
  const [kanal, setKanal] = useState<KampanyaKanali | "tumu">("tumu");
  const [pencere, setPencere] = useState<Pencere>(null);
  const [listeHata, setListeHata] = useState<string | null>(null);
  const [, baslat] = useTransition();
  const kapat = useCallback(() => setPencere(null), []);
  const bugunIso = bugun === null ? "" : isoGun(bugun);

  // Kampanya başına lead / satış: satış hattında kampanyası seçilen fırsatlar
  const sonuclar = useMemo(() => {
    const s: Record<string, { lead: number; kazanilan: number }> = {};
    for (const f of firsatlar) {
      if (!f.kampanyaId) continue;
      s[f.kampanyaId] ??= { lead: 0, kazanilan: 0 };
      s[f.kampanyaId].lead += 1;
      if (f.asama === "kazanildi") s[f.kampanyaId].kazanilan += 1;
    }
    return s;
  }, [firsatlar]);

  const uyeler = useCallback((id: string, kanal?: IzinKanali | null) => listeUyeleri(id, veri, listeler, bugun, kanal), [veri, listeler, bugun]);
  // "Lisansı bitenler" bugüne göre hesaplanır; tarih bilinmeden sayı gösterilmez
  const listeSayisi = useCallback(
    (id: string, kanal?: IzinKanali | null) => (id === "bitiyor" && bugun === null ? null : uyeler(id, kanal).length),
    [uyeler, bugun],
  );

  /** Kanal verilirse (kampanyadan indirme) yalnızca o kanalda izni olan kişiler dosyaya girer */
  const indir = (id: string, kanal?: IzinKanali | null) => {
    const ad = listeAdi(id, listeler) + (kanal ? ` ${IZIN_KANAL_ADI[kanal]} izinli` : "");
    csvIndir(
      [
        ["Firma", "Yetkili", "Telefon", "E-posta", "Ülke / bölge", "İzinli kanallar", "Bilgi"],
        ...uyeler(id, kanal).map((u) => [
          u.ad, u.kisi, u.telefon, u.eposta, u.ulke,
          u.kanallar === null ? "Sözleşmeli bayi" : u.kanallar.map((k) => IZIN_KANAL_ADI[k]).join(", ") || "İzin yok",
          u.bilgi,
        ]),
      ],
      `${dosyaAdi(ad) || "liste"}.csv`,
    );
  };

  const paylasildi = (id: string, deger: boolean) => {
    setIcerikler((l) => l.map((x) => (x.id === id ? { ...x, paylasildi: deger } : x)));
    baslat(async () => {
      await icerikPaylasildi(id, deger);
    });
  };
  const tasi = (id: string, tarih: string) => {
    setIcerikler((l) => l.map((x) => (x.id === id ? { ...x, tarih } : x)));
    baslat(async () => {
      await icerikTasi(id, tarih);
    });
  };
  const sil = (id: string) => {
    setIcerikler((l) => l.filter((x) => x.id !== id));
    baslat(async () => {
      await icerikSil(id);
    });
  };
  const icerikEklendi = useCallback((s: IcerikSonucu) => {
    const i = s.icerik;
    if (i) setIcerikler((l) => (l.some((x) => x.id === i.id) ? l.map((x) => (x.id === i.id ? i : x)) : [...l, i]));
    setPencere(null);
  }, []);
  const gonderildi = useCallback((g: Gonderim) => {
    setGonderimler((l) => [g, ...l]);
    if (g.tur !== "test") setKampanyalar((l) => l.map((k) => (k.id === g.kampanyaId && k.durum === "Taslak" ? { ...k, durum: "Aktif" } : k)));
  }, []);
  const kampanyaKaydedildi = useCallback((s: KampanyaSonucu) => {
    const k = s.kampanya;
    if (k) setKampanyalar((l) => (l.some((x) => x.id === k.id) ? l.map((x) => (x.id === k.id ? k : x)) : [k, ...l]));
    setPencere(null);
  }, []);
  const listeEklendi = useCallback((s: ListeSonucu) => {
    if (s.liste) setListeler((l) => [...l, s.liste!]);
    setListeHata(null);
    setPencere(null);
  }, []);
  const listeyiSil = (id: string) =>
    baslat(async () => {
      const s = await listeSil(id);
      if (s.hata) setListeHata(s.hata);
      else {
        setListeler((l) => l.filter((x) => x.id !== id));
        setListeHata(null);
      }
    });

  const ulkeler = useMemo(() => [...new Set(veri.musteriler.map((m) => m.ulke))].sort((a, b) => a.localeCompare(b, "tr")), [veri.musteriler]);
  const filtreSayisi = useCallback((f: ListeFiltresi) => veri.musteriler.filter((m) => filtreUygun(m, f)).length, [veri.musteriler]);
  const duzenlenen = pencere?.tur === "kampanya" && pencere.id ? kampanyalar.find((k) => k.id === pencere.id) : undefined;
  const duzenlenenIcerik = pencere?.tur === "icerik" && pencere.id ? icerikler.find((x) => x.id === pencere.id) : undefined;
  const gonderilen = pencere?.tur === "gonder" ? kampanyalar.find((k) => k.id === pencere.id) : undefined;
  const ozet = (l: OzelListe) =>
    l.aktarim
      ? `İçe aktarıldı · ${l.aktarim.kaynak}${l.aktarim.kisiler[0]?.kanallar.length ? ` · ${l.aktarim.kisiler[0].kanallar.map((k) => IZIN_KANAL_ADI[k]).join(", ")} izinli` : " · izin beyanı yok"}`
      : filtreOzeti(l.filtre, segmentler);
  const baslik =
    pencere?.tur === "icerik" ? (duzenlenenIcerik ? "İçeriği düzenle" : "İçerik ekle")
    : pencere?.tur === "liste" ? "Yeni hedef liste"
    : pencere?.tur === "aktar" ? "Kitle içe aktar"
    : pencere?.tur === "gonder" ? `${gonderilen?.kanal ?? ""} gönderimi`
    : duzenlenen ? "Kampanyayı düzenle" : "Kampanya kaydet";
  const aciklama =
    pencere?.tur === "liste" ? "Müşteri kayıtlarından filtreyle süzülür"
    : pencere?.tur === "aktar" ? "CSV, Excel (.xlsx) ya da Excel'den yapıştırılan tablo"
    : pencere?.tur === "gonder" ? gonderilen?.ad
    : pencere?.tur === "icerik" && duzenlenenIcerik ? `${duzenlenenIcerik.kanal} · ${duzenlenenIcerik.baslik}`
    : duzenlenen ? duzenlenen.ad : undefined;

  return (
    <>
      <PageHeader
        title="Pazarlama & bülten"
        description="İçerikleri planlayın, kitleleri içe aktarın, e-posta ve WhatsApp kampanyalarını izinli kişilere toplu gönderin"
      >
        <button type="button" onClick={() => bugunIso && setPencere({ tur: "icerik", tarih: bugunIso })} className={IKINCIL_BTN}>
          <Plus size={18} aria-hidden="true" />
          İçerik ekle
        </button>
        <button
          type="button"
          onClick={() => setPencere({ tur: "kampanya" })}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          <Plus size={18} aria-hidden="true" />
          Kampanya kaydet
        </button>
      </PageHeader>

      <DonemSecimi donem={donem} bugun={bugun} onDegis={setDonem} />

      <OzetKartlari
        donem={donem}
        icerikler={icerikler}
        kampanyalar={kampanyalar}
        gonderimler={gonderimler}
        sonuclar={sonuclar}
        izinli={{
          musteri: veri.musteriler.filter((m) => musteriIzinli(m)).length,
          eposta: veri.musteriler.filter((m) => musteriIzinli(m, "eposta")).length,
          whatsapp: veri.musteriler.filter((m) => musteriIzinli(m, "whatsapp")).length,
        }}
      />

      <IcerikTakvimi
        icerikler={icerikler}
        kampanyalar={kampanyalar}
        donem={donem}
        onPaylasildi={paylasildi}
        onSil={sil}
        onEkle={(tarih) => setPencere({ tur: "icerik", tarih })}
        onDuzenle={(id) => setPencere({ tur: "icerik", tarih: icerikler.find((x) => x.id === id)?.tarih ?? bugunIso, id })}
        onTasi={tasi}
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_620px]">
          <KampanyaTablosu
            kampanyalar={kampanyalar}
            kanal={kanal}
            onKanal={setKanal}
            sonuclar={sonuclar}
            listeAdi={(id) => listeAdi(id, listeler)}
            listeSayisi={listeSayisi}
            onDuzenle={(id) => setPencere({ tur: "kampanya", id })}
            onIndir={(k) => indir(k.listeId, KAMPANYA_IZNI[k.kanal])}
            gonderimler={gonderimler}
            onGonder={(id) => setPencere({ tur: "gonder", id })}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px]">
          <HedefListeler
            ozelListeler={listeler}
            sayi={listeSayisi}
            filtreOzeti={ozet}
            onIndir={indir}
            onSil={listeyiSil}
            onYeni={() => setPencere({ tur: "liste" })}
            onIceAktar={() => setPencere({ tur: "aktar" })}
            hata={listeHata}
          />
        </div>
      </div>

      <Modal acik={pencere !== null} onKapat={kapat} baslik={baslik} aciklama={aciklama}>
        {pencere?.tur === "icerik" && (
          <IcerikFormu key={pencere.id ?? pencere.tarih} icerik={duzenlenenIcerik} tarih={pencere.tarih} kampanyalar={kampanyalar} onKaydedildi={icerikEklendi} onVazgec={kapat} />
        )}
        {pencere?.tur === "kampanya" && (
          <KampanyaFormu key={pencere.id ?? "yeni"} kampanya={duzenlenen} bugun={bugunIso} ozelListeler={listeler} listeSayisi={listeSayisi} onKaydedildi={kampanyaKaydedildi} onVazgec={kapat} />
        )}
        {pencere?.tur === "liste" && <ListeFormu segmentler={segmentler} ulkeler={ulkeler} uyeSayisi={filtreSayisi} onKaydedildi={listeEklendi} onVazgec={kapat} />}
        {pencere?.tur === "aktar" && <IceAktarFormu onKaydedildi={listeEklendi} onVazgec={kapat} />}
        {gonderilen && (
          <GonderPenceresi
            key={gonderilen.id}
            kampanya={gonderilen}
            gonderimler={gonderimler}
            onGonderildi={gonderildi}
            onDuzenle={() => setPencere({ tur: "kampanya", id: gonderilen.id })}
            onKapat={kapat}
          />
        )}
      </Modal>
    </>
  );
}
