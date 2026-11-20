// Bot araç geçmişinin ekrandaki adları (istemci ve sunucu ortak; kanal bilmez). P2.2 araçları buraya eklenir.
export const ARAC_ADLARI: Record<string, string> = {
  insana_devret: "İnsana devret",
  ihtiyac_kaydet: "İhtiyaç kaydet",
  lead_skoru_ver: "Lead skoru",
  demo_talep_et: "Demo talebi",
  plan_oner: "Plan öner",
  izin_kaydet: "İzin kaydet",
};
export const aracAdi = (ad: string) => ARAC_ADLARI[ad] ?? ad;

/** bot_kullanim.sonuc → ekrandaki ad ve ton */
export const TUR_SONUCLARI: Record<string, { ad: string; ton: "ok" | "warn" | "err" | "gray" }> = {
  cevap: { ad: "Cevap gönderildi", ton: "ok" },
  devir: { ad: "İnsana devretti", ton: "warn" },
  sessiz: { ad: "Cevap üretmedi", ton: "err" },
  iptal: { ad: "Temsilci devraldı, gönderilmedi", ton: "gray" },
  hata: { ad: "Hata", ton: "err" },
  red: { ad: "Model reddetti", ton: "err" },
};
export const turSonucu = (s: string) => TUR_SONUCLARI[s] ?? { ad: s, ton: "gray" as const };

/** 0.000123 → "$0,000123" */
export const usd = (n: number) => `$${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
