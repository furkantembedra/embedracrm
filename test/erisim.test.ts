// Erişim kuralları (P0.2): CRM oturumu ve rolleri (lib/oturum.ts), rol kısıtlı Server Action'lar, API route'larının
// oturumsuz isteğe 401 dönmesi, bayi satış bildiriminin yalnızca kendi bayisi adına yapılabilmesi ve
// her Server Action'ın oturum kontrolüyle başladığı (statik tarama).
// Supabase istemcisi sahte: oturum ve kullanıcı satırı testin verdiği değerdir, ağa çıkılmaz.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Satir = { id: number; k_ad: string; k_eposta: string; k_rol: string; k_aktif: boolean };
const durum = {
  uid: null as string | null,
  kullanici: null as Satir | null,
  portal: null as { bayi: { id: string; ad: string }; mod: "bayi" | "yonetici" } | null,
};
const ekipUyesi = (k_rol: string, k_aktif = true) => {
  durum.uid = "11111111-1111-4111-8111-111111111111";
  durum.kullanici = { id: 6, k_ad: "Test Kullanıcı", k_eposta: "test@example.com", k_rol, k_aktif };
};

/** createClient yerine: yalnızca oturum (getClaims) ve kullanicilar satırı; başka tabloya gidilirse test düşer */
function sahteIstemci() {
  const zincir = (tablo: string) => {
    if (tablo !== "kullanicilar") throw new Error(`Sahte istemci: beklenmeyen tablo ${tablo}`);
    const z = { select: () => z, eq: () => z, maybeSingle: async () => ({ data: durum.kullanici, error: null }) };
    return z;
  };
  return { auth: { getClaims: async () => ({ data: durum.uid ? { claims: { sub: durum.uid } } : null, error: null }) }, from: zincir };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => sahteIstemci() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ sahte: "admin" }), gizliAnahtarVar: () => true }));
vi.mock("@/components/portal/oturum", () => ({ portalOturumu: async () => durum.portal }));
// Bayi listesi (RLS'li okuma) ve sonraki sorgular: erişim kontrolünü geçen çağrının nereye kadar gittiğini görmek için
const bayiOkundu = vi.fn();
vi.mock("@/components/bayiler/queries", async (asil) => ({
  ...(await asil<object>()),
  getAktifBayiler: async () => (bayiOkundu(), []),
}));
vi.mock("@/components/cihaz-lisans/queries", async (asil) => ({ ...(await asil<object>()), getSonBildirenler: async () => [] }));
vi.mock("@/components/bayi-dokumanlar/queries", async (asil) => ({ ...(await asil<object>()), getDokuman: async () => null }));
vi.mock("@/components/operasyon/queries", async (asil) => ({ ...(await asil<object>()), getEkip: async () => [] }));

// Bot › Gelen kutusu: erişim kontrolünü geçen çağrının veri katmanına ulaştığını görmek için
const botVeri = vi.hoisted(() => ({ cagrilar: [] as string[] }));
vi.mock("@/components/bot/queries", async (asil) => ({
  ...(await asil<object>()),
  gelenKutusu: async () => (botVeri.cagrilar.push("gelenKutusu"), []),
  konusmaDetayi: async () => (botVeri.cagrilar.push("konusmaDetayi"), null),
  okunduYaz: async () => void botVeri.cagrilar.push("okunduYaz"),
  firsatSorumlusuYaz: async () => void botVeri.cagrilar.push("firsatSorumlusuYaz"),
}));
vi.mock("@/components/konusma/gonder", () => ({
  mesajGonder: async (_k: number, _m: string, g: string, kullanici: number | null) => (botVeri.cagrilar.push(`mesajGonder:${g}:${kullanici}`), { ok: true, mesajIdleri: [1], demo: true }),
  sablonGonder: async () => (botVeri.cagrilar.push("sablonGonder"), { ok: true, mesajIdleri: [1], demo: true }),
}));
vi.mock("@/components/konusma/kuyruk", () => ({
  kuyrugaYaz: async () => (botVeri.cagrilar.push("kuyrugaYaz"), []),
  kuyruguIsle: async () => ({ sonuclar: [] }),
}));

const { oturumGerekli, rolEksik } = await import("@/lib/oturum");
const { sistemOlarak } = await import("@/lib/supabase/db");

beforeEach(() => {
  durum.uid = null;
  durum.kullanici = null;
  durum.portal = null;
  bayiOkundu.mockClear();
});

describe("lib/oturum: CRM oturumu ve roller", () => {
  it("oturum yoksa oturumGerekli hata fırlatır", async () => {
    await expect(oturumGerekli()).rejects.toThrow(/Oturum gerekli/);
  });

  it("Supabase hesabı var ama ekipte değilse hata fırlatır", async () => {
    durum.uid = "33333333-3333-4333-8333-333333333333";
    await expect(oturumGerekli()).rejects.toThrow(/Oturum gerekli/);
  });

  it("pasif ekip üyesi giremez", async () => {
    ekipUyesi("Yönetici", false);
    await expect(oturumGerekli()).rejects.toThrow(/Oturum gerekli/);
  });

  it("aktif ekip üyesi döner", async () => {
    ekipUyesi("Destek");
    expect(await oturumGerekli()).toEqual({ id: "u6", ad: "Test Kullanıcı", eposta: "test@example.com", rol: "Destek" });
  });

  it("rol listede yoksa oturumGerekli(roller) hata fırlatır, varsa geçer", async () => {
    ekipUyesi("Destek");
    await expect(oturumGerekli(["Yönetici", "Satış"])).rejects.toThrow("Bu işlem için yetkiniz yok (yalnızca Yönetici / Satış).");
    ekipUyesi("Satış");
    await expect(oturumGerekli(["Yönetici", "Satış"])).resolves.toMatchObject({ rol: "Satış" });
  });

  it("rolEksik: rol yetmezse fırlatmaz, mesaj döner; oturum yoksa yine fırlatır", async () => {
    await expect(rolEksik(["Yönetici"])).rejects.toThrow(/Oturum gerekli/);
    ekipUyesi("Pazarlama");
    expect(await rolEksik(["Yönetici"])).toBe("Bu işlem için yetkiniz yok (yalnızca Yönetici).");
    expect(await rolEksik(["Yönetici", "Pazarlama"])).toBeNull();
  });

  it("sistemOlarak (webhook, zamanlayıcı) içinde oturum aranmaz", async () => {
    expect(await sistemOlarak(() => oturumGerekli(["Yönetici"]))).toBeNull();
  });
});

describe("rol kısıtlı Server Action'lar", () => {
  it("kullanıcı kaydetme yalnızca Yönetici: diğer roller hata ekranı yerine mesaj alır", async () => {
    const { kullaniciKaydet } = await import("@/components/operasyon/actions");
    const k = { ad: "Yeni Kişi", eposta: "yeni@example.com", rol: "Destek", aktif: true };
    await expect(kullaniciKaydet(k)).rejects.toThrow(/Oturum gerekli/);
    for (const rol of ["Satış", "Destek", "Pazarlama"]) {
      ekipUyesi(rol);
      expect(await kullaniciKaydet(k)).toEqual({ hata: "Bu işlem için yetkiniz yok (yalnızca Yönetici)." });
    }
  });

  it("bayi dokümanı yükleme yalnızca Yönetici ve Pazarlama", async () => {
    const { dokumanYukle } = await import("@/components/bayi-dokumanlar/actions");
    ekipUyesi("Satış");
    expect(await dokumanYukle({}, new FormData())).toEqual({ hatalar: { genel: "Bu işlem için yetkiniz yok (yalnızca Yönetici / Pazarlama)." } });
    ekipUyesi("Pazarlama");
    expect((await dokumanYukle({}, new FormData())).hatalar?.genel).toBeUndefined();
  });

  it("bayi portal paneli yalnızca Yönetici ve Satış", async () => {
    const { bayiPortalPaneli } = await import("@/components/bayiler/portal-panel-actions");
    ekipUyesi("Destek");
    await expect(bayiPortalPaneli("1")).rejects.toThrow("yalnızca Yönetici / Satış");
    expect(bayiOkundu).not.toHaveBeenCalled();
    ekipUyesi("Satış");
    expect(await bayiPortalPaneli("1")).toBeNull(); // kontrolü geçti, bayi listesinde yok
    expect(bayiOkundu).toHaveBeenCalled();
  });
});

describe("Bot menüsü (P1.2): Yönetici, Satış, Pazarlama", () => {
  beforeEach(() => void (botVeri.cagrilar.length = 0));

  it("menüyü yalnızca üç rol görür", async () => {
    const { botMenusuGorur } = await import("@/components/bot/erisim");
    expect(["Yönetici", "Satış", "Pazarlama"].every(botMenusuGorur)).toBe(true);
    expect([null, "", "Destek", "Operasyon", "Bayi"].some(botMenusuGorur)).toBe(false);
  });

  it("sayfalar: diğer roller hata ekranı yerine rol mesajı alır; oturum yoksa fırlatır", async () => {
    const { botRolMesaji } = await import("@/components/bot/sayfa");
    await expect(botRolMesaji()).rejects.toThrow(/Oturum gerekli/);
    for (const rol of ["Destek", "Operasyon"]) {
      ekipUyesi(rol);
      expect(await botRolMesaji()).toBe("Bu işlem için yetkiniz yok (yalnızca Yönetici / Satış / Pazarlama).");
    }
    for (const rol of ["Yönetici", "Satış", "Pazarlama"]) {
      ekipUyesi(rol);
      expect(await botRolMesaji()).toBeNull();
    }
  });

  it("gelen kutusu aksiyonları Destek ve Operasyon'u veriye ulaşmadan reddeder", async () => {
    const a = await import("@/components/bot/actions");
    const cagir = [
      () => a.gelenKutusuGetir(), () => a.konusmaGetir(1), () => a.okunduIsaretle(1, 2), () => a.cevapGonder(1, "Merhaba"),
      () => a.sablonlaGonder(1, { ad: "takip", dil: "tr", parametreler: [] }), () => a.sorumluDegistir("1", ""),
    ];
    for (const c of cagir) await expect(c()).rejects.toThrow(/Oturum gerekli/);
    for (const rol of ["Destek", "Operasyon"]) {
      ekipUyesi(rol);
      for (const c of cagir) await expect(c()).rejects.toThrow("yalnızca Yönetici / Satış / Pazarlama");
    }
    expect(botVeri.cagrilar).toEqual([]);
    for (const rol of ["Yönetici", "Satış", "Pazarlama"]) {
      ekipUyesi(rol);
      for (const c of cagir) await c();
    }
    expect(botVeri.cagrilar).toContain("gelenKutusu");
    // Giden mesaj gönderen temsilci ve oturumdaki kullanıcıyla yazılır (ekipUyesi: kullanicilar.id = 6)
    expect(botVeri.cagrilar).toContain("mesajGonder:temsilci:6");
  });

  it("simülasyon yalnızca Yönetici ve yalnızca geliştirmede", async () => {
    const { konusmaSimuleEt } = await import("@/components/bot/actions");
    const { simulasyonAcik } = await import("@/components/bot/erisim");
    const form = new FormData();
    form.set("kanal", "whatsapp");
    form.set("kimlik", "+905321112233");
    form.set("mesaj", "Merhaba");
    for (const rol of ["Satış", "Pazarlama", "Destek"]) {
      ekipUyesi(rol);
      expect(simulasyonAcik(rol)).toBe(false);
      await expect(konusmaSimuleEt({}, form)).rejects.toThrow("yalnızca Yönetici");
    }
    ekipUyesi("Yönetici");
    expect(simulasyonAcik("Yönetici")).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(simulasyonAcik("Yönetici")).toBe(false);
      expect(await konusmaSimuleEt({}, form)).toEqual({ hatalar: { kanal: "Simülasyon yalnızca geliştirme ortamında çalışır." } });
      expect(botVeri.cagrilar).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
    await konusmaSimuleEt({}, form);
    expect(botVeri.cagrilar).toEqual(["kuyrugaYaz"]);
  });
});

describe("bayi satış bildirimi (satisBildir)", () => {
  const form = (bayiId: string) => {
    const f = new FormData();
    f.set("bayiId", bayiId);
    return f;
  };
  const bayi = (id: string) => ({ bayi: { id, ad: `Bayi ${id}` }, mod: "bayi" as const });

  it("oturumsuz çağrı hiçbir şey okumadan reddedilir", async () => {
    const { satisBildir } = await import("@/components/bayiler/hareket-actions");
    await expect(satisBildir({}, form("1"))).rejects.toThrow(/Oturum gerekli/);
    expect(bayiOkundu).not.toHaveBeenCalled();
  });

  it("bayi başka bir bayi adına bildiremez", async () => {
    const { satisBildir } = await import("@/components/bayiler/hareket-actions");
    durum.portal = bayi("1");
    await expect(satisBildir({}, form("2"))).rejects.toThrow(/Oturum gerekli/);
    expect(bayiOkundu).not.toHaveBeenCalled();
  });

  it("bayi kendi adına, CRM ekibi her bayi adına bildirebilir", async () => {
    const { satisBildir } = await import("@/components/bayiler/hareket-actions");
    durum.portal = bayi("1");
    expect(await satisBildir({}, form("1"))).toEqual({ hatalar: { genel: "Bayi bulunamadı." } }); // kontrolü geçti
    durum.portal = null;
    ekipUyesi("Satış");
    expect(await satisBildir({}, form("2"))).toEqual({ hatalar: { genel: "Bayi bulunamadı." } });
    expect(bayiOkundu).toHaveBeenCalledTimes(2);
  });

  it("cihaz sevki yalnızca CRM ekibi: bayi oturumu yetmez", async () => {
    const { cihazSevkEt } = await import("@/components/bayiler/hareket-actions");
    durum.portal = bayi("1");
    await expect(cihazSevkEt({}, form("1"))).rejects.toThrow(/Oturum gerekli/);
    expect(bayiOkundu).not.toHaveBeenCalled();
  });
});

describe("API route'ları", () => {
  const istek = (yol: string) => new NextRequest(new URL(yol, "http://localhost:3000"));

  it("cihaz bildirimi listesi (GET) oturumsuz 401, ekip üyesine açık", async () => {
    const { GET } = await import("@/app/api/cihaz-bildirimi/route");
    const yol = "/api/cihaz-bildirimi?sonra=2026-11-18T10:00:00.000Z";
    expect((await GET(istek(yol))).status).toBe(401);
    ekipUyesi("Destek");
    const y = await GET(istek(yol));
    expect(y.status).toBe(200);
    expect(await y.json()).toEqual({ cihazlar: [] });
  });

  it("bayi dokümanı: ne portal ne CRM oturumu varsa 401; sözleşme yalnızca portal oturumuyla", async () => {
    const { GET } = await import("@/app/api/bayi-dokuman/[id]/route");
    const ac = (id: string) => GET(istek(`/api/bayi-dokuman/${id}`), { params: Promise.resolve({ id }) });
    expect((await ac("5")).status).toBe(401);
    expect((await ac("sozlesme")).status).toBe(401);
    ekipUyesi("Destek");
    expect((await ac("5")).status).toBe(404); // oturum kontrolünü geçti, doküman yok
    expect((await ac("sozlesme")).status).toBe(401); // CRM kullanıcısının bayi sözleşmesi yok
  });
});

describe("her Server Action oturum kontrolüyle başlar", () => {
  const KOK = path.resolve(import.meta.dirname, "..");
  /** Oturumu doğrulayan çağrılar (portal dosyalarındaki yardımcılar portalOturumu'nu çağırıp yoksa fırlatır) */
  const KONTROL = /\b(oturumGerekli|ekipGerekli|rolEksik|crmKullanicisi|portalOturumu|bayiGerekli|bayiRmasi|bayiId)\(/;
  /** Oturum açmadan önce çağrılması gerekenler */
  const ISTISNA: Record<string, string[]> = { "components/giris/actions.ts": ["girisYap", "hesapEtkinlestir", "cikisYap"] };

  const dosyalar = ["app", "components", "lib"]
    .flatMap((d) => readdirSync(path.join(KOK, d), { recursive: true, encoding: "utf8" }).map((f) => path.join(d, f)))
    .filter((f) => /\.tsx?$/.test(f) && /^\s*["']use server["']/.test(readFileSync(path.join(KOK, f), "utf8")));

  const aksiyonlar = dosyalar.flatMap((f) => {
    const s = readFileSync(path.join(KOK, f), "utf8");
    return [...s.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)].map((m) => {
      // Parametre listesinin kapandığı yeri bul (çok satırlı imzalar), gövde ondan sonraki ilk "{" ile başlar
      let i = m.index + m[0].length;
      for (let derinlik = 1; derinlik > 0; i++) derinlik += s[i] === "(" ? 1 : s[i] === ")" ? -1 : 0;
      const govde = s.slice(s.indexOf("{\n", i), s.indexOf("\n}", i));
      // Kontrol gövdenin başında olmalı: ilk birkaç satırda (yalnızca form okuma vb. önünde)
      const bas = govde.split("\n").slice(0, 6).join("\n");
      return { dosya: f.split(path.sep).join("/"), ad: m[1], kontrollu: KONTROL.test(bas) };
    });
  });

  it("taranacak dosyalar bulunur", () => {
    expect(dosyalar.length).toBeGreaterThanOrEqual(20);
    expect(aksiyonlar.length).toBeGreaterThanOrEqual(120);
  });

  it("istisnalar dışında her dışa açık aksiyon ilk satırlarda oturumu doğrular", () => {
    const eksik = aksiyonlar.filter((a) => !a.kontrollu && !ISTISNA[a.dosya]?.includes(a.ad)).map((a) => `${a.dosya} :: ${a.ad}`);
    expect(eksik).toEqual([]);
  });
});
