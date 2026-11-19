// Satış hattı sabitleri: aşamalar, kayıp nedenleri, kaynaklar. Sunucu kodu içermez; istemci bileşenleri doğrudan
// buradan okur (queries.ts Supabase'e bağlı olduğu için tarayıcı paketine giremez). queries.ts bunları dışa da açar.

export const ASAMALAR = ["yeni", "demo", "teklif", "muzakere", "kazanildi", "kaybedildi"] as const;
export type Asama = (typeof ASAMALAR)[number];

export const ASAMA_BILGI: Record<Asama, { ad: string; renk: string }> = {
  yeni: { ad: "Yeni lead", renk: "#C9CCC2" },
  demo: { ad: "Demo planlandı", renk: "#2F4BFF" },
  teklif: { ad: "Teklif gönderildi", renk: "#E58A2B" },
  muzakere: { ad: "Müzakere", renk: "#0E0F0C" },
  kazanildi: { ad: "Kazanıldı", renk: "#B6DD2E" },
  kaybedildi: { ad: "Kaybedildi", renk: "#D93F3F" },
};

/** Kazanıldı ve Kaybedildi kapalı aşamalardır: açık fırsat değerine ve gecikme uyarısına girmez */
export const KAPALI_ASAMALAR: readonly Asama[] = ["kazanildi", "kaybedildi"];

export const KAYIP_NEDENLERI = ["Fiyat yüksek bulundu", "Rakibi seçti", "Bütçe yok", "Yanıt vermiyor", "İhtiyacı kalmadı", "Diğer"] as const;
export type KayipNedeni = (typeof KAYIP_NEDENLERI)[number];
export type KayipBilgisi = { neden: KayipNedeni; aciklama?: string };

// Lead kaynakları tek listedir: lib/constants.ts › LEAD_KAYNAKLARI (burada eski adıyla dışa açılır)
export { LEAD_KAYNAKLARI as KAYNAKLAR, type LeadKaynagi as Kaynak } from "@/lib/constants";
