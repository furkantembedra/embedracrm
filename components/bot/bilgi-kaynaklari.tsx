"use client";

// Bot › Ayarlar › Bilgi kaynakları (P2.4b). Yönetici PDF, ekran görüntüsü (PNG/JPG), Excel, CSV yükler ya da metin
// yapıştırır; hedef alanı seçer. Çıkan metin TASLAK olarak listelenir: Yönetici görür, düzenler, reddeder ya da
// onaylar. Onay yeni ayar sürümü açar (prompt cache bir kez yenilenir). Satış ve Pazarlama listeyi salt okunur görür.
// Maskeleme, işaretler ve toplam sınır burada anında, sunucuda kesin hesaplanır.
import { useMemo, useRef, useState, useTransition } from "react";
import { FileUp, Info } from "lucide-react";
import Chip, { type ChipTon } from "@/components/ui/chip";
import { AZAMI_TOPLAM, type BilgiKaynagi, type IstemAyarlari } from "./ayar-surumu";
import { usd } from "./arac-gorunumu";
import { AZAMI_DOSYA, AZAMI_TASLAK, GIRDI_ADI, HEDEF_ADI, HEDEFLER, KABUL_EDILEN } from "./bilgi-kaynagi/sabitler";
import { ISARET_ADI, isaretle, type Isaret, type IsaretTuru } from "./bilgi-kaynagi/maskele";
import { kaynakSiniri, sinirMetni } from "./bilgi-kaynagi/sinir";
import type { TabloOnizleme } from "./bilgi-kaynagi/tablo";
import type { KaynakDurumu, KaynakKaydi } from "./bilgi-kaynagi/veri";
import {
  eslemeyiUygula, kaynagiDevreDisiBirak, kaynagiOnayla, kaynagiReddet, kaynakYukle, tabloOnizlemesi, taslagiKaydet, type KaynakSonucu,
} from "./bilgi-kaynagi/actions";

const GIRDI = "w-full rounded-control border border-line-strong bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60";
const DUGME = "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
const ZAMAN = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const DURUM: Record<KaynakDurumu, { ad: string; ton: ChipTon }> = {
  taslak: { ad: "Taslak", ton: "warn" },
  onayli: { ad: "Onaylı", ton: "ok" },
  reddedildi: { ad: "Reddedildi", ton: "gray" },
  devre_disi: { ad: "Devre dışı", ton: "gray" },
};
const ISARET_TONU: Record<IsaretTuru, ChipTon> = { kisisel: "err", fiyat: "warn", talimat: "err", kesik: "warn" };

type Mesaj = { ton: "ok" | "err"; metin: string } | null;
const sunucuHatasi = { hata: "Sunucuya ulaşılamadı." } as KaynakSonucu;

function MesajSatiri({ m }: { m: Mesaj }) {
  if (!m) return null;
  return <span role={m.ton === "err" ? "alert" : "status"} className={`text-sm font-semibold ${m.ton === "err" ? "text-err" : "text-ok"}`}>{m.metin}</span>;
}

function IsaretOzeti({ isaretler }: { isaretler: Isaret[] }) {
  const sayilar = isaretler.reduce<Partial<Record<IsaretTuru, number>>>((t, i) => ({ ...t, [i.tur]: (t[i.tur] ?? 0) + 1 }), {});
  return (
    <>
      {(Object.keys(sayilar) as IsaretTuru[]).map((t) => <Chip key={t} ton={ISARET_TONU[t]}>{ISARET_ADI[t]}: {sayilar[t]}</Chip>)}
    </>
  );
}

function IsaretListesi({ isaretler, metin }: { isaretler: Isaret[]; metin: string }) {
  if (!isaretler.length) return <p className="text-xs text-ok">İşaretli satır yok.</p>;
  const satirlar = metin.split("\n");
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-control border border-line bg-bg p-2 text-xs" aria-label="İşaretli satırlar">
      {isaretler.map((i, n) => (
        <li key={n} className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2"><Chip ton={ISARET_TONU[i.tur]}>{ISARET_ADI[i.tur]}</Chip><b className="tabular-nums">{i.satir}. satır</b><span className="text-muted">{i.not}</span></span>
          {satirlar[i.satir - 1] && <code className="block truncate rounded bg-card px-1.5 py-0.5">{satirlar[i.satir - 1]}</code>}
        </li>
      ))}
    </ul>
  );
}

function SinirCubugu({ toplam, uyari, asim }: { toplam: number; uyari: boolean; asim: boolean }) {
  const oran = Math.min(1, toplam / AZAMI_TOPLAM);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-bold">İsteme giren toplam ek metin</span>
        <span className={`tabular-nums ${asim ? "font-bold text-err" : uyari ? "font-bold text-warn" : "text-muted"}`}>{toplam.toLocaleString("tr-TR")} / {AZAMI_TOPLAM.toLocaleString("tr-TR")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg" aria-hidden="true">
        <div className={`h-full ${asim ? "bg-err" : uyari ? "bg-warn" : "bg-ok"}`} style={{ width: `${oran * 100}%` }} />
      </div>
    </div>
  );
}

/** CSV / Excel sütun eşleme önizlemesi */
function SutunEsleme({ kaynakId, o, bitti }: { kaynakId: number; o: TabloOnizleme & { sayfa?: string }; bitti: (m: Mesaj) => void }) {
  const [dahil, setDahil] = useState<boolean[]>(o.dahil);
  const [mesaj, setMesaj] = useState<Mesaj>(null);
  const [bekliyor, baslat] = useTransition();
  const calistir = (f: () => Promise<KaynakSonucu>) => {
    setMesaj(null);
    baslat(async () => {
      const r = await f().catch(() => sunucuHatasi);
      if (r.hata) setMesaj({ ton: "err", metin: r.hata });
      else bitti({ ton: "ok", metin: r.duyuru ?? "Tamam." });
    });
  };
  return (
    <section aria-label="Sütun eşleme" className="flex flex-col gap-3 rounded-control border border-info/40 bg-info-bg/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b>Sütun eşleme</b>
        <span className="text-xs text-muted">{o.satirSayisi.toLocaleString("tr-TR")} satır{o.sayfa ? ` · sayfa "${o.sayfa}" (yalnızca ilk dolu sayfa okunur)` : ""}{o.kirpildi ? " · sınır nedeniyle kırpıldı" : ""}</span>
      </div>
      <p className="text-xs text-muted">Bota gidecek sütunları seçin. Ad, telefon, e-posta, adres, plaka gibi kişisel veri sütunları varsayılan olarak dışarıda; seçilen sütunlardaki metin de ayrıca maskelenir.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              {o.basliklar.map((b, i) => (
                <th key={i} scope="col" className="border-b border-line px-2 py-1 text-left align-bottom">
                  <label className="flex cursor-pointer items-center gap-1.5 font-bold">
                    <input type="checkbox" className="h-4 w-4" checked={dahil[i] ?? false} disabled={bekliyor} onChange={(e) => setDahil((d) => d.map((x, j) => (j === i ? e.target.checked : x)))} />
                    {b}
                  </label>
                  {o.kisisel[i] && <Chip ton="err" className="mt-1">Kişisel</Chip>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {o.ornek.map((s, r) => (
              <tr key={r}>
                {s.map((h, i) => <td key={i} className={`max-w-48 truncate border-b border-line px-2 py-1 ${dahil[i] ? "" : "text-muted line-through"}`}>{o.kisisel[i] ? "•••" : h}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={bekliyor || !dahil.some(Boolean)} onClick={() => calistir(() => eslemeyiUygula(kaynakId, dahil))} className={`${DUGME} bg-ink text-white`}>
          {bekliyor ? "Çevriliyor…" : "Metne çevir"}
        </button>
        <button type="button" disabled={bekliyor} onClick={() => calistir(() => kaynagiReddet(kaynakId))} className={`${DUGME} border border-line-strong`}>Vazgeç</button>
        <MesajSatiri m={mesaj} />
      </div>
    </section>
  );
}

function YuklemeFormu({ anahtarVar, bugunCikarim, bugunToplam, gunlukSinir }: { anahtarVar: boolean; bugunCikarim: number; bugunToplam: number; gunlukSinir: number }) {
  const [tur, setTur] = useState<"dosya" | "metin">("dosya");
  const [mesaj, setMesaj] = useState<Mesaj>(null);
  const [esleme, setEsleme] = useState<{ id: number; o: TabloOnizleme & { sayfa?: string } } | null>(null);
  const [bekliyor, baslat] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const gonder = (fd: FormData) => {
    setMesaj(null);
    setEsleme(null);
    const dosya = fd.get("dosya");
    if (tur === "dosya" && dosya instanceof File && dosya.size > AZAMI_DOSYA) {
      setMesaj({ ton: "err", metin: `Dosya en çok ${AZAMI_DOSYA / 1024 / 1024} MB olabilir.` });
      return;
    }
    fd.set("tur", tur);
    baslat(async () => {
      const r = await kaynakYukle(fd).catch(() => sunucuHatasi);
      const maliyet = r.maliyetUsd ? ` Çıkarım maliyeti: ${usd(r.maliyetUsd)}.` : "";
      if (r.hata) {
        setMesaj({ ton: "err", metin: r.hata + maliyet });
        return;
      }
      // Yalnızca girdi alanları temizlenir (form.reset() kontrollü tür seçimini bozar; hedef alan seçili kalır)
      const f = form.current;
      if (f) for (const ad of ["baslik", "metin", "dosya"]) {
        const el = f.elements.namedItem(ad);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "";
      }
      if (r.onizleme && r.kaynakId) setEsleme({ id: r.kaynakId, o: r.onizleme });
      setMesaj({ ton: "ok", metin: (r.duyuru ?? "Yüklendi.") + maliyet });
    });
  };

  return (
    <form ref={form} onSubmit={(e) => { e.preventDefault(); gonder(new FormData(e.currentTarget)); }} aria-labelledby="kaynak-ekle-baslik" className="flex flex-col gap-3 rounded-control border border-line p-4">
      <h3 id="kaynak-ekle-baslik" className="flex items-center gap-2 text-sm font-bold"><FileUp size={16} aria-hidden="true" /> Bilgi kaynağı ekle</h3>
      <div role="radiogroup" aria-label="Kaynak türü" className="flex flex-wrap gap-2 text-sm">
        {([["dosya", "Dosya yükle"], ["metin", "Metin yapıştır"]] as const).map(([d, ad]) => (
          <label key={d} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 ${tur === d ? "border-ink font-bold" : "border-line-strong"}`}>
            <input type="radio" name="kaynak-turu" value={d} checked={tur === d} onChange={() => setTur(d)} className="h-4 w-4" /> {ad}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Hedef alan</span>
          <select name="hedef" required defaultValue="bilgi_bankasi" disabled={bekliyor} className={`${GIRDI} min-h-10`}>
            {HEDEFLER.map((h) => <option key={h} value={h}>{HEDEF_ADI[h]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Başlık {tur === "dosya" && <span className="font-normal text-muted">(boşsa dosya adı)</span>}</span>
          <input name="baslik" maxLength={200} required={tur === "metin"} disabled={bekliyor} placeholder="örn. Garanti ve kurulum SSS" className={`${GIRDI} min-h-10`} />
        </label>
      </div>
      {tur === "dosya" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Dosya</span>
          <input name="dosya" type="file" required accept={KABUL_EDILEN} disabled={bekliyor} className="text-sm file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-control file:border file:border-line-strong file:bg-card file:px-3 file:font-bold" />
          <span className="text-xs text-muted">
            PDF, ekran görüntüsü (PNG / JPG; ör. eski WhatsApp / Instagram sohbetleri), Excel (.xlsx) ya da CSV (UTF-8); en çok {AZAMI_DOSYA / 1024 / 1024} MB. Ham dosya metin çıkarılınca silinir; yalnızca dosya adı, tür, yükleyen ve tarih kalır.
          </span>
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Metin</span>
          <textarea name="metin" rows={6} required maxLength={AZAMI_TASLAK} disabled={bekliyor} className={`${GIRDI} resize-y py-2`} placeholder="SSS, kurulum adımları, itiraz ve cevaplar ya da örnek bir konuşma…" />
        </label>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          PDF ve görseller Claude ile metne çevrilir; CSV ve Excel kodla okunur. Kişisel veriler otomatik maskelenir, şüpheli satırlar işaretlenir. Belgedeki fiyat ve iskontoları bot kullanmaz.
          {" "}Bugünkü çıkarım maliyeti {usd(bugunCikarim)} · bot toplamı {usd(bugunToplam)} / {usd(gunlukSinir)} (günlük sınıra dahil).
          {!anahtarVar && <b className="text-err"> ANTHROPIC_API_KEY tanımlı değil: PDF ve görseller çevrilemez.</b>}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={bekliyor} className={`${DUGME} min-h-11 bg-ink px-4 text-white`}>
          {bekliyor ? (tur === "dosya" ? "Yükleniyor ve çevriliyor…" : "Hazırlanıyor…") : tur === "dosya" ? "Yükle ve metne çevir" : "Taslak oluştur"}
        </button>
        <MesajSatiri m={mesaj} />
      </div>
      {esleme && <SutunEsleme key={esleme.id} kaynakId={esleme.id} o={esleme.o} bitti={(m) => { setEsleme(null); setMesaj(m); }} />}
    </form>
  );
}

/** Tek kaynak satırı: özet + (açılınca) taslak düzenleyici ya da salt okunur metin */
function KaynakSatiri({ k, aktifte, ayarlar, aktifKaynaklar, duzenleyebilir }: {
  k: KaynakKaydi; aktifte: boolean; ayarlar: IstemAyarlari; aktifKaynaklar: BilgiKaynagi[]; duzenleyebilir: boolean;
}) {
  const [baslik, setBaslik] = useState(k.baslik);
  const [metin, setMetin] = useState(k.metin);
  const [mesaj, setMesaj] = useState<Mesaj>(null);
  const [esleme, setEsleme] = useState<(TabloOnizleme & { sayfa?: string }) | null>(null);
  const [bekliyor, baslat] = useTransition();
  // Sunucu yenilemesinden sonra (kayıt / maskeleme) düzenleyici yeni metinle başlar
  const [onceki, setOnceki] = useState(k.metin);
  if (onceki !== k.metin) {
    setOnceki(k.metin);
    setMetin(k.metin);
  }
  const taslak = k.durum === "taslak" && !k.dosyaBekliyor;
  const duzenlenebilir = duzenleyebilir && taslak;
  const isaretler = useMemo(() => (duzenlenebilir ? isaretle(metin, k.isaretler.some((i) => i.tur === "kesik")) : k.isaretler), [duzenlenebilir, metin, k.isaretler]);
  const sinir = useMemo(() => kaynakSiniri(ayarlar, aktifKaynaklar, { id: k.id, metin: taslak ? metin : k.metin }), [ayarlar, aktifKaynaklar, k.id, k.metin, metin, taslak]);
  const degisti = metin !== k.metin || baslik !== k.baslik;

  const calistir = (f: () => Promise<KaynakSonucu>, onay?: string) => {
    if (onay && !window.confirm(onay)) return;
    setMesaj(null);
    baslat(async () => {
      const r = await f().catch(() => sunucuHatasi);
      setMesaj(r.hata ? { ton: "err", metin: r.hata } : { ton: "ok", metin: r.duyuru ?? "Tamam." });
      if (r.onizleme) setEsleme(r.onizleme);
    });
  };

  const yeniSurumUyarisi = "Yeni bir ayar sürümü açılacak ve bot hemen onu kullanacak (prompt cache bir kez yenilenir). Devam edilsin mi?";
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b className="min-w-0 break-words">{k.baslik}</b>
        <Chip ton={DURUM[k.durum].ton}>{DURUM[k.durum].ad}</Chip>
        {k.durum === "onayli" && !aktifte && <Chip ton="warn">Aktif sürümde değil</Chip>}
        {k.dosyaBekliyor && <Chip ton="info">Sütun eşlemesi bekliyor</Chip>}
        <Chip ton="gray">{HEDEF_ADI[k.hedef]}</Chip>
        <IsaretOzeti isaretler={k.isaretler} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted">
        <span>{GIRDI_ADI[k.girdi]}{k.dosyaAdi ? ` · ${k.dosyaAdi}` : ""}{k.dosyaBoyutu ? ` · ${k.dosyaBoyutu < 1024 ? "<1" : (k.dosyaBoyutu / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB` : ""}</span>
        <span>{k.metin.length.toLocaleString("tr-TR")} karakter</span>
        {k.maskelenen > 0 && <span>{k.maskelenen} maskeleme</span>}
        {k.maliyetUsd > 0 && <span>çıkarım {usd(k.maliyetUsd)}</span>}
        <span>{k.yukleyen ?? "—"} · {ZAMAN.format(new Date(k.zaman))}</span>
        {k.onaylayan && k.onayZamani && <span>onay: {k.onaylayan} · {ZAMAN.format(new Date(k.onayZamani))}</span>}
      </div>

      {k.dosyaBekliyor && duzenleyebilir && !esleme && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={bekliyor} onClick={() => calistir(() => tabloOnizlemesi(k.id))} className={`${DUGME} border border-line-strong`}>Eşlemeye devam et</button>
          <button type="button" disabled={bekliyor} onClick={() => calistir(() => kaynagiReddet(k.id))} className={`${DUGME} border border-line-strong`}>Vazgeç</button>
        </div>
      )}
      {esleme && <SutunEsleme kaynakId={k.id} o={esleme} bitti={(m) => { setEsleme(null); setMesaj(m); }} />}

      {!k.dosyaBekliyor && k.durum !== "reddedildi" && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-info">{duzenlenebilir ? "Taslağı gör ve düzenle" : "Metni göster"}</summary>
          <div className="mt-2 flex flex-col gap-2">
            {duzenlenebilir ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold">Başlık</span>
                  <input value={baslik} onChange={(e) => setBaslik(e.target.value)} maxLength={200} disabled={bekliyor} className={`${GIRDI} min-h-10`} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="flex justify-between text-xs font-bold"><span>Taslak metin (bota henüz gitmiyor)</span><span className="font-normal tabular-nums text-muted">{metin.length.toLocaleString("tr-TR")} karakter</span></span>
                  <textarea value={metin} onChange={(e) => setMetin(e.target.value)} rows={10} maxLength={AZAMI_TASLAK} disabled={bekliyor} className={`${GIRDI} resize-y py-2 font-mono text-xs`} />
                </label>
              </>
            ) : (
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-control border border-line bg-bg p-2 text-xs">{k.metin || "—"}</pre>
            )}
            <IsaretListesi isaretler={isaretler} metin={duzenlenebilir ? metin : k.metin} />
            {(k.durum === "taslak" || k.durum === "devre_disi") && (
              <>
                <SinirCubugu toplam={sinir.toplam} uyari={sinir.uyari} asim={sinir.asim} />
                {sinir.asim ? (
                  <span role="alert" className="text-xs font-semibold text-err">Onaylanırsa sınır aşılır: {sinirMetni(sinir)}. Kısaltın ya da başka bir kaynağı devre dışı bırakın.</span>
                ) : sinir.uyari ? <span className="text-xs font-semibold text-warn">Onaylanırsa sınıra yaklaşılır.</span> : null}
              </>
            )}
          </div>
        </details>
      )}

      {duzenleyebilir && (
        <div className="flex flex-wrap items-center gap-2">
          {duzenlenebilir && (
            <>
              <button type="button" disabled={bekliyor || !metin.trim() || sinir.asim} onClick={() => calistir(() => kaynagiOnayla(k.id, baslik, metin), yeniSurumUyarisi)} className={`${DUGME} bg-ink text-white`}>
                {bekliyor ? "Bekleyin…" : "Onayla (yeni sürüm)"}
              </button>
              <button type="button" disabled={bekliyor || !degisti} onClick={() => calistir(() => taslagiKaydet(k.id, baslik, metin))} className={`${DUGME} border border-line-strong`}>Taslağı kaydet</button>
              <button type="button" disabled={bekliyor} onClick={() => calistir(() => kaynagiReddet(k.id), "Taslak reddedilsin mi? Bota hiç girmez.")} className={`${DUGME} border border-line-strong text-err`}>Reddet</button>
            </>
          )}
          {k.durum === "onayli" && (
            <button type="button" disabled={bekliyor} onClick={() => calistir(() => kaynagiDevreDisiBirak(k.id), yeniSurumUyarisi)} className={`${DUGME} border border-line-strong`}>Devre dışı bırak</button>
          )}
          {k.durum === "devre_disi" && (
            <button type="button" disabled={bekliyor || sinir.asim} onClick={() => calistir(() => kaynagiOnayla(k.id), yeniSurumUyarisi)} className={`${DUGME} border border-line-strong`}>Yeniden etkinleştir</button>
          )}
          <MesajSatiri m={mesaj} />
        </div>
      )}
    </li>
  );
}

export default function BilgiKaynaklari({ kaynaklar, kurulumEksik = false, ayarlar, aktifKaynaklar, duzenleyebilir, anahtarVar, bugunCikarim, bugunToplam, gunlukSinir }: {
  kaynaklar: KaynakKaydi[];
  /** bot_bilgi_kaynaklari okunamadı (migration uygulanmamış) */
  kurulumEksik?: boolean;
  ayarlar: IstemAyarlari;
  aktifKaynaklar: BilgiKaynagi[];
  duzenleyebilir: boolean;
  anahtarVar: boolean;
  bugunCikarim: number;
  bugunToplam: number;
  gunlukSinir: number;
}) {
  const aktifIdler = new Set(aktifKaynaklar.map((k) => k.id));
  const genel = kaynakSiniri(ayarlar, aktifKaynaklar);
  const [filtre, setFiltre] = useState<"hepsi" | KaynakDurumu>("hepsi");
  const gorunen = kaynaklar.filter((k) => filtre === "hepsi" || k.durum === filtre);
  return (
    <section aria-labelledby="bilgi-kaynaklari-baslik" className="flex flex-col gap-4 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="bilgi-kaynaklari-baslik" className="text-base font-bold">Bilgi kaynakları</h2>
        <Chip ton="gray">{aktifKaynaklar.length} kaynak etkin</Chip>
      </div>
      <p className="text-xs text-muted">
        Yüklenen dosyalardan çıkan metin önce taslak olur; bot yalnızca Yönetici&apos;nin onayladığı kaynakları kullanır. Onay ve devre dışı bırakma yeni ayar sürümü açar
        (Sürümler&apos;den geri dönülebilir). Kaynak metinleri isteme veri olarak girer: içlerindeki talimatlar uygulanmaz, fiyat ve iskontolar geçersizdir.
      </p>
      <SinirCubugu toplam={genel.toplam} uyari={genel.uyari} asim={genel.asim} />
      {kurulumEksik ? (
        <p role="alert" className="rounded-control border border-err/40 bg-err-bg p-3 text-sm font-semibold text-err">
          Bilgi kaynakları tablosu okunamadı: supabase/migrations/20261120200000_bot_bilgi_kaynaklari.sql veritabanına uygulanmamış olabilir.
        </p>
      ) : duzenleyebilir
        ? <YuklemeFormu anahtarVar={anahtarVar} bugunCikarim={bugunCikarim} bugunToplam={bugunToplam} gunlukSinir={gunlukSinir} />
        : <p role="note" className="text-sm text-muted">Salt okunur: bilgi kaynaklarını yalnızca Yönetici yükler ve onaylar.</p>}
      {kaynaklar.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Duruma göre süz">
          {(["hepsi", "taslak", "onayli", "devre_disi", "reddedildi"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)} className={`min-h-8 cursor-pointer rounded-full border px-3 font-bold ${filtre === f ? "border-ink bg-ink text-white" : "border-line-strong"}`}>
              {f === "hepsi" ? "Tümü" : DURUM[f].ad} ({f === "hepsi" ? kaynaklar.length : kaynaklar.filter((k) => k.durum === f).length})
            </button>
          ))}
        </div>
      )}
      {!kaynaklar.length && !kurulumEksik && <p className="text-sm text-muted">Henüz bilgi kaynağı yok.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {gorunen.map((k) => (
          <KaynakSatiri key={k.id} k={k} aktifte={aktifIdler.has(k.id)} ayarlar={ayarlar} aktifKaynaklar={aktifKaynaklar} duzenleyebilir={duzenleyebilir} />
        ))}
      </ul>
    </section>
  );
}
