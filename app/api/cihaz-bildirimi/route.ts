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
// bildirim gönderen cihazları sorar (canlı güncelleme). Oturumdaki kullanıcının istemcisiyle (RLS) okunur.
//
// POST oturumsuz gelir (cihaz): veritabanı işi sistemOlarak() içinde gizli anahtarlı istemciyle yapılır.
// Hız sınırı (5 sn) bellek içinde tutulur: kısa ömürlü, sunucu örneği başına yeterli.
import { crmKullanicisi } from "@/lib/oturum";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { anahtarDogruMu } from "@/lib/cihaz-anahtari";
import { GUNCEL_FIRMWARE, cihaziGuncelle, getSonBildirenler } from "@/components/cihaz-lisans/queries";
import { sistemOlarak } from "@/lib/supabase/db";

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

  const zaman = new Date(simdi).toISOString();
  // cihazlar.c_fw / c_son_gorulme güncellenir; sürüm değiştiyse cihaz_surum_gecmisi'ne eklenir
  const guncel = await sistemOlarak(() =>
    cihaziGuncelle(seriNo, (c) => ({
      ...c,
      firmware: surum,
      sonGorulme: zaman,
      surumGecmisi:
        c.firmware === surum
          ? c.surumGecmisi ?? []
          : [{ zaman, eski: c.firmware, yeni: surum, kaynak: "cihaz" as const }, ...(c.surumGecmisi ?? [])],
    })),
  );
  if (!guncel) return hata("Bu seri no CRM'de kayıtlı değil.", 404);

  revalidatePath("/cihaz-lisans");
  revalidatePath(`/cihaz-lisans/${seriNo}`);
  revalidatePath("/musteriler"); // müşteri panelindeki cihaz firmware'i

  return NextResponse.json({ ok: true, guncelSurum: GUNCEL_FIRMWARE, guncellemeVar: !surum.startsWith(GUNCEL_FIRMWARE) });
}

/** CRM ekranının yeni bildirimleri çekmesi için: yalnızca oturumdaki ekip üyesi (POST cihazın kendi sırrıyla çalışır). */
export async function GET(istek: NextRequest) {
  if (!(await crmKullanicisi())) return hata("Oturum gerekli.", 401);
  const sonra = istek.nextUrl.searchParams.get("sonra") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(sonra)) return hata("sonra=ISO zaman gerekli.", 400);
  const cihazlar = await getSonBildirenler(sonra);
  return NextResponse.json({
    cihazlar: cihazlar.map((c) => ({ seriNo: c.seriNo, firmware: c.firmware, sonGorulme: c.sonGorulme, surumGecmisi: c.surumGecmisi ?? [] })),
  });
}
