// Abonelikten çıkma (kampanya e-postalarının altındaki bağlantı)
//   GET  /api/abonelik?t=<jeton>  → onay sayfası (e-posta tarayıcıları bağlantıyı açınca kişi yanlışlıkla çıkmasın diye)
//   POST /api/abonelik?t=<jeton>  → izni geri çeker. E-posta uygulamalarının "tek tıkla abonelikten çık" düğmesi de bunu çağırır.
// Jeton imzalıdır (lib/abonelik.ts); başkası adına uydurulamaz. Bu adres giriş gerektirmez.
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { abonelikCoz } from "@/lib/abonelik";
import { abonelikIptal } from "@/components/pazarlama/gonderim";

const sayfa = (baslik: string, govde: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${baslik}</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#F4F5F0;color:#0E0F0C;margin:0;display:grid;place-items:center;min-height:100vh;padding:16px}
main{background:#fff;border:1px solid #E3E5DE;border-radius:20px;padding:28px;max-width:420px}h1{font-size:20px;margin:0 0 8px}p{color:#474A42;line-height:1.5}
button{min-height:44px;border:0;border-radius:12px;background:#0E0F0C;color:#fff;font-weight:700;padding:0 18px;font-size:15px;cursor:pointer}</style></head>
<body><main>${govde}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const gecersiz = () => sayfa("Bağlantı geçersiz", "<h1>Bağlantı geçersiz</h1><p>Bu bağlantı bozuk ya da eksik kopyalanmış. Abonelikten çıkmak için e-postadaki bağlantıyı yeniden açın.</p>", 400);

export async function GET(istek: NextRequest) {
  const t = istek.nextUrl.searchParams.get("t") ?? "";
  const b = abonelikCoz(t);
  if (!b) return gecersiz();
  const kanal = b.kanal === "eposta" ? "e-posta" : "WhatsApp";
  return sayfa(
    "Abonelikten çık",
    `<h1>Abonelikten çık</h1><p>Embedra'dan ${kanal} ile duyuru ve kampanya mesajı almak istemiyorsanız onaylayın. Sipariş ve destek mesajlarınız etkilenmez.</p>
<form method="post" action="?t=${encodeURIComponent(t)}"><button type="submit">Abonelikten çık</button></form>`,
  );
}

export async function POST(istek: NextRequest) {
  const b = abonelikCoz(istek.nextUrl.searchParams.get("t") ?? "");
  if (!b) return gecersiz();
  await abonelikIptal(b);
  revalidatePath("/pazarlama");
  revalidatePath("/musteriler");
  return sayfa("Abonelikten çıktınız", "<h1>Abonelikten çıktınız</h1><p>Bundan sonra kampanya mesajı göndermeyeceğiz. Fikrinizi değiştirirseniz bize yazmanız yeterli.</p>");
}
