"use client";

// Müşteri panelindeki "İletişim" bölümü: vergi no (tek değer) ve birden fazla yetkili.
// Ekleme / düzenleme formları panelin içinde açılır; başka sayfaya gidilmez.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Mail, MessageCircle, Pencil, Phone, Plus, ShieldCheck, Star, Trash2 } from "lucide-react";
import Chip from "@/components/ui/chip";
import { useFormGonder } from "@/lib/use-form-gonder";
import {
  birincilYap, vergiNoKaydet, yetkiliKaydet, yetkiliSil,
  type VergiNoDurumu, type YetkiliFormDurumu,
} from "./actions";
import { izinliKanallar, telefonSade } from "./ortak";
import { IZIN_KANAL_ADI } from "./izin";
import IzinPaneli from "./izin-paneli";
import type { Yetkili } from "./queries";

const GIRDI =
  "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink aria-[invalid=true]:border-err";
const ALAN = "flex flex-col gap-1.5 text-xs font-bold";
const IKON_BTN =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[#474A42] transition-colors hover:bg-[#E4E6DF] disabled:opacity-50";
const KUCUK_BIRINCIL = "min-h-10 cursor-pointer rounded-control bg-ink px-4 text-[13px] font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60";
const KUCUK_IKINCIL = "min-h-10 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-[13px] font-bold hover:bg-[#F4F5F0]";

function Hata({ id, mesaj }: { id: string; mesaj?: string }) {
  return mesaj ? <span id={id} className="text-xs font-semibold text-err">{mesaj}</span> : null;
}

export type IletisimDegisikligi = { yetkililer?: Yetkili[]; vergiNo?: string };

export default function MusteriIletisim({
  musteriId,
  yetkililer,
  vergiNo,
  sonTemas,
  onDegisti,
}: {
  musteriId: string;
  yetkililer: Yetkili[];
  vergiNo: string;
  sonTemas: string;
  onDegisti: (d: IletisimDegisikligi) => void;
}) {
  // null: form kapalı · "yeni": yeni yetkili · başka değer: o yetkili düzenleniyor
  const [acikForm, setAcikForm] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<string | null>(null);
  const [acikIzin, setAcikIzin] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();

  function sil(id: string) {
    baslat(async () => {
      onDegisti({ yetkililer: await yetkiliSil(musteriId, id) });
      setSilinecek(null);
    });
  }
  function birincil(id: string) {
    baslat(async () => onDegisti({ yetkililer: await birincilYap(musteriId, id) }));
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-extrabold">İletişim</h3>

      <VergiNoSatiri musteriId={musteriId} vergiNo={vergiNo} onKaydedildi={(v) => onDegisti({ vergiNo: v })} />

      <div className="flex justify-between gap-3 text-[13px]">
        <span className="text-muted">Son temas</span>
        <span className="font-semibold">{sonTemas}</span>
      </div>

      <div className="flex items-center pt-1">
        <h4 className="text-[13px] font-extrabold">
          Yetkililer <span className="font-semibold text-muted">({yetkililer.length})</span>
        </h4>
        {acikForm !== "yeni" && (
          <button
            type="button"
            onClick={() => setAcikForm("yeni")}
            className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-[10px] px-2 text-xs font-bold text-info hover:bg-info-bg"
          >
            <Plus size={14} aria-hidden="true" />
            Yetkili ekle
          </button>
        )}
      </div>

      {yetkililer.length === 0 && acikForm !== "yeni" && (
        <p className="rounded-[14px] border border-dashed border-line-strong p-4 text-center text-[13px] text-muted">
          Henüz yetkili eklenmedi.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {yetkililer.map((y, i) =>
          acikForm === y.id ? (
            <li key={y.id}>
              <YetkiliFormu
                musteriId={musteriId}
                yetkili={y}
                onKaydedildi={(l) => {
                  onDegisti({ yetkililer: l });
                  setAcikForm(null);
                }}
                onVazgec={() => setAcikForm(null)}
              />
            </li>
          ) : (
            <li key={y.id} className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <b className="text-[13px]">{y.ad}</b>
                    {i === 0 && yetkililer.length > 1 && <Chip ton="lime">Birincil</Chip>}
                  </span>
                  {y.unvan && <span className="text-xs text-muted">{y.unvan}</span>}
                </div>
                {i > 0 && (
                  <button type="button" disabled={bekliyor} onClick={() => birincil(y.id)} aria-label={`${y.ad} birincil yetkili yap`} title="Birincil yap" className={IKON_BTN}>
                    <Star size={15} aria-hidden="true" />
                  </button>
                )}
                <button type="button" onClick={() => setAcikForm(y.id)} aria-label={`${y.ad} düzenle`} title="Düzenle" className={IKON_BTN}>
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setSilinecek(y.id)} aria-label={`${y.ad} sil`} title="Sil" className={`${IKON_BTN} hover:text-err`}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-col gap-1 text-[13px]">
                {y.telefon && (
                  <span className="flex items-center gap-2">
                    <a href={`tel:${telefonSade(y.telefon)}`} className="inline-flex min-w-0 items-center gap-1.5 font-semibold tabular-nums hover:underline">
                      <Phone size={14} aria-hidden="true" className="shrink-0 text-muted" />
                      {y.telefon}
                    </a>
                    <a
                      href={`https://wa.me/${telefonSade(y.telefon).replace("+", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${y.ad} WhatsApp`}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-ok hover:underline"
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      WhatsApp
                    </a>
                  </span>
                )}
                {y.eposta && (
                  <a href={`mailto:${y.eposta}`} className="inline-flex min-w-0 items-center gap-1.5 font-semibold hover:underline">
                    <Mail size={14} aria-hidden="true" className="shrink-0 text-muted" />
                    <span className="truncate">{y.eposta}</span>
                  </a>
                )}
              </div>

              {acikIzin === y.id ? (
                <IzinPaneli
                  musteriId={musteriId}
                  yetkili={y}
                  onKaydedildi={(l) => {
                    onDegisti({ yetkililer: l });
                    setAcikIzin(null);
                  }}
                  onVazgec={() => setAcikIzin(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {izinliKanallar(y).length ? (
                    izinliKanallar(y).map((k) => <Chip key={k} ton="ok" className="h-5 px-2 text-[11px]">{IZIN_KANAL_ADI[k]} izni</Chip>)
                  ) : (
                    <span className="text-xs text-muted">Duyuru izni yok</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setAcikIzin(y.id)}
                    className="ml-auto inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-[10px] px-2 text-xs font-bold text-info hover:bg-info-bg"
                  >
                    <ShieldCheck size={14} aria-hidden="true" />
                    İzinler
                  </button>
                </div>
              )}

              {silinecek === y.id && (
                <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-err-bg p-2.5 text-xs font-semibold text-err">
                  {y.ad} silinsin mi?
                  <button type="button" onClick={() => setSilinecek(null)} className="ml-auto min-h-9 cursor-pointer rounded-[10px] bg-card px-3 font-bold text-ink">
                    Vazgeç
                  </button>
                  <button type="button" disabled={bekliyor} onClick={() => sil(y.id)} className="min-h-9 cursor-pointer rounded-[10px] bg-err px-3 font-bold text-white disabled:opacity-60">
                    {bekliyor ? "Siliniyor…" : "Sil"}
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {acikForm === "yeni" && (
        <YetkiliFormu
          musteriId={musteriId}
          onKaydedildi={(l) => {
            onDegisti({ yetkililer: l });
            setAcikForm(null);
          }}
          onVazgec={() => setAcikForm(null)}
        />
      )}
    </section>
  );
}

/* ---------- Vergi no: boşsa "Ekle", doluysa değer + düzenle ---------- */

function VergiNoSatiri({ musteriId, vergiNo, onKaydedildi }: { musteriId: string; vergiNo: string; onKaydedildi: (v: string) => void }) {
  const [duzenle, setDuzenle] = useState(false);
  const [durum, gonder, bekliyor] = useActionState<VergiNoDurumu, FormData>(vergiNoKaydet, {});
  const gonderKorunarak = useFormGonder(gonder);
  const bildirildi = useRef<number | null>(null);

  useEffect(() => {
    if (!durum.vergiNo || !durum.zaman || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman;
    onKaydedildi(durum.vergiNo);
    setDuzenle(false);
  }, [durum, onKaydedildi]);

  if (duzenle) {
    return (
      <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-2 rounded-[14px] bg-[#F4F5F0] p-3">
        <input type="hidden" name="musteriId" value={musteriId} />
        <label className={ALAN}>
          Vergi no
          <input
            name="vergiNo"
            defaultValue={vergiNo}
            autoFocus
            placeholder="Ör. 1234567890"
            className={GIRDI}
            aria-invalid={!!durum.hata}
            aria-describedby="vergi-hata"
          />
          <Hata id="vergi-hata" mesaj={durum.hata} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDuzenle(false)} className={KUCUK_IKINCIL}>Vazgeç</button>
          <button type="submit" disabled={bekliyor} className={KUCUK_BIRINCIL}>{bekliyor ? "Kaydediliyor…" : "Kaydet"}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-muted">Vergi no</span>
      {vergiNo ? (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-semibold tabular-nums">{vergiNo}</span>
          <button type="button" onClick={() => setDuzenle(true)} aria-label="Vergi numarasını düzenle" title="Düzenle" className={IKON_BTN}>
            <Pencil size={14} aria-hidden="true" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setDuzenle(true)}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-[10px] px-2 text-xs font-bold text-info hover:bg-info-bg"
        >
          <Plus size={14} aria-hidden="true" />
          Vergi no ekle
        </button>
      )}
    </div>
  );
}

/* ---------- Yetkili ekleme / düzenleme formu ---------- */

function YetkiliFormu({
  musteriId,
  yetkili,
  onKaydedildi,
  onVazgec,
}: {
  musteriId: string;
  yetkili?: Yetkili; // verilirse düzenleme
  onKaydedildi: (yetkililer: Yetkili[]) => void;
  onVazgec: () => void;
}) {
  const [durum, gonder, bekliyor] = useActionState<YetkiliFormDurumu, FormData>(yetkiliKaydet, {});
  const gonderKorunarak = useFormGonder(gonder); // hata olunca girilenler silinmesin
  const bildirildi = useRef<number | null>(null);
  const h = durum.hatalar ?? {};
  const on = yetkili?.id ?? "yeni";

  useEffect(() => {
    if (!durum.yetkililer || !durum.zaman || bildirildi.current === durum.zaman) return;
    bildirildi.current = durum.zaman;
    onKaydedildi(durum.yetkililer);
  }, [durum, onKaydedildi]);

  return (
    <form onSubmit={gonderKorunarak} noValidate className="flex flex-col gap-3 rounded-[14px] border border-ink bg-[#F8F9F5] p-3">
      <b className="text-[13px]">{yetkili ? "Yetkiliyi düzenle" : "Yeni yetkili"}</b>
      <input type="hidden" name="musteriId" value={musteriId} />
      {yetkili && <input type="hidden" name="yetkiliId" value={yetkili.id} />}
      <div className="grid gap-3">
        <label className={ALAN}>
          Ad soyad *
          <input name="ad" defaultValue={yetkili?.ad} autoFocus className={GIRDI} aria-invalid={!!h.ad} aria-describedby={`${on}-ad`} />
          <Hata id={`${on}-ad`} mesaj={h.ad} />
        </label>
        <label className={ALAN}>
          Ünvan
          <input name="unvan" defaultValue={yetkili?.unvan} placeholder="Ör. Satın alma" className={GIRDI} />
        </label>
        <label className={ALAN}>
          Telefon
          <input name="telefon" type="tel" defaultValue={yetkili?.telefon} placeholder="+90 5xx xxx xx xx" className={GIRDI} aria-invalid={!!h.telefon} aria-describedby={`${on}-tel`} />
          <Hata id={`${on}-tel`} mesaj={h.telefon} />
        </label>
        <label className={ALAN}>
          E-posta
          <input name="eposta" type="email" defaultValue={yetkili?.eposta} className={GIRDI} aria-invalid={!!h.eposta} aria-describedby={`${on}-ep`} />
          <Hata id={`${on}-ep`} mesaj={h.eposta} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onVazgec} className={KUCUK_IKINCIL}>Vazgeç</button>
        <button type="submit" disabled={bekliyor} className={KUCUK_BIRINCIL}>
          {bekliyor ? "Kaydediliyor…" : yetkili ? "Güncelle" : "Yetkiliyi ekle"}
        </button>
      </div>
    </form>
  );
}
