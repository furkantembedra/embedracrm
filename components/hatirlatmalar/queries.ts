// Hatırlatmalar: elle eklenenler (fırsat, müşteri, bayi… detayından) + kurallardan otomatik üretilenler.
// Otomatik olanlar saklanmaz, her okumada güncel veriden hesaplanır; yalnızca "tamam / ertelendi" durumları tutulur.
// Şimdilik demo depo (sunucu belleğinde). Supabase bağlanınca supabase.from("reminders" | "reminder_states")…

export type KayitTuru = "firsat" | "teklif" | "siparis" | "musteri" | "bayi" | "rma" | "stok" | "cihaz";
export type Hatirlatma = {
  id: string; // elle: uuid · otomatik: "oto:<kural>:<kayıt>…"
  baslik: string;
  aciklama: string;
  kayit: { tur: KayitTuru; id: string; ad: string; href: string } | null;
  sorumluId: string; // Operasyon › Ekip kullanıcısı
  zaman: string; // "2026-11-10T09:00" (yerel)
  durum: "bekliyor" | "tamam";
  otomatik: boolean;
  onem: "normal" | "yuksek";
  tamamlanma?: string | null;
};

export type OtoDurum = { tamam?: string; ertelendi?: string }; // ertelendi: yeni zaman

/** Oturum açma henüz yok: aktif kullanıcı Operasyon › Ekip'teki ilk yönetici (u1). Admin paneline taşınınca oturumdan gelir. */
export const AKTIF_KULLANICI_ID = "u1";

const DEMO: Hatirlatma[] = [
  {
    id: "h-demo-1", baslik: "Nordic Steering · indirim onayı için ara", aciklama: "Satın alma müdürü Erik'e 2 yıllık yenileme indirimi.",
    kayit: { tur: "firsat", id: "f9", ad: "Nordic Steering AB", href: "/satis-hatti" }, sorumluId: "u2", zaman: "2026-11-10T10:30",
    durum: "bekliyor", otomatik: false, onem: "normal",
  },
  {
    id: "h-demo-2", baslik: "Hellas Steering sözleşme imzası", aciklama: "Destek taahhüdü maddesi netleşti mi?",
    kayit: { tur: "bayi", id: "hellas", ad: "Hellas Steering Tech", href: "/bayiler" }, sorumluId: "u1", zaman: "2026-11-12T14:00",
    durum: "bekliyor", otomatik: false, onem: "normal",
  },
];

type Depo = { elle: Hatirlatma[]; oto: Record<string, OtoDurum>; okunan: string[] };
const g = globalThis as { __embedraHatirlatma?: Depo };
const DEPO = (g.__embedraHatirlatma ??= { elle: structuredClone(DEMO), oto: {}, okunan: [] });

export async function getElleHatirlatmalar() {
  return DEPO.elle;
}
export async function getOtoDurumlar() {
  return DEPO.oto;
}
export async function getOkunanlar() {
  return new Set(DEPO.okunan);
}

// Aşağıdakiler yalnızca actions.ts'ten çağrılır.
export async function hatirlatmaEkleDepo(h: Hatirlatma) {
  DEPO.elle.unshift(h);
}
export async function elleGuncelle(id: string, f: (h: Hatirlatma) => void) {
  const h = DEPO.elle.find((x) => x.id === id);
  if (h) f(h);
  return h ?? null;
}
export async function otoDurumKaydet(id: string, d: OtoDurum | null) {
  if (d) DEPO.oto[id] = d;
  else delete DEPO.oto[id];
}
export async function okunduIsaretle(ids: string[]) {
  DEPO.okunan = [...new Set([...DEPO.okunan, ...ids])].slice(-500);
}
