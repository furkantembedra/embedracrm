"use client";

// Operasyon sayfası: "Üretim & tedarik" ve "Ayarlar & ekip" sekmeleri. Görev ataması Jira'da yapılır.
import { useCallback, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import { useBugun } from "@/lib/use-bugun";
import type { FiyatListesi } from "@/lib/urunler";
import { icUretimGirisiSil, kaliteyeGonder, tedarikTeslimAl, tedarikYolda, uretimeAl, type UretimSonucu } from "./actions";
import type { BilesenKalemi, HavuzSeri, IcUretimEmri, Kullanici, Recete, TedarikSiparisi, UretimPartisi } from "./queries";
import { BilesenStoku, IcUretimListesi, SeriHavuzu, TedarikListesi, UretimOzeti, UretimPartileri } from "./uretim";
import { GunlukGirisFormu, IcUretimFormu, KaliteFormu, PartiFormu, TedarikFormu } from "./uretim-formlari";
import { EkipAyari, FiyatListesiAyari, KargoFirmalariAyari } from "./ayarlar";

type Sekme = "uretim" | "ayarlar";
type Pencere = null | { tur: "parti" } | { tur: "depo"; id: string } | { tur: "tamir"; id: string } | { tur: "tedarik" } | { tur: "icUretim" } | { tur: "giris"; id: string };

export default function OperasyonGorunumu(p: {
  partiler: UretimPartisi[];
  bilesenler: BilesenKalemi[];
  tedarik: TedarikSiparisi[];
  havuz: HavuzSeri[];
  recete: Recete;
  icUretim: IcUretimEmri[];
  fiyat: FiyatListesi;
  aksesuarlar: { kod: string; ad: string; fiyat: number }[];
  kablolar: { kod: string; ad: string }[];
  kargoFirmalari: string[];
  ekip: Kullanici[];
}) {
  const bugun = useBugun();
  const bugunIso = bugun === null ? "" : new Date(bugun - new Date(bugun).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [sekme, setSekme] = useState<Sekme>("uretim");
  const [veri, setVeri] = useState({ partiler: p.partiler, bilesenler: p.bilesenler, tedarik: p.tedarik, havuz: p.havuz, recete: p.recete, icUretim: p.icUretim });
  const [fiyat, setFiyat] = useState(p.fiyat);
  const [aksesuarlar, setAksesuarlar] = useState(p.aksesuarlar);
  const [kargo, setKargo] = useState(p.kargoFirmalari);
  const [ekip, setEkip] = useState(p.ekip);
  const [pencere, setPencere] = useState<Pencere>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const kapat = useCallback(() => setPencere(null), []);

  const uygula = useCallback((s: UretimSonucu) => {
    if (s.hata) {
      setHata(s.hata);
      return;
    }
    setHata(null);
    if (s.partiler && s.bilesenler && s.tedarik && s.havuz && s.recete && s.icUretim) {
      setVeri({ partiler: s.partiler, bilesenler: s.bilesenler, tedarik: s.tedarik, havuz: s.havuz, recete: s.recete, icUretim: s.icUretim });
    }
    setPencere(null);
  }, []);
  const calistir = (is: () => Promise<UretimSonucu>) => baslat(async () => uygula(await is()));

  const partiEylemi = (parti: UretimPartisi) => {
    if (parti.durum === "planlandi") calistir(() => uretimeAl(parti.id));
    else if (parti.durum === "uretimde") calistir(() => kaliteyeGonder(parti.id));
    else if (parti.durum === "kalite") setPencere({ tur: "depo", id: parti.id });
    else if (parti.durum === "depoda" && parti.tamirde) setPencere({ tur: "tamir", id: parti.id });
  };

  const depoPartisi = pencere?.tur === "depo" || pencere?.tur === "tamir" ? veri.partiler.find((x) => x.id === pencere.id) : undefined;
  const girisEmri = pencere?.tur === "giris" ? veri.icUretim.find((x) => x.id === pencere.id) : undefined;
  const bilesenAdi = (kod: string) => veri.bilesenler.find((b) => b.kod === kod)?.ad ?? kod;
  const personeller = ekip.filter((k) => k.aktif).map((k) => k.ad);
  const tedarikKalemleri = [
    ...veri.bilesenler.map((b) => ({ kod: b.kod, ad: b.ad, grup: "Üretim bileşenleri" })),
    ...p.kablolar.map((k) => ({ kod: k.kod, ad: k.ad, grup: "Kablolar (sipariş deposu)" })),
  ];
  const tedarikciler = [...new Set(veri.tedarik.map((t) => t.tedarikci))];

  return (
    <>
      <PageHeader title="Operasyon" description="Üretim, tedarik ve seri no havuzu; fiyat listesi, kargo firmaları ve ekip ayarları">
        {sekme === "uretim" && (
          <button
            type="button"
            onClick={() => setPencere({ tur: "parti" })}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
          >
            <Plus size={18} aria-hidden="true" />
            Parti planla
          </button>
        )}
      </PageHeader>

      <div role="tablist" aria-label="Operasyon bölümleri" className="flex w-fit gap-1 rounded-control bg-card p-1 shadow-[0_0_0_1px_var(--color-line)]">
        {([["uretim", "Üretim & tedarik"], ["ayarlar", "Ayarlar & ekip"]] as const).map(([id, ad]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sekme === id}
            onClick={() => setSekme(id)}
            className={`min-h-10 cursor-pointer rounded-[9px] px-4 text-[13px] font-bold transition-colors ${sekme === id ? "bg-ink text-white" : "text-[#474A42] hover:bg-bg"}`}
          >
            {ad}
          </button>
        ))}
      </div>

      {sekme === "uretim" ? (
        <>
          <UretimOzeti partiler={veri.partiler} tedarik={veri.tedarik} havuz={veri.havuz} bilesenler={veri.bilesenler} icUretim={veri.icUretim} bugun={bugunIso} />
          {hata && <p role="alert" className="rounded-control bg-err-bg px-4 py-2.5 text-[13px] font-semibold text-err">{hata}</p>}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-4">
              <UretimPartileri partiler={veri.partiler} bekliyor={bekliyor} onPlanla={() => setPencere({ tur: "parti" })} onEylem={partiEylemi} />
              <IcUretimListesi
                emirler={veri.icUretim} bugun={bugunIso} bekliyor={bekliyor}
                onYeni={() => setPencere({ tur: "icUretim" })}
                onGiris={(id) => setPencere({ tur: "giris", id })}
                onSil={(emirId, girisId) => calistir(() => icUretimGirisiSil(emirId, girisId))}
              />
              <TedarikListesi tedarik={veri.tedarik} bekliyor={bekliyor} onYolda={(id) => calistir(() => tedarikYolda(id))} onTeslim={(id) => calistir(() => tedarikTeslimAl(id))} />
            </div>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
              <BilesenStoku bilesenler={veri.bilesenler} partiler={veri.partiler} recete={veri.recete} onTedarik={() => setPencere({ tur: "tedarik" })} onIcUretim={() => setPencere({ tur: "icUretim" })} />
              <SeriHavuzu havuz={veri.havuz} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[2_1_620px]">
            <FiyatListesiAyari
              fiyat={fiyat}
              aksesuarlar={aksesuarlar}
              onKaydedildi={(f, a) => {
                setFiyat(f);
                setAksesuarlar((l) => l.map((x) => ({ ...x, fiyat: a[x.kod] ?? x.fiyat })));
              }}
            />
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <EkipAyari ekip={ekip} onKaydedildi={setEkip} />
            <KargoFirmalariAyari firmalar={kargo} onKaydedildi={setKargo} />
          </div>
        </div>
      )}

      <Modal
        acik={pencere !== null}
        onKapat={kapat}
        baslik={
          pencere?.tur === "parti" ? "Üretim partisi planla"
          : pencere?.tur === "tedarik" ? "Tedarik siparişi (dış tedarik)"
          : pencere?.tur === "icUretim" ? "İç üretim emri"
          : pencere?.tur === "giris" ? "Gün sonu üretim girişi"
          : pencere?.tur === "tamir" ? "Tamir sonucu"
          : "Kalite sonucu · depoya al"
        }
        aciklama={
          depoPartisi && pencere?.tur === "tamir" ? `${depoPartisi.id} · ${depoPartisi.tamirde} cihaz tamirde`
          : depoPartisi ? `${depoPartisi.id} · ${depoPartisi.adet} cihaz kalite kontrolde`
          : girisEmri ? `${girisEmri.id} · ${girisEmri.hedef}× ${girisEmri.kalemAdi}`
          : undefined
        }
      >
        {pencere?.tur === "parti" && <PartiFormu key={bugunIso} bilesenler={veri.bilesenler} recete={veri.recete} bugun={bugunIso} onTamam={uygula} onVazgec={kapat} />}
        {depoPartisi && (
          <KaliteFormu
            key={`${pencere?.tur}-${depoPartisi.id}`} parti={depoPartisi} mod={pencere?.tur === "tamir" ? "tamir" : "kalite"}
            recete={veri.recete[depoPartisi.model]} bilesenAdi={bilesenAdi} onTamam={uygula} onVazgec={kapat}
          />
        )}
        {pencere?.tur === "icUretim" && <IcUretimFormu key={bugunIso} bilesenler={veri.bilesenler} bugun={bugunIso} onTamam={uygula} onVazgec={kapat} />}
        {girisEmri && <GunlukGirisFormu key={`${girisEmri.id}-${bugunIso}`} emir={girisEmri} personeller={personeller} bugun={bugunIso} onTamam={uygula} onVazgec={kapat} />}
        {pencere?.tur === "tedarik" && <TedarikFormu kalemler={tedarikKalemleri} tedarikciler={tedarikciler} bugun={bugunIso} onTamam={uygula} onVazgec={kapat} />}
      </Modal>
    </>
  );
}
