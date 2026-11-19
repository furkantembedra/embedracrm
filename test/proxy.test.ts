// proxy.ts (lib/supabase/proxy.ts): oturumsuz istek giriş sayfasına yönlenir, API 401 alır, açık yollar geçer.
// Supabase istemcisi sahte: getClaims yalnızca testin verdiği oturumu döner, ağa çıkılmaz.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const durum = { claims: null as { sub: string } | null };
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: durum.claims ? { claims: durum.claims } : null, error: null }) } }),
}));

const { proxy } = await import("@/proxy");
const istek = (yol: string) => proxy(new NextRequest(new URL(yol, "http://localhost:3000")));

beforeEach(() => void (durum.claims = null));

describe("oturum yoksa", () => {
  it.each([
    ["/musteriler", "/giris?sonra=%2Fmusteriler"],
    ["/satis-hatti/12?sekme=mesaj", "/giris?sonra=%2Fsatis-hatti%2F12%3Fsekme%3Dmesaj"],
    ["/", "/giris"],
    ["/portal", "/portal/giris"],
    ["/portal/cihazlar", "/portal/giris?sonra=%2Fportal%2Fcihazlar"],
  ])("%s → %s", async (yol, hedef) => {
    const y = await istek(yol);
    expect(y.status).toBe(307);
    const konum = new URL(y.headers.get("location")!);
    expect(konum.pathname + konum.search).toBe(hedef);
  });

  it.each(["/api/bayi-dokuman/5", "/api/cihaz-bildirimi-sahte", "/api/whatsapp", "/api/zamanlayici-sahte", "/api/meta", "/api/meta/webhook-sahte", "/api/meta/baska", "/api/konusma", "/api/konusma/isleyici-sahte"])("korumalı API %s 401 döner", async (yol) => {
    const y = await istek(yol);
    expect(y.status).toBe(401);
    expect(await y.json()).toEqual({ ok: false, hata: "Oturum gerekli." });
  });

  it.each(["/giris", "/portal/giris", "/auth/onay", "/api/cihaz-bildirimi", "/api/meta/webhook", "/api/whatsapp/webhook", "/api/abonelik", "/api/kampanya-zamanlayici", "/api/zamanlayici", "/api/konusma/isleyici"])(
    "açık yol %s geçer (kendi doğrulaması var)",
    async (yol) => {
      const y = await istek(yol);
      expect(y.status).toBe(200);
      expect(y.headers.get("x-middleware-next")).toBe("1");
    },
  );
});

describe("oturum varsa", () => {
  it.each(["/musteriler", "/portal/cihazlar", "/api/bayi-dokuman/5"])("%s geçer", async (yol) => {
    durum.claims = { sub: "11111111-1111-4111-8111-111111111111" };
    const y = await istek(yol);
    expect(y.status).toBe(200);
    expect(y.headers.get("x-middleware-next")).toBe("1");
  });
});
