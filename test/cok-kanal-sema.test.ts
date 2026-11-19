// P1.0 çok kanal şeması (20261119090656_cok_kanal_hazirlik.sql): Messenger kanalı, kanal hesabı, mesaj türü kısıtı,
// ek bilgi alanı, lead kaynağı listesinin tabloyla aynı olması ve migration'ın eski veriyi doğru taşıması.
// İki veritabanı: (1) sıfırdan kurulum (tüm migration'lar + seed), (2) eski şemada veri yazılıp migration sonradan uygulanan.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LEAD_KAYNAKLARI } from "@/lib/constants";
import { MESAJ_TURLERI } from "@/components/konusma/queries";
import { bosVeritabani, migrationUygula } from "./sahte/veritabani";

const MIGRATION = "20261119090656_cok_kanal_hazirlik.sql";

let db: PGlite;
beforeAll(async () => {
  db = await bosVeritabani();
}, 60_000);
afterAll(() => db?.close());

/** İşlemi kendi içinde çalıştırıp geri alır */
const dene = (is: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<void>) =>
  db.transaction(async (tx) => {
    await is(tx);
    await tx.rollback();
  });

describe("sıfırdan kurulum", () => {
  it("seed'deki konuşma varsayılan WhatsApp hesabında, mesajı ortak türde", async () => {
    const k = (await db.query(`select kanal, kanal_hesap_id from public.konusmalar`)).rows;
    expect(k).toEqual([{ kanal: "whatsapp", kanal_hesap_id: "varsayilan" }]);
    const m = (await db.query(`select tur, ek from public.konusma_mesajlari`)).rows;
    expect(m).toEqual([{ tur: "metin", ek: {} }]);
  });

  it("kaynak tablosu LEAD_KAYNAKLARI ile aynı (Messenger dahil)", async () => {
    const r = (await db.query<{ f_kaynak: string }>(`select f_kaynak from public.kaynak order by f_kaynak`)).rows.map((x) => x.f_kaynak);
    expect(r).toEqual([...LEAD_KAYNAKLARI].sort((a, b) => (a < b ? -1 : 1)));
    expect(r).toContain("Messenger");
  });

  it("Messenger kanalı kabul edilir, bilinmeyen kanal reddedilir", async () => {
    await dene(async (tx) => {
      await tx.query(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('messenger', 'sayfa-1', 'psid-1')`);
      await tx.exec("savepoint s");
      await expect(tx.query(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('telegram', 'x', 'y')`))
        .rejects.toMatchObject({ code: "23514" });
    });
  });

  it("kanal hesabı zorunlu ve boş olamaz", async () => {
    await dene(async (tx) => {
      await tx.exec("savepoint s");
      await expect(tx.query(`insert into public.konusmalar (kanal, dis_kullanici_id) values ('whatsapp', '+905550000009')`))
        .rejects.toMatchObject({ code: "23502" });
      await tx.exec("rollback to savepoint s");
      await expect(tx.query(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('whatsapp', '', '+905550000009')`))
        .rejects.toMatchObject({ code: "23514" });
    });
  });

  it("aynı kullanıcı kimliği farklı kanallarda ayrı konuşmadır", async () => {
    await dene(async (tx) => {
      for (const kanal of ["instagram", "messenger"]) {
        await tx.query(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ($1, 'h-1', 'kimlik-1')`, [kanal]);
      }
    });
  });

  it("mesaj türü yalnızca ortak listeden olabilir; varsayılan 'metin', ek varsayılan {}", async () => {
    await dene(async (tx) => {
      const k = (await tx.query<{ id: number }>(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('instagram', 'h', 'u') returning id`)).rows[0].id;
      for (const tur of MESAJ_TURLERI) {
        await tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, metin, tur, zaman) values ($1, 'gelen', 'musteri', 'x', $2, now())`, [k, tur]);
      }
      const v = (await tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, metin, zaman) values ($1, 'gelen', 'musteri', 'x', now()) returning tur, ek`, [k])).rows[0];
      expect(v).toEqual({ tur: "metin", ek: {} });
      await tx.exec("savepoint s");
      await expect(tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, metin, tur, zaman) values ($1, 'gelen', 'musteri', 'x', 'text', now())`, [k]))
        .rejects.toMatchObject({ code: "23514" });
    });
  });

  it("veritabanı kısıtı ile MESAJ_TURLERI aynı liste", async () => {
    const r = (await db.query<{ d: string }>(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'konusma_mesajlari_tur_check'`)).rows[0].d;
    expect([...r.matchAll(/'([a-z_]+)'::text/g)].map((x) => x[1]).sort()).toEqual([...MESAJ_TURLERI].sort());
  });

  it("ek alanı JSON nesnesi olmak zorundadır", async () => {
    await dene(async (tx) => {
      const k = (await tx.query<{ id: number }>(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('messenger', 'h', 'u') returning id`)).rows[0].id;
      await tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, metin, zaman, ek) values ($1, 'gelen', 'musteri', 'x', now(), '{"hikaye":{"id":"1"}}')`, [k]);
      await tx.exec("savepoint s");
      await expect(tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, metin, zaman, ek) values ($1, 'gelen', 'musteri', 'y', now(), '[]')`, [k]))
        .rejects.toMatchObject({ code: "23514" });
    });
  });

  it("dış mesaj kimliği kanallar arasında da tekildir", async () => {
    await dene(async (tx) => {
      const ig = (await tx.query<{ id: number }>(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('instagram', 'h', 'u') returning id`)).rows[0].id;
      const ms = (await tx.query<{ id: number }>(`insert into public.konusmalar (kanal, kanal_hesap_id, dis_kullanici_id) values ('messenger', 'h', 'u') returning id`)).rows[0].id;
      const yaz = (k: number) => tx.query(`insert into public.konusma_mesajlari (konusma_id, yon, gonderen, dis_mesaj_id, metin, zaman) values ($1, 'gelen', 'musteri', 'm_AYNI', 'x', now())`, [k]);
      await yaz(ig);
      await tx.exec("savepoint s");
      await expect(yaz(ms)).rejects.toMatchObject({ code: "23505" });
    });
  });
});

describe("eski veriyle migration", () => {
  let eski: PGlite;
  beforeAll(async () => {
    eski = await bosVeritabani({ seed: false, oncesi: MIGRATION });
    // P0 şemasında canlıdaki gibi veri: kaynaklar sabit kimlikle (identity sayacı geride), WhatsApp türleri eski adlarıyla
    await eski.exec(`
      insert into public.kaynak (id, f_kaynak) overriding system value values (1, 'Web sitesi'), (2, 'WhatsApp'), (3, 'Instagram'), (4, 'Bayi'), (5, 'Fuar'), (6, 'Mevcut müşteri');
      insert into public.konusmalar (kanal, dis_kullanici_id) values ('whatsapp', '+905321112233');
      insert into public.konusma_mesajlari (konusma_id, yon, gonderen, dis_mesaj_id, metin, tur, zaman)
      select k.id, 'gelen', 'musteri', 'wamid.' || t, 'x', t, now() from public.konusmalar k,
        unnest(array['text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'button', 'interactive', 'reaction', 'contacts', 'unsupported']) t;
    `);
    await migrationUygula(eski, MIGRATION);
  }, 60_000);
  afterAll(() => eski?.close());

  it("mevcut WhatsApp konuşmaları 'varsayilan' hesapla doldurulur", async () => {
    expect((await eski.query(`select kanal, kanal_hesap_id from public.konusmalar`)).rows).toEqual([{ kanal: "whatsapp", kanal_hesap_id: "varsayilan" }]);
  });

  it("eski türler ortak türe taşınır, birebir olmayanın aslı ek.kaynak_tur'da kalır", async () => {
    const r = Object.fromEntries((await eski.query<{ d: string; tur: string; ek: object }>(
      `select substr(dis_mesaj_id, 7) d, tur, ek from public.konusma_mesajlari`)).rows.map((x) => [x.d, [x.tur, x.ek]]));
    expect(r).toEqual({
      text: ["metin", {}], image: ["gorsel", {}], audio: ["ses", {}], video: ["video", {}], document: ["dosya", {}],
      sticker: ["gorsel", { kaynak_tur: "sticker" }], location: ["diger", { kaynak_tur: "location" }],
      button: ["metin", { kaynak_tur: "button" }], interactive: ["metin", { kaynak_tur: "interactive" }],
      reaction: ["tepki", { kaynak_tur: "reaction" }], contacts: ["diger", { kaynak_tur: "contacts" }],
      unsupported: ["diger", { kaynak_tur: "unsupported" }],
    });
  });

  it("dolu kaynak tablosuna Messenger bir sonraki kimlikle eklenir", async () => {
    expect((await eski.query(`select id::int, f_kaynak from public.kaynak where f_kaynak = 'Messenger'`)).rows).toEqual([{ id: 7, f_kaynak: "Messenger" }]);
  });

  it("varsayılan değer kalmaz: yeni konuşma hesabı açıkça vermeli", async () => {
    await expect(eski.query(`insert into public.konusmalar (kanal, dis_kullanici_id) values ('whatsapp', '+905550000001')`)).rejects.toMatchObject({ code: "23502" });
  });
});
