// P1.2 gelen kutusu şeması (20261119123218_gelen_kutusu.sql), gerçek Postgres 17'de (PGlite):
// gelen_kutusu() (son mesaj, okunmamış sayısı kullanıcı başına), konusma_okundu() (geri gitmez),
// teslim_durumlari_isle() (yalnızca ileri, yalnızca giden), kısıtlar ve RLS (okundu satırları yalnızca sahibine).
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";

const YONETICI = "11111111-1111-4111-8111-111111111111"; // kullanicilar.id = 1
const SATIS = "22222222-2222-4222-8222-222222222222"; // kullanicilar.id = 2
const YABANCI = "33333333-3333-4333-8333-333333333333";

let db: PGlite;
let konusma: number;
const mesajlar: number[] = [];

beforeAll(async () => {
  db = await bosVeritabani();
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'deniz@embedra.com', now()), ($2, 'ayse@embedra.com', now()), ($3, 'x@example.com', now())`, [YONETICI, SATIS, YABANCI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 1`, [YONETICI]);
  await db.query(`update public.kullanicilar set auth_id = $1 where id = 2`, [SATIS]);
}, 60_000);
afterAll(() => db?.close());

let sira = 0;
beforeEach(async () => {
  await db.exec(`delete from public.konusmalar where kanal_hesap_id = 'GK'`);
  mesajlar.length = 0;
  const gelen = async (dk: number) => {
    const r = await db.query<{ k: number; m: number }>(
      `select konusma_id::int k, mesaj_id::int m from public.gelen_mesaj_kaydet('whatsapp', 'GK', '+905330001122', $1, 'musteri', $2, 'metin', '{}'::jsonb, $3::timestamptz, 'Ali')`,
      [`GK.${++sira}`, `Mesaj ${dk}`, new Date(Date.UTC(2026, 10, 19, 10, dk)).toISOString()],
    );
    konusma = r.rows[0].k;
    mesajlar.push(r.rows[0].m);
  };
  await gelen(0);
  await gelen(1);
  await gelen(2);
  await db.query(
    `insert into public.konusma_mesajlari (konusma_id, yon, gonderen, dis_mesaj_id, metin, tur, zaman, gonderen_kullanici_id)
     values ($1, 'giden', 'temsilci', 'GK.GIDEN', 'Merhaba, ben Ayşe', 'metin', '2026-11-19T10:03:00Z', 2)`, [konusma]);
});

type Satir = { id: number; okunmamis: number; son_metin: string; son_yon: string; firma: string | null };
const liste = (uid: string | null) =>
  rolIle<Satir>(db, "authenticated", uid, `select id::int, okunmamis, son_metin, son_yon, firma from public.gelen_kutusu() where kanal_hesap_id = 'GK'`);

describe("gelen_kutusu ve okundu", () => {
  it("son mesajı ve kullanıcı başına okunmamış sayısını verir", async () => {
    expect(await liste(YONETICI)).toEqual([{ id: konusma, okunmamis: 3, son_metin: "Merhaba, ben Ayşe", son_yon: "giden", firma: null }]);
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [YONETICI]);
      await tx.exec(`set local role authenticated`);
      await tx.query(`select public.konusma_okundu($1, $2)`, [konusma, mesajlar[1]]);
    });
    expect((await liste(YONETICI))[0].okunmamis).toBe(1);
    expect((await liste(SATIS))[0].okunmamis).toBe(3); // başka kullanıcının okuması etkilemez
  });

  it("okundu işareti geri gitmez", async () => {
    const oku = async (m: number) => db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [SATIS]);
      await tx.exec(`set local role authenticated`);
      await tx.query(`select public.konusma_okundu($1, $2)`, [konusma, m]);
    });
    await oku(mesajlar[2]);
    await oku(mesajlar[0]);
    expect((await liste(SATIS))[0].okunmamis).toBe(0);
  });

  it("okundu satırlarını yalnızca sahibi görür; ekip dışı ve anon hiçbir şey görmez", async () => {
    await db.query(`insert into public.konusma_okumalari (kullanici_id, konusma_id, son_okunan_mesaj_id) values (1, $1, $2)`, [konusma, mesajlar[0]]);
    const say = (rol: "anon" | "authenticated", uid: string | null) =>
      rolIle<{ n: number }>(db, rol, uid, `select count(*)::int n from public.konusma_okumalari`).then((r) => r[0].n, () => -1);
    expect(await say("authenticated", YONETICI)).toBe(1);
    expect(await say("authenticated", SATIS)).toBe(0);
    expect(await say("authenticated", YABANCI)).toBe(0);
    expect(await say("anon", null)).toBe(-1); // yetki yok
    expect(await liste(YABANCI)).toEqual([]); // konuşmalar RLS ile kapalı
    // Başkası adına okundu yazılamaz
    await expect(rolIle(db, "authenticated", SATIS, `insert into public.konusma_okumalari (kullanici_id, konusma_id, son_okunan_mesaj_id) values (1, ${konusma}, 1)`)).rejects.toThrow(/row-level security/);
  });
});

describe("teslim_durumlari_isle", () => {
  const durum = async () => (await db.query<{ d: string | null; h: string | null }>(`select teslim_durumu d, teslim_hata_kodu h from public.konusma_mesajlari where dis_mesaj_id = 'GK.GIDEN'`)).rows[0];
  const isle = async (d: unknown[]) => (await db.query<{ n: number }>(`select public.teslim_durumlari_isle($1::jsonb) n`, [JSON.stringify(d)])).rows[0].n;

  it("yalnızca ileri gider: okundu'dan sonra gelen iletildi geri almaz", async () => {
    expect(await isle([{ dis_mesaj_id: "GK.GIDEN", durum: "okundu", zaman: "2026-11-19T10:05:00Z" }])).toBe(1);
    expect(await isle([{ dis_mesaj_id: "GK.GIDEN", durum: "iletildi", zaman: "2026-11-19T10:04:00Z" }])).toBe(0);
    expect(await durum()).toEqual({ d: "okundu", h: null });
  });

  it("aynı gövdede birden çok durum: en ilerisi yazılır; hata kodu saklanır", async () => {
    expect(await isle([
      { dis_mesaj_id: "GK.GIDEN", durum: "gonderildi" },
      { dis_mesaj_id: "GK.GIDEN", durum: "basarisiz", hata_kodu: "131047" },
      { dis_mesaj_id: "GK.GIDEN", durum: "iletildi" },
    ])).toBe(1);
    expect(await durum()).toEqual({ d: "basarisiz", h: "131047" });
  });

  it("gelen mesaja, bilinmeyen kimliğe ve bilinmeyen duruma dokunmaz", async () => {
    expect(await isle([
      { dis_mesaj_id: `GK.${sira}`, durum: "okundu" }, // gelen mesaj
      { dis_mesaj_id: "YOK", durum: "okundu" },
      { dis_mesaj_id: "GK.GIDEN", durum: "uydurma" },
    ])).toBe(0);
    expect(await durum()).toEqual({ d: null, h: null });
  });

  it("kısıtlar: gelen mesaja teslim durumu ve temsilci dışında gönderen kullanıcı yazılamaz", async () => {
    await expect(db.query(`update public.konusma_mesajlari set teslim_durumu = 'okundu' where id = $1`, [mesajlar[0]])).rejects.toThrow(/teslim_durumu_check/);
    await expect(db.query(`update public.konusma_mesajlari set gonderen_kullanici_id = 1 where id = $1`, [mesajlar[0]])).rejects.toThrow(/gonderen_kullanici_check/);
  });
});

describe("fırsat sorumlusu", () => {
  it("kullanıcı silinirse sorumlu boşalır", async () => {
    const f = (await db.query<{ id: number }>(`select id::int from public.satis_hatti order by id limit 1`)).rows[0].id;
    await db.query(`insert into public.kullanicilar (k_ad, k_eposta, k_rol) values ('Geçici', 'gecici@example.com', 'Satış')`);
    await db.query(`update public.satis_hatti set sorumlu_id = (select id from public.kullanicilar where k_eposta = 'gecici@example.com') where id = $1`, [f]);
    await db.query(`delete from public.kullanicilar where k_eposta = 'gecici@example.com'`);
    expect((await db.query<{ s: number | null }>(`select sorumlu_id s from public.satis_hatti where id = $1`, [f])).rows[0].s).toBeNull();
  });
});
