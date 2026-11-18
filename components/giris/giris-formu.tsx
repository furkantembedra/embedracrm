"use client";
// E-posta + şifre ile giriş formu (Supabase Auth). CRM (/giris) ve bayi portalı (/portal/giris) ortak kullanır.
// "İlk kez mi?" sekmesi kayıtlı e-postayla şifre belirleyip hesabı etkinleştirir (onay e-postası gider).
import { useActionState, useState } from "react";
import { girisYap, hesapEtkinlestir, type GirisDurumu } from "./actions";

const GIRDI = "min-h-11 min-w-0 rounded-control border border-line-strong bg-card px-3 text-sm font-medium outline-none focus:border-ink";
const ALAN = "flex flex-col gap-1.5 text-[13px] font-bold";

export default function GirisFormu({ alan = "crm", sonra = "" }: { alan?: "crm" | "portal"; sonra?: string }) {
  const [mod, setMod] = useState<"giris" | "etkinlestir">("giris");
  const [girisDurum, giris, girisBekliyor] = useActionState<GirisDurumu, FormData>(girisYap, {});
  const [kayitDurum, kayit, kayitBekliyor] = useActionState<GirisDurumu, FormData>(hesapEtkinlestir, {});
  const durum = mod === "giris" ? girisDurum : kayitDurum;
  const bekliyor = mod === "giris" ? girisBekliyor : kayitBekliyor;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-control bg-bg p-1 text-sm font-bold">
        {(["giris", "etkinlestir"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mod === m}
            onClick={() => setMod(m)}
            className={`min-h-10 cursor-pointer rounded-[10px] ${mod === m ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {m === "giris" ? "Giriş yap" : "İlk kez mi?"}
          </button>
        ))}
      </div>

      <form key={mod} action={mod === "giris" ? giris : kayit} className="flex flex-col gap-4">
        <input type="hidden" name="alan" value={alan} />
        <input type="hidden" name="sonra" value={sonra} />
        <label className={ALAN}>
          E-posta
          <input name="eposta" type="email" autoComplete="username" required autoFocus className={GIRDI} />
        </label>
        <label className={ALAN}>
          {mod === "giris" ? "Şifre" : "Yeni şifre"}
          <input name="sifre" type="password" autoComplete={mod === "giris" ? "current-password" : "new-password"} required minLength={mod === "giris" ? undefined : 8} className={GIRDI} />
        </label>
        {mod === "etkinlestir" && (
          <label className={ALAN}>
            Yeni şifre (tekrar)
            <input name="sifreTekrar" type="password" autoComplete="new-password" required minLength={8} className={GIRDI} />
          </label>
        )}
        {mod === "etkinlestir" && !durum.bilgi && (
          <p className="text-xs text-muted">
            {alan === "portal" ? "Embedra'ya bildirdiğiniz bayi e-postasını" : "Operasyon › Ekip'te kayıtlı e-postanızı"} kullanın. Onay bağlantısı gönderilir.
          </p>
        )}
        {durum.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata}</p>}
        {durum.bilgi && <p role="status" className="rounded-control bg-ok-bg px-3 py-2 text-[13px] font-semibold text-ok">{durum.bilgi}</p>}
        <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
          {mod === "giris" ? (bekliyor ? "Giriş yapılıyor…" : "Giriş yap") : bekliyor ? "Gönderiliyor…" : "Hesabı etkinleştir"}
        </button>
      </form>
    </div>
  );
}
