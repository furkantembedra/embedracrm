"use client";

// Kampanyayı gönder: kitle önizlemesi (kaç kişiye gidecek, kimler neden atlanıyor), deneme gönderimi,
// toplu gönderim ve bu kampanyanın geçmiş gönderimleri.
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import Chip from "@/components/ui/chip";
import { denemeGonder, kampanyayiGonder, kitleOnizleme, type KitleOnizleme } from "./actions";
import type { Gonderim, Kampanya } from "./queries";
import { mesajDoldur } from "./ortak";

const GIRDI = "min-h-11 w-full rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink";
const TUR_ADI: Record<Gonderim["tur"], string> = { elle: "Elle", planli: "Planlı", otomatik: "Otomatik", test: "Deneme" };
const zamanYaz = (z: string) => new Date(z).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function GonderPenceresi({
  kampanya,
  gonderimler,
  onGonderildi,
  onDuzenle,
  onKapat,
}: {
  kampanya: Kampanya;
  gonderimler: Gonderim[];
  onGonderildi: (g: Gonderim) => void;
  onDuzenle: () => void;
  onKapat: () => void;
}) {
  const [onizleme, setOnizleme] = useState<KitleOnizleme | null>(null);
  const [bekliyor, baslat] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Gonderim | null>(null);
  const [onay, setOnay] = useState(false);
  const [kime, setKime] = useState("");
  const [testSonuc, setTestSonuc] = useState<string | null>(null);
  const eposta = kampanya.kanal === "E-posta";
  const m = kampanya.mesaj;
  const mesajVar = !!m?.metin.trim() && (!eposta || !!m.konu.trim());

  useEffect(() => {
    let iptal = false;
    kitleOnizleme(kampanya.id).then((o) => !iptal && setOnizleme(o));
    return () => {
      iptal = true;
    };
  }, [kampanya.id, sonuc]);

  const gonder = () =>
    baslat(async () => {
      const s = await kampanyayiGonder(kampanya.id);
      setOnay(false);
      if (s.hata) setHata(s.hata);
      else if (s.gonderim) {
        setHata(null);
        setSonuc(s.gonderim);
        onGonderildi(s.gonderim);
      }
    });
  const dene = () =>
    baslat(async () => {
      const s = await denemeGonder(kampanya.id, kime);
      setTestSonuc(s.hata ?? (s.gonderim?.demo ? "Demo modu: adres doğrulandı, gerçek gönderim yapılmadı." : "Deneme mesajı gönderildi."));
      if (s.gonderim) onGonderildi(s.gonderim);
    });

  const ornek = onizleme?.ornek?.[0] ?? { ad: "Örnek Oto Elektrik", kisi: "Ali Yılmaz" };
  const gecmis = gonderimler.filter((g) => g.kampanyaId === kampanya.id);

  return (
    <div className="flex flex-col gap-4">
      {onizleme?.demo && (
        <p className="flex items-start gap-2 rounded-control bg-warn-bg px-3 py-2.5 text-[13px] font-semibold text-warn">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          Demo modu: {eposta ? "e-posta (Resend)" : "WhatsApp Cloud API"} anahtarı tanımlı değil. Gönderim kaydedilir ama kimseye mesaj gitmez.
        </p>
      )}

      {/* Kitle */}
      <section aria-label="Alıcılar" className="flex flex-col gap-2 rounded-control border border-line p-3">
        {onizleme === null ? (
          <span className="h-12 animate-pulse rounded-[9px] bg-[#F4F5F0] motion-reduce:animate-none" />
        ) : onizleme.hata ? (
          <span className="text-[13px] font-semibold text-err">{onizleme.hata}</span>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <b className="text-2xl font-extrabold tabular-nums">{onizleme.gonderilecek}</b>
              <span className="text-[13px] font-semibold text-[#474A42]">kişiye gidecek · listede {onizleme.toplam} kişi</span>
            </div>
            {onizleme.atlanan && onizleme.atlanan.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs text-muted">
                {onizleme.atlanan.map((a) => <li key={a.neden}>{a.sayi} kişi atlanıyor: {a.neden}</li>)}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Mesaj */}
      {mesajVar ? (
        <section aria-label="Mesaj önizlemesi" className="rounded-control bg-[#F4F5F0] p-3 text-[13px]">
          <div className="flex items-center gap-2">
            <b className="text-xs text-muted">Önizleme · {ornek.kisi || "—"}, {ornek.ad}</b>
            <button type="button" onClick={onDuzenle} className="ml-auto text-xs font-bold text-info hover:underline">Mesajı düzenle</button>
          </div>
          {eposta && <p className="mt-1 font-bold">{mesajDoldur(m!.konu, ornek)}</p>}
          <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-[#474A42]">{mesajDoldur(m!.metin, ornek)}</p>
          {!eposta && <p className="mt-2 text-[11px] text-muted">Şablon: <span className="font-mono">{m!.sablon || "— (girilmemiş)"}</span></p>}
        </section>
      ) : (
        <p className="rounded-control bg-warn-bg px-3 py-2.5 text-[13px] font-semibold text-warn">
          Bu kampanyanın {eposta ? "konusu ya da metni" : "metni"} yazılmamış.{" "}
          <button type="button" onClick={onDuzenle} className="underline">Mesajı yaz</button>
        </p>
      )}

      {/* Deneme */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deneme-adres" className="text-[13px] font-bold">Önce kendinize deneme gönderin</label>
        <div className="flex gap-2">
          <input id="deneme-adres" value={kime} onChange={(e) => setKime(e.target.value)} inputMode={eposta ? "email" : "tel"} placeholder={eposta ? "siz@embedra.com" : "+90 532 000 00 00"} className={GIRDI} />
          <button type="button" onClick={dene} disabled={bekliyor || !kime.trim() || !mesajVar} className="min-h-11 flex-none cursor-pointer rounded-control border border-line-strong bg-card px-4 text-sm font-bold hover:bg-[#F4F5F0] disabled:cursor-not-allowed disabled:opacity-50">
            Deneme gönder
          </button>
        </div>
        {testSonuc && <span className="text-xs font-semibold text-[#474A42]" aria-live="polite">{testSonuc}</span>}
      </div>

      {sonuc && (
        <p className="flex items-start gap-2 rounded-control bg-ok-bg px-3 py-2.5 text-[13px] font-semibold" role="status">
          <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          {sonuc.basarili} kişiye {sonuc.demo ? "gönderildi (demo, gerçek mesaj gitmedi)" : "gönderildi"}
          {sonuc.hatali ? ` · ${sonuc.hatali} hatalı` : ""}.
        </p>
      )}
      {hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{hata}</p>}

      {/* Geçmiş */}
      {gecmis.length > 0 && (
        <section aria-label="Gönderim geçmişi" className="flex flex-col gap-1.5">
          <b className="text-[13px]">Gönderim geçmişi</b>
          <ul className="flex flex-col divide-y divide-bg rounded-control border border-line">
            {gecmis.slice(0, 8).map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                <span className="font-semibold tabular-nums">{zamanYaz(g.zaman)}</span>
                <Chip ton={g.tur === "test" ? "gray" : g.tur === "elle" ? "ink" : "info"}>{TUR_ADI[g.tur]}</Chip>
                {g.demo && <Chip ton="warn">Demo</Chip>}
                <span className="ml-auto tabular-nums text-[#474A42]">
                  {g.basarili} gönderildi{g.hatali ? ` · ${g.hatali} hata` : ""}{g.atlanan ? ` · ${g.atlanan} atlandı` : ""}
                </span>
                {g.hatalar.length > 0 && <span className="w-full text-[11px] text-err">{g.hatalar.join(" · ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-end gap-2 bg-card px-5 py-4">
        {onay && <span className="mr-auto text-[13px] font-bold text-warn">{onizleme?.gonderilecek} kişiye gönderilsin mi? Geri alınamaz.</span>}
        <button type="button" onClick={onay ? () => setOnay(false) : onKapat} className="min-h-11 cursor-pointer rounded-control border border-line-strong px-4 text-sm font-bold hover:bg-[#F4F5F0]">
          {onay ? "Vazgeç" : "Kapat"}
        </button>
        <button
          type="button"
          onClick={onay ? gonder : () => setOnay(true)}
          disabled={bekliyor || !mesajVar || !onizleme?.gonderilecek || kampanya.durum === "Tamamlandı"}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} aria-hidden="true" />
          {bekliyor ? "Gönderiliyor…" : onay ? "Evet, gönder" : `${onizleme?.gonderilecek ?? ""} kişiye gönder`}
        </button>
      </div>
    </div>
  );
}
