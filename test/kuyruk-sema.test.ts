// P1.1 konuşma kuyruğu şeması (20261119100706_konusma_kuyrugu.sql), gerçek Postgres 17'de (PGlite):
// gelen_mesaj_kaydet (tek işlemde konuşma + mesaj + iş, tekrar yazmaz), konusma_kilidi_al / konusma_isi_bitir /
// konusma_kilidi_birak (tek sahip, süre aşımı, sıra koruma, tekrar denemesi), yetkiler ve RLS.
// PGlite tek bağlantılıdır: iki işleyicinin "aynı anda" çağrıları sıraya girer; kilidin mantığı (ikinci çağrının
// konuşmayı alamaması) bu sırayla sınanır. SKIP LOCKED'ın gerçek eşzamanlı davranışı burada sınanamaz.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bosVeritabani, rolIle } from "./sahte/veritabani";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EKIP = "11111111-1111-4111-8111-111111111111";
const YABANCI = "33333333-3333-4333-8333-333333333333";

let db: PGlite;
beforeAll(async () => {
  db = await bosVeritabani();
  const ekipEposta = (await db.query<{ e: string }>(`select k_eposta e from public.kullanicilar where k_aktif order by id limit 1`)).rows[0].e;
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now()), ($3, 'yabanci@example.com', now())`, [EKIP, ekipEposta, YABANCI]);
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec(`delete from public.konusma_isleri; delete from public.konusma_mesajlari where dis_mesaj_id like 'T.%';
    delete from public.konusmalar where kanal_hesap_id = 'TEST'; update public.konusmalar set kilit_sahibi = null, kilit_bitis = null;`);
});

let sira = 0;
const kaydet = async (kullanici = "+905339998877", o: { id?: string; gonderen?: string; zaman?: string; ad?: string | null } = {}) =>
  (await db.query<{ konusma_id: number; mesaj_id: number }>(
    `select konusma_id::int, mesaj_id::int from public.gelen_mesaj_kaydet('whatsapp', 'TEST', $1, $2, $3, 'Merhaba', 'metin', '{}'::jsonb, $4::timestamptz, $5)`,
    [kullanici, o.id ?? `T.${++sira}`, o.gonderen ?? "musteri", o.zaman ?? new Date().toISOString(), o.ad ?? null],
  )).rows[0] ?? null;
const tek = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
const kilitAl = async (sahip: string, konusma: number | null = null, sure = 120) =>
  (await tek<{ k: number | null }>(`select public.konusma_kilidi_al($1, $2, $3)::int k`, [sahip, sure, konusma])).k;
const bitir = async (is: number, sahip: string, hata: string | null = null) =>
  (await tek<{ r: boolean }>(`select public.konusma_isi_bitir($1, $2, $3) r`, [is, sahip, hata])).r;
const birak = async (konusma: number, sahip: string) => (await tek<{ r: string }>(`select public.konusma_kilidi_birak($1, $2) r`, [konusma, sahip])).r;
const isler = async (konusma: number) =>
  (await db.query<{ id: number; durum: string; deneme: number; tur: string }>(`select id::int, durum, deneme, tur from public.konusma_isleri where konusma_id = $1 order by id`, [konusma])).rows;

describe("gelen_mesaj_kaydet", () => {
  it("konuşmayı açar, mesajı yazar ve kuyruğa iş ekler; son müşteri mesajı ve profil adı konuşmaya yazılır", async () => {
    const r = await kaydet("+905339998877", { zaman: "2026-11-19T10:00:00Z", ad: " Ahmet " });
    expect(r).toEqual({ konusma_id: expect.any(Number), mesaj_id: expect.any(Number) });
    expect(await tek(`select yon, gonderen, tur from public.konusma_mesajlari where id = $1`, [r!.mesaj_id])).toEqual({ yon: "gelen", gonderen: "musteri", tur: "metin" });
    expect(await isler(r!.konusma_id)).toEqual([expect.objectContaining({ durum: "bekliyor", deneme: 0, tur: "musteri_mesaji" })]);
    const k = await tek<{ z: string; ad: string }>(`select son_musteri_mesaji_zamani z, dis_profil_adi ad from public.konusmalar where id = $1`, [r!.konusma_id]);
    expect(new Date(k.z).toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(k.ad).toBe("Ahmet");
  });

  it("aynı dis_mesaj_id ikinci kez gelirse hiçbir şey yazmaz", async () => {
    const r = await kaydet("+905339998877", { id: "T.AYNI" });
    expect(await kaydet("+905339998877", { id: "T.AYNI" })).toBeNull();
    expect(await kaydet("+905330000000", { id: "T.AYNI" })).toBeNull(); // başka kişiden de (global tekil)
    expect(await isler(r!.konusma_id)).toHaveLength(1);
    expect((await tek<{ n: number }>(`select count(*)::int n from public.konusma_mesajlari where dis_mesaj_id = 'T.AYNI'`)).n).toBe(1);
  });

  it("aynı kişinin mesajları aynı konuşmaya; geç gelen eski mesaj pencereyi geri almaz", async () => {
    const a = await kaydet("+905339998877", { zaman: "2026-11-19T10:00:00Z" });
    const b = await kaydet("+905339998877", { zaman: "2026-11-19T09:00:00Z" });
    expect(b!.konusma_id).toBe(a!.konusma_id);
    const z = (await tek<{ z: string }>(`select son_musteri_mesaji_zamani z from public.konusmalar where id = $1`, [a!.konusma_id])).z;
    expect(new Date(z).toISOString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("echo (temsilci) giden mesaj olarak yazılır, temsilci işi açılır, pencere ve profil adı değişmez", async () => {
    const r = await kaydet("+905339998877", { gonderen: "temsilci", ad: "Yazılmamalı" });
    expect(await tek(`select yon, gonderen from public.konusma_mesajlari where id = $1`, [r!.mesaj_id])).toEqual({ yon: "giden", gonderen: "temsilci" });
    expect(await isler(r!.konusma_id)).toEqual([expect.objectContaining({ tur: "temsilci_mesaji" })]);
    expect(await tek(`select son_musteri_mesaji_zamani z, dis_profil_adi ad from public.konusmalar where id = $1`, [r!.konusma_id])).toEqual({ z: null, ad: null });
  });

  it("bot göndereni ve boş dış kimliği reddeder", async () => {
    await expect(kaydet("+905339998877", { gonderen: "bot" })).rejects.toThrow(/musteri ya da temsilci/);
    await expect(kaydet("+905339998877", { id: "" })).rejects.toThrow(/dis_mesaj_id zorunlu/);
  });
});

describe("konuşma kilidi", () => {
  it("bir konuşmayı aynı anda tek işleyici alır; ikinci işleyici başka iş yoksa null alır", async () => {
    const r = await kaydet();
    await kaydet(); // aynı konuşmaya ikinci iş
    expect(await kilitAl(A)).toBe(r!.konusma_id);
    expect(await kilitAl(B)).toBeNull();
  });

  it("farklı konuşmalar farklı işleyicilere gider; en eski iş önce", async () => {
    const r1 = await kaydet("+905330000001");
    const r2 = await kaydet("+905330000002");
    expect(await kilitAl(A)).toBe(r1!.konusma_id);
    expect(await kilitAl(B)).toBe(r2!.konusma_id);
  });

  it("işi yalnızca kilit sahibi bitirebilir; bırakınca konuşma yeniden alınabilir", async () => {
    const r = await kaydet();
    const [is] = await isler(r!.konusma_id);
    await kilitAl(A);
    expect(await bitir(is.id, B)).toBe(false);
    expect(await bitir(is.id, A)).toBe(true);
    expect((await isler(r!.konusma_id))[0].durum).toBe("tamam");
    expect(await birak(r!.konusma_id, A)).toBe("birakildi");
    expect(await tek(`select kilit_sahibi, kilit_bitis from public.konusmalar where id = $1`, [r!.konusma_id])).toEqual({ kilit_sahibi: null, kilit_bitis: null });
    expect(await kilitAl(B)).toBeNull(); // bekleyen iş yok
  });

  it("işlerken yeni iş geldiyse bırakma 'devam' döner ve kilit sahibinde kalır", async () => {
    const r = await kaydet();
    const [is] = await isler(r!.konusma_id);
    await kilitAl(A);
    await bitir(is.id, A);
    await kaydet(); // bu sırada yeni mesaj
    expect(await birak(r!.konusma_id, A)).toBe("devam");
    expect(await kilitAl(B)).toBeNull();
    expect((await tek<{ s: string }>(`select kilit_sahibi s from public.konusmalar where id = $1`, [r!.konusma_id])).s).toBe(A);
  });

  it("süresi dolan kilidi başka işleyici devralır; eski sahip artık iş bitiremez, bırakamaz", async () => {
    const r = await kaydet();
    const [is] = await isler(r!.konusma_id);
    await kilitAl(A);
    await db.query(`update public.konusmalar set kilit_bitis = now() - interval '1 second' where id = $1`, [r!.konusma_id]);
    expect(await bitir(is.id, A)).toBe(false); // süre dolmuş: yazamaz
    expect(await kilitAl(B)).toBe(r!.konusma_id);
    expect(await bitir(is.id, A)).toBe(false);
    expect(await birak(r!.konusma_id, A)).toBe("kayip");
    expect(await bitir(is.id, B)).toBe(true);
  });

  it("p_konusma_id verilirse yalnızca o konuşmaya bakar", async () => {
    await kaydet("+905330000001");
    const r2 = await kaydet("+905330000002");
    expect(await kilitAl(A, r2!.konusma_id)).toBe(r2!.konusma_id);
    expect(await kilitAl(B, r2!.konusma_id)).toBeNull();
  });

  it("kilit süresi 5–900 sn dışında reddedilir", async () => {
    await expect(kilitAl(A, null, 1)).rejects.toThrow(/5–900/);
  });
});

describe("tekrar denemesi ve sıra", () => {
  it("hatalı iş beklemeye alınır, konuşma sıra korunarak alınmaz; zamanı gelince alınır; 5 denemede 'hata'", async () => {
    const r = await kaydet();
    await kaydet(); // arkasında ikinci iş (zamanı gelmiş)
    const [is] = await isler(r!.konusma_id);
    await kilitAl(A);
    expect(await bitir(is.id, A, "Fırsat kaydedilirken başarısız")).toBe(true);
    expect((await isler(r!.konusma_id))[0]).toMatchObject({ durum: "bekliyor", deneme: 1 });
    const bekleme = await tek<{ sn: number }>(`select extract(epoch from sonraki_deneme - now())::int sn from public.konusma_isleri where id = $1`, [is.id]);
    expect(bekleme.sn).toBeGreaterThanOrEqual(28);
    expect(bekleme.sn).toBeLessThanOrEqual(31);
    expect(await birak(r!.konusma_id, A)).toBe("birakildi"); // en eski iş beklemede: 'devam' değil
    expect(await kilitAl(B)).toBeNull(); // ikinci iş hazır olsa da sıra bekler

    for (let d = 2; d <= 5; d++) {
      await db.query(`update public.konusma_isleri set sonraki_deneme = now() - interval '1 second' where id = $1`, [is.id]);
      expect(await kilitAl(B)).toBe(r!.konusma_id);
      await bitir(is.id, B, "yine hata");
      expect(await birak(r!.konusma_id, B)).toBe(d === 5 ? "devam" : "birakildi"); // 5.'de 'hata'ya geçer, sıradaki hazır
    }
    expect((await isler(r!.konusma_id)).map((x) => [x.durum, x.deneme])).toEqual([["hata", 5], ["bekliyor", 0]]);
    expect((await tek<{ h: string }>(`select son_hata h from public.konusma_isleri where id = $1`, [is.id])).h).toBe("yine hata");
  });
});

describe("yetki ve RLS", () => {
  const cagri = `select * from public.gelen_mesaj_kaydet('whatsapp', 'TEST', '+905339998877', 'T.RLS', 'musteri', 'x', 'metin', '{}'::jsonb, now())`;

  it("anon fonksiyonları çalıştıramaz, kuyruğu okuyamaz", async () => {
    await expect(rolIle(db, "anon", null, cagri)).rejects.toThrow(/permission denied/);
    await expect(rolIle(db, "anon", null, `select public.konusma_kilidi_al('${A}')`)).rejects.toThrow(/permission denied/);
    await expect(rolIle(db, "anon", null, `select count(*) from public.konusma_isleri`)).rejects.toThrow(/permission denied/);
  });

  it("ekip dışı oturum yazamaz (RLS), CRM ekibi yazabilir (simülasyon)", async () => {
    await expect(rolIle(db, "authenticated", YABANCI, cagri)).rejects.toThrow(/row-level security/);
    const [r] = await rolIle<{ mesaj_id: number }>(db, "authenticated", EKIP, cagri);
    expect(r.mesaj_id).toBeTruthy();
    const [s] = await rolIle<{ n: number }>(db, "authenticated", YABANCI, `select count(*)::int n from public.konusma_isleri`);
    expect(s.n).toBe(0);
  });
});
