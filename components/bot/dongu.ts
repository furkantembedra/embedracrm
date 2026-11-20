// Bot döngüsü (P2.1). Kuyruk işleyicisi (components/konusma/kuyruk.ts) konuşma kilidi elindeyken, bot turunun zamanı
// geldiyse (son müşteri mesajından 6 sn sonra; SQL'de zaman damgasıyla) botTuru'nu bir kez çağırır.
//
// Akış: kapılar → son 20 mesaj + lead kartı ile Claude → araç çağrıları (en çok BOT_AZAMI_API_CAGRISI) → cevap
// konuşmanın kanal adaptörüyle gönderilir (bölme ve biçim adaptörde, components/konusma/gonder.ts) ve gönderen: bot
// olarak yazılır → tur bot_kullanim'e yazılır (token, maliyet, istem sürümü, araçlar; metin ve kişisel veri yok).
//
// Kapılar (biri tutmazsa Claude hiç çağrılmaz; bot bu konuşmada cevap verecekken veremiyorsa konuşma insana
// devredilir ki müşteri sessizce beklemesin, "Cevap bekliyor" + sorumluya bildirim):
//   bot kapalı / cevaplanacak yeni müşteri mesajı yok → hiçbir şey · ANTHROPIC_API_KEY yok · acil durdurma ·
//   kanalın bot modu "otomatik" değil (gölge P2.5) · adaptör pencereyi "acik" demiyor (etiketli pencere yalnızca
//   temsilci içindir) · tur sınırı · günlük maliyet sınırı (aşılınca yöneticilere günde bir bildirim, P2.4).
// Sabit istem Bot › Ayarlar'daki aktif ayar sürümünden kurulur (P2.4); mesai durumu değişken kısma gider.
// Hata, zaman aşımı, refusal ya da boş cevapta müşteriye bekletme mesajı GİTMEZ; konuşma insana devredilir.
//
// Kanal adına göre dal yok (değişmez kural 13): kanal adı, pencere ve biçim sınırları adaptörden.
import type Anthropic from "@anthropic-ai/sdk";
import { adaptorBul } from "@/components/konusma/kanallar";
import { mesajGonder } from "@/components/konusma/gonder";
import { botDevretti } from "@/components/konusma/devir";
import { botNotunuAl } from "@/components/konusma/queries";
import type { DevirSebebi } from "@/components/konusma/devir-sebepleri";
import { araciCalistir, aracTanimlari } from "./araclar";
import { claudeCagir, claudeHazir, hataKodu, kullanim } from "./claude";
import { degiskenIstem, istemSurumuEtiketi, sabitSistemIstemi } from "./istem";
import { mesaiDurumu } from "./ayar-surumu";
import { maliyetSiniriBildir } from "./maliyet";
import {
  aktifIstemAyari, botAktifMi, botAyarlariOku, botBaglamiOku, botKullanimYaz, botMesajlariniBagla, gunlukMaliyet, kanalBotModu, turSayisi,
  type BotKullanimKaydi,
} from "./veri";
import { BOT_AZAMI_API_CAGRISI, BOT_EFFORT, BOT_MODELI, maliyetHesapla, type TokenKullanimi } from "./yapilandirma";

/** Turun toplam süre bütçesi: bundan sonra yeni API çağrısı başlatılmaz (kuyruk kilidi 120 sn) */
export const BOT_TUR_SURESI_MS = 60_000;

export type BotTuruSonucu =
  | { durum: "atlandi"; neden: "konusma_yok" | "bot_kapali" | "kanal_yok" | "cevaplanacak_yok" }
  /** Kapıdan geçemedi, Claude çağrılmadı, konuşma insana devredildi */
  | { durum: "kapi"; neden: "anahtar_yok" | "acil_durdurma" | "kanal_modu" | "pencere" | "tur_siniri" | "maliyet_siniri" }
  | { durum: BotKullanimKaydi["sonuc"]; kullanimId: number; mesajIdleri: number[] };

const KAPI_ACIKLAMASI: Record<Extract<BotTuruSonucu, { durum: "kapi" }>["neden"], string> = {
  anahtar_yok: "Bot kapalı: ANTHROPIC_API_KEY tanımlı değil.",
  acil_durdurma: "Bot › Ayarlar'da acil durdurma açık.",
  kanal_modu: "Bu kanalda bot modu otomatik değil (Bot › Kanallar).",
  pencere: "Mesaj penceresi açık değil; bot yazamaz.",
  tur_siniri: "Konuşmada botun tur sınırı doldu.",
  maliyet_siniri: "Botun günlük maliyet sınırı doldu.",
};

async function kapi(konusmaId: number, neden: Extract<BotTuruSonucu, { durum: "kapi" }>["neden"]): Promise<BotTuruSonucu> {
  const sebep: DevirSebebi = neden === "tur_siniri" ? "tur_siniri" : "diger";
  await botDevretti(konusmaId, sebep, KAPI_ACIKLAMASI[neden]);
  console.info(`[bot] konuşma ${konusmaId}: Claude çağrılmadı (${neden}), konuşma insana devredildi`);
  return { durum: "kapi", neden };
}

const HATA_ACIKLAMASI: Record<string, string> = {
  zaman_asimi: "Claude zaman aşımına uğradı.",
  red: "Model bu mesaja cevap vermeyi reddetti (refusal).",
  max_tokens: "Model cevabı yarıda kaldı.",
  arac_dongusu: "Araç döngüsü sınırı aşıldı.",
  tur_suresi: "Bot turu süre bütçesini aştı.",
  bos_cevap: "Model gönderilecek bir cevap üretmedi.",
  gonderim: "Cevap kanala gönderilemedi.",
};
const hataAciklamasi = (kod: string) => HATA_ACIKLAMASI[kod] ?? `Claude API hatası (${kod}).`;

/** Konuşmanın bir bot turunu çalıştırır. Hiçbir zaman fırlatmaz (veritabanı hatası dışında). */
export async function botTuru(konusmaId: number, simdi = () => new Date()): Promise<BotTuruSonucu> {
  const baslangic = Date.now();
  const b = await botBaglamiOku(konusmaId);
  if (!b) return { durum: "atlandi", neden: "konusma_yok" };
  if (!b.botAktif) return { durum: "atlandi", neden: "bot_kapali" };
  const a = adaptorBul(b.kanal);
  if (!a) return { durum: "atlandi", neden: "kanal_yok" };

  // Cevaplanacak: konuşmanın son mesajı müşteriden ve bot (yeniden) açılmadan önce gelmemiş olmalı. Eşitlik geçerli:
  // yeni konuşmanın ilk mesajı konuşmayla aynı işlemde yazılır, created_at = bot_durumu_zamani (ikisi de now()).
  const son = b.mesajlar.at(-1);
  if (!son || son.gonderen !== "musteri" || Date.parse(son.olusturma) < Date.parse(b.botDurumuZamani)) {
    return { durum: "atlandi", neden: "cevaplanacak_yok" };
  }

  // Kapılar
  if (!claudeHazir()) return kapi(konusmaId, "anahtar_yok");
  const ayarlar = await botAyarlariOku();
  if (ayarlar.acilDurdurma) return kapi(konusmaId, "acil_durdurma");
  if ((await kanalBotModu(b.kanal)) !== "otomatik") return kapi(konusmaId, "kanal_modu");
  if (a.pencere(b.sonMusteriMesaji, simdi()).durum !== "acik") return kapi(konusmaId, "pencere");
  if ((await turSayisi(konusmaId, b.botDurumuZamani)) >= ayarlar.turSiniri) return kapi(konusmaId, "tur_siniri");
  const bugun = await gunlukMaliyet(simdi());
  if (bugun >= ayarlar.gunlukMaliyetSiniriUsd) {
    // Bot durur (konuşma devredilir) ve yöneticilere günde bir kez bildirim gider
    await maliyetSiniriBildir(bugun, ayarlar.gunlukMaliyetSiniriUsd, simdi());
    return kapi(konusmaId, "maliyet_siniri");
  }

  // İstem: sabit sistem + araçlar önde, değişken her şey tek kullanıcı mesajında sonda
  const ekipNotu = await botNotunuAl(konusmaId);
  // Sabit kısım Bot › Ayarlar'daki aktif sürümden (sürüm değişmedikçe bayt bayt aynı → önbellekten okunur)
  const ayar = await aktifIstemAyari();
  const mesajlar: Anthropic.MessageParam[] = [{
    role: "user",
    content: degiskenIstem({
      kanalAd: a.ad, sinirlar: a.sinirlar, lead: b.lead, ekipNotu, mesajlar: b.mesajlar, mesai: mesaiDurumu(ayar.ayarlar.mesaiSaatleri, simdi()),
    }),
  }];
  const sistem = sabitSistemIstemi(ayar.ayarlar, ayar.kaynaklar);
  const araclar = aracTanimlari();

  const toplam: TokenKullanimi = { girdi: 0, cikti: 0, cacheYazma: 0, cacheOkuma: 0 };
  const cagrilanAraclar: string[] = [];
  let apiCagrisi = 0;
  let devir = false;
  let hata: string | null = null;
  let red = false;
  let son_yanit: Anthropic.Message | null = null;

  for (;;) {
    if (apiCagrisi >= BOT_AZAMI_API_CAGRISI) { hata = "arac_dongusu"; break; }
    if (Date.now() - baslangic > BOT_TUR_SURESI_MS) { hata = "tur_suresi"; break; }
    apiCagrisi++;
    let y: Anthropic.Message;
    try {
      y = await claudeCagir({ sistem, araclar, mesajlar });
    } catch (e) {
      hata = hataKodu(e);
      console.error(`[bot] konuşma ${konusmaId}: Claude çağrısı başarısız (${hata})`);
      break;
    }
    const u = kullanim(y);
    toplam.girdi += u.girdi; toplam.cikti += u.cikti; toplam.cacheYazma += u.cacheYazma; toplam.cacheOkuma += u.cacheOkuma;
    // Önbellek denetimi: cache_read 0 kalıyorsa sabit önekte sessiz bir bozucu var (prompt-caching.md)
    console.info(`[bot] konuşma ${konusmaId} çağrı ${apiCagrisi}: girdi=${u.girdi} cache_read_input_tokens=${u.cacheOkuma} cache_creation_input_tokens=${u.cacheYazma} çıktı=${u.cikti} stop=${y.stop_reason}`);
    son_yanit = y;

    if (y.stop_reason === "refusal") { red = true; break; }
    if (y.stop_reason === "max_tokens" || y.stop_reason === "model_context_window_exceeded") { hata = "max_tokens"; break; }
    if (y.stop_reason !== "tool_use") break;

    const cagrilar = y.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const sonuclar: Anthropic.ToolResultBlockParam[] = [];
    for (const c of cagrilar) {
      cagrilanAraclar.push(c.name);
      const r = await araciCalistir(c.name, c.input, { konusmaId });
      if (r.devir) devir = true;
      sonuclar.push({ type: "tool_result", tool_use_id: c.id, content: r.icerik, ...(r.hata ? { is_error: true } : {}) });
    }
    // Asistan içeriği (thinking blokları dahil) değiştirilmeden geri verilir; tüm araç sonuçları tek kullanıcı mesajında
    mesajlar.push({ role: "assistant", content: y.content }, { role: "user", content: sonuclar });
  }

  // Yalnızca son yanıtın metni müşteriye gider (araç çağrısı öncesi ara metinler bekletme cümlesi olabilir)
  const metin = !hata && !red && son_yanit?.stop_reason !== "tool_use"
    ? (son_yanit?.content ?? []).filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text.trim()).filter(Boolean).join("\n\n")
    : "";

  let sonuc: BotKullanimKaydi["sonuc"];
  let mesajIdleri: number[] = [];
  let hataKoduYaz: string | null = hata;
  if (red) {
    sonuc = "red";
    hataKoduYaz = "red";
  } else if (hata) {
    sonuc = "hata";
  } else if (!devir && !(await botAktifMi(konusmaId))) {
    // Tur sürerken temsilci devraldı / yazdı: cevap gönderilmez (değişmez kural 4)
    sonuc = "iptal";
  } else if (!metin) {
    sonuc = devir ? "devir" : "sessiz";
    if (!devir) hataKoduYaz = "bos_cevap";
  } else {
    const g = await mesajGonder(konusmaId, metin, "bot");
    mesajIdleri = g.ok ? g.mesajIdleri : [];
    if (g.ok) sonuc = devir ? "devir" : "cevap";
    else {
      sonuc = "hata";
      hataKoduYaz = "gonderim";
      console.error(`[bot] konuşma ${konusmaId}: cevap gönderilemedi (${g.kod ?? "kanal"}), ${g.gonderilen} parça gitti`);
    }
  }

  const kayit: BotKullanimKaydi = {
    konusmaId, kanal: b.kanal, model: BOT_MODELI, effort: BOT_EFFORT, istemSurumu: istemSurumuEtiketi(ayar.surumNo), apiCagrisi,
    ...toplam, maliyetUsd: maliyetHesapla(BOT_MODELI, toplam), araclar: cagrilanAraclar, sonuc,
    hataKodu: hataKoduYaz, sureMs: Date.now() - baslangic,
  };
  const kullanimId = await botKullanimYaz(kayit);
  await botMesajlariniBagla(mesajIdleri, kullanimId);

  // Hata / refusal / boş cevap / gönderim hatası: bekletme mesajı yok, konuşma insana devredilir
  if (sonuc === "hata" || sonuc === "red" || sonuc === "sessiz") {
    await botDevretti(konusmaId, "bot_hatasi", hataAciklamasi(hataKoduYaz ?? "beklenmeyen"));
  }
  console.info(`[bot] konuşma ${konusmaId}: tur ${sonuc}, ${apiCagrisi} çağrı, ${kayit.maliyetUsd} USD, araçlar: ${cagrilanAraclar.join(",") || "-"}`);
  return { durum: sonuc, kullanimId, mesajIdleri };
}
