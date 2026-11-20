"use client";

// Bot › Ayarlar (P2.4): botun sabit istemine giren sürümlü ayarlar. Değişiklik prompt cache'ini sıfırladığı için
// yalnızca bilinçli "Kaydet" ile yeni sürüm olur; önceki sürüme dönülebilir (o da yeni sürüm açar). "Botu dene"
// paneli formdaki taslağı kaydetmeden kullanır. Sınır ve kişisel veri denetimi burada anında, sunucuda kesin yapılır.
// Yalnızca Yönetici değiştirir; Satış ve Pazarlama aynı formu salt okunur görür.
import { useMemo, useState, useTransition } from "react";
import { History, Save } from "lucide-react";
import Chip from "@/components/ui/chip";
import {
  ALAN_ETIKETI, ALAN_SINIRI, AZAMI_TOPLAM, GUN_ADI, GUNLER, ayarlarEsit, ayarlariDenetle, mesaiMetni,
  type BilgiKaynagi, type Gun, type IstemAyarlari, type MetinAlani,
} from "./ayar-surumu";
import { istemAyarlariniKaydet, surumeDon } from "./actions";
import BotuDene, { type DenemeKanali } from "./botu-dene";

export type SurumSatiri = {
  surumNo: number;
  olusturan: string | null;
  zaman: string;
  aciklama: string | null;
  geriDonulen: number | null;
  uzunluk: number;
  ayarlar: IstemAyarlari;
  /** P2.4b: bu sürümdeki bilgi kaynağı sayısı */
  kaynakSayisi: number;
};

const ZAMAN = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const GIRDI = "w-full rounded-control border border-line-strong bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60";

const ALANLAR: { k: MetinAlani; satir: number; ipucu: string; yer?: string }[] = [
  { k: "botAdi", satir: 1, ipucu: "Bot kendini bu adla tanıtabilir; yine de her zaman yapay zekâ asistanı olduğunu söyler.", yer: "örn. Embedra Asistan" },
  { k: "acilisMesaji", satir: 3, ipucu: "Konuşmadaki ilk cevabın temeli. Bot müşterinin dilinde ve ilk mesajına uyarlayarak yazar; asistan beyanını kendisi ekler.", yer: "Merhaba, ben Embedra'nın yapay zekâ asistanıyım…" },
  { k: "tonNotu", satir: 3, ipucu: "Üslup notu (ör. resmî / samimi, hitap). Değişmez kurallar her zaman önce gelir." },
  { k: "bilgiBankasi", satir: 8, ipucu: "SSS, kurulum, garanti, teslim süresi, ödeme koşulları. Bot burada açıkça yazanı söyleyebilir, yazmayanı uydurmaz. Fiyat yazmayın: bot fiyatı yalnızca fiyat listesinden okur." },
  { k: "itirazlar", satir: 6, ipucu: "Sık duyulan itirazlar ve önerilen cevaplar (ör. \"Pahalı\" → …). docs/bot/itirazlar.md'dekilere eklenir." },
  { k: "ornekKonusmalar", satir: 8, ipucu: "Gerçek satış konuşmaları, kişisel bilgiler temizlenmiş. Konuşmaları \"---\" satırıyla ayırın. docs/bot/ornek-konusmalar/'dakilere eklenir." },
];

function MetinAlaniKutusu({ k, satir, ipucu, yer, deger, hata, duzenleyebilir, degistir }: {
  k: MetinAlani; satir: number; ipucu: string; yer?: string; deger: string; hata?: string; duzenleyebilir: boolean; degistir: (v: string) => void;
}) {
  const id = `ayar-${k}`;
  const uzun = deger.length > ALAN_SINIRI[k];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold">{ALAN_ETIKETI[k]}</label>
        <span className={`text-[11px] tabular-nums ${uzun ? "font-bold text-err" : "text-muted"}`}>{deger.length.toLocaleString("tr-TR")} / {ALAN_SINIRI[k].toLocaleString("tr-TR")}</span>
      </div>
      {satir === 1 ? (
        <input id={id} value={deger} onChange={(e) => degistir(e.target.value)} disabled={!duzenleyebilir} placeholder={yer} aria-invalid={!!hata} aria-describedby={`${id}-ipucu`} className={`${GIRDI} min-h-11`} />
      ) : (
        <textarea id={id} value={deger} onChange={(e) => degistir(e.target.value)} disabled={!duzenleyebilir} placeholder={yer} rows={satir} aria-invalid={!!hata} aria-describedby={`${id}-ipucu`} className={`${GIRDI} resize-y py-2`} />
      )}
      <span id={`${id}-ipucu`} className="text-xs text-muted">{ipucu}</span>
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
    </div>
  );
}

function MesaiDuzenleyici({ a, setA, duzenleyebilir, hata }: { a: IstemAyarlari; setA: (f: (x: IstemAyarlari) => IstemAyarlari) => void; duzenleyebilir: boolean; hata?: string }) {
  const gunuAyarla = (g: Gun, v: [string, string] | null) => setA((x) => ({ ...x, mesaiSaatleri: { ...x.mesaiSaatleri, [g]: v } }));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold">Mesai saatleri (İstanbul saati)</legend>
      <p className="text-xs text-muted">Bot mesai dışında da cevap verir; yalnızca devrederken müşteriye ekibin ne zaman döneceğini söyler. Hiçbir gün işaretli değilse mesai tanımsızdır.</p>
      <ul className="flex flex-col gap-1.5">
        {GUNLER.map((g) => {
          const s = a.mesaiSaatleri[g] ?? null;
          return (
            <li key={g} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex w-32 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={!!s} disabled={!duzenleyebilir} onChange={(e) => gunuAyarla(g, e.target.checked ? ["09:00", "18:00"] : null)} className="h-4 w-4" />
                {GUN_ADI[g]}
              </label>
              {s ? (
                <>
                  <input type="time" aria-label={`${GUN_ADI[g]} açılış`} value={s[0]} disabled={!duzenleyebilir} onChange={(e) => gunuAyarla(g, [e.target.value, s[1]])} className={`${GIRDI} min-h-9 w-28 tabular-nums`} />
                  <span aria-hidden="true">–</span>
                  <input type="time" aria-label={`${GUN_ADI[g]} kapanış`} value={s[1]} disabled={!duzenleyebilir} onChange={(e) => gunuAyarla(g, [s[0], e.target.value])} className={`${GIRDI} min-h-9 w-28 tabular-nums`} />
                </>
              ) : <span className="text-xs text-muted">Kapalı</span>}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">Özet: {mesaiMetni(a.mesaiSaatleri)}</span>
      {hata && <span role="alert" className="text-xs font-semibold text-err">{hata}</span>}
    </fieldset>
  );
}

function Surumler({ surumler, aktifNo, duzenleyebilir }: { surumler: SurumSatiri[]; aktifNo: number | null; duzenleyebilir: boolean }) {
  const [mesaj, setMesaj] = useState<{ ton: "ok" | "err"; metin: string } | null>(null);
  const [bekliyor, baslat] = useTransition();
  return (
    <section aria-labelledby="surum-baslik" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
      <h2 id="surum-baslik" className="flex items-center gap-2 text-base font-bold"><History size={16} aria-hidden="true" /> Sürümler</h2>
      {!surumler.length && <p className="text-sm text-muted">Henüz kaydedilmiş sürüm yok; bot varsayılan istemle çalışıyor.</p>}
      <ol className="flex flex-col divide-y divide-line">
        {surumler.map((s) => (
          <li key={s.surumNo} className="flex flex-col gap-1 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b className="tabular-nums">Sürüm {s.surumNo}</b>
              {s.surumNo === aktifNo && <Chip ton="ok">Aktif</Chip>}
              {s.geriDonulen != null && <Chip ton="gray">Sürüm {s.geriDonulen}&apos;e dönüş</Chip>}
              <span className="text-xs tabular-nums text-muted">{ZAMAN.format(new Date(s.zaman))}{s.olusturan ? ` · ${s.olusturan}` : ""} · {s.uzunluk.toLocaleString("tr-TR")} karakter{s.kaynakSayisi ? ` · ${s.kaynakSayisi} bilgi kaynağı` : ""}</span>
              {duzenleyebilir && s.surumNo !== aktifNo && (
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() => {
                    if (!window.confirm(`Sürüm ${s.surumNo}'in ayarları yeni bir sürüm olarak etkinleşsin mi? Botun istemi değişir (prompt cache bir kez sıfırlanır).`)) return;
                    setMesaj(null);
                    baslat(async () => {
                      const r = await surumeDon(s.surumNo).catch(() => ({ hata: "Sunucuya ulaşılamadı." }) as { hata?: string; surumNo?: number });
                      setMesaj(r.hata ? { ton: "err", metin: r.hata } : { ton: "ok", metin: `Sürüm ${s.surumNo}'e dönüldü (yeni sürüm ${r.surumNo}).` });
                    });
                  }}
                  className="ml-auto inline-flex min-h-9 cursor-pointer items-center rounded-control border border-line-strong px-3 text-xs font-bold disabled:opacity-50"
                >
                  Bu sürüme dön
                </button>
              )}
            </div>
            {s.aciklama && <span className="text-xs">{s.aciklama}</span>}
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-info">İçeriği göster</summary>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {(Object.keys(ALAN_ETIKETI) as MetinAlani[]).map((k) => (
                  <div key={k} className="contents">
                    <dt className="font-bold text-muted">{ALAN_ETIKETI[k]}</dt>
                    <dd className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{s.ayarlar[k] || <span className="text-muted">—</span>}</dd>
                  </div>
                ))}
                <dt className="font-bold text-muted">Mesai</dt>
                <dd>{mesaiMetni(s.ayarlar.mesaiSaatleri)}</dd>
              </dl>
            </details>
          </li>
        ))}
      </ol>
      {mesaj && <span role={mesaj.ton === "err" ? "alert" : "status"} className={`text-sm font-semibold ${mesaj.ton === "err" ? "text-err" : "text-ok"}`}>{mesaj.metin}</span>}
    </section>
  );
}

export default function IstemAyarlari({ aktif, aktifNo, kaynaklar, surumler, duzenleyebilir, denemeKanallari, anahtarVar }: {
  aktif: IstemAyarlari;
  aktifNo: number | null;
  kaynaklar: BilgiKaynagi[];
  surumler: SurumSatiri[];
  duzenleyebilir: boolean;
  denemeKanallari: DenemeKanali[];
  anahtarVar: boolean;
}) {
  const [a, setA] = useState<IstemAyarlari>(aktif);
  // Etkin sürüm değişince (kaydet / geri dön sonrası sunucu yenilemesi) form yeni sürümle başlar
  const [oncekiNo, setOncekiNo] = useState(aktifNo);
  if (oncekiNo !== aktifNo) {
    setOncekiNo(aktifNo);
    setA(aktif);
  }
  const [aciklama, setAciklama] = useState("");
  const [mesaj, setMesaj] = useState<{ ton: "ok" | "err"; metin: string } | null>(null);
  const [sunucuHatalari, setSunucuHatalari] = useState<Record<string, string>>({});
  const [bekliyor, baslat] = useTransition();
  const denetim = useMemo(() => ayarlariDenetle(a, kaynaklar), [a, kaynaklar]);
  const degisti = !ayarlarEsit(denetim.ayarlar, aktif);
  const hatalar: Record<string, string | undefined> = { ...sunucuHatalari, ...denetim.hatalar };
  const hataVar = Object.keys(denetim.hatalar).length > 0;
  const deg = (k: MetinAlani) => (v: string) => {
    setA((x) => ({ ...x, [k]: v }));
    setSunucuHatalari({});
  };

  const kaydet = () => {
    setMesaj(null);
    baslat(async () => {
      const r = await istemAyarlariniKaydet(a, aciklama).catch(() => ({ hata: "Kaydedilemedi: sunucuya ulaşılamadı." }) as Awaited<ReturnType<typeof istemAyarlariniKaydet>>);
      if (r.hata) {
        setSunucuHatalari((r.hatalar ?? {}) as Record<string, string>);
        setMesaj({ ton: "err", metin: r.hata });
      } else {
        setAciklama("");
        setMesaj({ ton: "ok", metin: `Sürüm ${r.surumNo} kaydedildi ve etkin. Bot bundan sonraki turlarda bu ayarları kullanır.` });
      }
    });
  };

  const oran = Math.min(1, denetim.toplam / AZAMI_TOPLAM);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <form
          aria-labelledby="istem-baslik"
          className="flex flex-col gap-4 rounded-card border border-line bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            kaydet();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="istem-baslik" className="text-base font-bold">Kişilik ve bilgi</h2>
            <Chip ton={aktifNo ? "ok" : "gray"}>{aktifNo ? `Etkin: sürüm ${aktifNo}` : "Henüz kaydedilmedi"}</Chip>
            {degisti && <Chip ton="warn">Kaydedilmemiş değişiklik</Chip>}
          </div>
          <p className="text-xs text-muted">
            Bu alanlar botun sabit istemine girer. Kaydettiğinizde yeni sürüm açılır ve bot hemen onu kullanır; istem önbelleği bir kez yeniden yazılır, o yüzden
            değişiklikleri toplu kaydedin. Telefon ya da e-posta gibi görünen satırlar kabul edilmez.
          </p>
          {ALANLAR.map((x) => (
            <MetinAlaniKutusu key={x.k} {...x} deger={a[x.k]} hata={hatalar[x.k]} duzenleyebilir={duzenleyebilir} degistir={deg(x.k)} />
          ))}
          <MesaiDuzenleyici a={a} setA={(f) => { setA(f); setSunucuHatalari({}); }} duzenleyebilir={duzenleyebilir} hata={hatalar.mesaiSaatleri} />
          <MetinAlaniKutusu
            k="mesaiDisiNotu" satir={1} deger={a.mesaiDisiNotu} hata={hatalar.mesaiDisiNotu} duzenleyebilir={duzenleyebilir} degistir={deg("mesaiDisiNotu")}
            ipucu="Mesai dışında devredilen müşteriye söylenecek cevap süresi (ör. ekibimiz ilk iş gününde 09:00'dan sonra dönecek). Bot müşterinin diline çevirir."
          />

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold">İsteme giren toplam ek metin</span>
              <span className={`tabular-nums ${hatalar.toplam ? "font-bold text-err" : denetim.uyari ? "font-bold text-warn" : "text-muted"}`}>
                {denetim.toplam.toLocaleString("tr-TR")} / {AZAMI_TOPLAM.toLocaleString("tr-TR")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg" aria-hidden="true">
              <div className={`h-full ${hatalar.toplam ? "bg-err" : denetim.uyari ? "bg-warn" : "bg-ok"}`} style={{ width: `${oran * 100}%` }} />
            </div>
            <span className="text-[11px] text-muted">docs/bot/ altındaki örnek konuşmalar ve itirazlar{kaynaklar.length ? ", onaylı bilgi kaynakları" : ""} da bu toplama dahil.</span>
            {hatalar.toplam && <span role="alert" className="text-xs font-semibold text-err">{hatalar.toplam}</span>}
            {!hatalar.toplam && denetim.uyari && <span className="text-xs font-semibold text-warn">Sınıra yaklaşıldı.</span>}
          </div>

          {duzenleyebilir ? (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold">Değişiklik notu (isteğe bağlı)</span>
                <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} maxLength={300} placeholder="örn. garanti metni güncellendi" className={`${GIRDI} min-h-11`} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={bekliyor || !degisti || hataVar} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control bg-ink px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <Save size={14} aria-hidden="true" /> {bekliyor ? "Kaydediliyor…" : "Kaydet (yeni sürüm)"}
                </button>
                {degisti && (
                  <button type="button" disabled={bekliyor} onClick={() => { setA(aktif); setSunucuHatalari({}); setMesaj(null); }} className="inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line-strong px-4 text-sm font-bold disabled:opacity-50">
                    Değişiklikleri at
                  </button>
                )}
                {mesaj && <span role={mesaj.ton === "err" ? "alert" : "status"} className={`text-sm font-semibold ${mesaj.ton === "err" ? "text-err" : "text-ok"}`}>{mesaj.metin}</span>}
              </div>
            </div>
          ) : <p role="note" className="text-sm text-muted">Salt okunur: bot ayarlarını yalnızca Yönetici değiştirir.</p>}
        </form>
        <Surumler surumler={surumler} aktifNo={aktifNo} duzenleyebilir={duzenleyebilir} />
      </div>
      <div className="xl:sticky xl:top-4">
        <BotuDene taslak={denetim.ayarlar} kanallar={denemeKanallari} kullanabilir={duzenleyebilir} anahtarVar={anahtarVar} />
      </div>
    </div>
  );
}
