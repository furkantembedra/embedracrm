// Devir görünümünün saf kuralları (Gelen kutusu ve testler aynı işlevi kullanır).
import { devirSebebiAdi } from "@/components/konusma/devir-sebepleri";
import type { KonusmaDetayi, SistemSatiri } from "./queries";

/** Hangi düğmeler görünür (saf işlev; test edilir) */
export function devirDugmeleri(d: Pick<KonusmaDetayi, "botAktif" | "devirSebebi" | "devralanId">, ben: string) {
  return {
    /** Bot konuşuyorsa, bot devrettiyse ya da konuşma başkasındaysa devralınabilir */
    devral: d.botAktif || !!d.devirSebebi || d.devralanId !== ben,
    botaVer: !d.botAktif,
  };
}

/** Sistem satırının metni (saf işlev; test edilir) */
export function sistemSatiriMetni(o: Pick<SistemSatiri, "tur" | "kaynak" | "kullaniciAd" | "sebep" | "aciklama">): { metin: string; ek: string | null } {
  const kim = o.kullaniciAd ?? "Bir ekip üyesi";
  switch (o.tur) {
    case "devralindi":
      if (o.kaynak === "kanal_disi") return { metin: "CRM dışından (Meta gelen kutusu / telefon) yazıldı; bot sustu", ek: null };
      if (o.kaynak === "cevap") return { metin: `${kim} yazdı ve konuşmayı devraldı; bot sustu`, ek: null };
      return { metin: `${kim} konuşmayı devraldı; bot sustu`, ek: null };
    case "bota_verildi":
      return { metin: `${kim} konuşmayı bota geri verdi`, ek: o.aciklama ? `Bota not: ${o.aciklama}` : null };
    case "bot_devretti":
      return { metin: `Bot devretti: ${devirSebebiAdi(o.sebep)}`, ek: o.aciklama };
  }
}

