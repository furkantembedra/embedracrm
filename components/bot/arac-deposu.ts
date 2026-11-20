// Bot araçlarının veri erişimi (P2.2). Araçlar (./araclar.ts) yalnızca bu arayüzü kullanır; testler bellek içi bir
// uygulama verir. Değişmez kural 12: her işlem turun konuşmasından çözülen fırsat / müşteriyle sınırlıdır; fırsat ya da
// müşteri kimliği modelden alınmaz. İşleyici gizli anahtarla (sistemOlarak), geliştirme simülasyonu CRM kullanıcısıyla
// çalışır; ikisinde de aynı sorgular.
import { db, sonuc } from "@/lib/supabase/db";
import type { Kanal } from "@/components/konusma/queries";
import { firsatNotuEkle } from "@/components/satis-hatti/queries";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { getEkip, getFiyatListesi } from "@/components/operasyon/queries";
import { devirAlicilari } from "@/components/konusma/devir";
import type { IzinKanali } from "@/components/musteriler/izin";
import type { FiyatListesi } from "@/lib/urunler";
import { telefonNormalize } from "@/components/whatsapp/telefon";
import { leadKartiOku, type LeadKarti } from "./lead-karti";

export type AracKonusmasi = {
  konusmaId: number;
  kanal: Kanal;
  disKullaniciId: string;
  profilAdi: string | null;
  musteriId: number | null;
  firsat: {
    id: number;
    firma: string;
    konum: string | null;
    telefon: string | null;
    musteriId: number | null;
    sorumluId: number | null;
    kart: LeadKarti;
  } | null;
};

export type FirsatYamasi = { firma?: string; konum?: string; telefon?: string };

export interface AracDeposu {
  konusma(konusmaId: number): Promise<AracKonusmasi | null>;
  /** Kartı üst düzey anahtarlarla birleştirir (null değer anahtarı siler); yeni kartı döner */
  kartBirlestir(firsatId: number, yama: Record<string, unknown>): Promise<LeadKarti>;
  firsatGuncelle(firsatId: number, y: FirsatYamasi): Promise<void>;
  /** Telefonu ya da e-postası eşleşen yetkililer */
  yetkiliEslestir(telefon: string | null, eposta: string | null): Promise<{ yetkiliId: number; musteriId: number }[]>;
  /** Fırsatı ve konuşmayı mevcut müşteriye bağlar (yalnızca henüz bağlı değilse) */
  musteriyeBagla(konusmaId: number, firsatId: number, musteriId: number): Promise<void>;
  munhasirBayiler(ulkeKodu: string): Promise<{ bayiId: number; ad: string; kapsam: string | null }[]>;
  firsatNotu(firsatId: number, metin: string): Promise<void>;
  /** Fırsatın sorumlusuna (yoksa Satış rolüne) hatırlatma */
  hatirlatma(h: { firsatId: number; firma: string; konusmaId: number; sorumluId: number | null; baslik: string; aciklama: string }): Promise<void>;
  /** Yetkilinin kanal iznini verildi olarak yazar (tekil: yetkili + kanal) */
  izinYaz(yetkiliId: number, kanal: IzinKanali, kaynak: string, tarih: string): Promise<void>;
  fiyatListesi(): Promise<FiyatListesi>;
}

/** "2026-11-19T14:05" (hatırlatmalar sunucunun yerel saatinde tutulur) */
function simdiYerel(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type KonusmaSatiri = {
  id: number; kanal: Kanal; dis_kullanici_id: string; dis_profil_adi: string | null; musteri_id: number | null;
  firsat: { id: number; f_firma: string; f_konum: string | null; f_telefon: string | null; musteri_id: number | null; sorumlu_id: number | null; lead_karti: unknown } | null;
};

export const supabaseAracDeposu: AracDeposu = {
  async konusma(konusmaId) {
    const s = await db();
    const r = sonuc(
      await s.from("konusmalar")
        .select(`id, kanal, dis_kullanici_id, dis_profil_adi, musteri_id,
          firsat:satis_hatti!konusmalar_satis_hatti_id_fkey(id, f_firma, f_konum, f_telefon, musteri_id, sorumlu_id, lead_karti)`)
        .eq("id", konusmaId).maybeSingle(),
      "Araç için konuşma okunurken",
    ) as unknown as KonusmaSatiri | null;
    if (!r) return null;
    const f = r.firsat;
    return {
      konusmaId: Number(r.id), kanal: r.kanal, disKullaniciId: r.dis_kullanici_id, profilAdi: r.dis_profil_adi,
      musteriId: r.musteri_id != null ? Number(r.musteri_id) : null,
      firsat: f
        ? {
            id: Number(f.id), firma: f.f_firma, konum: f.f_konum, telefon: f.f_telefon,
            musteriId: f.musteri_id != null ? Number(f.musteri_id) : null,
            sorumluId: f.sorumlu_id != null ? Number(f.sorumlu_id) : null,
            kart: leadKartiOku(f.lead_karti),
          }
        : null,
    };
  },

  async kartBirlestir(firsatId, yama) {
    const s = await db();
    const r = sonuc(await s.rpc("lead_karti_birlestir", { p_firsat_id: firsatId, p_yama: yama }), "Lead kartı yazılırken") as unknown;
    return leadKartiOku(r);
  },

  async firsatGuncelle(firsatId, y) {
    const satir: Record<string, unknown> = {};
    if (y.firma !== undefined) satir.f_firma = y.firma;
    if (y.konum !== undefined) satir.f_konum = y.konum;
    if (y.telefon !== undefined) satir.f_telefon = y.telefon;
    if (!Object.keys(satir).length) return;
    satir.f_son_hareket = new Date().toISOString().slice(0, 10);
    const s = await db();
    sonuc(await s.from("satis_hatti").update(satir).eq("id", firsatId), "Fırsat güncellenirken");
  },

  async yetkiliEslestir(telefon, eposta) {
    const s = await db();
    // İşlev normalize telefon bekler (y_tel_normal ile birebir karşılaştırır)
    const t = telefon ? telefonNormalize(telefon) : "";
    const r = (sonuc(await s.rpc("yetkili_eslestir", { p_telefon: t, p_eposta: eposta ?? "" }), "Yetkili eşleştirilirken") ?? []) as {
      yetkili_id: number; musteri_id: number;
    }[];
    return r.map((x) => ({ yetkiliId: Number(x.yetkili_id), musteriId: Number(x.musteri_id) }));
  },

  async musteriyeBagla(konusmaId, firsatId, musteriId) {
    const s = await db();
    sonuc(await s.from("satis_hatti").update({ musteri_id: musteriId }).eq("id", firsatId).is("musteri_id", null), "Fırsat müşteriye bağlanırken");
    sonuc(await s.from("konusmalar").update({ musteri_id: musteriId }).eq("id", konusmaId).is("musteri_id", null), "Konuşma müşteriye bağlanırken");
  },

  async munhasirBayiler(ulkeKodu) {
    const s = await db();
    const r = (sonuc(await s.rpc("munhasir_bayi", { p_ulke_kodu: ulkeKodu }), "Münhasır bayi aranırken") ?? []) as { bayi_id: number; ad: string; kapsam: string | null }[];
    return r.map((x) => ({ bayiId: Number(x.bayi_id), ad: x.ad, kapsam: x.kapsam }));
  },

  firsatNotu: (firsatId, metin) => firsatNotuEkle(firsatId, metin, "bot"),

  async hatirlatma(h) {
    const ekip = await getEkip();
    const alicilar = devirAlicilari(h.sorumluId != null ? `u${h.sorumluId}` : null, ekip);
    const zaman = simdiYerel();
    await Promise.all(alicilar.map((sorumluId) => hatirlatmaEkleDepo({
      id: "",
      baslik: h.baslik.slice(0, 140),
      aciklama: h.aciklama.slice(0, 500),
      kayit: { tur: "firsat", id: String(h.firsatId), ad: h.firma, href: `/bot?k=${h.konusmaId}` },
      sorumluId,
      zaman,
      durum: "bekliyor",
      otomatik: false,
      onem: "normal",
    })));
  },

  async izinYaz(yetkiliId, kanal, kaynak, tarih) {
    const s = await db();
    sonuc(
      await s.from("iletisim_izinleri").upsert(
        { yetkili_id: yetkiliId, i_kanal: kanal, i_verildi: true, i_tarih: tarih, i_kaynak: kaynak, i_cekilme: null },
        { onConflict: "yetkili_id,i_kanal" },
      ),
      "İletişim izni yazılırken",
    );
  },

  fiyatListesi: () => getFiyatListesi(),
};
