"use server";
// Satış Hattı: kaydetme ve güncelleme (Server Actions)
import { ASAMALAR, KAYNAKLAR, type Asama, type Firsat, type Kaynak } from "./queries";

export async function firsatAsamasiGuncelle(id: string, asama: Asama) {
  if (!ASAMALAR.includes(asama)) throw new Error("Geçersiz aşama");
  // TODO: Supabase bağlanınca:
  // await supabase.from("deals").update({ stage: asama }).eq("id", id);
  void id;
}

export type FirsatFormDurumu = { hatalar?: Record<string, string>; firsat?: Firsat };

export async function firsatKaydet(_onceki: FirsatFormDurumu, form: FormData): Promise<FirsatFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const firma = metin("firma");
  const tutar = Number(metin("tutar").replace(/\./g, "").replace(",", "."));
  const kaynak = metin("kaynak");
  const asama = metin("asama");
  const sonrakiTarih = metin("sonrakiTarih");

  const hatalar: Record<string, string> = {};
  if (!firma) hatalar.firma = "Firma adı zorunlu.";
  if (!Number.isFinite(tutar) || tutar <= 0) hatalar.tutar = "Tutarı TL olarak girin (ör. 184000).";
  if (!KAYNAKLAR.includes(kaynak as Kaynak)) hatalar.kaynak = "Kaynak seçin.";
  if (!ASAMALAR.includes(asama as Asama)) hatalar.asama = "Aşama seçin.";
  if (!sonrakiTarih) hatalar.sonrakiTarih = "Sonraki adım için bir tarih girin.";
  if (Object.keys(hatalar).length) return { hatalar };

  const firsat: Firsat = {
    id: crypto.randomUUID(),
    firma,
    konum: metin("konum") || "—",
    kaynak: kaynak as Kaynak,
    icerik: metin("icerik") || "—",
    tutar,
    asama: asama as Asama,
    sonrakiAdim: metin("sonrakiAdim") || "—",
    sonrakiTarih,
  };

  // TODO: Supabase bağlanınca: await supabase.from("deals").insert({ ... }).select().single();

  return { firsat };
}
