// ONESuite → CRM sürüm bildirimi
//
// ONESuite her açılışta (ve lisans kontrolünde) şunu gönderir:
//   POST /api/cihaz-bildirimi
//   Content-Type: application/json
//   { "seriNo": "EO1-2402-0612", "surum": "v2.4.1", "anahtar": "<cihaza özel anahtar>" }
//
// Yanıt: { "ok": true, "guncelSurum": "v2.4", "guncellemeVar": false }
// ONESuite guncellemeVar true ise kullanıcıya "Yeni sürüm var" diyebilir.
//
// GET /api/cihaz-bildirimi?sonra=<ISO zaman>: açık Cihaz & Lisans sayfası o zamandan sonra
// bildirim gönderen cihazları sorar (canlı güncelleme). TODO: giriş eklenince bunu yalnızca oturumlu yönetici görsün.
//
// Supabase'e geçince aynı mantık bir Edge Function'a taşınabilir; cihaz tarafı değişmez.
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { anahtarDogruMu } from "@/lib/cihaz-anahtari";
import { GUNCEL_FIRMWARE, cihaziGuncelle, getCihaz, getSonBildirenler } from "@/components/cihaz-lisans/queries";

const SERI_NO = /^EO1-\d{4}-\d{4}$/;
const SURUM = /^v\d+\.\d+\.\d+$/;
const BEKLEME_MS = 5_000; // aynı cihazdan 5 sn içinde ikinci bildirim reddedilir

const g = globalThis as { __embedraSonIstek?: Map<string, number> };
const SON_ISTEK = (g.__embedraSonIstek ??= new Map());

const hata = (mesaj: string, status: number) => NextResponse.json({ ok: false, hata: mesaj }, { status });

export async function POST(istek: NextRequest) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return hata("Gövde JSON olmalı.", 400);
  }
  const { seriNo, surum, anahtar } = (govde ?? {}) as Record<string, unknown>;
  if (typeof seriNo !== "string" || !SERI_NO.test(seriNo)) return hata("Geçersiz seri no.", 400);
  if (typeof surum !== "string" || !SURUM.test(surum)) return hata("Sürüm v1.2.3 biçiminde olmalı.", 400);
  if (typeof anahtar !== "string" || !anahtarDogruMu(seriNo, anahtar)) return hata("Anahtar doğrulanamadı.", 401);

  const simdi = Date.now();
  const onceki = SON_ISTEK.get(seriNo);
  if (onceki && simdi - onceki < BEKLEME_MS) return hata("Çok sık bildirim.", 429);
  SON_ISTEK.set(seriNo, simdi);

  if (!(await getCihaz(seriNo))) return hata("Bu seri no CRM'de kayıtlı değil.", 404);

  const zaman = new Date(simdi).toISOString();
  await cihaziGuncelle(seriNo, (c) => ({
    ...c,
    firmware: surum,
    sonGorulme: zaman,
    surumGecmisi:
      c.firmware === surum
        ? c.surumGecmisi ?? []
        : [{ zaman, eski: c.firmware, yeni: surum, kaynak: "cihaz" as const }, ...(c.surumGecmisi ?? [])],
  }));
  // TODO (Supabase): update devices set firmware, last_seen_at; sürüm değiştiyse firmware_history'ye insert

  revalidatePath("/cihaz-lisans");
  revalidatePath(`/cihaz-lisans/${seriNo}`);
  revalidatePath("/musteriler"); // müşteri panelindeki cihaz firmware'i

  return NextResponse.json({ ok: true, guncelSurum: GUNCEL_FIRMWARE, guncellemeVar: !surum.startsWith(GUNCEL_FIRMWARE) });
}

export async function GET(istek: NextRequest) {
  const sonra = istek.nextUrl.searchParams.get("sonra") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(sonra)) return hata("sonra=ISO zaman gerekli.", 400);
  const cihazlar = await getSonBildirenler(sonra);
  return NextResponse.json({
    cihazlar: cihazlar.map((c) => ({ seriNo: c.seriNo, firmware: c.firmware, sonGorulme: c.sonGorulme, surumGecmisi: c.surumGecmisi ?? [] })),
  });
}
