"use client";

// Hatırlatmalar sayfası: gecikmiş / bugün / yaklaşan / tamamlanan grupları, sorumlu filtresi ve elle ekleme
import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import Modal from "@/components/ui/modal";
import HatirlatmaFormu from "./hatirlatma-formu";
import HatirlatmaSatiri from "./hatirlatma-satiri";
import { useHatirlatmalar } from "./use-hatirlatmalar";
import type { Hatirlatma } from "./queries";

type Kapsam = "benim" | "tumu" | string; // string: kullanıcı id

export default function HatirlatmaGorunumu() {
  const [sayac, setSayac] = useState(0);
  const { veri, tamamla, ertele } = useHatirlatmalar(sayac);
  const [kapsam, setKapsam] = useState<Kapsam>("tumu");
  const [ekle, setEkle] = useState(false);
  const kapat = useCallback(() => setEkle(false), []);
  const eklendi = useCallback(() => {
    setEkle(false);
    setSayac((n) => n + 1);
  }, []);

  const yonetici = veri?.aktif.rol === "Yönetici";
  const liste = (veri?.liste ?? []).filter((h) => (kapsam === "tumu" ? true : kapsam === "benim" ? h.sorumluId === veri?.aktif.id : h.sorumluId === kapsam));
  const simdi = veri?.simdi ?? "";
  const bugun = simdi.slice(0, 10);
  const gruplar: { ad: string; liste: Hatirlatma[] }[] = [
    { ad: "Gecikmiş", liste: liste.filter((h) => h.durum === "bekliyor" && h.zaman.slice(0, 10) < bugun) },
    { ad: "Bugün", liste: liste.filter((h) => h.durum === "bekliyor" && h.zaman.slice(0, 10) === bugun) },
    { ad: "Yaklaşan", liste: liste.filter((h) => h.durum === "bekliyor" && h.zaman.slice(0, 10) > bugun) },
    { ad: "Tamamlanan (bu ay)", liste: liste.filter((h) => h.durum === "tamam").sort((a, b) => (b.tamamlanma ?? "").localeCompare(a.tamamlanma ?? "")) },
  ];

  return (
    <>
      <PageHeader title="Hatırlatmalar" description="Elle eklenenler + satış, teklif, sipariş, stok, lisans ve RMA kurallarından otomatik oluşanlar">
        <button type="button" onClick={() => setEkle(true)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
          <Plus size={18} aria-hidden="true" /> Hatırlatma ekle
        </button>
      </PageHeader>

      {veri && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] font-bold">
            Sorumlu
            <select value={kapsam} onChange={(e) => setKapsam(e.target.value)} className="min-h-10 cursor-pointer rounded-control border border-line-strong bg-card px-3 text-sm font-semibold">
              {yonetici && <option value="tumu">Herkes</option>}
              <option value="benim">Bana atananlar ({veri.aktif.ad})</option>
              {yonetici && veri.ekip.filter((k) => k.id !== veri.aktif.id).map((k) => <option key={k.id} value={k.id}>{k.ad} · {k.rol}</option>)}
            </select>
          </label>
          <span className="text-xs text-muted">{yonetici ? "Yönetici olarak tüm ekibin hatırlatmalarını görüyorsunuz." : "Yalnızca size atananlar görünür."}</span>
        </div>
      )}

      {!veri && <div aria-busy="true" aria-label="Yükleniyor" className="h-80 animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />}

      {veri && (
        <div className="grid gap-4 xl:grid-cols-2">
          {gruplar.map((g) => (
            <section key={g.ad} aria-label={g.ad} className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-5">
              <h2 className="flex items-center gap-2 text-[17px] font-extrabold">
                {g.ad}
                <span className={`rounded-full px-2 py-0.5 text-xs ${g.ad === "Gecikmiş" && g.liste.length ? "bg-warn-bg text-warn" : "bg-bg text-[#474A42]"}`}>{g.liste.length}</span>
              </h2>
              {g.liste.length ? (
                <ul className="flex flex-col gap-2">
                  {g.liste.map((h) => (
                    <HatirlatmaSatiri
                      key={h.id}
                      h={h}
                      simdi={simdi}
                      sorumlu={yonetici ? veri.ekip.find((k) => k.id === h.sorumluId)?.ad ?? "Pasif kullanıcı" : undefined}
                      onTamamla={(t) => tamamla(h.id, t)}
                      onErtele={(s) => ertele(h.id, s)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-sm text-muted">Bu grupta hatırlatma yok.</p>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal acik={ekle} onKapat={kapat} baslik="Hatırlatma ekle">
        <HatirlatmaFormu onKaydedildi={eklendi} onVazgec={kapat} />
      </Modal>
    </>
  );
}
