// Veritabanı: repodaki migration'lar + seed boş bir Postgres 17'de (PGlite) sıfırdan kurulur; ardından
// telefon normalizasyonunun SQL karşılığı, tekillik kuralları, RLS, auth bağlama tetikleyicisi ve sayaçlar sınanır.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { telefonNormalize } from "@/components/whatsapp/telefon";
import { TELEFON_ORNEKLERI } from "./veri/telefon-ornekleri";
import { bosVeritabani, MIGRATIONLAR, rolIle } from "./sahte/veritabani";

let db: PGlite;
beforeAll(async () => {
  db = await bosVeritabani();
}, 60_000);
afterAll(() => db?.close());

const tek = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

describe("migration'lar ve seed", () => {
  it("boş veritabanında hatasız kurulur", async () => {
    expect(MIGRATIONLAR.length).toBeGreaterThanOrEqual(7);
    const r = await tek<{ n: number }>(`select count(*)::int n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`);
    expect(r.n).toBe(71); // P1.1: konusma_isleri
  });

  it("kullanılmayan whatsapp_mesajlari tablosu kalmaz", async () => {
    expect((await tek<{ n: number }>(`select count(*)::int n from pg_class where relname = 'whatsapp_mesajlari'`)).n).toBe(0);
  });

  it("seed demo veriyi yükler; auth hesapları boştur", async () => {
    const r = await tek<Record<string, number>>(`select
      (select count(*)::int from public.musteri) musteri, (select count(*)::int from public.satis_hatti) firsat,
      (select count(*)::int from public.kullanicilar) kullanici, (select count(*)::int from public.bayiler) bayi,
      (select count(*)::int from public.kullanicilar where auth_id is not null) bagli_ekip,
      (select count(*)::int from public.bayi_kullanicilari where auth_id is not null) bagli_bayi`);
    expect(r).toMatchObject({ musteri: 15, firsat: 12, kullanici: 6, bayi: 4, bagli_ekip: 0, bagli_bayi: 0 });
  });

  it("kimlik sayaçları seed'den sonra çakışmaz", async () => {
    await db.transaction(async (tx) => {
      const enBuyuk = (await tx.query<{ m: number }>(`select max(id)::int m from public.musteri`)).rows[0].m;
      const yeni = (await tx.query<{ id: number }>(`insert into public.musteri (m_ad) values ('Sayaç testi') returning id::int`)).rows[0].id;
      expect(yeni).toBeGreaterThan(enBuyuk);
      const bayiEnBuyuk = (await tx.query<{ m: number }>(`select max(id)::int m from public.bayiler`)).rows[0].m;
      const basvuru = (await tx.query<{ id: number }>(`insert into public.bayi_basvurulari (s_ad) values ('Sayaç testi') returning id::int`)).rows[0].id;
      expect(basvuru).toBeGreaterThan(bayiEnBuyuk); // bayiler.id aynı sayacı kullanır
      await tx.rollback();
    });
  });
});

describe("private.telefon_normal (SQL) = telefonNormalize (TS)", () => {
  it.each(TELEFON_ORNEKLERI)("%j", async (girdi, beklenen) => {
    const r = await tek<{ n: string | null }>(`select private.telefon_normal($1) n`, [girdi]);
    expect(r.n ?? "").toBe(beklenen);
    expect(r.n ?? "").toBe(telefonNormalize(girdi));
  });

  it("üretilmiş sütunlar yazılan telefonu normalize eder", async () => {
    await db.transaction(async (tx) => {
      const m = (await tx.query<{ id: number }>(`insert into public.musteri (m_ad) values ('Telefon testi') returning id`)).rows[0].id;
      const y = (await tx.query<{ n: string }>(`insert into public.musteri_yetkilileri (musteri_id, y_ad, y_tel) values ($1, 'Ali', '0532 999 88 77') returning y_tel_normal n`, [m])).rows[0];
      expect(y.n).toBe("+905329998877");
      await tx.rollback();
    });
  });
});

describe("tekillik", () => {
  it("aynı dış mesaj kimliği ikinci kez yazılamaz", async () => {
    await db.transaction(async (tx) => {
      const k = (await tx.query<{ id: number }>(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('whatsapp', '111', '+905550000001') returning id`)).rows[0].id;
      const yaz = () => tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, dis_mesaj_id, metin, zaman) values ($1, 'gelen', 'musteri', 'wamid.AYNI', 'x', now())`, [k]);
      await yaz();
      await tx.exec("savepoint ikinci");
      await expect(yaz()).rejects.toMatchObject({ code: "23505" });
      await tx.rollback();
    });
  });

  it("kanal + kanal hesabı + dış kullanıcı kimliği başına tek konuşma olur", async () => {
    await db.transaction(async (tx) => {
      const ac = (hesap: string) => tx.query(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('instagram', $1, 'igsid-1')`, [hesap]);
      await ac("ig-hesap-1");
      await tx.exec("savepoint ikinci");
      await expect(ac("ig-hesap-1")).rejects.toMatchObject({ code: "23505" });
      await tx.exec("rollback to savepoint ikinci");
      // IGSID / PSID hesaba özgüdür: aynı kimlik başka hesapta başka bir kişi, ayrı konuşma
      await ac("ig-hesap-2");
      await tx.rollback();
    });
  });

  it("gelen mesajın göndereni müşteri olmak zorundadır", async () => {
    await db.transaction(async (tx) => {
      const k = (await tx.query<{ id: number }>(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('whatsapp', '111', '+905550000002') returning id`)).rows[0].id;
      await expect(tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, metin, zaman) values ($1, 'gelen', 'bot', 'x', now())`, [k]))
        .rejects.toMatchObject({ code: "23514" });
      await tx.rollback();
    });
  });
});

describe("RLS ve auth bağlama", () => {
  const EKIP = "11111111-1111-4111-8111-111111111111";
  const BAYI = "22222222-2222-4222-8222-222222222222";
  const YABANCI = "33333333-3333-4333-8333-333333333333";
  let bayiId: number;

  beforeAll(async () => {
    // Onaylı e-postayla açılan auth hesabı, tetikleyiciyle aynı e-postadaki ekip / bayi kaydına bağlanır
    const ekipEposta = (await tek<{ e: string }>(`select k_eposta e from public.kullanicilar where k_aktif order by id limit 1`)).e;
    const bayiKaydi = await tek<{ e: string; b: number }>(`select bk_eposta e, bayi_id::int b from public.bayi_kullanicilari order by id limit 1`);
    bayiId = bayiKaydi.b;
    await db.query(`update public.bayi_kullanicilari set bk_erisim = true where lower(bk_eposta) = lower($1)`, [bayiKaydi.e]);
    await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, upper($2), now()), ($3, $4, now()), ($5, 'yabanci@example.com', now())`,
      [EKIP, ekipEposta, BAYI, bayiKaydi.e, YABANCI]);
  });

  it("tetikleyici auth hesaplarını e-postayla (büyük/küçük harf duyarsız) bağlar", async () => {
    const r = await tek<{ ekip: number; bayi: number }>(`select
      (select count(*)::int from public.kullanicilar where auth_id = $1) ekip, (select count(*)::int from public.bayi_kullanicilari where auth_id = $2) bayi`, [EKIP, BAYI]);
    expect(r).toEqual({ ekip: 1, bayi: 1 });
  });

  it("anon rol hiçbir tabloyu okuyamaz", async () => {
    await expect(rolIle(db, "anon", null, `select count(*) from public.musteri`)).rejects.toThrow(/permission denied/);
    await expect(rolIle(db, "anon", null, `select count(*) from public.konusmalar`)).rejects.toThrow(/permission denied/);
  });

  it("ekipte olmayan hesap hiçbir satır görmez", async () => {
    const [r] = await rolIle<Record<string, number>>(db, "authenticated", YABANCI,
      `select (select count(*)::int from public.musteri) musteri, (select count(*)::int from public.satis_hatti) firsat, (select count(*)::int from public.konusmalar) konusma, (select count(*)::int from public.kullanicilar) kullanici`);
    expect(r).toEqual({ musteri: 0, firsat: 0, konusma: 0, kullanici: 0 });
  });

  it("ekip üyesi her şeyi görür", async () => {
    const [r] = await rolIle<Record<string, number>>(db, "authenticated", EKIP,
      `select (select count(*)::int from public.musteri) musteri, (select count(*)::int from public.satis_hatti) firsat, (select count(*)::int from public.konusmalar) konusma`);
    expect(r).toMatchObject({ musteri: 15, firsat: 12, konusma: 1 });
  });

  it("bayi yalnızca kendi cihazlarını görür, satış hattını ve konuşmaları hiç göremez", async () => {
    const [r] = await rolIle<Record<string, number>>(db, "authenticated", BAYI, `select
      (select count(*)::int from public.cihazlar) cihaz, (select count(*)::int from public.cihazlar where bayi_id <> ${bayiId}) baska_cihaz,
      (select count(*)::int from public.bayiler) bayi, (select count(*)::int from public.satis_hatti) firsat, (select count(*)::int from public.konusmalar) konusma`);
    const kendi = await tek<{ n: number }>(`select count(*)::int n from public.cihazlar where bayi_id = $1`, [bayiId]);
    expect(r).toEqual({ cihaz: kendi.n, baska_cihaz: 0, bayi: 1, firsat: 0, konusma: 0 });
  });
});
