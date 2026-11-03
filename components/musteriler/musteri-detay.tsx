// Sağ panel: iletişim, cihazlar, zaman çizelgesi, not ekleme
import Link from "next/link";
import { Cpu, Mail, MessageCircle, Phone } from "lucide-react";
import Chip from "@/components/ui/chip";
import { basHarfler, kisaTl } from "@/lib/format";
import { SEGMENT_ADI, type Musteri } from "./queries";
import { CIHAZ_TONU, PLAN_TONU, avatarRengi, durumTonu } from "./ortak";
import MusteriZamanCizelgesi from "./musteri-zaman-cizelgesi";

const ILETISIM_BTN =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-line-strong bg-card px-2 text-[13px] font-bold transition-colors hover:bg-[#F4F5F0]";

export default function MusteriDetay({ musteri }: { musteri: Musteri | null }) {
  if (!musteri) {
    return (
      <aside className="flex w-full items-center justify-center rounded-card border border-line bg-card p-10 text-sm text-muted">
        Ayrıntıları görmek için bir müşteri seçin.
      </aside>
    );
  }
  const m = musteri;
  const telefon = m.telefon.replace(/[^\d+]/g, "");

  return (
    <aside aria-label="Müşteri detayı" className="flex w-full min-w-0 flex-col gap-5 rounded-card border border-line bg-card p-5">
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${avatarRengi(m.id)}`}>
          {basHarfler(m.ad)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[19px] font-extrabold leading-tight">
            <Link href={`/musteriler/${m.id}`} className="hover:underline">{m.ad}</Link>
          </h2>
          <span className="text-[13px] text-muted">{m.sehir}, {m.ulke} · {SEGMENT_ADI[m.segment]}</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip ton={PLAN_TONU[m.plan]}>{m.plan}</Chip>
            <Chip ton={durumTonu(m.durum)}>{m.durum}</Chip>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a href={`tel:${telefon}`} className={ILETISIM_BTN}><Phone size={16} aria-hidden="true" />Ara</a>
        <a href={`https://wa.me/${telefon.replace("+", "")}`} target="_blank" rel="noreferrer" className={ILETISIM_BTN}>
          <MessageCircle size={16} aria-hidden="true" />WhatsApp
        </a>
        <a href={`mailto:${m.eposta}`} className={ILETISIM_BTN}><Mail size={16} aria-hidden="true" />E-posta</a>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Toplam değer", m.toplamDeger === null ? "—" : kisaTl(m.toplamDeger)],
          ["Cihaz", String(m.cihazlar.length)],
          ["Açık talep", String(m.acikTalep)],
        ].map(([etiket, deger]) => (
          <div key={etiket} className="flex flex-col gap-1 rounded-[14px] bg-[#F4F5F0] p-3">
            <dt className="text-xs font-semibold text-muted">{etiket}</dt>
            <dd className="text-base font-extrabold tabular-nums">{deger}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold">İletişim</h3>
        <dl className="flex flex-col gap-2 text-[13px]">
          {[
            ["Yetkili", m.yetkili],
            ["Telefon", m.telefon],
            ["E-posta", m.eposta],
            ["Vergi No", m.vergiNo],
            ["Son temas", m.sonTemas],
          ].map(([etiket, deger]) => (
            <div key={etiket} className="flex justify-between gap-3">
              <dt className="text-muted">{etiket}</dt>
              <dd className="min-w-0 truncate text-right font-semibold">{deger}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center">
          <h3 className="text-sm font-extrabold">Cihazlar</h3>
          <Link href="/cihaz-lisans" className="ml-auto text-xs font-bold text-info hover:text-[#1A2A9E]">Tümü →</Link>
        </div>
        {m.cihazlar.length === 0 ? (
          <p className="text-[13px] text-muted">Kayıtlı cihaz yok.</p>
        ) : (
          m.cihazlar.map((c) => (
            <div key={c.seriNo} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ink text-lime">
                <Cpu size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono text-xs font-semibold">{c.seriNo}</span>
                <span className="text-xs text-muted">Firmware {c.firmware}</span>
              </div>
              <Chip ton={CIHAZ_TONU[c.durum]}>{c.durum}</Chip>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold">Zaman çizelgesi</h3>
        <MusteriZamanCizelgesi olaylar={m.olaylar} />
      </section>

      <form className="flex flex-col gap-2">
        <label htmlFor={`not-${m.id}`} className="text-sm font-extrabold">Not ekle</label>
        <textarea
          id={`not-${m.id}`}
          name="not"
          rows={3}
          placeholder="Görüşme notu, teklif detayı, hatırlatma…"
          className="resize-y rounded-control border border-line-strong bg-card p-3 text-[13px] outline-none focus:border-ink"
        />
        <button type="submit" disabled className="min-h-11 rounded-control bg-ink px-4 text-sm font-bold text-white disabled:opacity-60" title="Supabase bağlanınca çalışacak">
          Kaydet
        </button>
      </form>
    </aside>
  );
}
