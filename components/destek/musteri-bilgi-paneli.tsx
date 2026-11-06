// Sağ panel: müşteri, cihaz, Ara / WhatsApp / E-posta bağlantıları
import Link from "next/link";
import { Cpu, Mail, MessageCircle, Phone, PlusCircle } from "lucide-react";
import type { Musteri } from "@/components/musteriler/queries";
import type { Talep } from "./queries";
import { telefonSade } from "./ortak";

const ILETISIM_BTN =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-line-strong bg-card px-1.5 text-xs font-bold transition-colors hover:bg-[#F4F5F0] aria-disabled:pointer-events-none aria-disabled:opacity-50";
const EYLEM_BTN =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-card px-4 text-left text-sm font-bold transition-colors hover:bg-[#F4F5F0] disabled:cursor-default disabled:opacity-60";

export default function MusteriBilgiPaneli({
  talep,
  musteri,
  onAracKapsami,
  onMusteriAc,
  onCihazAc,
}: {
  talep: Talep | null;
  musteri?: Musteri | null; // kayıtlı müşteriyse iletişim bilgisi güncel müşteri kaydından okunur
  onAracKapsami?: (id: string) => void;
  onMusteriAc?: (musteriId: string) => void; // verilirse sayfaya gitmek yerine pencerede açılır
  onCihazAc?: (seriNo: string) => void;
}) {
  if (!talep) return null;
  const t = talep;
  // Müşteri kaydı varsa talepteki eski kopya yerine güncel yetkililer kullanılır
  // (müşteri ekranında silinen / değişen bilgi burada da hemen değişir)
  const yetkililer = musteri?.yetkililer;
  const telefonlu = yetkililer ? yetkililer.find((y) => y.telefon) ?? null : null;
  const epostali = yetkililer ? yetkililer.find((y) => y.eposta) ?? null : null;
  const kisi = yetkililer ? (yetkililer[0] ?? null) : null;
  const yetkiliAdi = yetkililer ? kisi?.ad ?? "" : t.yetkili;
  const telefon = yetkililer ? telefonlu?.telefon ?? "" : t.telefon;
  const eposta = yetkililer ? epostali?.eposta ?? "" : t.eposta;
  const tel = telefonSade(telefon);
  const telVar = tel.length > 4;
  const epostaVar = eposta.includes("@");
  const isaretli = t.konu === "Araç kapsamı isteği";

  return (
    <aside aria-label="Müşteri ve cihaz bilgisi" className="flex w-full min-w-0 flex-col gap-[18px] rounded-card border border-line bg-card p-5">
      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold">Müşteri</h3>
        {t.musteriId && onMusteriAc ? (
          <button
            type="button"
            onClick={() => onMusteriAc(t.musteriId!)}
            className="cursor-pointer self-start text-left text-[15px] font-bold text-info hover:text-[#1A2A9E]"
          >
            {t.musteri} →
          </button>
        ) : t.musteriId ? (
          <Link href={`/musteriler/${t.musteriId}`} className="text-[15px] font-bold text-info hover:text-[#1A2A9E]">{t.musteri} →</Link>
        ) : (
          <b className="text-[15px]">{t.musteri}</b>
        )}
        <span className="text-[13px] text-muted">
          {yetkiliAdi || telefon ? [yetkiliAdi, telefon].filter(Boolean).join(" · ") : "Yetkili bilgisi yok"}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <a href={telVar ? `tel:${tel}` : undefined} aria-disabled={!telVar} className={ILETISIM_BTN}>
            <Phone size={15} aria-hidden="true" />Ara
          </a>
          <a
            href={telVar ? `https://wa.me/${tel.replace("+", "")}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!telVar}
            className={ILETISIM_BTN}
          >
            <MessageCircle size={15} aria-hidden="true" />WhatsApp
          </a>
          <a href={epostaVar ? `mailto:${eposta}?subject=${encodeURIComponent(`Destek #${t.id}: ${t.baslik}`)}` : undefined} aria-disabled={!epostaVar} className={ILETISIM_BTN}>
            <Mail size={15} aria-hidden="true" />E-posta
          </a>
        </div>
        <p className="text-xs leading-normal text-muted">
          Butonlar telefonunuzdaki veya bilgisayarınızdaki uygulamayı açar; mesajlar CRM&apos;e otomatik düşmez, önemli olanı not olarak ekleyin.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-[13px]">
        <h3 className="mb-0.5 text-sm font-extrabold">Cihaz ve araç</h3>
        <dl className="flex flex-col gap-2">
          {[
            ["Seri no", <span key="s" className="font-mono text-xs font-semibold">{t.seriNo ?? "—"}</span>],
            ["Lisans", <b key="l">{t.plan}</b>],
            ["Araç", <b key="a" className="text-right">{t.arac}</b>],
          ].map(([etiket, deger]) => (
            <div key={etiket as string} className="flex justify-between gap-3">
              <dt className="text-muted">{etiket}</dt>
              <dd className="min-w-0 text-right">{deger}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-extrabold">Bu talepten</h3>
        {t.seriNo && onCihazAc ? (
          <button type="button" onClick={() => onCihazAc(t.seriNo!)} className={EYLEM_BTN}>
            <Cpu size={18} aria-hidden="true" />
            Cihaz kaydını aç
          </button>
        ) : t.seriNo ? (
          <Link href={`/cihaz-lisans/${t.seriNo}`} className={EYLEM_BTN}>
            <Cpu size={18} aria-hidden="true" />
            Cihaz kaydını aç
          </Link>
        ) : (
          <button type="button" disabled className={EYLEM_BTN}>
            <Cpu size={18} aria-hidden="true" />
            Talebe cihaz bağlanmadı
          </button>
        )}
        {onAracKapsami && (
          <button type="button" disabled={isaretli} onClick={() => onAracKapsami(t.id)} className={EYLEM_BTN}>
            <PlusCircle size={18} aria-hidden="true" />
            {isaretli ? "Araç kapsamı isteği olarak işaretli" : "Araç kapsamı isteği olarak işaretle"}
          </button>
        )}
      </section>
    </aside>
  );
}
