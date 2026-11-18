// İçerik takvimine görsel / video yükleme: POST /api/medya (multipart, alan adı "dosya")
// Yanıt: { id, ad, tur: "gorsel" | "video", boyut }. Dosya /api/medya/<id> adresinden okunur.
// Yükleme oturumdaki kullanıcının yetkisiyle yapılır (Storage RLS: yalnızca CRM ekibi yazabilir).
import { NextResponse, type NextRequest } from "next/server";
import { MEDYA_SINIRI, MEDYA_TIPLERI, medyaKaydet } from "@/components/pazarlama/medya-deposu";

export async function POST(istek: NextRequest) {
  let form: FormData;
  try {
    form = await istek.formData();
  } catch {
    return NextResponse.json({ hata: "Dosya okunamadı." }, { status: 400 });
  }
  const dosya = form.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) return NextResponse.json({ hata: "Dosya seçin." }, { status: 400 });
  if (!MEDYA_TIPLERI.includes(dosya.type)) return NextResponse.json({ hata: "Yalnızca JPG, PNG, WEBP, GIF, MP4, MOV veya WEBM." }, { status: 415 });
  if (dosya.size > MEDYA_SINIRI) return NextResponse.json({ hata: "Dosya en fazla 25 MB olabilir." }, { status: 413 });
  let id: string;
  try {
    id = await medyaKaydet({ ad: dosya.name.slice(0, 120), tip: dosya.type, veri: new Uint8Array(await dosya.arrayBuffer()) });
  } catch (e) {
    console.error("[medya yükleme]", e);
    return NextResponse.json({ hata: "Dosya kaydedilemedi. Oturumunuzu kontrol edip yeniden deneyin." }, { status: 500 });
  }
  return NextResponse.json({ id, ad: dosya.name.slice(0, 120), tur: dosya.type.startsWith("video/") ? "video" : "gorsel", boyut: dosya.size });
}
