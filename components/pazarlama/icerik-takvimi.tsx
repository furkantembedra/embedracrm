"use client";

// İçerik takvimi: seçili dönemin günleri hafta hafta gösterilir. Karta tıklanınca içerik düzenlenir
// (görsel / video, açıklama metni, hashtag); kutucuk paylaşıldı işaretler. Kart sürüklenip başka güne bırakılınca tarihi değişir.
import { useState } from "react";
import { AlignLeft, Film, Hash, Image as Gorsel, Plus, X } from "lucide-react";
import { useBugun } from "@/lib/use-bugun";
import { ICERIK_KANALLARI, type Icerik, type Kampanya } from "./queries";
import { GUN_ADI, ICERIK_RENGI, gunEkle, gunSayisi, haftaBasi, isoGun, type Donem } from "./ortak";

export default function IcerikTakvimi({
  icerikler,
  kampanyalar,
  donem,
  onPaylasildi,
  onSil,
  onEkle,
  onDuzenle,
  onTasi,
}: {
  icerikler: Icerik[];
  kampanyalar: Kampanya[];
  donem: Donem | null;
  onPaylasildi: (id: string, deger: boolean) => void;
  onSil: (id: string) => void;
  onEkle: (tarih: string) => void;
  onDuzenle: (id: string) => void;
  onTasi: (id: string, tarih: string) => void;
}) {
  const [suruklenen, setSuruklenen] = useState<string | null>(null);
  const [hedef, setHedef] = useState<string | null>(null);
  const bitir = () => {
    setSuruklenen(null);
    setHedef(null);
  };
  const bugun = useBugun();
  const bugunIso = bugun === null ? "" : isoGun(bugun);
  // Takvim pazartesiden başlar; dönemin dışındaki günler soluk gösterilir
  const ilk = donem ? isoGun(haftaBasi(new Date(donem.bas + "T12:00:00").getTime()) + 3_600_000) : null;
  const gunler = donem && ilk ? Array.from({ length: Math.ceil(gunSayisi(ilk, donem.bit) / 7) * 7 }, (_, i) => gunEkle(ilk, i)) : [];
  const kampanyaAdi = (id: string | null) => kampanyalar.find((k) => k.id === id)?.ad;
  const donemdeki = donem ? icerikler.filter((x) => x.tarih >= donem.bas && x.tarih <= donem.bit) : [];
  const uzun = gunler.length > 14; // ay görünümünde kartlar sıkışık gösterilir

  return (
    <section aria-labelledby="takvim-baslik" className="flex w-full min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="takvim-baslik" className="text-[17px] font-extrabold">İçerik takvimi</h2>
          <span className="text-xs font-semibold text-muted">
            {donemdeki.length} içerik · {donemdeki.filter((x) => x.paylasildi).length} paylaşıldı · düzenlemek için tıklayın, taşımak için sürükleyin
          </span>
        </div>
        <ul aria-label="Kanal renkleri" className="ml-auto flex flex-wrap gap-3 text-xs font-semibold text-[#474A42]">
          {ICERIK_KANALLARI.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: ICERIK_RENGI[k] }} />
              {k}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7 gap-2">
          {gunler.length > 0 && GUN_ADI.map((g) => <span key={g} className="px-1 text-xs font-bold text-muted">{g}</span>)}
          {gunler.map((gun) => {
            const icinde = !!donem && gun >= donem.bas && gun <= donem.bit;
            const bugunMu = gun === bugunIso;
            const gunIcerik = icinde ? icerikler.filter((x) => x.tarih === gun) : [];
            const gunNo = Number(gun.slice(8));
            const ustunde = icinde && hedef === gun && suruklenen !== null;
            const ayAdi = gunNo === 1 || gun === donem?.bas ? new Date(gun + "T00:00:00").toLocaleDateString("tr-TR", { month: "short" }) : "";
            return (
              <div
                key={gun}
                onDragOver={(e) => {
                  if (!icinde || suruklenen === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (hedef !== gun) setHedef(gun);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHedef(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  const x = icerikler.find((i) => i.id === id);
                  if (x && icinde && x.tarih !== gun) onTasi(id, gun);
                  bitir();
                }}
                className={`flex flex-col gap-1.5 rounded-[14px] border p-2 transition-colors ${uzun ? "min-h-[120px]" : "min-h-[170px]"} ${
                  !icinde
                    ? "border-transparent bg-transparent opacity-40"
                    : ustunde
                      ? "border-lime-dark bg-[#DCE9B0] outline-2 outline-dashed outline-lime-dark"
                      : bugunMu
                        ? "border-lime-dark bg-[#FFFBE0]"
                        : "border-bg bg-[#F8F9F5]"
                }`}
              >
                <div className="flex items-baseline gap-1.5">
                  <b className={`tabular-nums ${uzun ? "text-sm" : "text-lg"}`}>{gunNo}</b>
                  {ayAdi && <span className="text-xs font-semibold text-muted">{ayAdi}</span>}
                  {bugunMu && <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">Bugün</span>}
                </div>
                {gunIcerik.map((x) => (
                  <div
                    key={x.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", x.id);
                      e.dataTransfer.effectAllowed = "move";
                      setSuruklenen(x.id);
                    }}
                    onDragEnd={bitir}
                    title="Başka güne taşımak için sürükleyin"
                    className={`group relative flex cursor-grab items-start gap-2 rounded-[10px] border border-line bg-card p-2 transition-colors hover:border-line-strong active:cursor-grabbing ${suruklenen === x.id ? "opacity-40" : ""}`}
                    style={{ boxShadow: `inset 3px 0 0 ${ICERIK_RENGI[x.kanal]}` }}
                  >
                    <input
                      type="checkbox"
                      checked={x.paylasildi}
                      onChange={(e) => onPaylasildi(x.id, e.target.checked)}
                      aria-label={`${x.baslik} paylaşıldı`}
                      className="relative z-10 ml-0.5 mt-0.5 h-4 w-4 flex-none cursor-pointer accent-[#0E0F0C]"
                    />
                    <button type="button" onClick={() => onDuzenle(x.id)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 pr-4 text-left after:absolute after:inset-0 after:content-['']">
                      <span className="text-[11px] font-bold text-muted">{x.kanal}</span>
                      <span className={`text-xs font-bold leading-snug ${x.paylasildi ? "text-muted line-through" : ""}`}>{x.baslik}</span>
                      {kampanyaAdi(x.kampanyaId) && <span className="truncate text-[11px] text-muted">↳ {kampanyaAdi(x.kampanyaId)}</span>}
                      <IcerikIsaretleri icerik={x} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSil(x.id)}
                      aria-label={`${x.baslik} içeriğini sil`}
                      className="absolute right-1 top-1 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-bg hover:text-err focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {icinde && (
                  <button
                    type="button"
                    onClick={() => onEkle(gun)}
                    aria-label={`${gunNo} ${new Date(gun + "T00:00:00").toLocaleDateString("tr-TR", { month: "long" })} için içerik ekle`}
                    className="mt-auto flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong text-xs font-bold text-muted hover:border-ink hover:text-ink"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Ekle
                  </button>
                )}
              </div>
            );
          })}
          {gunler.length === 0 && <div className="col-span-7 h-[170px] animate-pulse rounded-[14px] bg-[#F8F9F5] motion-reduce:animate-none" />}
        </div>
      </div>
    </section>
  );
}

/** Kartın altındaki küçük işaretler: görsel / video sayısı, açıklama, hashtag */
function IcerikIsaretleri({ icerik }: { icerik: Icerik }) {
  const gorsel = icerik.medya.filter((m) => m.tur === "gorsel").length;
  const video = icerik.medya.length - gorsel;
  if (!gorsel && !video && !icerik.aciklama && !icerik.hashtaglar.length) return null;
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted">
      {gorsel > 0 && <span className="flex items-center gap-0.5" title={`${gorsel} görsel`}><Gorsel size={12} aria-hidden="true" />{gorsel}</span>}
      {video > 0 && <span className="flex items-center gap-0.5" title={`${video} video`}><Film size={12} aria-hidden="true" />{video}</span>}
      {icerik.aciklama && <span title="Açıklama metni var"><AlignLeft size={12} aria-label="Açıklama metni var" /></span>}
      {icerik.hashtaglar.length > 0 && <span className="flex items-center" title={icerik.hashtaglar.map((h) => `#${h}`).join(" ")}><Hash size={12} aria-hidden="true" />{icerik.hashtaglar.length}</span>}
    </span>
  );
}
