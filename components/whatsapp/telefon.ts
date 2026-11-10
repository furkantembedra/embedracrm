// Telefon numarası normalizasyonu: WhatsApp wa_id'si ("905321234567") ile CRM'deki
// serbest yazılmış numaraları ("0532 123 45 67", "+90 532…") aynı biçime getirir.

/** "+905321234567" döner; çözülemezse "" */
export function telefonNormalize(girdi: string): string {
  let d = girdi.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = "90" + d.slice(1); // 05xx… yurt içi
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d; // 5xx… yurt içi
  d = d.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? `+${d}` : "";
}

/** "+905321234567" → "+90 532 123 45 67" (Türkiye), diğerleri olduğu gibi */
export function telefonGoster(t: string) {
  const m = t.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : t;
}
