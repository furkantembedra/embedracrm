// Bayi dokümanını döndürür. ?indir=1 ile dosya olarak iner.
// Portal oturumu varsa yalnızca o bayiye açık dokümanlar verilir. "sozlesme" kimliği oturumdaki bayinin
// sözleşme özetini PDF olarak üretir. Örnek (demo) dokümanların dosyası anında üretilir.
// TODO: CRM'e giriş sistemi gelince CRM tarafı da oturumla kontrol edilmeli (şu an CRM'de giriş yok).
import type { NextRequest } from "next/server";
import { getBasvurular } from "@/components/bayiler/queries";
import { dokumanDosyasi, getDokuman, ornekPdf } from "@/components/bayi-dokumanlar/queries";
import { DOSYA_TIPLERI, hedefteMi } from "@/components/bayi-dokumanlar/ortak";
import { portalOturumu } from "@/components/portal/oturum";

const ayEkle = (t: string, ay: number) => { const d = new Date(t + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + ay); return d.toISOString().slice(0, 10); };

function yanit(veri: Uint8Array, tip: string, ad: string, indir: boolean) {
  return new Response(new Blob([veri as BlobPart], { type: tip }), {
    headers: {
      "Content-Type": tip,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${indir ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(ad)}`,
    },
  });
}

export async function GET(istek: NextRequest, ctx: RouteContext<"/api/bayi-dokuman/[id]">) {
  const { id } = await ctx.params;
  const indir = istek.nextUrl.searchParams.has("indir");
  const oturum = await portalOturumu();

  if (id === "sozlesme") {
    if (!oturum) return new Response("Oturum gerekli", { status: 401 });
    const b = (await getBasvurular()).find((x) => x.id === oturum.bayi.id);
    if (!b) return new Response("Bulunamadı", { status: 404 });
    const s = b.sozlesme;
    const pdf = ornekPdf(`Bayilik sozlesmesi - ${b.sirket}`, [
      `Bayi: ${b.sirket} (${b.yetkili})`, `Vergi no: ${b.vergiNo}`, `Baslangic: ${oturum.bayi.sozlesmeBaslangic ?? b.tarih}   Bitis: ${ayEkle(oturum.bayi.sozlesmeBaslangic ?? b.tarih, oturum.bayi.sozlesmeSureAy ?? 24)} (${oturum.bayi.sozlesmeSureAy ?? 24} ay)`, "",
      `Bolge: ${s.bolge.kapsam}${s.bolge.munhasir ? " (munhasir)" : ""}`,
      `Yillik hedef: ${s.moq.yillik ?? "-"} cihaz   Ilk siparis: ${s.moq.one ?? 0} ONE + ${s.moq.lite ?? 0} ONE LITE`,
      `Bayi iskontosu: %${s.moq.indirim ?? 0}`,
      `Bayinin destek kapsami: ${s.destek.bayi.join(", ") || "-"}`,
      `Marka kiti teslimi: ${s.marka.kitTarihi || "-"}   Logo onayi: ${s.marka.logoOnay ? "var" : "yok"}`, "",
      "Ekler: 1) Bayilik genel kosullari  2) Marka kullanim kilavuzu", "",
      "Bu belge sozlesme ozetidir; imzali asli Embedra'da saklanir.",
    ]);
    return yanit(pdf, "application/pdf", `Sozlesme-${b.id}.pdf`, indir);
  }

  const d = await getDokuman(id);
  if (!d) return new Response("Bulunamadı", { status: 404 });
  if (oturum && !hedefteMi(d.hedef, oturum.bayi.id)) return new Response("Yetkisiz", { status: 403 });
  const dosya = dokumanDosyasi(id);
  if (dosya) {
    const tip = d.mime && d.mime in DOSYA_TIPLERI ? d.mime : "application/octet-stream";
    return yanit(dosya, tip, d.dosyaAdi, indir);
  }
  // Örnek doküman: başlık ve açıklamadan tek sayfalık PDF
  return yanit(ornekPdf(d.baslik, [d.aciklama, "", `Kategori: ${d.kategori}`, `Yayin tarihi: ${d.tarih}`, "", "Bu ornek bir dokumandir. Gercek dosya CRM'den yuklendiginde burada gorunur."]), "application/pdf", d.dosyaAdi, indir);
}
