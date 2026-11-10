// Portal sayfalarının ortak veri okuması: oturum yoksa girişe yönlendirir, yalnızca bayinin kendi kayıtlarını döner.
import { redirect } from "next/navigation";
import { getBasvurular, getBayiHareketleri } from "@/components/bayiler/queries";
import { stoktakiSeriler } from "@/components/bayiler/ortak";
import { getCihazlar } from "@/components/cihaz-lisans/queries";
import { getSiparisler } from "@/components/siparisler/queries";
import { portalOturumu } from "./oturum";

export async function bayiVerisi() {
  const o = await portalOturumu();
  if (!o) redirect("/portal/giris");
  const [basvurular, hareketler, cihazlar, siparisler] = await Promise.all([getBasvurular(), getBayiHareketleri(), getCihazlar(), getSiparisler()]);
  return {
    ...o,
    basvuru: basvurular.find((b) => b.id === o.bayi.id) ?? null,
    hareketler: hareketler.filter((h) => h.bayiId === o.bayi.id),
    stokSeriler: stoktakiSeriler(o.bayi.id, hareketler),
    cihazlar: cihazlar.filter((c) => c.bayiId === o.bayi.id),
    siparisler: siparisler.filter((s) => s.bayiId === o.bayi.id),
  };
}

export const tarihTr = (t: string) => new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

/** Bugün ve bugünden n gün sonrası ("2026-11-10") — sayfa bileşeninin dışında hesaplanır */
export function gunler(ileri = 0) {
  const simdi = Date.now();
  return { bugun: new Date(simdi).toISOString().slice(0, 10), ileri: new Date(simdi + ileri * 86_400_000).toISOString().slice(0, 10) };
}
