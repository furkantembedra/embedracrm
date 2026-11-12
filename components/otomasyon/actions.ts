"use server";
// Otomasyon (Server Actions). Kurallar yalnızca sunucuda saklanır ve çalışır; ekran bu işlemlerle okur / değiştirir.
import { headers } from "next/headers";
import { getEkip, type Kullanici } from "@/components/operasyon/queries";
import { saglayicilar } from "@/lib/ileti-gonder";
import { eslesmeler, filtreUyar, otomasyonCalistir, type CalismaOzeti } from "./motor";
import { FILTRE_ALANLARI, KURAL_ADI_MAX, TETIKLEYICILER } from "./ortak";
import {
  getCalismaKayitlari, getKurallar, islendiMi, kuralGuncelle, kuralKaydet, kuralSil,
  type CalismaKaydi, type Kural, type KuralFiltresi, type TetikleyiciId,
} from "./queries";

export type KuralOnizleme = { toplam: number; yeni: number; ornekler: string[] };
export type OtomasyonVerisi = {
  kurallar: (Kural & { onizleme: KuralOnizleme })[];
  kayitlar: CalismaKaydi[];
  ekip: Pick<Kullanici, "id" | "ad" | "rol">[];
  epostaSaglayici: string | null;
};

async function onizle(k: Pick<Kural, "id" | "tetikleyici" | "gun" | "filtre">): Promise<KuralOnizleme> {
  const l = (await eslesmeler(k.tetikleyici, k.gun)).filter((e) => filtreUyar(e, k.tetikleyici, k.filtre ?? {}));
  const yeniler: string[] = [];
  for (const e of l) if (!(await islendiMi(k.id, e.anahtar))) yeniler.push(e.kayitAd);
  return { toplam: l.length, yeni: yeniler.length, ornekler: yeniler.slice(0, 3) };
}

export async function otomasyonVerisi(): Promise<OtomasyonVerisi> {
  const [kurallar, kayitlar, ekip] = await Promise.all([getKurallar(), getCalismaKayitlari(), getEkip()]);
  return {
    kurallar: await Promise.all(kurallar.map(async (k) => ({ ...k, onizleme: await onizle(k) }))),
    kayitlar: kayitlar.slice(0, 50),
    ekip: ekip.filter((u) => u.aktif).map(({ id, ad, rol }) => ({ id, ad, rol })),
    epostaSaglayici: saglayicilar().eposta,
  };
}

export type KuralFormDurumu = { hatalar?: Record<string, string>; kural?: Kural; zaman?: number };

export async function kuralFormuKaydet(_o: KuralFormDurumu, form: FormData): Promise<KuralFormDurumu> {
  const metin = (ad: string) => String(form.get(ad) ?? "").trim();
  const ekip = await getEkip();
  const hatalar: Record<string, string> = {};

  const ad = metin("ad");
  if (!ad) hatalar.ad = "Kurala bir ad verin.";
  const tetikleyici = metin("tetikleyici") as TetikleyiciId;
  const tanim = TETIKLEYICILER[tetikleyici];
  if (!tanim) hatalar.tetikleyici = "Tetikleyici seçin.";
  const gun = tanim?.esik ? Number(metin("gun")) : 0;
  if (tanim?.esik && (!Number.isInteger(gun) || gun < 1 || gun > 365)) hatalar.gun = "1 ile 365 arasında bir gün sayısı girin.";

  const filtre: KuralFiltresi = {};
  for (const alan of tanim ? FILTRE_ALANLARI[tetikleyici] : []) {
    const v = metin(`filtre_${alan}`).slice(0, 60);
    if (v) filtre[alan] = v;
  }

  const hatirlatmaAcik = form.get("hatirlatmaAcik") === "on";
  const sorumluId = metin("sorumluId");
  if (hatirlatmaAcik && !ekip.some((u) => u.id === sorumluId && u.aktif)) hatalar.sorumluId = "Sorumlu seçin.";

  const epostaAcik = form.get("epostaAcik") === "on" && !!tanim?.musteriBagli;
  const konu = metin("konu");
  const govde = metin("govde");
  if (epostaAcik && !konu) hatalar.konu = "E-posta konusu yazın.";
  if (epostaAcik && !govde) hatalar.govde = "E-posta metni yazın.";

  if (!hatirlatmaAcik && !epostaAcik) hatalar.eylem = "En az bir eylem seçin (hatırlatma ya da e-posta).";
  if (Object.keys(hatalar).length) return { hatalar };

  const id = metin("id");
  const mevcut = id ? (await getKurallar()).find((k) => k.id === id) : null;
  const kural: Kural = {
    id: mevcut?.id ?? crypto.randomUUID(),
    ad: ad.slice(0, KURAL_ADI_MAX),
    aktif: mevcut?.aktif ?? true,
    tetikleyici,
    gun,
    filtre,
    engel: mevcut?.engel ?? null,
    hatirlatma: hatirlatmaAcik ? { sorumluId, onem: metin("onem") === "yuksek" ? "yuksek" : "normal" } : null,
    eposta: epostaAcik ? { konu: konu.slice(0, 150), metin: govde.slice(0, 2000) } : null,
    olusturma: mevcut?.olusturma ?? new Date().toISOString(),
    sonCalisma: mevcut?.sonCalisma ?? null,
  };
  await kuralKaydet(kural);
  return { kural, zaman: Date.now() };
}

export async function kuralAcKapat(id: string, aktif: boolean) {
  await kuralGuncelle(id, (k) => void (k.aktif = aktif));
}

export async function kuralSilAction(id: string) {
  await kuralSil(id);
}

async function taban() {
  const h = await headers();
  return process.env.SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

/** Tek bir kuralı hemen çalıştırır (pasif olsa bile): yalnızca daha önce işlenmemiş kayıtlara uygulanır. */
export async function kuraliSimdiCalistir(id: string): Promise<{ ozet: CalismaOzeti | null }> {
  return { ozet: await otomasyonCalistir(await taban(), id) };
}

export async function tumKurallariCalistir(): Promise<{ ozet: CalismaOzeti | null }> {
  return { ozet: await otomasyonCalistir(await taban()) };
}
