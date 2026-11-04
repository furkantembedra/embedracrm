// Gerçek cihaz olmadan "ONESuite sürüm bildirdi" durumunu dener.
//
//   npm run cihaz-bildir -- EO1-2402-0612 v2.4.1     → tek cihaz bildirir
//   npm run cihaz-bildir -- demo                     → eski sürümdeki 3 cihaz 4'er sn arayla güncellenir
//
// Geliştirme sunucusu (npm run dev) açık olmalı. Cihaz & Lisans sayfası açıksa birkaç saniyede güncellenir.
// Anahtar, CRM'deki lib/cihaz-anahtari.ts ile aynı yöntemle üretilir (cihazın içinde saklanacak değer).
import { createHmac } from "node:crypto";

const ADRES = process.env.CRM_ADRESI ?? "http://localhost:3000";
const SIR = process.env.CIHAZ_BILDIRIM_SIRRI ?? "embedra-demo-sirri";
const anahtar = (seriNo) => createHmac("sha256", SIR).update(seriNo).digest("hex").slice(0, 32);

async function bildir(seriNo, surum) {
  const yanit = await fetch(`${ADRES}/api/cihaz-bildirimi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriNo, surum, anahtar: anahtar(seriNo) }),
  });
  const veri = await yanit.json().catch(() => ({}));
  console.log(`${yanit.ok ? "✓" : "✗"} ${seriNo} → ${surum}  (${yanit.status})`, veri.hata ?? (veri.guncellemeVar ? "güncelleme var" : "güncel"));
}

const [ilk, ikinci] = process.argv.slice(2);
if (ilk === "demo") {
  const senaryo = [
    ["EO1-2311-0322", "v2.4.1"], // Ege MYO: v2.3.2 → v2.4.1
    ["EO1-2309-0142", "v2.4.1"], // Akdeniz: v2.2.4 → v2.4.1
    ["EO1-2311-0301", "v2.3.2"], // Atelier: aynı sürüm, yalnızca "son görülme" güncellenir
  ];
  for (const [i, [s, v]] of senaryo.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 4000));
    await bildir(s, v);
  }
} else if (ilk && ikinci) {
  await bildir(ilk, ikinci);
} else {
  console.log("Kullanım: npm run cihaz-bildir -- <seri-no> <sürüm>   veya   npm run cihaz-bildir -- demo");
  process.exit(1);
}
