// Kuyruktaki bir konuşma işini satış hattına işler. Kanal bilmez (değişmez kural 13): kanalın farkı (lead kaynağı,
// telefon olup olmadığı, görünen ad) konuşmanın kanal adaptöründen gelir (components/konusma/kanallar/).
// Kuyruk işleyicisi (./kuyruk.ts) çağırır; konuşma kilidi elindeyken, işler sırayla.
//
// Müşteri mesajı:
//  1) Kişi eşleştirmesi kanal + kanal hesabı + dış kullanıcı kimliğiyle: konuşmanın bağlı fırsatı hâlâ açıksa mesaj ona eklenir.
//  2) Değilse ve kanal telefon veriyorsa (WhatsApp) aynı telefonlu açık fırsata eklenir.
//  3) Hiçbiri yoksa "Yeni lead" aşamasında, kaynağı kanalın lead kaynağı olan fırsat açılır.
//  Konuşmanın müşterisi ya da telefonu bir müşteri yetkilisine aitse firma adı müşteriden alınır ve mesaj müşterinin
//  zaman çizelgesine de düşer.
// Temsilci mesajı (echo: işletme hesabından CRM dışında yazılmış): konuşmanın fırsatına bağlanır ve "temsilci yazdı"
// kuralı tetiklenir (bot susar).
//
// Tekrar güvenliği: iş yarıda hata verirse kuyruk onu yeniden dener. Fırsat açılır açılmaz konuşmaya bağlanır, böylece
// tekrar denemede (1) yolu aynı fırsatı bulur, ikinci lead açılmaz. Zaman çizelgesi en son yazılır.
import { revalidatePath } from "next/cache";
import { firsatEkleDepo, firsatiGuncelle, getFirsat, KAPALI_ASAMALAR, type Firsat } from "@/components/satis-hatti/queries";
import { getMusteri, musteriyiGuncelle } from "@/components/musteriler/queries";
import { mesajiBagla, temsilciYazdi, type KuyrukIsi, type KuyrukKonusmasi } from "@/components/konusma/queries";
import { db, sonuc as veri } from "@/lib/supabase/db";
import { adaptor } from "./kanallar";

export type IsSonucu = { isId: number; mesajId: number; firsatId: string | null; yeni: boolean };

/** Önbellek yenileme; istek bağlamı dışında (geliştirme zamanlayıcısı) çağrılırsa sessizce geçer */
function yenile(...yollar: string[]) {
  for (const y of yollar) {
    try {
      revalidatePath(y);
    } catch {
      /* istek bağlamı yok */
    }
  }
}

function bugun() {
  // Sonraki adım tarihi sunucunun bugünü (mesaj zamanı gecikmeli gelebilir)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function acikFirsat(s: Awaited<ReturnType<typeof db>>, alan: "id" | "f_telefon_normal", deger: number | string) {
  const r = await s.from("satis_hatti").select("id, asama:asama!satis_hatti_asama_id_fkey!inner(kod)")
    .eq(alan, deger).not("asama.kod", "in", `(${KAPALI_ASAMALAR.join(",")})`)
    .order("id", { ascending: false }).limit(1).maybeSingle();
  return (veri(r, "Açık fırsat aranırken") as { id: number } | null)?.id ?? null;
}

export async function isiIsle(k: KuyrukKonusmasi, is: KuyrukIsi): Promise<IsSonucu> {
  const a = adaptor(k.kanal);
  const s = await db();

  if (is.tur === "temsilci_mesaji") {
    if (k.satisHattiId != null && is.mesaj.satisHattiId == null) {
      await mesajiBagla(k.id, is.mesaj.id, { satisHattiId: k.satisHattiId, musteriId: null });
    }
    await temsilciYazdi(k.id);
    yenile("/satis-hatti");
    return { isId: is.id, mesajId: is.mesaj.id, firsatId: k.satisHattiId == null ? null : String(k.satisHattiId), yeni: false };
  }

  const telefon = a.telefon(k.disKullaniciId);

  // 1) konuşmanın bağlı açık fırsatı, 2) aynı telefonlu açık fırsat
  let acikId = k.satisHattiId != null ? await acikFirsat(s, "id", k.satisHattiId) : null;
  if (acikId === null && telefon) acikId = await acikFirsat(s, "f_telefon_normal", telefon);

  // Müşteri: konuşmaya bağlıysa o, değilse telefonun sahibi yetkili
  let musteriId = k.musteriId;
  if (musteriId == null && telefon) {
    const y = veri(
      await s.from("musteri_yetkilileri").select("musteri_id").eq("y_tel_normal", telefon).order("y_sira").limit(1).maybeSingle(),
      "Müşteri yetkilisi aranırken",
    ) as { musteri_id: number } | null;
    musteriId = y?.musteri_id ?? null;
  }
  const musteri = musteriId != null ? await getMusteri(String(musteriId)) : null;

  // 3) Açık fırsat varsa ona eklenir, yoksa "Yeni lead" açılır
  let firsatId: string;
  const yeni = acikId === null;
  if (!yeni) {
    const f = await firsatiGuncelle(String(acikId), (x) => {
      x.sonrakiAdim = a.sonrakiAdim;
      x.sonrakiTarih = bugun();
    });
    firsatId = f!.id;
  } else {
    const f: Firsat = {
      id: "",
      firma: musteri?.ad ?? (k.profilAdi?.trim() || a.gorunenKimlik(k.disKullaniciId)),
      konum: musteri ? `${musteri.sehir}, ${musteri.ulke}` : telefon?.startsWith("+90") ? "Türkiye" : "—",
      kaynak: a.leadKaynagi,
      icerik: "Ürün belirlenmedi",
      tutar: 0,
      asama: "yeni",
      sonrakiAdim: a.sonrakiAdim,
      sonrakiTarih: bugun(),
      kampanyaId: null,
      ...(telefon ? { telefon } : {}),
    };
    await firsatEkleDepo(f);
    firsatId = f.id;
  }

  // 4) Mesajı fırsata, konuşmayı fırsat / müşteriye bağla (tekrar denemede aynı fırsat bulunsun diye hemen)
  await mesajiBagla(k.id, is.mesaj.id, { satisHattiId: Number(firsatId), musteriId: musteri ? Number(musteri.id) : null });

  // 5) Müşteri zaman çizelgesi
  if (musteri) {
    await musteriyiGuncelle(musteri.id, (x) => {
      x.olaylar.unshift({ metin: `${a.ad}: “${is.mesaj.metin.slice(0, 120)}”`, zaman: `Bugün · ${a.ad}`, tur: "arama" });
      x.sonTemas = "Bugün";
    });
    yenile("/musteriler");
  }
  yenile("/satis-hatti", "/genel-bakis");
  return { isId: is.id, mesajId: is.mesaj.id, firsatId, yeni };
}

/** Simülasyon için: işlenen fırsatı okur */
export const islenenFirsat = (id: string) => getFirsat(id);
