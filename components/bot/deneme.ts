// "Botu dene" (Bot › Ayarlar, P2.4): Yönetici kaydetmeden önce TASLAK ayarlarla örnek konuşma yapar. Gerçek bot
// turuyla aynı istem (sabit kısım taslak ayarla kurulur, değişken kısım seçilen kanalın adaptöründen biçim
// sınırlarıyla) ve aynı araç tanımları kullanılır; ama:
//  • Hiçbir şey müşteriye gitmez, konuşma / mesaj / fırsat kaydı açılmaz. Cevap adaptörün bol() işleviyle kanalda
//    nasıl parçalanacağı gösterilerek döner.
//  • Araçlar bellek içi "deneme deposu"yla çalışır: lead kartı yalnızca bu denemede birikir (istemci bir sonraki
//    mesajda geri yollar), fırsat notu / hatırlatma / izin yazılmaz; plan_oner güncel fiyat listesini ve bayi
//    kontrolü bayi tablosunu yalnızca OKUR. insana_devret konuşmayı devretmez, yalnızca "devrederdi" der.
//  • Kullanım gerçek maliyettir: bot_kullanim'e tur = 'deneme' (konuşmasız) yazılır ve günlük maliyet sınırına
//    dahildir; sınır doluysa deneme de yapılmaz. Acil durdurma denemeyi engellemez (müşteriye bir şey gitmez).
// Kanal adına göre dal yok (değişmez kural 13).
import type Anthropic from "@anthropic-ai/sdk";
import { adaptorBul } from "@/components/konusma/kanallar";
import { ARAC_DEVIR_SEBEPLERI, araciCalistir, aracTanimlari, type AracSonucu } from "./araclar";
import { supabaseAracDeposu, type AracDeposu } from "./arac-deposu";
import { claudeCagir, claudeHazir, hataKodu, kullanim } from "./claude";
import { degiskenIstem, ISTEM_SURUMU, sabitSistemIstemi, type IstemMesaji } from "./istem";
import { leadKartiOku, type LeadKarti } from "./lead-karti";
import { mesaiDurumu, type BilgiKaynagi, type IstemAyarlari } from "./ayar-surumu";
import { botAyarlariOku, denemeKullanimiYaz, gunlukMaliyet } from "./veri";
import { BOT_AZAMI_API_CAGRISI, BOT_EFFORT, BOT_MESAJ_KIRP, BOT_MODELI, BOT_SON_MESAJ, maliyetHesapla, type TokenKullanimi } from "./yapilandirma";

export type DenemeMesaji = { gonderen: "musteri" | "bot"; metin: string };

export type DenemeSonucu =
  | {
      ok: true;
      /** Müşteriye gidecek metin, kanal adaptörünün bölmesiyle (boşsa bot sessiz kaldı) */
      parcalar: string[];
      araclar: { ad: string; sonuc: string; hata: boolean }[];
      devir: boolean;
      /** Bu denemede biriken lead kartı (istemci sonraki mesajda geri yollar) */
      kart: LeadKarti;
      kullanim: TokenKullanimi;
      maliyetUsd: number;
      apiCagrisi: number;
    }
  | { ok: false; hata: string; maliyetUsd?: number };

export const DENEME_AZAMI_MESAJ = BOT_SON_MESAJ;

/** Bellek içi depo: yalnızca kart birikir; diğer yazmalar yok sayılır, okumalar gerçek ve salt okunur */
function denemeDeposu(kanal: string, kart: LeadKarti): { depo: AracDeposu; kart: () => LeadKarti } {
  let k: LeadKarti = { ...kart };
  const depo: AracDeposu = {
    async konusma() {
      return {
        konusmaId: 0, kanal: kanal as never, disKullaniciId: "deneme", profilAdi: null, musteriId: null,
        firsat: { id: 0, firma: k.firma ?? "Deneme", konum: null, telefon: null, musteriId: null, sorumluId: null, kart: k },
      };
    },
    async kartBirlestir(_id, yama) {
      const yeni: Record<string, unknown> = { ...k };
      for (const [a, v] of Object.entries(yama)) {
        if (v === null) delete yeni[a];
        else yeni[a] = v;
      }
      k = leadKartiOku(yeni);
      return k;
    },
    async firsatGuncelle() {},
    async yetkiliEslestir() { return []; },
    async musteriyeBagla() {},
    munhasirBayiler: (ulke) => supabaseAracDeposu.munhasirBayiler(ulke),
    async firsatNotu() {},
    async hatirlatma() {},
    async izinYaz() {},
    fiyatListesi: () => supabaseAracDeposu.fiyatListesi(),
  };
  return { depo, kart: () => k };
}

/** insana_devret denemede devretmez; girdiyi aynı kurallarla denetler */
function denemeDevri(girdi: unknown): AracSonucu {
  const g = girdi && typeof girdi === "object" ? (girdi as Record<string, unknown>) : null;
  if (!(ARAC_DEVIR_SEBEPLERI as readonly unknown[]).includes(g?.sebep)) return { icerik: "Geçersiz sebep. Listeden bir sebep seç.", hata: true };
  return { icerik: "Konuşma ekibe devredildi. İstersen müşteriye tek kısa cümleyle bir ekip arkadaşının döneceğini söyle; soru sorma.", devir: true };
}

/** Modele dönen araç sonucunun ekranda gösterilecek kısa hâli */
const ozet = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 300);

/**
 * Taslak ayarla tek bir deneme turu. Girdi çağıran tarafından doğrulanmış olmalı (actions.ts); burada yalnızca kapılar:
 * anahtar, kanal adaptörü, günlük maliyet sınırı.
 */
export async function denemeTuru(g: {
  ayarlar: IstemAyarlari;
  kaynaklar: readonly BilgiKaynagi[];
  kanal: string;
  mesajlar: DenemeMesaji[];
  kart: unknown;
  simdi?: Date;
}): Promise<DenemeSonucu> {
  const simdi = g.simdi ?? new Date();
  if (!claudeHazir()) return { ok: false, hata: "ANTHROPIC_API_KEY tanımlı değil: bot ve deneme kapalı." };
  const a = adaptorBul(g.kanal);
  if (!a) return { ok: false, hata: "Bu kanalın adaptörü henüz yok (Faz 4); biçim sınırları bilinmiyor." };
  const ayarlar = await botAyarlariOku();
  const bugun = await gunlukMaliyet(simdi);
  if (bugun >= ayarlar.gunlukMaliyetSiniriUsd) return { ok: false, hata: "Günlük maliyet sınırı doldu; deneme de yapılamıyor." };
  const son = g.mesajlar.at(-1);
  if (!son || son.gonderen !== "musteri") return { ok: false, hata: "Son mesaj müşteriden olmalı." };

  const zaman = simdi.toISOString();
  const istemMesajlari: IstemMesaji[] = g.mesajlar.slice(-DENEME_AZAMI_MESAJ).map((m) => ({
    gonderen: m.gonderen, metin: m.metin.slice(0, BOT_MESAJ_KIRP), zaman, tur: "metin", ek: null,
  }));
  const d = denemeDeposu(a.kanal, leadKartiOku(g.kart));
  const mesajlar: Anthropic.MessageParam[] = [{
    role: "user",
    content: degiskenIstem({
      kanalAd: a.ad, sinirlar: a.sinirlar, ekipNotu: null, mesajlar: istemMesajlari, mesai: mesaiDurumu(g.ayarlar.mesaiSaatleri, simdi),
      // Telefonun kanaldan gelip gelmediği adaptörden: örnek bir numarayı çözebiliyorsa kanal telefon veriyordur
      lead: { firma: null, konum: null, asama: null, ilgi: null, kart: d.kart(), kanalTelefonu: a.telefon(a.kimlikAlani.ornek) != null },
    }),
  }];
  const sistem = sabitSistemIstemi(g.ayarlar, g.kaynaklar);
  const araclar = aracTanimlari();

  const toplam: TokenKullanimi = { girdi: 0, cikti: 0, cacheYazma: 0, cacheOkuma: 0 };
  const cagrilar: { ad: string; sonuc: string; hata: boolean }[] = [];
  let apiCagrisi = 0;
  let devir = false;
  let hata: string | null = null;
  let red = false;
  let yanit: Anthropic.Message | null = null;
  const baslangic = Date.now();

  for (;;) {
    if (apiCagrisi >= BOT_AZAMI_API_CAGRISI) { hata = "arac_dongusu"; break; }
    apiCagrisi++;
    try {
      yanit = await claudeCagir({ sistem, araclar, mesajlar });
    } catch (e) {
      hata = hataKodu(e);
      break;
    }
    const u = kullanim(yanit);
    toplam.girdi += u.girdi; toplam.cikti += u.cikti; toplam.cacheYazma += u.cacheYazma; toplam.cacheOkuma += u.cacheOkuma;
    if (yanit.stop_reason === "refusal") { red = true; break; }
    if (yanit.stop_reason === "max_tokens" || yanit.stop_reason === "model_context_window_exceeded") { hata = "max_tokens"; break; }
    if (yanit.stop_reason !== "tool_use") break;
    const sonuclar: Anthropic.ToolResultBlockParam[] = [];
    for (const c of yanit.content.filter((x): x is Anthropic.ToolUseBlock => x.type === "tool_use")) {
      const r = c.name === "insana_devret" ? denemeDevri(c.input) : await araciCalistir(c.name, c.input, { konusmaId: 0, depo: d.depo, simdi: () => simdi });
      if (r.devir) devir = true;
      cagrilar.push({ ad: c.name, sonuc: ozet(r.icerik), hata: !!r.hata });
      sonuclar.push({ type: "tool_result", tool_use_id: c.id, content: r.icerik, ...(r.hata ? { is_error: true } : {}) });
    }
    mesajlar.push({ role: "assistant", content: yanit.content }, { role: "user", content: sonuclar });
  }

  const maliyetUsd = maliyetHesapla(BOT_MODELI, toplam);
  const metin = !hata && !red && yanit?.stop_reason !== "tool_use"
    ? (yanit?.content ?? []).filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text.trim()).filter(Boolean).join("\n\n")
    : "";
  const sonuc = red ? "red" : hata ? "hata" : devir ? "devir" : metin ? "cevap" : "sessiz";
  await denemeKullanimiYaz({
    tur: "deneme", kanal: a.kanal, model: BOT_MODELI, effort: BOT_EFFORT, istemSurumu: `${ISTEM_SURUMU}/taslak`,
    apiCagrisi, ...toplam, maliyetUsd, araclar: cagrilar.map((c) => c.ad), sonuc, hataKodu: red ? "red" : hata, sureMs: Date.now() - baslangic,
  });
  if (red) return { ok: false, hata: "Model bu mesaja cevap vermeyi reddetti (refusal). Gerçek konuşmada ekibe devredilirdi.", maliyetUsd };
  if (hata) return { ok: false, hata: `Claude çağrısı başarısız (${hata}). Gerçek konuşmada ekibe devredilirdi.`, maliyetUsd };
  return { ok: true, parcalar: metin ? a.bol(metin) : [], araclar: cagrilar, devir, kart: d.kart(), kullanim: toplam, maliyetUsd, apiCagrisi };
}
