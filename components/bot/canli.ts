"use client";

// Gelen kutusunun canlı yenilenmesi.
//
// Seçim: Supabase Realtime (postgres_changes) + yedek olarak seyrek yenileme. Gerekçe:
//  • Yeni mesaj saniyeler içinde görünür (bot konuşurken ekip canlı izler); kısa aralıklı yenileme her açık sekmede
//    sürekli sorgu demek (5 sn'de bir × kullanıcı × sekme), üstelik yine birkaç saniye geç kalır.
//  • RLS ile uyumlu: Realtime her değişikliği abonenin kendi JWT'siyle tablonun SELECT politikasından geçirir
//    (konusmalar / konusma_mesajlari: yalnızca aktif CRM ekibi). Tarayıcı istemcisi oturum çerezindeki token'ı kullanır;
//    bayi ya da oturumsuz biri olay alamaz.
//  • Olayın içeriği kullanılmaz, yalnızca "değişti" sinyalidir: veri her zaman Server Action'la (rol kontrolüyle,
//    tek okuma yolundan) yeniden okunur. Böylece ekran ile sunucu aynı kuralı kullanır, istemcide birleştirme hatası olmaz.
//  • Kanal kurulamazsa ya da koparsa (ağ, Realtime kapalı) 20 sn'de bir yenilemeye düşer; bağlıyken de pencere
//    sürelerinin (24 saat) güncel kalması için 2 dakikada bir yenilenir.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const YEDEK_ARALIK_MS = 20_000;
const BAGLIYKEN_ARALIK_MS = 120_000;
const TOPLAMA_MS = 400; // aynı anda gelen olayları tek yenilemeye toplar

export type CanliDurum = "baglaniyor" | "canli" | "yedek";

export function useCanliYenileme(yenile: () => void): CanliDurum {
  const [durum, setDurum] = useState<CanliDurum>("baglaniyor");
  const yenileRef = useRef(yenile);
  useEffect(() => {
    yenileRef.current = yenile;
  }, [yenile]);

  useEffect(() => {
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    const tetikle = () => {
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => yenileRef.current(), TOPLAMA_MS);
    };
    let bagli = false;
    let bitti = false; // temizlikten sonra gelen durum (kanal kapatıldı: CLOSED) yok sayılır
    let kanal: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let istemci: ReturnType<typeof createClient> | null = null;
    try {
      istemci = createClient();
      kanal = istemci
        .channel("bot-gelen-kutusu")
        .on("postgres_changes", { event: "*", schema: "public", table: "konusma_mesajlari" }, tetikle)
        .on("postgres_changes", { event: "*", schema: "public", table: "konusmalar" }, tetikle)
        .subscribe((s) => {
          if (bitti) return;
          const once = bagli;
          bagli = s === "SUBSCRIBED";
          setDurum(bagli ? "canli" : s === "CLOSED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? "yedek" : "baglaniyor");
          if (bagli && !once) tetikle(); // bağlanana kadar kaçan değişiklikler
        });
    } catch {
      queueMicrotask(() => setDurum("yedek")); // istemci kurulamadı (ör. ortam değişkeni yok): yedek yenileme
    }
    // Bağlı değilken yedek yenileme (yalnızca sekme görünürken)
    const aralik = setInterval(() => {
      if (!bagli && document.visibilityState === "visible") tetikle();
    }, YEDEK_ARALIK_MS);
    let sonTam = Date.now();
    const yavas = setInterval(() => {
      if (bagli && Date.now() - sonTam >= BAGLIYKEN_ARALIK_MS) {
        sonTam = Date.now();
        tetikle();
      }
    }, 10_000);
    // Sekmeye dönünce hemen tazele
    const gorunur = () => document.visibilityState === "visible" && tetikle();
    document.addEventListener("visibilitychange", gorunur);
    return () => {
      bitti = true;
      if (zamanlayici) clearTimeout(zamanlayici);
      clearInterval(aralik);
      clearInterval(yavas);
      document.removeEventListener("visibilitychange", gorunur);
      if (kanal && istemci) void istemci.removeChannel(kanal);
    };
  }, []);

  return durum;
}
