// Planlar, durumlar, kaynaklar, öncelikler ve chip renkleri tek yerde
export const PLANLAR = ["Basic", "Pro", "Pro+"] as const;
export const TALEP_DURUMLARI = ["Açık", "Beklemede", "Çözüldü"] as const;
export const ONCELIKLER = ["Düşük", "Orta", "Yüksek"] as const;
export const KANALLAR = ["Telefon", "WhatsApp", "E-posta", "Yüz yüze"] as const;
/**
 * Satış hattı lead kaynakları: tek liste (components/satis-hatti/sabitler.ts KAYNAKLAR buradan gelir).
 * Veritabanındaki kaynak tablosuyla aynı olmalı (test/veritabani.test.ts denetler); yeni kaynak migration + seed ile eklenir.
 * Bayi portalının kendi lead kaynakları ayrıdır (components/portal/lead-ortak.ts).
 */
export const LEAD_KAYNAKLARI = ["Web sitesi", "WhatsApp", "Instagram", "Messenger", "Bayi", "Fuar", "Mevcut müşteri"] as const;
export type LeadKaynagi = (typeof LEAD_KAYNAKLARI)[number];
export const FIRSAT_ASAMALARI = ["Yeni lead", "Demo planlandı", "Teklif gönderildi", "Müzakere", "Kazanıldı"] as const;
export const SIPARIS_ADIMLARI = ["Ödeme alındı", "Hazırlanıyor", "Kargoya verildi", "Teslim edildi", "Lisans teslim edildi"] as const;
export const BAYI_ASAMALARI = ["Başvuru", "Değerlendirme", "Sözleşme", "Lansman"] as const;
