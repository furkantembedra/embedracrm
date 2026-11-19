"use client";

// Gelen kutusu sohbet başlığındaki bot durumu ve Devral / Bota geri ver düğmeleri; sohbetteki sistem satırları.
// Asıl kural sunucuda (components/konusma/devir.ts + SQL): buradaki görünüm yalnızca hangi düğmenin anlamlı olduğunu seçer.
import { useState, useTransition } from "react";
import { Bot, Hand, Info, Siren } from "lucide-react";
import Modal from "@/components/ui/modal";
import { DEVIR_SEBEPLERI, devirSebebiAdi } from "@/components/konusma/devir-sebepleri";
import { devirDugmeleri, sistemSatiriMetni } from "./devir-gorunumu";
import { botDevretmesiniSimuleEt, konusmayiBotaVer, konusmayiDevral } from "./actions";
import { BotRozeti, botDurumu } from "./kanal-gorunumu";
import type { KonusmaDetayi, SistemSatiri } from "./queries";

const BUTON = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-control px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const ALAN = "rounded-control border border-line-strong bg-card px-3 py-2 text-sm font-medium outline-none focus:border-ink";

export function DevirKontrolleri({
  d, ben, simulasyon, onDegisti, onDuyuru,
}: {
  d: KonusmaDetayi;
  /** Oturumdaki kullanıcı ("u6") */
  ben: string;
  /** Geliştirmede ve Yönetici: botun devretmesini simüle et */
  simulasyon: boolean;
  onDegisti: () => void;
  onDuyuru: (metin: string) => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [notAcik, setNotAcik] = useState(false);
  const [not, setNot] = useState("");
  const [simAcik, setSimAcik] = useState(false);
  const [sebep, setSebep] = useState<string>("musteri_istedi");
  const [aciklama, setAciklama] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const durum = botDurumu(d.botAktif, d.mesajlar.at(-1)?.yon, d.devirSebebi);
  const dugme = devirDugmeleri(d, ben);

  const calistir = (is: () => Promise<{ hata?: string; duyuru?: string }>, basari: string, sonra?: () => void) => {
    setHata(null);
    baslat(async () => {
      try {
        const r = await is();
        if (r.hata) {
          setHata(r.hata);
          return;
        }
        sonra?.();
        onDuyuru(r.duyuru ?? basari);
        onDegisti();
      } catch {
        setHata("İşlem yapılamadı: sunucuya ulaşılamadı.");
      }
    });
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <BotRozeti durum={durum} sebep={d.devirSebebi ? devirSebebiAdi(d.devirSebebi) : null} />
      {!d.botAktif && d.devralanAd && <span className="text-xs font-semibold text-muted">Devralan: {d.devralanAd}</span>}
      {dugme.devral && (
        <button type="button" disabled={bekliyor} onClick={() => calistir(() => konusmayiDevral(d.id), "Konuşmayı devraldınız; bot bu konuşmada sustu.")}
          className={`${BUTON} bg-ink text-white hover:bg-ink-soft`}>
          <Hand size={16} aria-hidden="true" />Devral
        </button>
      )}
      {dugme.botaVer && (
        <button type="button" disabled={bekliyor} onClick={() => { setHata(null); setNotAcik(true); }}
          className={`${BUTON} border border-line-strong bg-card hover:bg-[#F4F5F0]`}>
          <Bot size={16} aria-hidden="true" />Bota geri ver
        </button>
      )}
      {simulasyon && d.botAktif && (
        <button type="button" disabled={bekliyor} onClick={() => { setHata(null); setSimAcik(true); }}
          className={`${BUTON} border border-dashed border-line-strong text-[#474A42] hover:bg-[#F4F5F0]`} title="Yalnızca geliştirmede ve Yönetici">
          <Siren size={16} aria-hidden="true" />Bot devretmesini simüle et
        </button>
      )}
      {hata && !notAcik && !simAcik && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}

      <Modal acik={notAcik} onKapat={() => setNotAcik(false)} baslik="Bota geri ver" aciklama="Bot, müşterinin bir sonraki mesajından itibaren konuşmaya devam eder.">
        <form className="flex flex-col gap-3 pb-5" onSubmit={(e) => {
          e.preventDefault();
          calistir(() => konusmayiBotaVer(d.id, not), "Konuşma bota verildi; bot müşterinin sıradaki mesajına cevap verecek.", () => {
            setNotAcik(false);
            setNot("");
          });
        }}>
          <label className="flex flex-col gap-1 text-sm font-bold">
            Bota not (isteğe bağlı)
            <textarea value={not} onChange={(e) => setNot(e.target.value)} rows={3} maxLength={1000} className={ALAN}
              placeholder="ör. Fiyatı ben verdim, 2 cihaz + Pro+ konuştuk; demo için uygun günü sor." />
            <span className="text-xs font-medium text-muted">Müşteriye gönderilmez. Bot bu notu bir sonraki turda bir kez görür.</span>
          </label>
          {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNotAcik(false)} className={`${BUTON} hover:bg-[#F4F5F0]`}>Vazgeç</button>
            <button type="submit" disabled={bekliyor} className={`${BUTON} bg-ink text-white hover:bg-ink-soft`}>{bekliyor ? "Veriliyor…" : "Bota geri ver"}</button>
          </div>
        </form>
      </Modal>

      {simulasyon && (
        <Modal acik={simAcik} onKapat={() => setSimAcik(false)} baslik="Bot devretmesini simüle et" aciklama="insana_devret aracıyla aynı yol (P2.2): bot kapanır, fırsata not, sorumluya bildirim">
          <form className="flex flex-col gap-3 pb-5" onSubmit={(e) => {
            e.preventDefault();
            calistir(() => botDevretmesiniSimuleEt(d.id, sebep, aciklama), "Bot devretti.", () => {
              setSimAcik(false);
              setAciklama("");
            });
          }}>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Sebep
              <select value={sebep} onChange={(e) => setSebep(e.target.value)} className={`${ALAN} min-h-10 cursor-pointer`}>
                {Object.entries(DEVIR_SEBEPLERI).map(([k, ad]) => <option key={k} value={k}>{ad}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Botun açıklaması (isteğe bağlı)
              <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} maxLength={300} className={`${ALAN} min-h-10`} placeholder="ör. 5 cihaz için iskonto istiyor" />
            </label>
            {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSimAcik(false)} className={`${BUTON} hover:bg-[#F4F5F0]`}>Vazgeç</button>
              <button type="submit" disabled={bekliyor} className={`${BUTON} bg-ink text-white hover:bg-ink-soft`}>Devret</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function SistemSatiriGorunumu({ o, zaman }: { o: SistemSatiri; zaman: string }) {
  const { metin, ek } = sistemSatiriMetni(o);
  const vurgu = o.tur === "bot_devretti";
  return (
    <li role="note" className="flex justify-center">
      <span className={`flex max-w-[90%] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-center text-xs shadow-sm ${vurgu ? "bg-err-bg text-err" : "bg-[#FFF8D6] text-[#5C4A00]"}`}>
        <span className="inline-flex items-center gap-1.5 font-bold"><Info size={13} aria-hidden="true" />{metin}</span>
        {ek && <span className="whitespace-pre-line break-words font-medium">{ek}</span>}
        <time dateTime={o.zaman} className="text-[11px] opacity-80" suppressHydrationWarning>{zaman}</time>
      </span>
    </li>
  );
}
