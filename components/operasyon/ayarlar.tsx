"use client";

// Ayarlar & ekip sekmesi: fiyat listesi (satış hattı ve sipariş formları buradan okur), kargo firmaları, ekip
import { useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import Chip from "@/components/ui/chip";
import { CIHAZ_MODELLERI, LISANS_PAKETLERI, URUN_BILGI, type FiyatListesi, type LisansPaketi } from "@/lib/urunler";
import { fiyatListesiKaydet, kargoFirmalariniKaydet, kullaniciKaydet } from "./actions";
import { ROLLER } from "./ortak";
import type { Kullanici, Rol } from "./queries";

const KART = "flex w-full min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-5";
const GIRDI = "min-h-10 w-full rounded-control border border-line-strong bg-card px-3 text-[13px] font-medium outline-none focus:border-ink";
const BIRINCIL = "min-h-10 cursor-pointer rounded-control bg-ink px-4 text-[13px] font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50";
const IKINCIL = "min-h-10 cursor-pointer rounded-control border border-line-strong bg-card px-4 text-[13px] font-bold hover:bg-[#F4F5F0]";

const sayiAl = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));

function Durum({ hata, tamam }: { hata: string | null; tamam: string | null }) {
  if (hata) return <span role="alert" className="text-xs font-semibold text-err">{hata}</span>;
  if (tamam) return <span role="status" className="text-xs font-semibold text-ok">{tamam}</span>;
  return null;
}

/* ---------- Fiyat listesi ---------- */

export function FiyatListesiAyari({
  fiyat,
  aksesuarlar,
  onKaydedildi,
}: {
  fiyat: FiyatListesi;
  aksesuarlar: { kod: string; ad: string; fiyat: number }[];
  onKaydedildi: (f: FiyatListesi, aksesuar: Record<string, number>) => void;
}) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);
  // Metin olarak tutulur ki kullanıcı yazarken alan boşalabilsin; kaydederken sayıya çevrilir
  const [cihaz, setCihaz] = useState(() => Object.fromEntries(CIHAZ_MODELLERI.map((m) => [m, String(fiyat.cihaz[m])])));
  const [lisans, setLisans] = useState(() =>
    Object.fromEntries(Object.entries(fiyat.lisans).map(([k, v]) => [k, { fiyat: v.fiyat === null ? "" : String(v.fiyat), cihaz: v.cihaz === null ? "" : String(v.cihaz) }])),
  );
  const [kdv, setKdv] = useState(String(Math.round(fiyat.kdv * 1000) / 10));
  const [aks, setAks] = useState(() => Object.fromEntries(aksesuarlar.map((a) => [a.kod, String(a.fiyat)])));

  const kaydet = () =>
    baslat(async () => {
      setTamam(null);
      const yeni: FiyatListesi = {
        cihaz: Object.fromEntries(CIHAZ_MODELLERI.map((m) => [m, sayiAl(cihaz[m])])) as FiyatListesi["cihaz"],
        lisans: Object.fromEntries(
          Object.entries(lisans).map(([k, v]) => [k, { fiyat: v.fiyat.trim() ? sayiAl(v.fiyat) : null, cihaz: v.cihaz.trim() ? sayiAl(v.cihaz) : null }]),
        ) as FiyatListesi["lisans"],
        kdv: sayiAl(kdv) / 100,
      };
      const aksesuar = Object.fromEntries(Object.entries(aks).map(([k, v]) => [k, sayiAl(v)]));
      const s = await fiyatListesiKaydet(yeni, aksesuar);
      if (s.hata) setHata(s.hata);
      else if (s.fiyat) {
        setHata(null);
        setTamam("Kaydedildi. Satış hattı ve sipariş formları yeni fiyatları kullanıyor.");
        onKaydedildi(s.fiyat, aksesuar);
      }
    });

  return (
    <section aria-labelledby="fl-baslik" className={KART}>
      <div className="flex flex-col gap-0.5">
        <h2 id="fl-baslik" className="text-[17px] font-extrabold">Fiyat listesi</h2>
        <span className="text-xs font-semibold text-muted">KDV hariç TL · satış hattı ve manuel sipariş tutarları buradan hesaplanır · kayıtlı fırsat ve siparişlerin tutarı değişmez</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {CIHAZ_MODELLERI.map((m) => (
          <label key={m} className="flex flex-col gap-1 text-xs font-bold">
            {URUN_BILGI[m].ad} cihaz
            <input inputMode="numeric" value={cihaz[m]} onChange={(e) => setCihaz({ ...cihaz, [m]: e.target.value })} className={`${GIRDI} tabular-nums`} />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs font-bold">
          KDV oranı (%)
          <input inputMode="decimal" value={kdv} onChange={(e) => setKdv(e.target.value)} className={`${GIRDI} tabular-nums`} />
          <span className="font-normal text-muted">Cihaz ve aksesuara eklenir, lisansa eklenmez</span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold">ONESuite lisans paketleri (yıllık)</span>
        <div className="overflow-x-auto rounded-[14px] border border-line">
          <table className="w-full min-w-[420px] border-collapse text-[13px]">
            <thead className="bg-[#F8F9F5] text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Paket</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Yıllık ücret · boş = özel fiyat</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Kapsadığı cihaz · boş = özel</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(LISANS_PAKETLERI) as LisansPaketi[]).map((p) => (
                <tr key={p} className="border-t border-bg">
                  <th scope="row" className="px-3 py-2 text-left font-bold">{p}</th>
                  <td className="px-3 py-2">
                    <input aria-label={`${p} yıllık ücret`} inputMode="numeric" placeholder="Özel fiyat" value={lisans[p].fiyat} onChange={(e) => setLisans({ ...lisans, [p]: { ...lisans[p], fiyat: e.target.value } })} className={`${GIRDI} tabular-nums`} />
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={`${p} kapsadığı cihaz`} inputMode="numeric" placeholder="Özel" value={lisans[p].cihaz} onChange={(e) => setLisans({ ...lisans, [p]: { ...lisans[p], cihaz: e.target.value } })} className={`${GIRDI} tabular-nums`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aksesuarlar.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold">Aksesuar / yedek kablo</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {aksesuarlar.map((a) => (
              <label key={a.kod} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-[13px]">
                <span className="min-w-0 truncate font-semibold">{a.ad}</span>
                <input aria-label={`${a.ad} fiyatı`} inputMode="numeric" value={aks[a.kod]} onChange={(e) => setAks({ ...aks, [a.kod]: e.target.value })} className={`${GIRDI} tabular-nums`} />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Durum hata={hata} tamam={tamam} />
        <button type="button" onClick={kaydet} disabled={bekliyor} className={`${BIRINCIL} ml-auto`}>{bekliyor ? "Kaydediliyor…" : "Fiyatları kaydet"}</button>
      </div>
    </section>
  );
}

/* ---------- Kargo firmaları ---------- */

export function KargoFirmalariAyari({ firmalar, onKaydedildi }: { firmalar: string[]; onKaydedildi: (l: string[]) => void }) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [yeni, setYeni] = useState("");
  const kaydet = (liste: string[]) =>
    baslat(async () => {
      const s = await kargoFirmalariniKaydet(liste);
      if (s.hata) setHata(s.hata);
      else if (s.kargo) {
        setHata(null);
        setYeni("");
        onKaydedildi(s.kargo);
      }
    });
  return (
    <section aria-labelledby="kf-baslik" className={KART}>
      <div className="flex flex-col gap-0.5">
        <h2 id="kf-baslik" className="text-[17px] font-extrabold">Kargo firmaları</h2>
        <span className="text-xs font-semibold text-muted">Sipariş › Kargoya ver penceresinde seçilir</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {firmalar.map((f) => (
          <li key={f} className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-[#F8F9F5] pl-3 pr-1 text-[13px] font-semibold">
            {f}
            <button type="button" disabled={bekliyor} onClick={() => kaydet(firmalar.filter((x) => x !== f))} aria-label={`${f} firmasını kaldır`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-err">
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (yeni.trim()) kaydet([...firmalar, yeni]);
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="yeni-kargo">Yeni kargo firması</label>
        <input id="yeni-kargo" value={yeni} onChange={(e) => setYeni(e.target.value)} placeholder="Ör. PTT Kargo" maxLength={40} className={GIRDI} />
        <button type="submit" disabled={bekliyor || !yeni.trim()} className={`${BIRINCIL} inline-flex items-center gap-1.5`}>
          <Plus size={16} aria-hidden="true" />
          Ekle
        </button>
      </form>
      <Durum hata={hata} tamam={null} />
    </section>
  );
}

/* ---------- Ekip ---------- */

type Taslak = { id?: string; ad: string; eposta: string; rol: Rol; aktif: boolean };

export function EkipAyari({ ekip, onKaydedildi }: { ekip: Kullanici[]; onKaydedildi: (l: Kullanici[]) => void }) {
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [taslak, setTaslak] = useState<Taslak | null>(null);
  const kaydet = (k: Taslak) =>
    baslat(async () => {
      const s = await kullaniciKaydet(k);
      if (s.hata) setHata(s.hata);
      else if (s.ekip) {
        setHata(null);
        setTaslak(null);
        onKaydedildi(s.ekip);
      }
    });

  const form = taslak && (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        kaydet(taslak);
      }}
      className="flex flex-col gap-3 rounded-[14px] bg-[#F8F9F5] p-3"
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_150px]">
        <label className="flex flex-col gap-1 text-xs font-bold">
          Ad soyad
          <input autoFocus value={taslak.ad} onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })} className={GIRDI} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">
          E-posta
          <input type="email" value={taslak.eposta} onChange={(e) => setTaslak({ ...taslak, eposta: e.target.value })} className={GIRDI} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">
          Rol
          <select value={taslak.rol} onChange={(e) => setTaslak({ ...taslak, rol: e.target.value as Rol })} className={GIRDI}>
            {ROLLER.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] font-semibold">
        <input type="checkbox" checked={taslak.aktif} onChange={(e) => setTaslak({ ...taslak, aktif: e.target.checked })} className="h-4 w-4 accent-[#0E0F0C]" />
        Aktif (giriş yapabilir)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Durum hata={hata} tamam={null} />
        <button type="button" onClick={() => { setTaslak(null); setHata(null); }} className={`${IKINCIL} ml-auto`}>Vazgeç</button>
        <button type="submit" disabled={bekliyor} className={BIRINCIL}>{bekliyor ? "Kaydediliyor…" : "Kaydet"}</button>
      </div>
    </form>
  );

  return (
    <section aria-labelledby="ek-baslik" className={KART}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="ek-baslik" className="text-[17px] font-extrabold">Ekip</h2>
          <span className="text-xs font-semibold text-muted">Kullanıcılar ve rolleri · görev ataması Jira&apos;da · roller giriş sistemi bağlanınca yetkiye dönüşür</span>
        </div>
        {!taslak && (
          <button type="button" onClick={() => setTaslak({ ad: "", eposta: "", rol: "Satış", aktif: true })} className={`${IKINCIL} ml-auto inline-flex items-center gap-1.5`}>
            <Plus size={16} aria-hidden="true" />
            Kullanıcı ekle
          </button>
        )}
      </div>
      {taslak && !taslak.id && form}
      <ul className="flex flex-col gap-2">
        {ekip.map((k) =>
          taslak?.id === k.id ? (
            <li key={k.id}>{form}</li>
          ) : (
            <li key={k.id} className={`flex flex-wrap items-center gap-3 rounded-[14px] border border-line p-3 ${k.aktif ? "" : "opacity-60"}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[13px]">{k.ad}</b>
                <span className="truncate text-xs text-muted">{k.eposta}</span>
              </div>
              <Chip ton={k.rol === "Yönetici" ? "ink" : "gray"}>{k.rol}</Chip>
              {!k.aktif && <Chip ton="warn">Pasif</Chip>}
              <button type="button" onClick={() => { setTaslak({ ...k }); setHata(null); }} aria-label={`${k.ad} düzenle`} title="Düzenle" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-[#474A42] hover:bg-bg">
                <Pencil size={15} aria-hidden="true" />
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
