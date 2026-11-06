"use client";

// Sözleşme kontrol listesi: her madde kapalıyken tek satır + özet, açılınca o maddeye özel alanlar.
// Alandan çıkınca kaydedilir; zorunlu alanlar dolunca madde kendiliğinden işaretlenir. Aynı anda tek madde açık.
import { useState } from "react";
import { ChevronDown, Lock, TriangleAlert } from "lucide-react";
import { tl } from "@/lib/format";
import { DESTEK_KALEMLERI, KONTROL_LISTESI, type Basvuru, type SozlesmeDetayi } from "./queries";
import { maddeOzeti, maddeTamam, moqTutari } from "./ortak";

const GIRDI =
  "min-h-10 w-full rounded-control border border-line-strong bg-card px-3 text-[13px] font-medium outline-none focus:border-ink";
const ALAN = "flex min-w-0 flex-col gap-1 text-xs font-bold";
const SECIM = (aktif: boolean) =>
  `min-h-9 flex-1 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
    aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"
  }`;

/** "" → null, "12" → 12 */
const sayi = (v: string) => (v.trim() === "" ? null : Number(v));
const yaz = (n: number | null) => (n === null ? "" : String(n));

export default function SozlesmeKontrolleri({
  basvuru: b,
  acikMadde,
  onAc,
  onKontrol,
  onKaydet,
  cakisanlar,
}: {
  basvuru: Basvuru;
  acikMadde: number | null;
  onAc: (sira: number | null) => void;
  onKontrol: (sira: number, deger: boolean) => void;
  onKaydet: (sira: number, d: SozlesmeDetayi) => void;
  cakisanlar: string[]; // aynı ülkedeki aktif bayiler / diğer başvurular
}) {
  // Yazılan ama henüz kaydedilmemiş değerler; alandan çıkınca kaydedilir
  const [taslak, setTaslak] = useState<{ id: string; d: SozlesmeDetayi } | null>(null);
  const d = taslak?.id === b.id ? taslak.d : b.sozlesme;
  const tamamlanan = b.kontroller.filter(Boolean).length;

  const degistir = (f: (x: SozlesmeDetayi) => SozlesmeDetayi) => setTaslak({ id: b.id, d: f(d) });
  const kaydet = (sira: number, yeni: SozlesmeDetayi = d) => {
    if (JSON.stringify(yeni) === JSON.stringify(b.sozlesme)) return;
    onKaydet(sira, yeni);
  };
  // Seçim düğmeleri / onay kutuları: değiştiği anda kaydedilir
  const hemen = (sira: number, f: (x: SozlesmeDetayi) => SozlesmeDetayi) => {
    const yeni = f(d);
    setTaslak({ id: b.id, d: yeni });
    kaydet(sira, yeni);
  };

  // Sözleşme aşamasından önce kilitli; lansmandan sonra yalnızca okunur (özetler görünür)
  if (b.asama === "basvuru" || b.asama === "degerlendirme") {
    return (
      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-extrabold">Sözleşme kontrol listesi</h3>
        <p className="flex items-center gap-2 rounded-control border border-dashed border-line-strong px-3 py-2.5 text-xs text-muted">
          <Lock size={14} aria-hidden="true" className="shrink-0" />
          Başvuru Sözleşme aşamasına geçince 4 madde burada açılır.
        </p>
      </section>
    );
  }
  const saltOkunur = b.asama === "lansman";

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1.5 flex w-full items-center text-sm font-extrabold">
        Sözleşme kontrol listesi
        <span className="ml-auto text-xs font-semibold tabular-nums text-muted">{tamamlanan}/{KONTROL_LISTESI.length}</span>
      </legend>

      {KONTROL_LISTESI.map((k, i) => {
        const acik = acikMadde === i;
        const ozet = maddeOzeti(i, d);
        const tam = maddeTamam(i, d);
        const panelId = `madde-${b.id}-${i}`;
        return (
          <div key={k.baslik} className={`rounded-[14px] border transition-colors ${acik ? "border-ink bg-[#F8F9F5]" : "border-transparent"}`}>
            <div className="flex min-h-12 items-center gap-3 pl-2">
              <input
                type="checkbox"
                checked={b.kontroller[i]}
                disabled={saltOkunur}
                onChange={(e) => onKontrol(i, e.target.checked)}
                aria-label={`${k.baslik} tamamlandı`}
                className="h-5 w-5 flex-none cursor-pointer accent-[#0E0F0C]"
              />
              <button
                type="button"
                onClick={() => onAc(acik ? null : i)}
                disabled={saltOkunur}
                aria-expanded={saltOkunur ? undefined : acik}
                aria-controls={panelId}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pr-2 text-left disabled:cursor-default"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[13px]">{k.baslik}</b>
                  <span className={`truncate text-xs ${ozet ? "text-[#474A42]" : "text-muted"}`}>{ozet ?? "Henüz girilmedi"}</span>
                </span>
                {!saltOkunur && <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-muted transition-transform ${acik ? "rotate-180" : ""}`} />}
              </button>
            </div>

            {acik && !saltOkunur && (
              <div id={panelId} className="flex flex-col gap-3 px-3 pb-3.5 pt-1">
                <p className="text-xs text-muted">{k.not}</p>

                {i === 0 && (
                  <>
                    <label className={ALAN}>
                      Bölge kapsamı *
                      <input
                        value={d.bolge.kapsam}
                        onChange={(e) => degistir((x) => ({ ...x, bolge: { ...x.bolge, kapsam: e.target.value } }))}
                        onBlur={() => kaydet(0)}
                        placeholder="Ör. Polonya (tamamı)"
                        className={GIRDI}
                      />
                    </label>
                    <div className={ALAN}>
                      <span id={`${panelId}-mun`}>Bu bölgede başka bayi olabilir mi? *</span>
                      <div role="group" aria-labelledby={`${panelId}-mun`} className="flex gap-1 rounded-control bg-bg p-1">
                        {[
                          [true, "Hayır, tek bayi"],
                          [false, "Evet, olabilir"],
                        ].map(([v, ad]) => (
                          <button
                            key={String(v)}
                            type="button"
                            aria-pressed={d.bolge.munhasir === v}
                            onClick={() => hemen(0, (x) => ({ ...x, bolge: { ...x.bolge, munhasir: v as boolean } }))}
                            className={SECIM(d.bolge.munhasir === v)}
                          >
                            {ad}
                          </button>
                        ))}
                      </div>
                    </div>
                    {cakisanlar.length > 0 && (
                      <p className="flex items-start gap-2 rounded-control bg-warn-bg px-3 py-2 text-xs font-semibold text-warn">
                        <TriangleAlert size={15} aria-hidden="true" className="mt-px shrink-0" />
                        Bu ülkede başka kayıt var: {cakisanlar.join(", ")}. Bölge sınırlarını netleştirin.
                      </p>
                    )}
                  </>
                )}

                {i === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["one", "İlk sipariş · ONE"],
                          ["lite", "İlk sipariş · ONE LITE"],
                          ["yillik", "Yıllık hedef (cihaz)"],
                          ["indirim", "Bayi indirimi (%) *"],
                        ] as const
                      ).map(([alan, etiket]) => (
                        <label key={alan} className={ALAN}>
                          {etiket}
                          <input
                            type="number"
                            min={0}
                            max={alan === "indirim" ? 60 : undefined}
                            inputMode="numeric"
                            value={yaz(d.moq[alan])}
                            onChange={(e) => degistir((x) => ({ ...x, moq: { ...x.moq, [alan]: sayi(e.target.value) } }))}
                            onBlur={() => kaydet(1)}
                            className={`${GIRDI} tabular-nums`}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="flex justify-between gap-2 rounded-control bg-[#F4F5F0] px-3 py-2 text-xs">
                      <span className="text-muted">İlk sipariş tutarı (KDV hariç)</span>
                      <b className="tabular-nums">{tl(moqTutari(d.moq))}</b>
                    </p>
                    <p className="text-[11px] text-muted">* En az bir cihaz adedi ve indirim oranı zorunlu.</p>
                  </>
                )}

                {i === 2 && (
                  <>
                    <label className={ALAN}>
                      Marka kiti gönderim tarihi *
                      <input
                        type="date"
                        value={d.marka.kitTarihi}
                        onChange={(e) => degistir((x) => ({ ...x, marka: { ...x.marka, kitTarihi: e.target.value } }))}
                        onBlur={() => kaydet(2)}
                        className={GIRDI}
                      />
                    </label>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[13px] font-semibold">
                      <input
                        type="checkbox"
                        checked={d.marka.logoOnay}
                        onChange={(e) => hemen(2, (x) => ({ ...x, marka: { ...x.marka, logoOnay: e.target.checked } }))}
                        className="h-4.5 w-4.5 accent-[#0E0F0C]"
                      />
                      Logo ve görsel kullanımı onaylandı *
                    </label>
                    <label className={ALAN}>
                      Not
                      <input
                        value={d.marka.not}
                        onChange={(e) => degistir((x) => ({ ...x, marka: { ...x.marka, not: e.target.value } }))}
                        onBlur={() => kaydet(2)}
                        placeholder="Ör. yerel dilde broşür bayide"
                        className={GIRDI}
                      />
                    </label>
                  </>
                )}

                {i === 3 && (
                  <>
                    <div className={ALAN}>
                      <span>Bayinin üstlendikleri *</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DESTEK_KALEMLERI.map((kalem) => {
                          const secili = d.destek.bayi.includes(kalem);
                          return (
                            <label key={kalem} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-card px-2.5 text-[13px] font-semibold">
                              <input
                                type="checkbox"
                                checked={secili}
                                onChange={() =>
                                  hemen(3, (x) => ({
                                    ...x,
                                    destek: { ...x.destek, bayi: secili ? x.destek.bayi.filter((y) => y !== kalem) : [...x.destek.bayi, kalem] },
                                  }))
                                }
                                className="h-4 w-4 accent-[#0E0F0C]"
                              />
                              {kalem}
                            </label>
                          );
                        })}
                      </div>
                      <span className="font-normal text-muted">
                        Embedra&apos;da kalan:{" "}
                        {["Teknik destek", "Yazılım", ...DESTEK_KALEMLERI.filter((x) => !d.destek.bayi.includes(x))].join(", ")}
                      </span>
                    </div>
                  </>
                )}

                <p className={`text-[11px] font-semibold ${tam ? "text-ok" : "text-muted"}`}>
                  {tam ? "✓ Zorunlu alanlar tamam, madde işaretlendi." : "Zorunlu (*) alanlar dolunca madde kendiliğinden işaretlenir."}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
