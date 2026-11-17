// Sipariş iptali: CRM (Sipariş & Sevkiyat) ve bayi portalı aynı kuralı kullanır. Yalnızca sunucuda import edin.
// Kargodan önce iptal edilebilir. Atanmış seri numaraları depo havuzuna döner ve bu siparişe açılmış (henüz kullanılmamış)
// cihaz kayıtları silinir; ödemesi alınmış siparişte "ödeme iadesi gerekir" notu düşülür. İptal edilen sipariş gelir,
// stok ihtiyacı ve açık sipariş listelerine girmez; lisans ataması varsa ilgili yenileme talebi "Sipariş yok"a döner.
import { cihazSilDepo, getCihaz } from "@/components/cihaz-lisans/queries";
import { havuzaGeriKoy } from "@/components/operasyon/queries";
import { getSiparis, siparisiGuncelle, type Siparis } from "./queries";
import { iptalEdilebilir } from "./ortak";

export async function siparisiIptalEt(id: string, neden: string, kim: "embedra" | "bayi", zaman: string): Promise<{ hata?: string; siparis?: Siparis }> {
  const s = await getSiparis(id);
  if (!s) return { hata: "Sipariş bulunamadı." };
  if (!iptalEdilebilir(s)) return { hata: s.durum === "iptal" ? "Sipariş zaten iptal edilmiş." : "Kargoya verilmiş sipariş iptal edilemez; iade kaydı açın." };
  const n = neden.trim().slice(0, 300);
  if (n.length < 3) return { hata: "İptal nedenini yazın." };

  // Atanmış seriler: cihaz hâlâ bu siparişte ve kullanılmamışsa kaydı silinir, seri depoya döner
  const geri: { seriNo: string; model: "ONE" | "ONE Lite" }[] = [];
  for (const seriNo of s.seriNolar) {
    const c = await getCihaz(seriNo);
    if (c && !c.lisansBitis && (c.bayiId ? c.bayiId === s.bayiId : c.musteriId === s.musteriId)) {
      await cihazSilDepo(seriNo);
      geri.push({ seriNo, model: c.model });
    }
  }
  if (geri.length) await havuzaGeriKoy(geri);

  const odemeIadesi = s.durum === "hazirlaniyor";
  const g = await siparisiGuncelle(id, (x) => {
    x.durum = "iptal";
    x.iptal = { tarih: zaman, neden: n, kim, odemeIadesi };
    x.seriNolar = x.seriNolar.filter((no) => !geri.some((r) => r.seriNo === no));
    x.notlar.push({
      metin: `Sipariş ${kim === "bayi" ? "bayi tarafından portaldan" : ""} iptal edildi: ${n}.${geri.length ? ` ${geri.length} seri no depoya döndü.` : ""}${odemeIadesi ? " Ödeme alınmıştı: ödeme iadesi yapılmalı." : ""}`.replace("  ", " "),
      zaman, sistem: true,
    });
  });
  return { siparis: g ? structuredClone(g) : undefined };
}
