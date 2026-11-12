// Otomasyon: kullanıcının yönetim panelinden tanımladığı "şu olursa şunu yap" kuralları ve çalışma geçmişi.
// Şimdilik demo depo (sunucu belleğinde). Supabase bağlanınca supabase.from("automation_rules" | "automation_runs")…
// ile değiştirin; `islenen` için (kural_id, anahtar) üzerinde unique kısıt kullanın (aynı kayıt için iki kez çalışmayı önler).

export type TetikleyiciId =
  | "lisans-bitiyor"
  | "teklif-yanitsiz"
  | "rma-gecikti"
  | "siparis-kargolanmadi"
  | "firsat-hareketsiz"
  | "stok-kritik"
  | "destek-yanitsiz"
  | "cihaz-sessiz";

/** İsteğe bağlı daraltma: boş alan "hepsi" demektir. Hangi alanların işe yaradığı tetikleyiciye göre değişir (ortak.ts › FILTRE_ALANLARI). */
export type KuralFiltresi = { ulke?: string; plan?: string; model?: string };

export type Kural = {
  id: string;
  ad: string;
  aktif: boolean;
  tetikleyici: TetikleyiciId;
  gun: number; // tetikleyicinin gün eşiği (stok-kritik'te kullanılmaz)
  filtre: KuralFiltresi;
  /** Otomatik çalışma güvenlik sınırına takıldıysa nedeni. Kuralı elle "Çalıştır"mak onay sayılır ve bunu temizler. */
  engel: string | null;
  hatirlatma: { sorumluId: string; onem: "normal" | "yuksek" } | null;
  /** Müşteriye e-posta: yalnızca kayıt bir müşteriye bağlıysa ve yetkilinin e-posta izni varsa gönderilir. {firma} {detay} yazılabilir. */
  eposta: { konu: string; metin: string } | null;
  olusturma: string; // ISO
  sonCalisma: string | null; // ISO
};

export type EylemSonucu = { eylem: "hatirlatma" | "eposta"; durum: "yapildi" | "atlandi" | "hata"; ayrinti: string };
export type CalismaKaydi = {
  id: string;
  zaman: string; // ISO
  kuralId: string;
  kuralAd: string;
  kayitAd: string;
  href: string;
  sonuclar: EylemSonucu[];
};

const DEMO: Kural[] = [
  {
    id: "k-lisans-hatirlatma", ad: "Lisans bitmeden satışa görev aç", aktif: true, tetikleyici: "lisans-bitiyor", gun: 45, filtre: {}, engel: null,
    hatirlatma: { sorumluId: "u2", onem: "normal" }, eposta: null, olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
  {
    id: "k-lisans-eposta", ad: "Lisans yenileme e-postası", aktif: false, tetikleyici: "lisans-bitiyor", gun: 30, filtre: {}, engel: null,
    hatirlatma: null,
    eposta: {
      konu: "{firma} · lisansınızın süresi doluyor",
      metin: "Merhaba,\n\n{detay}\n\nKesintisiz kullanım için yenileme teklifimizi iletmek isteriz. Bu e-postayı yanıtlayarak bize ulaşabilirsiniz.\n\nEmbedra Ekibi",
    },
    olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
  {
    id: "k-teklif", ad: "Yanıtsız teklifi takip et", aktif: true, tetikleyici: "teklif-yanitsiz", gun: 5, filtre: {}, engel: null,
    hatirlatma: { sorumluId: "u2", onem: "yuksek" }, eposta: null, olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
  {
    id: "k-rma", ad: "Uzayan RMA'yı destek ekibine bildir", aktif: false, tetikleyici: "rma-gecikti", gun: 5, filtre: {}, engel: null,
    hatirlatma: { sorumluId: "u3", onem: "yuksek" }, eposta: null, olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
  {
    id: "k-stok", ad: "Kritik stokta operasyona haber ver", aktif: false, tetikleyici: "stok-kritik", gun: 0, filtre: {}, engel: null,
    hatirlatma: { sorumluId: "u4", onem: "yuksek" }, eposta: null, olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
  {
    id: "k-sessiz", ad: "Uzun süredir bağlanmayan cihazı destekle kontrol et", aktif: false, tetikleyici: "cihaz-sessiz", gun: 14, filtre: {}, engel: null,
    hatirlatma: { sorumluId: "u3", onem: "normal" }, eposta: null, olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
  {
    id: "k-destek", ad: "Ele alınmayan destek talebini uyar", aktif: false, tetikleyici: "destek-yanitsiz", gun: 1, filtre: {}, engel: null,
    hatirlatma: { sorumluId: "u3", onem: "yuksek" }, eposta: null, olusturma: "2026-11-01T09:00:00.000Z", sonCalisma: null,
  },
];

type Depo = { kurallar: Kural[]; kayitlar: CalismaKaydi[]; islenen: Set<string>; calisiyor: boolean };
const g = globalThis as { __embedraOtomasyon?: Depo };
const DEPO = (g.__embedraOtomasyon ??= { kurallar: structuredClone(DEMO), kayitlar: [], islenen: new Set(), calisiyor: false });

export async function getKurallar() {
  return DEPO.kurallar;
}
export async function getCalismaKayitlari() {
  return DEPO.kayitlar;
}
export async function islendiMi(kuralId: string, anahtar: string) {
  return DEPO.islenen.has(`${kuralId}|${anahtar}`);
}

// Aşağıdakiler yalnızca actions.ts ve motor.ts'ten çağrılır.
export async function kuralKaydet(k: Kural) {
  const i = DEPO.kurallar.findIndex((x) => x.id === k.id);
  if (i >= 0) DEPO.kurallar[i] = k;
  else DEPO.kurallar.unshift(k);
}
export async function kuralGuncelle(id: string, f: (k: Kural) => void) {
  const k = DEPO.kurallar.find((x) => x.id === id);
  if (k) f(k);
  return k ?? null;
}
export async function kuralSil(id: string) {
  DEPO.kurallar = DEPO.kurallar.filter((k) => k.id !== id);
  for (const a of [...DEPO.islenen]) if (a.startsWith(`${id}|`)) DEPO.islenen.delete(a);
}
export async function islendiIsaretle(kuralId: string, anahtar: string) {
  DEPO.islenen.add(`${kuralId}|${anahtar}`);
}
export async function kayitEkle(k: CalismaKaydi) {
  DEPO.kayitlar.unshift(k);
  DEPO.kayitlar.length = Math.min(DEPO.kayitlar.length, 200);
}
/** Aynı anda iki çalıştırma (zamanlayıcı + elle) aynı kaydı ikilemesin. Alındıysa true. */
export async function kilitAl() {
  if (DEPO.calisiyor) return false;
  DEPO.calisiyor = true;
  return true;
}
export async function kilitBirak() {
  DEPO.calisiyor = false;
}
