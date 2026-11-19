// Plan önerisi: (1) senaryo tablosu (test/veri/plan-senaryolari.ts), (2) her özellik ve özellik çifti için 1–20 cihazda,
// iki para biriminde ve iki fiyat listesinde her zaman doğru olması gereken kurallar.
import { describe, expect, it } from "vitest";
import { OZELLIK_KATALOGU, PLAN_SIRASI, enUygunPlan } from "@/lib/urun-bilgisi";
import { VARSAYILAN_FIYAT, lisansYillikFiyat, type FiyatListesi, type LisansPaketi, type ParaBirimi } from "@/lib/urunler";
import { PLAN_SENARYOLARI } from "./veri/plan-senaryolari";

const BASLANGIC: FiyatListesi = { ...structuredClone(VARSAYILAN_FIYAT), eurKur: 55.54 };

describe("senaryo tablosu (gerçek katalog, başlangıç fiyatları)", () => {
  it.each(PLAN_SENARYOLARI.map((s) => [s.musteri, s] as const))("%s", (_ad, s) => {
    const r = enUygunPlan(s.ozellikler, s.cihaz, { fiyat: BASLANGIC, cihazModeli: s.model });
    expect(r.oneri).toMatchObject({ plan: s.plan, lisansAdedi: s.lisans, yillikTutar: s.tutar });
    expect(r.bilinmeyen).toEqual(s.bilinmeyen ?? []);
    expect(r.modelUyumsuz).toBe(s.modelUyumsuz ?? false);
    if (s.ust === null) expect(r.ustPlan).toBeNull();
    else if (s.ust) expect(r.ustPlan).toMatchObject({ plan: s.ust.plan, lisansAdedi: s.ust.lisans, yillikTutar: s.ust.tutar, ekTutar: s.ust.ekTutar });
  });
});

/* ---------- Kurallar ---------- */

// İkinci fiyat listesi: Premium fiyatlı, elle EUR fiyatları var, Pro+ 4 cihaz. Kurallar fiyattan bağımsız olmalı.
const FARKLI: FiyatListesi = {
  ...structuredClone(VARSAYILAN_FIYAT),
  eurKur: 50,
  lisans: {
    Basic: { fiyat: 45_000, cihaz: 1, eurFiyat: 800 },
    Pro: { fiyat: 65_000, cihaz: 1 },
    "Pro+": { fiyat: 150_000, cihaz: 4, eurFiyat: 2_500 },
    Premium: { fiyat: 300_000, cihaz: 5 },
    Enterprise: { fiyat: null, cihaz: null },
  },
};

const sira = (p: LisansPaketi) => PLAN_SIRASI.indexOf(p);
const ids = OZELLIK_KATALOGU.map((o) => o.id);
const ISTEKLER: string[][] = [[], ...ids.map((a) => [a]), ...ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]))];
const DURUMLAR = [BASLANGIC, FARKLI].flatMap((fiyat) => (["TRY", "EUR"] as ParaBirimi[]).map((paraBirimi) => ({ fiyat, paraBirimi })));

/** Bir planın n cihaz için tutarı (testin kendi hesabı) */
function tutar(f: FiyatListesi, p: LisansPaketi, n: number, pb: ParaBirimi) {
  const birim = lisansYillikFiyat(f, p, pb);
  const kapsam = f.lisans[p].cihaz;
  const lisans = kapsam ? Math.ceil(n / kapsam) : 1;
  return { lisans, tutar: birim === null ? null : birim * lisans };
}

describe("plan önerisi kuralları (her özellik ve özellik çifti × 1–20 cihaz × TRY/EUR × 2 fiyat listesi)", () => {
  it("katalogda kural denemeye yetecek özellik var", () => {
    expect(ISTEKLER.length).toBeGreaterThan(100);
  });

  it.each(DURUMLAR.map((d, i) => [`fiyat listesi ${i < 2 ? "başlangıç" : "farklı"} · ${d.paraBirimi}`, d] as const))("%s", (_ad, { fiyat, paraBirimi }) => {
    for (const istek of ISTEKLER) {
      const ozellikler = OZELLIK_KATALOGU.filter((o) => istek.includes(o.id));
      const enAz = Math.max(0, ...ozellikler.map((o) => sira(o.enDusukPlan)));
      let onceki: number | null = null;

      for (let n = 1; n <= 20; n++) {
        const r = enUygunPlan(istek, n, { fiyat, paraBirimi });
        const ad = `${istek.join("+") || "(boş)"} × ${n}`;
        const o = r.oneri;
        expect(o, ad).not.toBeNull();
        if (!o) continue;

        // 1. İstenen her özelliği kapsar
        expect(sira(o.plan), ad).toBeGreaterThanOrEqual(enAz);
        // 2. Lisanslar cihazları karşılar, fazladan lisans yok
        const kapsam = fiyat.lisans[o.plan].cihaz;
        if (kapsam) {
          expect(o.lisansAdedi * kapsam, ad).toBeGreaterThanOrEqual(n);
          expect((o.lisansAdedi - 1) * kapsam, ad).toBeLessThan(n);
        } else expect(o.lisansAdedi, ad).toBe(1);
        // 3. Kapsayan, fiyatı belli hiçbir plan daha ucuz değil; özel fiyat yalnızca fiyatlı aday yoksa önerilir
        const adaylar = PLAN_SIRASI.slice(enAz).map((p) => ({ p, ...tutar(fiyat, p, n, paraBirimi) }));
        expect(o.yillikTutar, ad).toBe(tutar(fiyat, o.plan, n, paraBirimi).tutar);
        for (const a of adaylar) if (a.tutar !== null) {
          expect(o.yillikTutar, `${ad}: ${a.p}`).not.toBeNull();
          expect(a.tutar, `${ad}: ${a.p} daha ucuz`).toBeGreaterThanOrEqual(o.yillikTutar!);
        }
        // 4. Cihaz arttıkça tutar düşmez
        if (onceki !== null && o.yillikTutar !== null) expect(o.yillikTutar, ad).toBeGreaterThanOrEqual(onceki);
        onceki = o.yillikTutar;

        // 5. Yükseltme: önerilenden üstte, özellik ekler ve özellik ekleyen en ucuz plandır
        const ekleyenler = PLAN_SIRASI.slice(sira(o.plan) + 1)
          .filter((p) => OZELLIK_KATALOGU.some((x) => sira(x.enDusukPlan) > sira(o.plan) && sira(x.enDusukPlan) <= sira(p)))
          .map((p) => ({ p, ...tutar(fiyat, p, n, paraBirimi) }));
        const u = r.ustPlan;
        if (ekleyenler.length === 0) { expect(u, ad).toBeNull(); continue; }
        expect(u, ad).not.toBeNull();
        if (!u) continue;
        expect(sira(u.plan), ad).toBeGreaterThan(sira(o.plan));
        expect(u.ekOzellikler.length, ad).toBeGreaterThan(0);
        for (const x of u.ekOzellikler) expect(sira(x.enDusukPlan) > sira(o.plan) && sira(x.enDusukPlan) <= sira(u.plan), `${ad}: ${x.id}`).toBe(true);
        for (const e of ekleyenler) if (e.tutar !== null) {
          expect(u.yillikTutar, `${ad}: ${e.p} fiyatlı yükseltme var`).not.toBeNull();
          expect(e.tutar, `${ad}: ${e.p} daha ucuz yükseltme`).toBeGreaterThanOrEqual(u.yillikTutar!);
        }
        expect(u.ekTutar, ad).toBe(u.yillikTutar !== null && o.yillikTutar !== null ? u.yillikTutar - o.yillikTutar : null);
      }
    }
  });
});
