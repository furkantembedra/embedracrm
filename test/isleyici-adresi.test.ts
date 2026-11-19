// /api/konusma/isleyici: CRON_SECRET doğrulaması, gizli anahtar kontrolü, işleyicinin gizli anahtarla (sistemOlarak)
// çalışması, hata durumunda içerik sızdırmadan 500. İşleyici sahte; kuralları test/kuyruk.test.ts'te.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const durum = { gizliAnahtar: true, sistemde: false };
const kuyruguIsle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ gizliAnahtarVar: () => durum.gizliAnahtar }));
vi.mock("@/lib/supabase/db", () => ({
  sistemOlarak: async <T>(is: () => Promise<T>) => {
    durum.sistemde = true;
    try {
      return await is();
    } finally {
      durum.sistemde = false;
    }
  },
}));
vi.mock("@/components/konusma/kuyruk", () => ({ kuyruguIsle: (...a: unknown[]) => kuyruguIsle(...a) }));

const { GET, POST, maxDuration } = await import("@/app/api/konusma/isleyici/route");
const SIR = "test-cron-sirri";
const istek = (yetki?: string, yontem = "POST") =>
  new NextRequest("https://crm.ornek.test/api/konusma/isleyici", { method: yontem, headers: yetki === undefined ? {} : { authorization: yetki } });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SIR);
  durum.gizliAnahtar = true;
  kuyruguIsle.mockReset().mockImplementation(async () => {
    expect(durum.sistemde).toBe(true); // oturumsuz: gizli anahtarlı istemciyle
    return { konusma: 2, islenen: 3, hatali: 1, sonuclar: [{ firsatId: "9" }] };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/konusma/isleyici", () => {
  it("yetkisiz isteği reddeder, işleyiciyi çalıştırmaz", async () => {
    for (const y of [undefined, "Bearer yanlis", SIR]) expect((await POST(istek(y))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(istek("Bearer "))).status).toBe(401);
    expect(kuyruguIsle).not.toHaveBeenCalled();
  });

  it("gizli anahtar yoksa 503", async () => {
    durum.gizliAnahtar = false;
    expect((await POST(istek(`Bearer ${SIR}`))).status).toBe(503);
  });

  it("POST (pg_net) ve GET kuyruğu işler; yanıtta yalnızca sayılar var", async () => {
    for (const f of [POST, GET]) {
      const r = await f(istek(`Bearer ${SIR}`));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, konusma: 2, islenen: 3, hatali: 1 });
    }
    expect(maxDuration).toBe(60);
  });

  it("işleyici hata verirse 500, hata metni yanıtta yok", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    kuyruguIsle.mockRejectedValue(new Error("Konuşma kilidi alınırken başarısız: gizli ayrıntı"));
    const r = await POST(istek(`Bearer ${SIR}`));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("gizli ayrıntı");
  });
});
