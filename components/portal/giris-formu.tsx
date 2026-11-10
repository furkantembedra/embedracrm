"use client";

import { useActionState } from "react";
import { girisYap, type PortalFormDurumu } from "./actions";
import { PORTAL_ALAN, PORTAL_GIRDI } from "./stil";

export default function PortalGirisFormu() {
  const [durum, gonder, bekliyor] = useActionState<PortalFormDurumu, FormData>(girisYap, {});
  return (
    <form action={gonder} className="flex flex-col gap-4">
      <label className={PORTAL_ALAN}>
        E-posta
        <input name="eposta" type="email" autoComplete="username" required autoFocus className={PORTAL_GIRDI} />
      </label>
      <label className={PORTAL_ALAN}>
        Şifre
        <input name="sifre" type="password" autoComplete="current-password" required className={PORTAL_GIRDI} />
      </label>
      {durum.hata && <p role="alert" className="rounded-control bg-err-bg px-3 py-2 text-[13px] font-semibold text-err">{durum.hata}</p>}
      <button type="submit" disabled={bekliyor} className="min-h-11 cursor-pointer rounded-control bg-ink px-5 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60">
        {bekliyor ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
