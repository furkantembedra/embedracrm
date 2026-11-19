// Zamanlayıcı adresleri (/api/zamanlayici, /api/kampanya-zamanlayici): CRON_SECRET doğrulaması, gizli anahtar kontrolü,
// kampanya + otomasyonun birlikte ve birbirinden bağımsız çalışması, vercel.json cron tanımı.
// Kampanya ve otomasyon motorları sahte: burada yalnızca adresin davranışı denenir, veritabanına gidilmez.
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const durum = { gizliAnahtar: true };
const kampanya = vi.fn<(taban: string) => Promise<unknown[]>>();
const otomasyon = vi.fn<(taban: string) => Promise<unknown>>();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ gizliAnahtarVar: () => durum.gizliAnahtar, createAdminClient: () => ({ sahte: "admin" }) }));
vi.mock("@/components/pazarlama/gonderim", () => ({ zamanlayiciCalistir: (t: string) => kampanya(t) }));
vi.mock("@/components/otomasyon/motor", () => ({ otomasyonZamanlayici: (t: string) => otomasyon(t) }));

const { GET } = await import("@/app/api/zamanlayici/route");
const { GET: kampanyaGET } = await import("@/app/api/kampanya-zamanlayici/route");
const { cronYetkili } = await import("@/lib/cron");
const { revalidatePath } = await import("next/cache");

const SIR = "test-cron-sirri";
const istek = (yol: string, yetki?: string) =>
  new NextRequest(new URL(yol, "https://crm.ornek.test"), { headers: yetki === undefined ? {} : { authorization: yetki } });
const ozet = { kural: 2, eslesme: 1, yeni: 1, eylem: 1, durdurulan: 0 };

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SIR);
  vi.stubEnv("SITE_URL", "");
  durum.gizliAnahtar = true;
  kampanya.mockReset().mockResolvedValue([]);
  otomasyon.mockReset().mockResolvedValue(ozet);
  vi.mocked(revalidatePath).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("cronYetkili", () => {
  it("yalnızca doğru Bearer başlığını kabul eder", () => {
    expect(cronYetkili(`Bearer ${SIR}`)).toBe(true);
    expect(cronYetkili(`Bearer ${SIR}x`)).toBe(false);
    expect(cronYetkili(SIR)).toBe(false);
    expect(cronYetkili(null)).toBe(false);
  });

  it("CRON_SECRET tanımlı değilse (boş dahil) hiçbir isteği kabul etmez", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(cronYetkili("Bearer ")).toBe(false);
    expect(cronYetkili("Bearer undefined")).toBe(false);
  });
});

describe.each([
  ["/api/zamanlayici", GET],
  ["/api/kampanya-zamanlayici", kampanyaGET],
])("%s", (yol, get) => {
  it.each([undefined, "", "Bearer yanlis", SIR])("yetki %s → 401, iş çalışmaz", async (yetki) => {
    const y = await get(istek(yol, yetki));
    expect(y.status).toBe(401);
    expect(kampanya).not.toHaveBeenCalled();
    expect(otomasyon).not.toHaveBeenCalled();
  });

  it("gizli Supabase anahtarı yoksa 503", async () => {
    durum.gizliAnahtar = false;
    const y = await get(istek(yol, `Bearer ${SIR}`));
    expect(y.status).toBe(503);
    expect(kampanya).not.toHaveBeenCalled();
  });

  it("SITE_URL boşsa istekteki adres, doluysa SITE_URL kullanılır", async () => {
    await get(istek(yol, `Bearer ${SIR}`));
    expect(kampanya).toHaveBeenLastCalledWith("https://crm.ornek.test");
    vi.stubEnv("SITE_URL", "https://crm.embedra.test");
    await get(istek(yol, `Bearer ${SIR}`));
    expect(kampanya).toHaveBeenLastCalledWith("https://crm.embedra.test");
  });
});

describe("/api/zamanlayici", () => {
  const cagir = () => GET(istek("/api/zamanlayici", `Bearer ${SIR}`));

  it("kampanya ve otomasyonu birlikte çalıştırır", async () => {
    kampanya.mockResolvedValue([{}, {}]);
    const y = await cagir();
    expect(y.status).toBe(200);
    expect(await y.json()).toEqual({ ok: true, kampanya: { gonderim: 2 }, otomasyon: ozet });
    expect(otomasyon).toHaveBeenCalledWith("https://crm.ornek.test");
    expect(revalidatePath).toHaveBeenCalledWith("/pazarlama");
  });

  it("gönderim yoksa sayfa yenilenmez; otomasyon kilitliyse null döner", async () => {
    otomasyon.mockResolvedValue(null);
    const y = await cagir();
    expect(await y.json()).toEqual({ ok: true, kampanya: { gonderim: 0 }, otomasyon: null });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("kampanya hata verirse otomasyon yine çalışır, yanıt 500", async () => {
    kampanya.mockRejectedValue(new Error("veritabanı yok"));
    const y = await cagir();
    expect(y.status).toBe(500);
    expect(otomasyon).toHaveBeenCalledOnce();
    expect(await y.json()).toEqual({ ok: false, kampanya: { hata: "Kampanya zamanlayıcısı hata verdi." }, otomasyon: ozet });
  });

  it("otomasyon hata verirse kampanya sonucu yine döner, hata ayrıntısı yanıta sızmaz", async () => {
    kampanya.mockResolvedValue([{}]);
    otomasyon.mockRejectedValue(new Error("gizli ayrıntı"));
    const y = await cagir();
    expect(y.status).toBe(500);
    const govde = await y.json();
    expect(govde).toEqual({ ok: false, kampanya: { gonderim: 1 }, otomasyon: { hata: "Otomasyon zamanlayıcısı hata verdi." } });
    expect(JSON.stringify(govde)).not.toContain("gizli ayrıntı");
  });
});

describe("vercel.json", () => {
  it("cron /api/zamanlayici'yi günde bir kez çağırır (Hobby plan sınırı)", () => {
    const ayar = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(ayar.crons).toEqual([{ path: "/api/zamanlayici", schedule: expect.stringMatching(/^\d{1,2} \d{1,2} \* \* \*$/) }]);
  });
});
