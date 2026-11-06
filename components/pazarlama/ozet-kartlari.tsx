"use client";

// Seçili dönemin özeti: planlanan / paylaşılan içerik, dönemde yürüyen kampanya, gönderilen mesaj ve kampanya lead'leri.
// Duyuru izni kartı döneme bağlı değildir (bugünkü durum).
import { useBugun } from "@/lib/use-bugun";
import type { Gonderim, Icerik, Kampanya } from "./queries";
import { donemde, isoGun, type Donem } from "./ortak";

export default function OzetKartlari({
  donem,
  icerikler,
  kampanyalar,
  gonderimler,
  sonuclar,
  izinli,
}: {
  donem: Donem | null;
  icerikler: Icerik[];
  kampanyalar: Kampanya[];
  gonderimler: Gonderim[];
  sonuclar: Record<string, { lead: number; kazanilan: number }>;
  izinli: { musteri: number; eposta: number; whatsapp: number };
}) {
  const bugun = useBugun();
  const bugunIso = bugun === null ? "" : isoGun(bugun);
  const d = donem;
  const icerik = d ? icerikler.filter((i) => i.tarih >= d.bas && i.tarih <= d.bit) : [];
  const paylasilan = icerik.filter((i) => i.paylasildi).length;
  const geciken = bugunIso ? icerik.filter((i) => !i.paylasildi && i.tarih < bugunIso).length : 0;
  const kampanya = d ? kampanyalar.filter((k) => donemde(k.baslangic, k.bitis, d)) : [];
  const gonderim = d ? gonderimler.filter((g) => g.tur !== "test" && g.zaman.slice(0, 10) >= d.bas && g.zaman.slice(0, 10) <= d.bit) : [];
  const eposta = gonderim.filter((g) => g.kanal === "eposta").reduce((t, g) => t + g.basarili, 0);
  const whatsapp = gonderim.filter((g) => g.kanal === "whatsapp").reduce((t, g) => t + g.basarili, 0);
  const lead = kampanya.reduce((t, k) => ({ lead: t.lead + (sonuclar[k.id]?.lead ?? 0), kazanilan: t.kazanilan + (sonuclar[k.id]?.kazanilan ?? 0) }), { lead: 0, kazanilan: 0 });
  const yok = d === null;

  const kartlar = [
    {
      etiket: "Planlanan içerik", deger: yok ? "—" : String(icerik.length),
      alt: icerik.length ? `${paylasilan} paylaşıldı · ${icerik.length - paylasilan} bekliyor` : "Bu dönemde içerik yok",
      uyari: geciken ? `${geciken} içerik gecikti` : "",
    },
    {
      etiket: "Dönemdeki kampanya", deger: yok ? "—" : String(kampanya.length),
      alt: `${kampanya.filter((k) => k.durum === "Aktif").length} aktif · ${kampanya.filter((k) => k.durum === "Taslak").length} taslak · ${kampanya.filter((k) => k.durum === "Tamamlandı").length} bitti`,
      uyari: "",
    },
    { etiket: "Gönderilen mesaj", deger: yok ? "—" : String(eposta + whatsapp), alt: `E-posta ${eposta} · WhatsApp ${whatsapp} · ${gonderim.length} gönderim`, uyari: "" },
    { etiket: "Kampanyalardan gelen lead", deger: yok ? "—" : String(lead.lead), alt: `${lead.kazanilan} tanesi satışa döndü · dönemdeki kampanyalardan`, uyari: "" },
  ];
  return (
    <section aria-label="Pazarlama özeti" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kartlar.map((k) => (
        <div key={k.etiket} className="flex flex-col gap-1.5 rounded-card border border-line bg-card p-4">
          <span className="text-xs font-semibold text-muted">{k.etiket}</span>
          <b className="text-2xl font-extrabold tabular-nums">{k.deger}</b>
          <span className="text-xs text-muted">{k.alt}</span>
          {k.uyari && <span className="text-xs font-bold text-warn">{k.uyari}</span>}
        </div>
      ))}
      <div className="flex flex-col gap-1.5 rounded-card border border-lime-dark bg-lime-bg/40 p-4">
        <span className="text-xs font-semibold text-[#3A4D00]">Duyuru izni olan müşteri</span>
        <b className="text-2xl font-extrabold tabular-nums">{izinli.musteri}</b>
        <span className="text-xs text-[#3A4D00]">E-posta {izinli.eposta} · WhatsApp {izinli.whatsapp} · bugünkü durum</span>
      </div>
    </section>
  );
}
