// Yüklenen içerik görselini / videosunu döndürür. ?indir=1 ile dosya olarak indirilir.
import type { NextRequest } from "next/server";
import { medyaGetir } from "@/components/pazarlama/medya-deposu";

export async function GET(istek: NextRequest, ctx: RouteContext<"/api/medya/[id]">) {
  const { id } = await ctx.params;
  const d = medyaGetir(id);
  if (!d) return new Response("Bulunamadı", { status: 404 });
  const indir = istek.nextUrl.searchParams.has("indir");
  return new Response(new Blob([d.veri as BlobPart], { type: d.tip }), {
    headers: {
      "Content-Type": d.tip,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(indir ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.ad)}` } : {}),
    },
  });
}
