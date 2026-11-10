"use client";

// Sağ panel: iletişim (yetkililer, vergi no), cihazlar, zaman çizelgesi, not ekleme
import Link from "next/link";
import HatirlatmaButonu from "@/components/hatirlatmalar/hatirlatma-butonu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cpu, Mail, MessageCircle, Phone } from "lucide-react";
import Chip from "@/components/ui/chip";
import { basHarfler, kisaTl } from "@/lib/format";
import { SEGMENT_ADI, type Musteri, type Olay } from "./queries";
import { CIHAZ_TONU, PLAN_TONU, avatarRengi, birincilYetkili, durumTonu, telefonSade } from "./ortak";
import MusteriIletisim, { type IletisimDegisikligi } from "./musteri-iletisim";
import MusteriZamanCizelgesi from "./musteri-zaman-cizelgesi";
import MusteriNotFormu from "./musteri-not-formu";

const ILETISIM_BTN =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-line-strong bg-card px-2 text-[13px] font-bold transition-colors hover:bg-[#F4F5F0] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card";

/** Ara / WhatsApp / E-posta: bağlantı yoksa devre dışı düğme olur, title nedeni söyler */
function IletisimDugmesi({ href, ikon, etiket, baslik, yeniSekme }: { href: string | null; ikon: React.ReactNode; etiket: string; baslik: string; yeniSekme?: boolean }) {
  if (!href) {
    return (
      <span title={baslik} className="flex">
        <button type="button" disabled aria-label={`${etiket}: ${baslik}`} className={ILETISIM_BTN}>{ikon}{etiket}</button>
      </span>
    );
  }
  return (
    <a href={href} title={baslik} className={ILETISIM_BTN} {...(yeniSekme ? { target: "_blank", rel: "noreferrer" } : {})}>
      {ikon}{etiket}
    </a>
  );
}

export default function MusteriDetay({
  musteri,
  yalin = false,
  onNotEklendi,
  onAdaTikla,
  onIletisimDegisti,
}: {
  musteri: Musteri | null;
  yalin?: boolean; // pencere içinde: kart çerçevesi olmadan
  onNotEklendi?: (musteriId: string, olay: Olay) => void; // verilmezse sayfa sunucudan yenilenir
  onAdaTikla?: (musteriId: string) => void; // verilirse ada tıklayınca sayfaya gitmek yerine pencere açılır
  onIletisimDegisti?: (musteriId: string, d: IletisimDegisikligi) => void; // verilmezse sayfa sunucudan yenilenir
}) {
  const router = useRouter();
  // Yetkili / vergi no kaydedilince ekran hemen güncellensin diye son değişikliği burada tutarız
  const [yerel, setYerel] = useState<{ id: string } & IletisimDegisikligi>({ id: "" });

  if (!musteri) {
    return (
      <aside className="flex w-full items-center justify-center rounded-card border border-line bg-card p-10 text-sm text-muted">
        Ayrıntıları görmek için bir müşteri seçin.
      </aside>
    );
  }
  const m: Musteri = yerel.id === musteri.id ? { ...musteri, ...yerel, id: musteri.id } : musteri;
  const kisi = birincilYetkili(m);
  // Birincil yetkilide yoksa telefonu / e-postası olan ilk yetkili kullanılır
  const telefonlu = kisi?.telefon ? kisi : m.yetkililer.find((y) => y.telefon) ?? null;
  const epostali = kisi?.eposta ? kisi : m.yetkililer.find((y) => y.eposta) ?? null;
  const telefon = telefonlu?.telefon ? telefonSade(telefonlu.telefon) : "";
  const yetkiliYok = m.yetkililer.length === 0;

  function iletisimDegisti(d: IletisimDegisikligi) {
    setYerel((y) => ({ ...(y.id === m.id ? y : {}), ...d, id: m.id }));
    if (onIletisimDegisti) onIletisimDegisti(m.id, d);
    else router.refresh();
  }

  return (
    <aside aria-label="Müşteri detayı" className={`flex w-full min-w-0 flex-col gap-5 ${yalin ? "pb-5" : "rounded-card border border-line bg-card p-5"}`}>
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${avatarRengi(m.id)}`}>
          {basHarfler(m.ad)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[19px] font-extrabold leading-tight">
            {yalin ? (
              m.ad
            ) : onAdaTikla ? (
              <button type="button" onClick={() => onAdaTikla(m.id)} className="cursor-pointer text-left hover:underline">{m.ad}</button>
            ) : (
              <Link href={`/musteriler/${m.id}`} className="hover:underline">{m.ad}</Link>
            )}
          </h2>
          <span className="text-[13px] text-muted">{m.sehir}, {m.ulke} · {SEGMENT_ADI[m.segment]}</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip ton={PLAN_TONU[m.plan]}>{m.plan}</Chip>
            <Chip ton={durumTonu(m.durum)}>{m.durum}</Chip>
          </div>
        </div>
        <HatirlatmaButonu kayit={{ tur: "musteri", id: m.id, ad: m.ad, href: `/musteriler/${m.id}` }} className="ml-auto shrink-0 max-sm:hidden" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Numara / e-posta yoksa düğme devre dışı; üzerine gelince nedeni yazar */}
        <IletisimDugmesi
          href={telefon ? `tel:${telefon}` : null}
          ikon={<Phone size={16} aria-hidden="true" />}
          etiket="Ara"
          baslik={telefonlu ? `${telefonlu.ad} · ${telefonlu.telefon}` : yetkiliYok ? "Önce yetkili ekleyin" : "Yetkililerde telefon numarası yok"}
        />
        <IletisimDugmesi
          href={telefon ? `https://wa.me/${telefon.replace("+", "")}` : null}
          yeniSekme
          ikon={<MessageCircle size={16} aria-hidden="true" />}
          etiket="WhatsApp"
          baslik={telefonlu ? `${telefonlu.ad} · ${telefonlu.telefon}` : yetkiliYok ? "Önce yetkili ekleyin" : "Yetkililerde telefon numarası yok"}
        />
        <IletisimDugmesi
          href={epostali ? `mailto:${epostali.eposta}` : null}
          ikon={<Mail size={16} aria-hidden="true" />}
          etiket="E-posta"
          baslik={epostali ? `${epostali.ad} · ${epostali.eposta}` : yetkiliYok ? "Önce yetkili ekleyin" : "Yetkililerde e-posta adresi yok"}
        />
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

      <MusteriIletisim
        key={`iletisim-${m.id}`}
        musteriId={m.id}
        yetkililer={m.yetkililer}
        vergiNo={m.vergiNo}
        sonTemas={m.sonTemas}
        onDegisti={iletisimDegisti}
      />

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center">
          <h3 className="text-sm font-extrabold">Cihazlar</h3>
          {/* Satış hattındaki "Müşteriyi aç" penceresinde (yalin) gösterilmez */}
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
                <span className="text-xs text-muted"><b className="font-bold text-ink">{c.model}</b></span>
              </div>
              <Chip ton={CIHAZ_TONU[c.durum]}>{c.durum}</Chip>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold">
          Zaman çizelgesi <span className="font-semibold text-muted">({m.olaylar.length})</span>
        </h3>
        <MusteriZamanCizelgesi olaylar={m.olaylar} />
      </section>

      <MusteriNotFormu key={`not-${m.id}`} musteriId={m.id} onEklendi={onNotEklendi} />
    </aside>
  );
}
