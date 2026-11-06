"use client";

// Kampanya kayıtları: kanal sekmeleri, hedef liste, tarih, durum ve satış hattından sayılan lead / satış.
// Satıra tıklanınca kampanya düzenlenir; indirme düğmesi kampanyanın hedef listesini Excel'e (CSV) verir.
import { Download, Send } from "lucide-react";
import Chip from "@/components/ui/chip";
import { KAMPANYA_KANALLARI, type Gonderim, type Kampanya, type KampanyaKanali } from "./queries";
import { IZIN_KANAL_ADI, type IzinKanali } from "@/components/musteriler/izin";
import { DURUM_TONU, KAMPANYA_IZNI, KANAL_TONU, kampanyaTarihi } from "./ortak";

const TH = "px-2 py-2.5 text-left text-xs font-semibold text-muted";
const TD = "border-t border-bg px-2 py-3 align-middle";

export default function KampanyaTablosu({
  kampanyalar,
  kanal,
  onKanal,
  sonuclar,
  listeAdi,
  listeSayisi,
  onDuzenle,
  onIndir,
  gonderimler,
  onGonder,
}: {
  kampanyalar: Kampanya[];
  kanal: KampanyaKanali | "tumu";
  onKanal: (k: KampanyaKanali | "tumu") => void;
  sonuclar: Record<string, { lead: number; kazanilan: number }>;
  listeAdi: (id: string) => string;
  listeSayisi: (id: string, kanal?: IzinKanali | null) => number | null;
  onDuzenle: (id: string) => void;
  onIndir: (k: Kampanya) => void;
  gonderimler: Gonderim[];
  onGonder: (id: string) => void;
}) {
  const gorunen = kampanyalar.filter((k) => kanal === "tumu" || k.kanal === kanal);
  const sekmeler: (KampanyaKanali | "tumu")[] = ["tumu", ...KAMPANYA_KANALLARI];
  return (
    <section aria-labelledby="kp-baslik" className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="kp-baslik" className="text-[17px] font-extrabold">Kampanya kayıtları</h2>
          <span className="text-xs font-semibold text-muted">E-posta ve WhatsApp kampanyaları buradan izinli kişilere toplu gönderilir · lead ve satış, satış hattında kampanyası seçilen fırsatlardan sayılır</span>
        </div>
        <div role="tablist" aria-label="Kanal" className="ml-auto flex flex-wrap gap-1 rounded-control bg-bg p-1">
          {sekmeler.map((s) => {
            const aktif = s === kanal;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={aktif}
                onClick={() => onKanal(s)}
                className={`min-h-9 cursor-pointer rounded-[9px] px-3 text-[13px] font-bold transition-colors ${aktif ? "bg-card text-ink shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42] hover:text-ink"}`}
              >
                {s === "tumu" ? "Tümü" : s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead className="bg-[#F8F9F5]">
            <tr>
              <th scope="col" className={`${TH} pl-4`}>Kampanya</th>
              <th scope="col" className={TH}>Kanal</th>
              <th scope="col" className={TH}>Tarih</th>
              <th scope="col" className={TH}>Durum</th>
              <th scope="col" className={TH}>Gönderim</th>
              <th scope="col" className={`${TH} text-right`}>Lead / satış</th>
              <th scope="col" className={`${TH} pr-4`}><span className="sr-only">İşlemler</span></th>
            </tr>
          </thead>
          <tbody>
            {gorunen.map((k) => {
              const s = sonuclar[k.id] ?? { lead: 0, kazanilan: 0 };
              const sayi = listeSayisi(k.listeId);
              const izin = KAMPANYA_IZNI[k.kanal];
              const izinli = izin ? listeSayisi(k.listeId, izin) : null;
              const mesajli = izin === "eposta" || izin === "whatsapp";
              const gecmis = gonderimler.filter((g) => g.kampanyaId === k.id && g.tur !== "test");
              const toplam = gecmis.reduce((t, g) => t + g.basarili, 0);
              const son = gecmis[0];
              return (
                <tr key={k.id} onClick={() => onDuzenle(k.id)} className="cursor-pointer transition-colors hover:bg-[#F6F7F2]">
                  <td className={`${TD} pl-4`}>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuzenle(k.id);
                        }}
                        className="cursor-pointer self-start text-left font-bold hover:underline"
                      >
                        {k.ad}
                      </button>
                      <span className="text-xs text-muted">
                        Liste: {listeAdi(k.listeId)}
                        {sayi !== null ? ` · ${sayi} kişi` : ""}
                        {izin && izinli !== null && sayi !== null ? <b className={izinli < sayi ? "font-semibold text-warn" : "font-semibold"}>{` · ${IZIN_KANAL_ADI[izin]} izni: ${izinli}`}</b> : null}
                        {k.not ? ` · ${k.not}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className={TD}><Chip ton={KANAL_TONU[k.kanal]}>{k.kanal}</Chip></td>
                  <td className={`${TD} whitespace-nowrap text-[#474A42]`}>{kampanyaTarihi(k.baslangic, k.bitis)}</td>
                  <td className={TD}><Chip ton={DURUM_TONU[k.durum]}>{k.durum}</Chip></td>
                  <td className={`${TD} text-xs`}>
                    {mesajli ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold tabular-nums">{toplam ? `${toplam} kişiye gitti` : "Gönderilmedi"}</span>
                        <span className="whitespace-nowrap text-muted">
                          {k.otomasyon?.tur === "surekli"
                            ? "Otomatik · yeni girenlere"
                            : k.otomasyon?.tur === "planli" && k.otomasyon.zaman
                              ? `Planlı · ${new Date(k.otomasyon.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                              : son
                                ? `Son: ${new Date(son.zaman).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}${son.demo ? " · demo" : ""}`
                                : "Elle"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right font-bold tabular-nums`}>{s.lead || "—"} / {s.kazanilan || "—"}</td>
                  <td className={`${TD} pr-4`}>
                    <div className="flex justify-end gap-1.5">
                    {mesajli && k.durum !== "Tamamlandı" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGonder(k.id);
                        }}
                        aria-label={`${k.ad} kampanyasını gönder`}
                        title="Toplu gönder"
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-control bg-ink px-3 text-xs font-bold text-white hover:bg-ink-soft"
                      >
                        <Send size={14} aria-hidden="true" />
                        Gönder
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onIndir(k);
                      }}
                      aria-label={`${k.ad} hedef listesini indir`}
                      title={izin ? `Yalnızca ${IZIN_KANAL_ADI[izin]} izni olanları indir` : "Hedef listeyi indir"}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-line-strong bg-card hover:bg-[#F4F5F0]"
                    >
                      <Download size={16} aria-hidden="true" />
                    </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {gorunen.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted">Bu kanalda kampanya yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
