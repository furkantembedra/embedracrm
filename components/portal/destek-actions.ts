"use server";
// Bayi portalı › Destek: talep açma ve talebe mesaj yazma. Talep CRM › Destek'e "Bayi portalı" kanalıyla düşer;
// bayinin temsilcisine ve destek ekibine hatırlatma açılır.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBasvurular } from "@/components/bayiler/queries";
import { getCihaz } from "@/components/cihaz-lisans/queries";
import { KONULAR, getTalep, talebiGuncelle, talepEkle, type Konu, type Oncelik } from "@/components/destek/queries";
import { simdiIso } from "@/components/destek/ortak";
import { hatirlatmaEkleDepo } from "@/components/hatirlatmalar/queries";
import { ONCELIKLER } from "@/lib/constants";
import { portalOturumu } from "./oturum";
import type { PortalFormDurumu } from "./actions";

const DESTEK_EKIBI = "u3"; // Operasyon › Ekip'teki destek sorumlusu

async function oturumGerekli() {
  const o = await portalOturumu();
  if (!o) redirect("/portal/giris");
  return o;
}

function yenile() {
  for (const y of ["/portal/destek", "/destek", "/bayiler"]) revalidatePath(y);
}

export async function portalDestekAc(_o: PortalFormDurumu, form: FormData): Promise<PortalFormDurumu> {
  const { bayi } = await oturumGerekli();
  const al = (k: string) => String(form.get(k) ?? "").trim();
  const konu = al("konu") as Konu, oncelik = al("oncelik") as Oncelik, baslik = al("baslik").slice(0, 120), aciklama = al("aciklama").slice(0, 2000), seriNo = al("seriNo");
  const hatalar: Record<string, string> = {};
  if (!KONULAR.includes(konu)) hatalar.konu = "Konu seçin.";
  if (!(ONCELIKLER as readonly string[]).includes(oncelik)) hatalar.oncelik = "Öncelik seçin.";
  if (baslik.length < 3) hatalar.baslik = "Kısa bir başlık yazın.";
  if (aciklama.length < 10) hatalar.aciklama = "Sorunu birkaç cümleyle anlatın.";
  const cihaz = seriNo ? await getCihaz(seriNo) : null;
  if (seriNo && (!cihaz || cihaz.bayiId !== bayi.id)) hatalar.seriNo = "Bu cihaz bayinize ait değil.";
  if (Object.keys(hatalar).length) return { hatalar };

  const b = (await getBasvurular()).find((x) => x.id === bayi.id);
  const zaman = simdiIso();
  const talep = await talepEkle({
    durum: "yeni", baslik, aciklama, oncelik, konu, kanal: "Bayi portalı", acilis: zaman, dosya: null,
    musteriId: null, musteri: bayi.ad, bayiId: bayi.id,
    yetkili: b?.yetkili ?? "", telefon: b?.telefon ?? "", eposta: b?.eposta ?? "",
    seriNo: cihaz?.seriNo ?? null, plan: cihaz?.plan ?? "—", firmware: cihaz?.firmware ?? "—",
    arac: cihaz?.musteriId ? `Son kullanıcı: ${cihaz.musteri}` : "—",
    notlar: [{ tur: "acilis", metin: "Talep bayi portalından açıldı.", zaman }],
  });
  const kayit = { tur: "destek" as const, id: talep.id, ad: `#${talep.id} · ${bayi.ad}`, href: `/destek/${talep.id}` };
  for (const sorumluId of new Set([DESTEK_EKIBI, bayi.temsilciId ?? "u2"])) {
    await hatirlatmaEkleDepo({
      id: crypto.randomUUID(), baslik: `Bayi destek talebi #${talep.id}: ${baslik}`, aciklama: `${bayi.ad} · ${konu} · ${oncelik}`, kayit,
      sorumluId, zaman, durum: "bekliyor", otomatik: false, onem: oncelik === "Yüksek" ? "yuksek" : "normal",
    });
  }
  yenile();
  return { tamam: `Talebiniz alındı: #${talep.id}. Embedra destek ekibi yanıtladığında burada göreceksiniz.`, zaman: Date.now(), kayitId: talep.id };
}

/** Bayi kendi talebine mesaj yazar; çözülmüş talep yeniden açılır */
export async function portalDestekMesaj(id: string, metin: string): Promise<{ hata?: string }> {
  const { bayi } = await oturumGerekli();
  const m = metin.trim().slice(0, 2000);
  if (m.length < 2) return { hata: "Mesajınızı yazın." };
  const t = await getTalep(id);
  if (!t || t.bayiId !== bayi.id) return { hata: "Talep bulunamadı." };
  const zaman = simdiIso();
  await talebiGuncelle(id, (x) => {
    x.notlar.push({ tur: "bayi", metin: m, zaman });
    if (x.durum === "cozuldu" || x.durum === "beklemede") {
      x.notlar.push({ tur: "yeniden", metin: "Bayinin mesajıyla yeniden açıldı.", zaman });
      x.durum = "islemde";
    }
  });
  yenile();
  return {};
}
