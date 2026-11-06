"use client";

// Pazarlama pencerelerindeki formlar: içerik ekle / düzenle (görsel, açıklama, hashtag), kampanya kaydet / düzenle (mesaj ve otomatik gönderim), yeni hedef liste
import { useState, useTransition } from "react";
import { Copy, Download, Film, Image as ImageIcon, Upload, X } from "lucide-react";
import { IZIN_KANALLARI, IZIN_KANAL_ADI } from "@/components/musteriler/izin";
import { icerikKaydet, kampanyaKaydet, listeKaydet, type IcerikSonucu, type KampanyaSonucu, type ListeSonucu } from "./actions";
import {
  HAZIR_LISTELER, ICERIK_KANALLARI, KAMPANYA_DURUMLARI, KAMPANYA_KANALLARI,
  type Icerik, type IcerikKanali, type Kampanya, type KampanyaDurumu, type KampanyaKanali, type ListeFiltresi, type Medya, type Otomasyon, type OzelListe,
} from "./queries";
import { hashtagTemizle, mesajDoldur } from "./ortak";

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const ALAN = "flex min-w-0 flex-col gap-1.5 text-[13px] font-bold";

function Hata({ mesaj }: { mesaj?: string }) {
  return mesaj ? <span role="alert" className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

function Altlik({ bekliyor, etiket, onVazgec }: { bekliyor: boolean; etiket: string; onVazgec: () => void }) {
  return (
    <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 bg-card px-5 py-4">
      <button type="button" onClick={onVazgec} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">Vazgeç</button>
      <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60">
        {bekliyor ? "Kaydediliyor…" : etiket}
      </button>
    </div>
  );
}

/* ---------- İçerik ---------- */

/** Kanalın açıklama sınırı (karakter) */
const ACIKLAMA_SINIRI: Record<IcerikKanali, number> = { Instagram: 2200, LinkedIn: 3000, WhatsApp: 1024, Blog: 3000, "Bülten / e-posta": 3000 };
const HASHTAG_KANALI: IcerikKanali[] = ["Instagram", "LinkedIn"];

export function IcerikFormu({
  icerik,
  tarih: ilkTarih,
  kampanyalar,
  onKaydedildi,
  onVazgec,
}: {
  icerik?: Icerik; // verilirse düzenleme
  tarih: string;
  kampanyalar: Kampanya[];
  onKaydedildi: (s: IcerikSonucu) => void;
  onVazgec: () => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [h, setH] = useState<Record<string, string>>({});
  const [v, setV] = useState({
    tarih: icerik?.tarih ?? ilkTarih,
    kanal: (icerik?.kanal ?? "Instagram") as IcerikKanali,
    baslik: icerik?.baslik ?? "",
    kampanyaId: icerik?.kampanyaId ?? "",
    aciklama: icerik?.aciklama ?? "",
  });
  const [hashtaglar, setHashtaglar] = useState<string[]>(icerik?.hashtaglar ?? []);
  const [etiket, setEtiket] = useState("");
  const [medya, setMedya] = useState<Medya[]>(icerik?.medya ?? []);
  const [yukleniyor, setYukleniyor] = useState(0);
  const [kopyalandi, setKopyalandi] = useState(false);
  const sinir = ACIKLAMA_SINIRI[v.kanal];

  const etiketEkle = (metin: string) => {
    const yeni = metin.split(/[\s,]+/).map(hashtagTemizle).filter(Boolean);
    if (yeni.length) setHashtaglar((l) => [...new Set([...l, ...yeni])].slice(0, 30));
    setEtiket("");
  };

  const dosyalariYukle = async (liste: FileList | null) => {
    const dosyalar = [...(liste ?? [])].slice(0, 10 - medya.length);
    if (!dosyalar.length) return;
    setYukleniyor((n) => n + dosyalar.length);
    await Promise.all(
      dosyalar.map(async (f) => {
        const form = new FormData();
        form.append("dosya", f);
        try {
          const r = await fetch("/api/medya", { method: "POST", body: form });
          const j = (await r.json()) as Medya & { hata?: string };
          if (!r.ok) setH((x) => ({ ...x, medya: `${f.name}: ${j.hata ?? "yüklenemedi"}` }));
          else setMedya((l) => [...l, { id: j.id, ad: j.ad, tur: j.tur, boyut: j.boyut }]);
        } catch {
          setH((x) => ({ ...x, medya: `${f.name}: yüklenemedi` }));
        } finally {
          setYukleniyor((n) => n - 1);
        }
      }),
    );
  };

  const paylasimMetni = [v.aciklama.trim(), hashtaglar.map((x) => `#${x}`).join(" ")].filter(Boolean).join("\n\n");
  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(paylasimMetni);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1500);
    } catch {
      /* pano izni yoksa sessiz geç */
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const bekleyen = etiket.trim() ? [...new Set([...hashtaglar, ...etiket.split(/[\s,]+/).map(hashtagTemizle).filter(Boolean)])] : hashtaglar;
        baslat(async () => {
          const s = await icerikKaydet({ ...v, id: icerik?.id, hashtaglar: bekleyen, medya });
          if (s.hatalar) setH(s.hatalar);
          else onKaydedildi(s);
        });
      }}
      className="flex flex-col gap-4"
    >
      <label className={ALAN}>
        Başlık *
        <input autoFocus={!icerik} value={v.baslik} onChange={(e) => setV({ ...v, baslik: e.target.value })} maxLength={120} placeholder="Ör. Reels: CAN-FD ile hızlı teşhis" className={GIRDI} aria-invalid={!!h.baslik} />
        <Hata mesaj={h.baslik} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ALAN}>
          Tarih *
          <input type="date" value={v.tarih} onChange={(e) => setV({ ...v, tarih: e.target.value })} className={GIRDI} aria-invalid={!!h.tarih} />
          <Hata mesaj={h.tarih} />
        </label>
        <label className={ALAN}>
          Kanal *
          <select value={v.kanal} onChange={(e) => setV({ ...v, kanal: e.target.value as IcerikKanali })} className={GIRDI}>
            {ICERIK_KANALLARI.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
      </div>

      {/* Görsel / video */}
      <div className={ALAN}>
        <span>Görsel / video <span className="font-normal text-muted">· en fazla 10 dosya, her biri 25 MB</span></span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {medya.map((m, i) => (
            <figure key={m.id} className="group relative aspect-square overflow-hidden rounded-[12px] border border-line bg-[#F4F5F0]">
              {m.tur === "video" ? (
                <video src={`/api/medya/${m.id}`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- yüklenen dosya kendi API'mizden gelir
                <img src={`/api/medya/${m.id}`} alt={m.ad} className="h-full w-full object-cover" />
              )}
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-semibold text-white">
                {m.tur === "video" ? <Film size={11} aria-hidden="true" /> : <ImageIcon size={11} aria-hidden="true" />}
                <span className="truncate">{i + 1}. {m.ad}</span>
              </figcaption>
              <div className="absolute right-1 top-1 flex gap-1">
                <a href={`/api/medya/${m.id}?indir=1`} aria-label={`${m.ad} indir`} className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-ink hover:bg-white">
                  <Download size={14} aria-hidden="true" />
                </a>
                <button type="button" onClick={() => setMedya((l) => l.filter((x) => x.id !== m.id))} aria-label={`${m.ad} kaldır`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-white/90 text-ink hover:bg-white hover:text-err">
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </figure>
          ))}
          {Array.from({ length: yukleniyor }, (_, i) => <div key={`y${i}`} className="aspect-square animate-pulse rounded-[12px] bg-[#F4F5F0] motion-reduce:animate-none" />)}
          {medya.length + yukleniyor < 10 && (
            <label
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-line-strong text-center text-xs font-bold text-muted hover:border-ink hover:text-ink"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); dosyalariYukle(e.dataTransfer.files); }}
            >
              <Upload size={18} aria-hidden="true" />
              Ekle
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => { dosyalariYukle(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        <Hata mesaj={h.medya} />
      </div>

      {/* Açıklama */}
      <label className={ALAN}>
        <span className="flex items-baseline gap-2">
          Açıklama metni
          <span className={`ml-auto text-xs font-semibold tabular-nums ${v.aciklama.length > sinir ? "text-err" : "text-muted"}`}>{v.aciklama.length}/{sinir}</span>
        </span>
        <textarea
          rows={5}
          value={v.aciklama}
          onChange={(e) => setV({ ...v, aciklama: e.target.value })}
          maxLength={3000}
          placeholder={v.kanal === "Instagram" ? "Gönderinin altına yazılacak metin. İlk satır akışta görünür, dikkat çekici olsun." : "Paylaşımın metni"}
          className={`${GIRDI} py-2 leading-relaxed`}
          aria-invalid={!!h.aciklama || v.aciklama.length > sinir}
        />
        <Hata mesaj={h.aciklama ?? (v.aciklama.length > sinir ? `${v.kanal} için en fazla ${sinir} karakter.` : undefined)} />
      </label>

      {/* Hashtag */}
      <div className={ALAN}>
        <span className="flex items-baseline gap-2">
          <label htmlFor="hashtag-girdi">Hashtag&apos;ler</label>
          {!HASHTAG_KANALI.includes(v.kanal) && <span className="font-normal text-muted">({v.kanal} için genelde kullanılmaz)</span>}
          <span className={`ml-auto text-xs font-semibold tabular-nums ${hashtaglar.length >= 30 ? "text-warn" : "text-muted"}`}>{hashtaglar.length}/30</span>
        </span>
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-card px-2 py-1.5 focus-within:border-ink">
          {hashtaglar.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 rounded-full bg-info-bg py-0.5 pl-2.5 pr-1 text-xs font-bold text-info">
              #{x}
              <button type="button" onClick={() => setHashtaglar((l) => l.filter((y) => y !== x))} aria-label={`#${x} kaldır`} className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/60">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id="hashtag-girdi"
            value={etiket}
            onChange={(e) => (/[\s,]$/.test(e.target.value) ? etiketEkle(e.target.value) : setEtiket(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                etiketEkle(etiket);
              } else if (e.key === "Backspace" && !etiket && hashtaglar.length) setHashtaglar((l) => l.slice(0, -1));
            }}
            onBlur={() => etiket.trim() && etiketEkle(etiket)}
            onPaste={(e) => {
              e.preventDefault();
              etiketEkle(etiket + " " + e.clipboardData.getData("text"));
            }}
            disabled={hashtaglar.length >= 30}
            placeholder={hashtaglar.length ? "" : "#EmbedraONE #otoelektrik · Enter, boşluk ya da virgülle ekleyin"}
            className="min-w-[140px] flex-1 bg-transparent py-1 text-sm outline-none"
          />
        </div>
        <Hata mesaj={h.hashtaglar} />
      </div>

      {paylasimMetni && (
        <div className="flex flex-col gap-2 rounded-control bg-[#F4F5F0] p-3">
          <div className="flex items-center gap-2">
            <b className="text-xs">Paylaşım metni önizlemesi</b>
            <button type="button" onClick={kopyala} className="ml-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[9px] border border-line-strong bg-card px-2.5 text-xs font-bold hover:bg-white">
              <Copy size={13} aria-hidden="true" />
              {kopyalandi ? "Kopyalandı" : "Metni kopyala"}
            </button>
          </div>
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[#474A42]">{paylasimMetni}</p>
        </div>
      )}

      <Altlik bekliyor={bekliyor || yukleniyor > 0} etiket={icerik ? "Değişiklikleri kaydet" : "İçeriği ekle"} onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- Kampanya ---------- */

export function KampanyaFormu({
  kampanya,
  bugun,
  ozelListeler,
  listeSayisi,
  onKaydedildi,
  onVazgec,
}: {
  kampanya?: Kampanya; // verilirse düzenleme
  bugun: string;
  ozelListeler: OzelListe[];
  listeSayisi: (id: string) => number | null;
  onKaydedildi: (s: KampanyaSonucu) => void;
  onVazgec: () => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [h, setH] = useState<Record<string, string>>({});
  const [v, setV] = useState({
    ad: kampanya?.ad ?? "",
    kanal: (kampanya?.kanal ?? "E-posta") as KampanyaKanali,
    listeId: kampanya?.listeId ?? "",
    baslangic: kampanya?.baslangic ?? bugun,
    bitis: kampanya?.bitis ?? "",
    durum: (kampanya?.durum ?? "Taslak") as KampanyaDurumu,
    not: kampanya?.not ?? "",
  });
  const [mesaj, setMesaj] = useState(kampanya?.mesaj ?? { konu: "", metin: "", sablon: "" });
  const [oto, setOto] = useState<Otomasyon>(kampanya?.otomasyon ?? { tur: "yok", zaman: null });
  const mesajli = v.kanal === "E-posta" || v.kanal === "WhatsApp";
  const ekle = (alan: string) => setMesaj((m) => ({ ...m, metin: `${m.metin}${m.metin && !/\s$/.test(m.metin) ? " " : ""}${alan}` }));
  const ornek = { ad: "Örnek Oto Elektrik", kisi: "Ali Yılmaz" };
  const sayiYaz = (id: string) => {
    const n = listeSayisi(id);
    return n === null ? "" : ` · ${n} kişi`;
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        baslat(async () => {
          const s = await kampanyaKaydet({ ...v, id: kampanya?.id, bitis: v.bitis || null, mesaj: mesajli ? mesaj : undefined, otomasyon: mesajli ? oto : undefined });
          if (s.hatalar) setH(s.hatalar);
          else onKaydedildi(s);
        });
      }}
      className="flex flex-col gap-4"
    >
      <label className={ALAN}>
        Kampanya adı *
        <input autoFocus value={v.ad} onChange={(e) => setV({ ...v, ad: e.target.value })} maxLength={100} placeholder="Ör. Black Friday Pro+ yükseltme" className={GIRDI} aria-invalid={!!h.ad} />
        <Hata mesaj={h.ad} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Kanal *
          <select value={v.kanal} onChange={(e) => setV({ ...v, kanal: e.target.value as KampanyaKanali })} className={GIRDI}>
            {KAMPANYA_KANALLARI.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <div className={ALAN}>
          <span id="kp-durum">Durum *</span>
          <div role="group" aria-labelledby="kp-durum" className="flex gap-1 rounded-control bg-bg p-1">
            {KAMPANYA_DURUMLARI.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={v.durum === d}
                onClick={() => setV({ ...v, durum: d })}
                className={`min-h-9 flex-1 cursor-pointer rounded-[9px] text-[13px] font-bold ${v.durum === d ? "bg-card shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42]"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className={ALAN}>
        Hedef liste *
        <select value={v.listeId} onChange={(e) => setV({ ...v, listeId: e.target.value })} className={GIRDI} aria-invalid={!!h.listeId}>
          <option value="" disabled>Seçin</option>
          {HAZIR_LISTELER.map((l) => <option key={l.id} value={l.id}>{l.ad}{sayiYaz(l.id)}</option>)}
          {ozelListeler.length > 0 && (
            <optgroup label="Kaydettiğiniz listeler">
              {ozelListeler.map((l) => <option key={l.id} value={l.id}>{l.ad}{sayiYaz(l.id)}</option>)}
            </optgroup>
          )}
        </select>
        <Hata mesaj={h.listeId} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ALAN}>
          Başlangıç *
          <input type="date" value={v.baslangic} onChange={(e) => setV({ ...v, baslangic: e.target.value })} className={GIRDI} aria-invalid={!!h.baslangic} />
          <Hata mesaj={h.baslangic} />
        </label>
        <label className={ALAN}>
          <span>Bitiş <span className="font-normal text-muted">(tek günse boş)</span></span>
          <input type="date" value={v.bitis} min={v.baslangic} onChange={(e) => setV({ ...v, bitis: e.target.value })} className={GIRDI} aria-invalid={!!h.bitis} />
          <Hata mesaj={h.bitis} />
        </label>
      </div>
      <label className={ALAN}>
        <span>Not <span className="font-normal text-muted">(isteğe bağlı)</span></span>
        <input value={v.not} onChange={(e) => setV({ ...v, not: e.target.value })} maxLength={200} placeholder="Ör. İlk yıl %10 indirim" className={GIRDI} />
      </label>
      {mesajli && (
        <fieldset className="flex flex-col gap-3 rounded-control border border-line p-3">
          <legend className="px-1 text-[13px] font-bold">{v.kanal} mesajı</legend>
          {v.kanal === "E-posta" ? (
            <label className={ALAN}>
              Konu
              <input value={mesaj.konu} onChange={(e) => setMesaj({ ...mesaj, konu: e.target.value })} maxLength={150} placeholder="Ör. {firma} için Kasım fırsatları" className={GIRDI} aria-invalid={!!h.konu} />
              <Hata mesaj={h.konu} />
            </label>
          ) : (
            <label className={ALAN}>
              <span>Meta şablon adı <span className="font-normal text-muted">(WhatsApp Business&apos;ta onaylı şablon)</span></span>
              <input value={mesaj.sablon} onChange={(e) => setMesaj({ ...mesaj, sablon: e.target.value })} maxLength={100} placeholder="pro_yukseltme_teklifi" className={`${GIRDI} font-mono`} />
              <span className="text-xs font-normal text-muted">WhatsApp pazarlama mesajı yalnızca onaylı şablonla gider. Şablonda {"{{1}}"} kişi adı, {"{{2}}"} firma adı olur; aşağıdaki metin şablonun içeriğidir.</span>
            </label>
          )}
          <label className={ALAN}>
            <span className="flex flex-wrap items-center gap-1.5">
              Metin
              <span className="ml-auto flex gap-1">
                {["{ad}", "{firma}"].map((a) => (
                  <button key={a} type="button" onClick={() => ekle(a)} className="min-h-7 cursor-pointer rounded-[8px] border border-line-strong bg-card px-2 font-mono text-[11px] font-bold hover:bg-[#F4F5F0]">+ {a}</button>
                ))}
              </span>
            </span>
            <textarea
              rows={6}
              value={mesaj.metin}
              onChange={(e) => setMesaj({ ...mesaj, metin: e.target.value })}
              maxLength={4000}
              placeholder={"Merhaba {ad},\n\n…"}
              className={`${GIRDI} py-2 leading-relaxed`}
              aria-invalid={!!h.metin}
            />
            <Hata mesaj={h.metin} />
          </label>
          {mesaj.metin && (
            <div className="rounded-control bg-[#F4F5F0] p-3 text-[13px]">
              <b className="text-xs text-muted">Önizleme · {ornek.kisi}, {ornek.ad}</b>
              {v.kanal === "E-posta" && mesaj.konu && <p className="mt-1 font-bold">{mesajDoldur(mesaj.konu, ornek)}</p>}
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[#474A42]">{mesajDoldur(mesaj.metin, ornek)}</p>
              <p className="mt-2 text-[11px] text-muted">{v.kanal === "E-posta" ? "Her e-postanın altına abonelikten çıkma bağlantısı eklenir." : "Alıcı abonelikten çıkarsa bir daha gönderilmez."}</p>
            </div>
          )}
          <div className={ALAN}>
            <span id="kp-oto">Gönderim</span>
            <div role="group" aria-labelledby="kp-oto" className="flex flex-wrap gap-1 rounded-control bg-bg p-1">
              {([["yok", "Elle gönderirim"], ["planli", "Belirli bir zamanda"], ["surekli", "Listeye yeni girenlere otomatik"]] as const).map(([t, ad]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={oto.tur === t}
                  onClick={() => setOto({ tur: t, zaman: t === "planli" ? oto.zaman ?? `${v.baslangic}T10:00` : null })}
                  className={`min-h-9 flex-1 cursor-pointer whitespace-nowrap rounded-[9px] px-2 text-[13px] font-bold ${oto.tur === t ? "bg-card shadow-[0_1px_2px_rgba(14,15,12,0.08)]" : "text-[#474A42]"}`}
                >
                  {ad}
                </button>
              ))}
            </div>
            {oto.tur === "planli" && (
              <input type="datetime-local" value={oto.zaman ?? ""} onChange={(e) => setOto({ tur: "planli", zaman: e.target.value })} className={GIRDI} aria-invalid={!!h.zaman} aria-label="Gönderim zamanı" />
            )}
            <Hata mesaj={h.zaman ?? h.otomasyon} />
            <span className="text-xs font-normal text-muted">
              {oto.tur === "yok" && "Kaydettikten sonra kampanya listesindeki “Gönder” düğmesiyle gönderirsiniz."}
              {oto.tur === "planli" && "Seçilen zamanda listedeki izinli herkese bir kez gönderilir. Kampanya Aktif olmalı."}
              {oto.tur === "surekli" &&
                "Kampanya tarihleri boyunca listeye yeni giren her kişiye bir kez gönderilir (ör. lisansı 30 gün içinde bitecek duruma gelenler). Kampanya Aktif olmalı."}
            </span>
          </div>
        </fieldset>
      )}
      <p className="text-xs text-muted">Bu kampanyadan gelen lead&apos;leri satış hattında fırsatın &quot;Kampanya&quot; alanından seçin; sayılar buraya otomatik gelir.</p>
      <Altlik bekliyor={bekliyor} etiket={kampanya ? "Değişiklikleri kaydet" : "Kampanyayı kaydet"} onVazgec={onVazgec} />
    </form>
  );
}

/* ---------- Hedef liste ---------- */

export function ListeFormu({
  segmentler,
  ulkeler,
  uyeSayisi,
  onKaydedildi,
  onVazgec,
}: {
  segmentler: Record<string, string>;
  ulkeler: string[];
  uyeSayisi: (f: ListeFiltresi) => number;
  onKaydedildi: (s: ListeSonucu) => void;
  onVazgec: () => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [ad, setAd] = useState("");
  const [f, setF] = useState<ListeFiltresi>({ segment: "", plan: "", ulke: "", izin: "herhangi" });
  const n = uyeSayisi(f);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        baslat(async () => {
          const s = await listeKaydet(ad, f);
          if (s.hata) setHata(s.hata);
          else onKaydedildi(s);
        });
      }}
      className="flex flex-col gap-4"
    >
      <label className={ALAN}>
        Liste adı *
        <input autoFocus value={ad} onChange={(e) => setAd(e.target.value)} maxLength={60} placeholder="Ör. Türkiye'deki eğitim kurumları" className={GIRDI} aria-invalid={!!hata} />
        <Hata mesaj={hata ?? undefined} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ALAN}>
          Segment
          <select value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} className={GIRDI}>
            <option value="">Tümü</option>
            {Object.entries(segmentler).map(([id, ad]) => <option key={id} value={id}>{ad}</option>)}
          </select>
        </label>
        <label className={ALAN}>
          Plan
          <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} className={GIRDI}>
            <option value="">Tümü</option>
            {["Basic", "Pro", "Pro+", "Lead"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className={ALAN}>
          Ülke
          <select value={f.ulke} onChange={(e) => setF({ ...f, ulke: e.target.value })} className={GIRDI}>
            <option value="">Tümü</option>
            {ulkeler.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
      </div>
      <label className={ALAN}>
        Duyuru izni
        <select value={f.izin} onChange={(e) => setF({ ...f, izin: e.target.value as ListeFiltresi["izin"] })} className={GIRDI}>
          <option value="">Fark etmez (izinsizler de listede)</option>
          <option value="herhangi">En az bir kanalda izinli</option>
          {IZIN_KANALLARI.map((k) => <option key={k} value={k}>{IZIN_KANAL_ADI[k]} izni olanlar</option>)}
        </select>
      </label>
      <p className={`rounded-control px-3 py-2.5 text-[13px] font-semibold ${n ? "bg-[#F4F5F0]" : "bg-warn-bg text-warn"}`} aria-live="polite">
        {n ? `Bu filtreye şu an ${n} müşteri uyuyor. Liste, kayıtlar değiştikçe kendiliğinden güncellenir.` : "Bu filtreye uyan müşteri yok."}
      </p>
      <Altlik bekliyor={bekliyor} etiket="Listeyi kaydet" onVazgec={onVazgec} />
    </form>
  );
}
