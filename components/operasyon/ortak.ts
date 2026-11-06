// Operasyon bileşenlerinin paylaştığı küçük yardımcılar
import type { ChipTon } from "@/components/ui/chip";
import type { CihazModeli } from "@/lib/urunler";
import type { PartiDurumu, TedarikDurumu } from "./queries";

/** Bir cihaz için harcanan bileşenler (üretime alınınca stoktan düşer). Kablolar sipariş deposundan kutuya girer. */
export const RECETE: Record<CihazModeli, string[]> = {
  ONE: ["PCB-MAIN", "AMOLED", "KASA-ONE", "KUTU"],
  "ONE Lite": ["PCB-MAIN", "KASA-LITE", "KUTU"],
};

export const ROLLER = ["Yönetici", "Satış", "Destek", "Operasyon", "Pazarlama"] as const;

export const PARTI_ADI: Record<PartiDurumu, string> = { planlandi: "Planlandı", uretimde: "Üretimde", kalite: "Kalite kontrol", depoda: "Depoda" };
export const PARTI_TONU: Record<PartiDurumu, ChipTon> = { planlandi: "gray", uretimde: "info", kalite: "warn", depoda: "ok" };
export const PARTI_EYLEMI: Partial<Record<PartiDurumu, string>> = { planlandi: "Üretime al", uretimde: "Kaliteye gönder", kalite: "Depoya al" };

export const TEDARIK_ADI: Record<TedarikDurumu, string> = { siparis: "Sipariş verildi", yolda: "Yolda", teslim: "Teslim alındı" };
export const TEDARIK_TONU: Record<TedarikDurumu, ChipTon> = { siparis: "gray", yolda: "info", teslim: "ok" };

export const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** Bugüne göre kaç gün kaldı (negatif: gecikti). bugun null ise null */
export function gunKaldi(iso: string, bugun: number | null) {
  if (bugun === null) return null;
  return Math.round((new Date(iso + "T00:00:00").getTime() - bugun) / 86_400_000);
}

/* ---------- İç üretim ---------- */

const gunMs = 86_400_000;
const isoMs = (iso: string) => Date.parse(iso + "T00:00:00Z");
export const isoGunEkle = (iso: string, n: number) => new Date(isoMs(iso) + n * gunMs).toISOString().slice(0, 10);
export const isoFark = (a: string, b: string) => Math.round((isoMs(a) - isoMs(b)) / gunMs);

export type IcUretimHali = "bekliyor" | "planda" | "geride" | "gecikti" | "tamam";
export const IC_URETIM_ADI: Record<IcUretimHali, string> = { bekliyor: "Başlamadı", planda: "Planda", geride: "Geride", gecikti: "Süre doldu", tamam: "Tamamlandı" };
export const IC_URETIM_TONU: Record<IcUretimHali, ChipTon> = { bekliyor: "gray", planda: "ok", geride: "warn", gecikti: "err", tamam: "ink" };

type EmirOzeti = { hedef: number; baslangic: string; gun: number; girisler: { tarih: string; adet: number }[] };

/**
 * "10 günde 100 adet" emrinin bugünkü durumu. Gün sonunda giriş yapıldıysa o gün tamamlanmış sayılır:
 * 1. gün 10 adet girildiyse → üretilen 10, kalan 90, kalan gün 9, günlük gereken 10.
 */
export function icUretimDurumu(e: EmirOzeti, bugun: string) {
  const uretilen = e.girisler.reduce((t, g) => t + g.adet, 0);
  const kalan = Math.max(0, e.hedef - uretilen);
  const bitis = isoGunEkle(e.baslangic, e.gun - 1);
  const bugunGirildi = !!bugun && e.girisler.some((g) => g.tarih === bugun);
  const basladi = !!bugun && isoFark(bugun, e.baslangic) >= 0;
  // Biten (girişi yapılmış ya da geçmiş) gün sayısı
  const gecen = !bugun ? 0 : Math.min(e.gun, Math.max(0, isoFark(bugun, e.baslangic) + (bugunGirildi ? 1 : 0)));
  const kalanGun = e.gun - gecen;
  const beklenen = Math.round((e.hedef * gecen) / e.gun);
  const gecikme = bugun ? isoFark(bugun, bitis) + (bugunGirildi ? 0 : 1) : 0; // > 0: süre doldu, bu kadar gün geçti
  const hal: IcUretimHali = kalan === 0 ? "tamam" : !basladi ? "bekliyor" : kalanGun === 0 && gecikme > 0 ? "gecikti" : uretilen < beklenen ? "geride" : "planda";
  return {
    uretilen, kalan, bitis, kalanGun, beklenen, hal,
    fark: uretilen - beklenen, // + önde, - geride
    gunlukHedef: Math.ceil(e.hedef / e.gun),
    gereken: kalanGun > 0 ? Math.ceil(kalan / kalanGun) : kalan, // kalan günlerde günlük üretilmesi gereken
    bugunGirildi,
  };
}

/** Seri no listesini (satır, virgül, boşluk) ayırır, büyük harfe çevirir */
export const seriAyikla = (metin: string) => metin.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
export const SERI_DESENI = /^[A-Z0-9][A-Z0-9-]{3,31}$/;
