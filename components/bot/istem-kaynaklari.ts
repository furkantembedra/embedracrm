// BU DOSYA ÜRETİLİR, ELLE DEĞİŞTİRMEYİN. Kaynak: docs/bot/ornek-konusmalar/*.md ve docs/bot/itirazlar.md
// Yeniden üretmek için: npm run bot:istem-kaynaklari (ayrıntı scripts/bot-istem-kaynaklari.mjs)

/** Gerçek satış konuşmaları (kişisel bilgiler temizlenmiş), dosya adına göre sıralı */
export const ORNEK_KONUSMALAR: readonly { dosya: string; metin: string }[] = [];

/** Sık duyulan itirazlar ve cevapları; belge yoksa null */
export const ITIRAZLAR: string | null = null;
