// Uzun metni kanalın azami uzunluğuna göre parçalar. Önce paragraf, sonra satır, cümle ve kelime sınırından böler;
// tek kelime bile sığmıyorsa sert keser. Parçalar kırpılır, boş parça dönmez. `olc` uzunluğu ölçer (karakter ya da bayt).
export const karakterSay = (s: string) => [...s].length;
export const utf8BaytSay = (s: string) => Buffer.byteLength(s, "utf8");

const AYIRICILAR = [/\n{2,}/, /\n/, /(?<=[.!?…])\s+/, /\s+/];

export function metniBol(metin: string, azami: number, olc: (s: string) => number = karakterSay): string[] {
  const t = metin.trim();
  if (!t) return [];
  if (olc(t) <= azami) return [t];
  for (const ayirici of AYIRICILAR) {
    const parcalar = t.split(ayirici).map((p) => p.trim()).filter(Boolean);
    if (parcalar.length < 2) continue;
    const ayrac = ayirici.source.startsWith("\\n{2") ? "\n\n" : ayirici.source === "\\n" ? "\n" : " ";
    const sonuc: string[] = [];
    let birikim = "";
    for (const p of parcalar) {
      const aday = birikim ? `${birikim}${ayrac}${p}` : p;
      if (olc(aday) <= azami) {
        birikim = aday;
        continue;
      }
      if (birikim) sonuc.push(birikim);
      if (olc(p) <= azami) birikim = p;
      else {
        sonuc.push(...metniBol(p, azami, olc)); // bu parça bir alt ayırıcıyla bölünür
        birikim = "";
      }
    }
    if (birikim) sonuc.push(birikim);
    return sonuc;
  }
  // Ayırıcı yok (tek uzun kelime): kod noktası bazında sert kesim
  const sonuc: string[] = [];
  let parca = "";
  for (const ch of t) {
    if (olc(parca + ch) > azami) {
      sonuc.push(parca);
      parca = "";
    }
    parca += ch;
  }
  if (parca) sonuc.push(parca);
  return sonuc;
}
