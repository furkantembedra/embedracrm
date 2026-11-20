"use server";
// Bot › Ayarlar › Bilgi kaynakları (P2.4b) Server Action'ları. Hepsi yalnızca Yönetici (oturumGerekli; RLS, Storage
// politikası ve SQL işlevi de denetler). Satış ve Pazarlama listeyi sayfada salt okunur görür, eylem çağıramaz.
//
// Akış: (1) dosya sunucuda boyut / tür (sihirli bayt) denetiminden geçer ve özel bucket'a yüklenir; (2) PDF / görsel
// Claude ile, CSV / Excel kodla (sütun eşlemesiyle) metne çevrilir; (3) metin maskelenir ve işaretlenir; taslak
// kaydedilince ham dosya Storage'dan silinir; (4) taslak bota gitmez: Yönetici düzenler, reddeder ya da onaylar;
// onay P2.4'teki sürümlü ayarlara yeni sürüm olarak girer (toplam 40.000 karakter sınırı burada kesin denetlenir).
import { revalidatePath } from "next/cache";
import { oturumGerekli } from "@/lib/oturum";
import { kullaniciNo } from "@/lib/supabase/db";
import { BOT_YONETICI_ROLLERI } from "../erisim";
import { aktifIstemAyari } from "../veri";
import { kisiselVeriBul, type BilgiKaynagi } from "../ayar-surumu";
import { AZAMI_TASLAK, csvMetni, dosyaDenetle, excelOku, HEDEFLER, type DosyaTuru } from "./dosya";
import { claudeIleCikar } from "./cikarim";
import { kaynakMetniHazirla } from "./maskele";
import { kaynakSiniri, sinirMetni } from "./sinir";
import { csvAyristir, onizleme, tabloKur, tablodanMetin, type Tablo, type TabloOnizleme } from "./tablo";
import {
  dosyaIndir, dosyaSil, dosyaYukle, kaynakDurumuYaz, kaynakEkle, kaynakGetir, taslakYaz, yetimDosyalariTemizle,
} from "./veri";

export type KaynakSonucu = {
  hata?: string;
  duyuru?: string;
  kaynakId?: number;
  /** CSV / Excel: sütun eşleme önizlemesi (dosya Storage'da bekliyor) */
  onizleme?: TabloOnizleme & { sayfa?: string };
  /** Bu işlemdeki Claude çıkarım maliyeti (USD) */
  maliyetUsd?: number;
  /** Onayla açılan ayar sürümü */
  surumNo?: number | null;
  /** Kayıttan sonra (maskelenmiş) taslak metin */
  metin?: string;
};

const kimlikMi = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
const hedefMi = (x: unknown): x is BilgiKaynagi["hedef"] => HEDEFLER.includes(x as BilgiKaynagi["hedef"]);
const tekSatir = (x: unknown, sinir: number) => (typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, sinir) : "");
const yenile = () => revalidatePath("/bot/ayarlar");
const hataMetni = (e: unknown) => (e instanceof Error ? e.message : "Beklenmeyen hata");

async function tabloOku(veri: Uint8Array, tur: DosyaTuru): Promise<Tablo & { kirpildi: boolean; sayfa?: string }> {
  if (tur.girdi === "csv") return tabloKur(csvAyristir(csvMetni(veri)));
  const x = await excelOku(veri);
  return { ...tabloKur(x.satirlar), sayfa: x.sayfa };
}

/** Ham dosyayı siler ve kayıttaki yolu temizler; hata olursa loglar (yetim temizliği sonra yeniden dener) */
async function hamDosyayiKaldir(id: number, yol: string, ek: Parameters<typeof taslakYaz>[1] = {}) {
  try {
    await dosyaSil(yol);
    await taslakYaz(id, { ...ek, dosyaYoluSil: true });
  } catch (e) {
    console.error(`[bot] bilgi kaynağı ${id}: ham dosya silinemedi (${hataMetni(e)}); yetim temizliği yeniden deneyecek`);
    if (ek.durum || ek.maliyetEkle) await taslakYaz(id, { durum: ek.durum, maliyetEkle: ek.maliyetEkle }).catch(() => {});
  }
}

/**
 * Yeni kaynak. FormData: baslik, hedef, tur ("dosya" | "metin"), dosya (File) ya da metin.
 * PDF / görsel hemen metne çevrilir; CSV / Excel için sütun eşleme önizlemesi döner (eslemeyiUygula ile devam).
 */
export async function kaynakYukle(form: FormData): Promise<KaynakSonucu> {
  const k = await oturumGerekli(BOT_YONETICI_ROLLERI);
  const kullanici = k ? kullaniciNo(k.id) : null;
  await yetimDosyalariTemizle().catch((e) => console.error(`[bot] yetim dosya temizliği: ${hataMetni(e)}`));

  const hedef = form.get("hedef");
  if (!hedefMi(hedef)) return { hata: "Hedef alanı seçin." };
  const tur = form.get("tur");

  if (tur === "metin") {
    const ham = typeof form.get("metin") === "string" ? (form.get("metin") as string) : "";
    if (!ham.trim()) return { hata: "Metni yapıştırın." };
    if (ham.length > AZAMI_TASLAK) return { hata: `Metin en çok ${AZAMI_TASLAK.toLocaleString("tr-TR")} karakter olabilir; bölerek ekleyin.` };
    const baslik = tekSatir(form.get("baslik"), 200);
    if (!baslik) return { hata: "Başlık yazın." };
    const h = kaynakMetniHazirla(ham);
    const id = await kaynakEkle({
      baslik, hedef, girdi: "metin", dosyaAdi: null, dosyaTuru: null, dosyaBoyutu: null, dosyaYolu: null,
      metin: h.metin, isaretler: h.isaretler, maskelenen: h.maskelenen, yukleyenId: kullanici,
    });
    yenile();
    return { kaynakId: id, metin: h.metin, duyuru: `Taslak oluşturuldu${h.maskelenen ? `; ${h.maskelenen} kişisel veri maskelendi` : ""}. Kontrol edip onaylayın.` };
  }

  const dosya = form.get("dosya");
  if (tur !== "dosya" || !(dosya instanceof File)) return { hata: "Dosya seçin." };
  const veri = new Uint8Array(await dosya.arrayBuffer());
  const denetim = dosyaDenetle(veri, dosya.name);
  if (!denetim.ok) return { hata: denetim.hata };
  const t = denetim.tur;
  const dosyaAdi = tekSatir(dosya.name, 255) || "dosya";
  const baslik = tekSatir(form.get("baslik"), 200) || dosyaAdi.replace(/\.[a-z0-9]+$/i, "").slice(0, 200);
  const yol = `${crypto.randomUUID()}.${t.girdi === "gorsel" ? (t.mime === "image/png" ? "png" : "jpg") : t.girdi}`;

  // Önce kayıt (yol ile), sonra yükleme: işlem yarıda kalırsa yetim temizliği dosyayı bulur
  const id = await kaynakEkle({
    baslik, hedef, girdi: t.girdi, dosyaAdi, dosyaTuru: t.mime, dosyaBoyutu: veri.byteLength, dosyaYolu: yol,
    metin: "", isaretler: [], maskelenen: 0, yukleyenId: kullanici,
  });
  try {
    await dosyaYukle(yol, veri, t.mime);
  } catch (e) {
    await taslakYaz(id, { dosyaYoluSil: true, durum: "reddedildi" }).catch(() => {});
    yenile();
    return { hata: `Dosya yüklenemedi: ${hataMetni(e)}` };
  }

  if (t.girdi === "csv" || t.girdi === "xlsx") {
    let tablo: Awaited<ReturnType<typeof tabloOku>>;
    try {
      tablo = await tabloOku(veri, t);
    } catch {
      await hamDosyayiKaldir(id, yol, { durum: "reddedildi" });
      yenile();
      return { hata: "Dosya okunamadı: geçerli bir Excel (.xlsx) ya da CSV değil." };
    }
    if (!tablo.basliklar.length || !tablo.satirlar.length) {
      await hamDosyayiKaldir(id, yol, { durum: "reddedildi" });
      yenile();
      return { hata: "Tabloda başlık satırının altında veri yok." };
    }
    yenile();
    return { kaynakId: id, onizleme: { ...onizleme(tablo), sayfa: tablo.sayfa }, duyuru: "Sütunları seçip metne çevirin." };
  }

  // PDF / görsel: Claude ile metne çevir; taslak kaydedilince ham dosya silinir
  const c = await claudeIleCikar(t, veri, hedef);
  if (!c.ok) {
    await hamDosyayiKaldir(id, yol, { durum: "reddedildi", maliyetEkle: c.maliyetUsd });
    yenile();
    return { hata: c.hata, maliyetUsd: c.maliyetUsd };
  }
  const kesik = c.kesik || c.metin.length > AZAMI_TASLAK;
  const h = kaynakMetniHazirla(c.metin.slice(0, AZAMI_TASLAK), kesik);
  await taslakYaz(id, { metin: h.metin, isaretler: h.isaretler, maskelenen: h.maskelenen, maliyetEkle: c.maliyetUsd });
  await hamDosyayiKaldir(id, yol);
  yenile();
  return {
    kaynakId: id, metin: h.metin, maliyetUsd: c.maliyetUsd,
    duyuru: `Metne çevrildi, ham dosya silindi${h.maskelenen ? `; ${h.maskelenen} kişisel veri maskelendi` : ""}. Taslağı kontrol edip onaylayın.`,
  };
}

/** Bekleyen CSV / Excel kaynağının önizlemesi (sayfa yenilenince eşlemeye devam etmek için) */
export async function tabloOnizlemesi(id: number): Promise<KaynakSonucu> {
  await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (!kimlikMi(id)) return { hata: "Kaynak bulunamadı." };
  const k = await kaynakGetir(id);
  if (!k || k.durum !== "taslak" || !k.dosyaYolu || (k.girdi !== "csv" && k.girdi !== "xlsx")) return { hata: "Eşleme bekleyen dosya yok." };
  const veri = await dosyaIndir(k.dosyaYolu);
  if (!veri) return { hata: "Dosya Storage'da bulunamadı; yeniden yükleyin." };
  const t = await tabloOku(veri, { girdi: k.girdi, mime: k.dosyaTuru as DosyaTuru["mime"] });
  return { kaynakId: id, onizleme: { ...onizleme(t), sayfa: t.sayfa } };
}

/** CSV / Excel: seçilen sütunlarla metne çevir, maskele, taslağı kaydet, ham dosyayı sil */
export async function eslemeyiUygula(id: number, dahil: boolean[]): Promise<KaynakSonucu> {
  await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (!kimlikMi(id)) return { hata: "Kaynak bulunamadı." };
  if (!Array.isArray(dahil) || !dahil.some((x) => x === true)) return { hata: "En az bir sütun seçin." };
  const k = await kaynakGetir(id);
  if (!k || k.durum !== "taslak" || !k.dosyaYolu || (k.girdi !== "csv" && k.girdi !== "xlsx")) return { hata: "Eşleme bekleyen dosya yok." };
  const yol = k.dosyaYolu;
  const veri = await dosyaIndir(yol);
  if (!veri) return { hata: "Dosya Storage'da bulunamadı; yeniden yükleyin." };
  const t = await tabloOku(veri, { girdi: k.girdi, mime: k.dosyaTuru as DosyaTuru["mime"] });
  const metin = tablodanMetin(t, t.basliklar.map((_, i) => dahil[i] === true), k.hedef);
  if (!metin.trim()) return { hata: "Seçilen sütunlarda veri yok." };
  if (metin.length > AZAMI_TASLAK) return { hata: `Seçilen sütunlarla metin ${metin.length.toLocaleString("tr-TR")} karakter; sınır ${AZAMI_TASLAK.toLocaleString("tr-TR")}. Daha az sütun seçin ya da dosyayı bölün.` };
  const h = kaynakMetniHazirla(metin);
  await taslakYaz(id, { metin: h.metin, isaretler: h.isaretler, maskelenen: h.maskelenen });
  await hamDosyayiKaldir(id, yol);
  yenile();
  return { kaynakId: id, metin: h.metin, duyuru: `Metne çevrildi, ham dosya silindi${h.maskelenen ? `; ${h.maskelenen} kişisel veri maskelendi` : ""}. Taslağı kontrol edip onaylayın.` };
}

/** Taslağı düzenle (yeniden maskelenir ve işaretlenir; bota gitmez) */
export async function taslagiKaydet(id: number, baslik: string, metin: string): Promise<KaynakSonucu> {
  await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (!kimlikMi(id)) return { hata: "Kaynak bulunamadı." };
  const b = tekSatir(baslik, 200);
  if (!b) return { hata: "Başlık yazın." };
  if (typeof metin !== "string" || !metin.trim()) return { hata: "Taslak boş olamaz; istemiyorsanız reddedin." };
  if (metin.length > AZAMI_TASLAK) return { hata: `Taslak en çok ${AZAMI_TASLAK.toLocaleString("tr-TR")} karakter olabilir.` };
  const k = await kaynakGetir(id);
  if (!k || k.durum !== "taslak" || k.dosyaBekliyor) return { hata: "Yalnızca metne çevrilmiş taslak düzenlenebilir." };
  const h = kaynakMetniHazirla(metin);
  await taslakYaz(id, { baslik: b, metin: h.metin, isaretler: h.isaretler, maskelenen: k.maskelenen + h.maskelenen });
  yenile();
  return { kaynakId: id, metin: h.metin, duyuru: h.maskelenen ? `Kaydedildi; ${h.maskelenen} kişisel veri daha maskelendi.` : "Taslak kaydedildi." };
}

/**
 * Onayla (taslak) ya da yeniden etkinleştir (devre dışı): aktif ayar sürümünden yeni sürüm açılır, kaynak isteme girer.
 * Taslakta baslik / metin verilirse onunla (yeniden maskelenmiş) onaylanır. Toplam sınır aşılırsa onay engellenir.
 */
export async function kaynagiOnayla(id: number, baslik?: string | null, metin?: string | null): Promise<KaynakSonucu> {
  const o = await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (!kimlikMi(id)) return { hata: "Kaynak bulunamadı." };
  const k = await kaynakGetir(id);
  if (!k || (k.durum !== "taslak" && k.durum !== "devre_disi")) return { hata: "Bu kaynak onaylanamaz." };
  if (k.dosyaBekliyor) return { hata: "Önce sütunları seçip metne çevirin." };
  let son = k.metin;
  let b: string | null = null;
  if (k.durum === "taslak" && typeof metin === "string") {
    if (metin.length > AZAMI_TASLAK) return { hata: `Taslak en çok ${AZAMI_TASLAK.toLocaleString("tr-TR")} karakter olabilir.` };
    son = kaynakMetniHazirla(metin).metin;
    b = tekSatir(baslik, 200) || null;
  }
  if (!son.trim()) return { hata: "Boş kaynak onaylanamaz." };
  const satir = kisiselVeriBul(son);
  if (satir) return { hata: `${satir}. satır telefon ya da e-posta gibi görünüyor; kişisel bilgiyi silin.` };
  const aktif = await aktifIstemAyari();
  const sinir = kaynakSiniri(aktif.ayarlar, aktif.kaynaklar, { id, metin: son });
  if (sinir.asim) {
    return { hata: `Onaylanmadı: ${sinirMetni(sinir)}. Taslağı kısaltın ya da başka bir kaynağı devre dışı bırakın.` };
  }
  const surumNo = await kaynakDurumuYaz(id, "onayli", { baslik: b, metin: k.durum === "taslak" ? son : null }, o ? kullaniciNo(o.id) : null);
  console.info(`[bot] bilgi kaynağı ${id} onaylandı (ayar sürümü ${surumNo ?? "değişmedi"})`);
  yenile();
  return { kaynakId: id, surumNo, duyuru: `Onaylandı${surumNo ? `; ayar sürümü ${surumNo} etkin (prompt cache bir kez yenilenir)` : ""}.${sinir.uyari ? ` Uyarı: ${sinirMetni(sinir)}.` : ""}` };
}

/** Taslağı reddet (bota hiç girmez; bekleyen ham dosya varsa silinir) */
export async function kaynagiReddet(id: number): Promise<KaynakSonucu> {
  const o = await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (!kimlikMi(id)) return { hata: "Kaynak bulunamadı." };
  const k = await kaynakGetir(id);
  if (!k || k.durum !== "taslak") return { hata: "Yalnızca taslak reddedilebilir." };
  if (k.dosyaYolu) await hamDosyayiKaldir(id, k.dosyaYolu);
  await kaynakDurumuYaz(id, "reddedildi", {}, o ? kullaniciNo(o.id) : null);
  yenile();
  return { kaynakId: id, duyuru: "Taslak reddedildi." };
}

/** Onaylı kaynağı devre dışı bırak: aktif sürümden çıkarılan yeni sürüm açılır */
export async function kaynagiDevreDisiBirak(id: number): Promise<KaynakSonucu> {
  const o = await oturumGerekli(BOT_YONETICI_ROLLERI);
  if (!kimlikMi(id)) return { hata: "Kaynak bulunamadı." };
  const k = await kaynakGetir(id);
  if (!k || k.durum !== "onayli") return { hata: "Yalnızca onaylı kaynak devre dışı bırakılabilir." };
  const surumNo = await kaynakDurumuYaz(id, "devre_disi", {}, o ? kullaniciNo(o.id) : null);
  console.info(`[bot] bilgi kaynağı ${id} devre dışı (ayar sürümü ${surumNo ?? "değişmedi"})`);
  yenile();
  return { kaynakId: id, surumNo, duyuru: surumNo ? `Devre dışı bırakıldı; ayar sürümü ${surumNo} etkin.` : "Devre dışı bırakıldı (aktif sürümde zaten yoktu)." };
}
