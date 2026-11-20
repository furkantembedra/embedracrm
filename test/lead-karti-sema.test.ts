// P2.2 lead kartı şeması (20261120130000_lead_karti.sql), gerçek Postgres 17'de (PGlite): lead_karti kısıtı,
// lead_karti_birlestir (üst düzey birleştirme, null anahtarı siler), munhasir_bayi (münhasır işareti, ülke, sözleşme
// süresi), yetkili_eslestir (normalize telefon, büyük/küçük harf duyarsız e-posta), firsat_notlari 'bot' türü ve yetkiler.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";

let db: PGlite;
let firsat: number;

beforeAll(async () => {
  db = await bosVeritabani();
  firsat = (await db.query<{ id: number }>(
    `insert into public.satis_hatti (f_firma, asama_id) values ('+90 532 000 00 00', (select id from public.asama where kod = 'yeni')) returning id::int`,
  )).rows[0].id;
}, 60_000);
afterAll(() => db?.close());

const tek = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

describe("satis_hatti.lead_karti", () => {
  it("varsayılan boş nesne; nesne olmayan değer reddedilir", async () => {
    expect((await tek<{ k: unknown }>(`select lead_karti k from public.satis_hatti where id = $1`, [firsat])).k).toEqual({});
    await expect(db.query(`update public.satis_hatti set lead_karti = '[]'::jsonb where id = $1`, [firsat])).rejects.toThrow(/lead_karti_nesne/);
  });

  it("lead_karti_birlestir üst düzey anahtarları birleştirir, null anahtarı siler, yeni kartı döner", async () => {
    const b = async (yama: object) => (await tek<{ k: Record<string, unknown> }>(`select public.lead_karti_birlestir($1, $2::jsonb) k`, [firsat, JSON.stringify(yama)])).k;
    expect(await b({ firma: "Usta", cihaz_adedi: 2 })).toEqual({ firma: "Usta", cihaz_adedi: 2 });
    expect(await b({ sehir: "Konya", skor: { deger: "sicak", gerekce: "g" } })).toEqual({ firma: "Usta", cihaz_adedi: 2, sehir: "Konya", skor: { deger: "sicak", gerekce: "g" } });
    expect(await b({ cihaz_adedi: 3, skor: null })).toEqual({ firma: "Usta", cihaz_adedi: 3, sehir: "Konya" });
    expect((await tek<{ k: unknown }>(`select public.lead_karti_birlestir($1, '[1]'::jsonb) k`, [firsat])).k).toBeNull();
  });
});

describe("munhasir_bayi", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into public.bayi_basvurulari (id, s_ad, s_asama, k_bolge, k_moq, k_marka, k_destek, s_sozlesme) overriding system value values
        (9001, 'Münhasır DE', 'lansman', true, true, true, true, '{"bolge": {"kapsam": "Almanya", "munhasir": true}}'),
        (9002, 'Münhasır değil PL', 'lansman', true, true, true, true, '{"bolge": {"kapsam": "Polonya", "munhasir": false}}'),
        (9003, 'Süresi bitmiş AT', 'lansman', true, true, true, true, '{"bolge": {"kapsam": "Avusturya", "munhasir": true}}'),
        (9004, 'Süresiz CZ', 'lansman', true, true, true, true, '{"bolge": {"kapsam": "", "munhasir": true}}');
      insert into public.bayiler (id, basvuru_id, by_ad, by_ulke_kodu, by_sozlesme_bat, by_sozlesme_sure_ay) values
        (9001, 9001, 'Auto Test GmbH', 'DE', current_date - 30, 24),
        (9002, 9002, 'Polska Sp.', 'PL', current_date - 30, 24),
        (9003, 9003, 'Alt Wien', 'AT', current_date - 800, 24),
        (9004, 9004, 'Praha s.r.o.', 'CZ', null, null);`);
  });
  const bul = async (u: string) => (await db.query<{ bayi_id: number; ad: string; kapsam: string | null }>(`select bayi_id::int, ad, kapsam from public.munhasir_bayi($1)`, [u])).rows;

  it("münhasır işaretli, sözleşmesi süren bayiyi bulur (ülke kodu büyük/küçük harf duyarsız)", async () => {
    expect(await bul("de")).toEqual([{ bayi_id: 9001, ad: "Auto Test GmbH", kapsam: "Almanya" }]);
    expect(await bul("CZ")).toEqual([{ bayi_id: 9004, ad: "Praha s.r.o.", kapsam: null }]);
  });
  it("münhasır olmayan, süresi bitmiş ya da başka ülkedeki bayiyi bulmaz", async () => {
    expect(await bul("PL")).toEqual([]);
    expect(await bul("AT")).toEqual([]);
    expect(await bul("FR")).toEqual([]);
  });
});

describe("yetkili_eslestir", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into public.musteri (id, m_ad) overriding system value values (9101, 'Eşleşme A'), (9102, 'Eşleşme B');
      insert into public.musteri_yetkilileri (id, musteri_id, y_ad, y_tel, y_eposta) overriding system value values
        (9201, 9101, 'Ali', '0532 777 66 55', 'Ali@Usta.COM'),
        (9202, 9102, 'Veli', '+49 151 0000 1111', '');`);
  });
  const esle = async (t: string, e: string) =>
    (await db.query<{ yetkili_id: number; musteri_id: number }>(`select yetkili_id::int, musteri_id::int from public.yetkili_eslestir($1, $2)`, [t, e])).rows;

  it("normalize telefonla (uygulama normalize eder) ve büyük/küçük harf duyarsız e-postayla eşleşir; boş girdi eşleşmez", async () => {
    expect(await esle("+905327776655", "")).toEqual([{ yetkili_id: 9201, musteri_id: 9101 }]);
    expect(await esle("", " ali@usta.com ")).toEqual([{ yetkili_id: 9201, musteri_id: 9101 }]);
    expect(await esle("+4915100001111", "ali@usta.com")).toEqual([{ yetkili_id: 9201, musteri_id: 9101 }, { yetkili_id: 9202, musteri_id: 9102 }]);
    expect(await esle("", "")).toEqual([]);
  });
});

describe("firsat_notlari ve yetkiler", () => {
  it("botun bilgi notu ('bot') yazılabilir, bilinmeyen tür reddedilir", async () => {
    await db.query(`insert into public.firsat_notlari (satis_hatti_id, tur, metin) values ($1, 'bot', 'Bölgede münhasır bayi var: X')`, [firsat]);
    await expect(db.query(`insert into public.firsat_notlari (satis_hatti_id, tur, metin) values ($1, 'baska', 'x')`, [firsat])).rejects.toThrow(/tur_check/);
  });

  it("işleyicinin rolü (service_role) üç işlevi de çağırabilir (canlıda private şema yetkisi hatası çıkmıştı)", async () => {
    await db.exec("begin; set local role service_role;");
    try {
      expect((await db.query(`select * from public.yetkili_eslestir('+905327776655', 'ali@usta.com')`)).rows).toHaveLength(1);
      expect((await db.query(`select * from public.munhasir_bayi('DE')`)).rows).toHaveLength(1);
      expect((await db.query(`select public.lead_karti_birlestir(${firsat}, '{"aciliyet": "hemen"}'::jsonb) k`)).rows).toHaveLength(1);
    } finally {
      await db.exec("rollback;");
    }
  });

  it("anon yeni işlevleri çağıramaz", async () => {
    for (const sql of [
      `select public.munhasir_bayi('DE')`,
      `select public.yetkili_eslestir('+905327776655', '')`,
      `select public.lead_karti_birlestir(${firsat}, '{}'::jsonb)`,
    ]) {
      await expect(rolIle(db, "anon", null, sql)).rejects.toThrow(/permission denied/);
    }
  });
});
