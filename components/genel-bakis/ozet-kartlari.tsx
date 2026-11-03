// Genel Bakış: üst sıradaki 4 özet kart
// Şimdilik DEMO_VERI ile çalışır. Supabase bağlanınca sayfada
// <OzetKartlari veri={await getOzet()} /> şeklinde gerçek veriyi verin.
import Link from "next/link";

export type OzetVerisi = {
  gelir: {
    toplam: number;
    donanim: number;
    lisans: number;
    ay: string; // kartın başlığında görünür: "Ekim"
    degisimYuzde: number; // önceki aya göre
    son12Ay: number[]; // sparkline için
  };
  lisans: { basic: number; pro: number; proPlus: number; buAyYeni: number };
  destek: { acik: number; yuksekOncelik: number; beklemede: number; buHaftaCozulen: number };
  yenileme: { adet: number; potansiyelGelir: number };
};

const DEMO_VERI: OzetVerisi = {
  gelir: {
    toplam: 1_284_500,
    donanim: 762_000,
    lisans: 522_500,
    ay: "Ekim",
    degisimYuzde: 12.4,
    son12Ay: [774, 902, 841, 903, 974, 963, 1056, 1091, 1057, 1008, 1178, 1284],
  },
  lisans: { basic: 473, pro: 586, proPlus: 187, buAyYeni: 38 },
  destek: { acik: 27, yuksekOncelik: 4, beklemede: 6, buHaftaCozulen: 19 },
  yenileme: { adet: 64, potansiyelGelir: 412_800 },
};

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const sayi = new Intl.NumberFormat("tr-TR");
const kisaTl = (n: number) => `₺${Math.round(n / 1000)}K`;

// Tüm kartlarda ortak sınıflar
const KART = "flex min-w-0 flex-col gap-3.5 rounded-card p-5";
const UST = "flex items-start justify-between gap-3";
const BASLIK = "min-w-0 pt-1 text-xs font-semibold leading-snug";
const BUYUK = "text-[clamp(24px,2.2vw,32px)] font-extrabold leading-none tracking-tight tabular-nums whitespace-nowrap";

export default function OzetKartlari({ veri = DEMO_VERI }: { veri?: OzetVerisi }) {
  const { gelir, lisans, destek, yenileme } = veri;
  const toplamLisans = lisans.basic + lisans.pro + lisans.proPlus;
  const oran = (n: number) => (toplamLisans ? (n / toplamLisans) * 100 : 0);

  return (
    <section aria-label="Özet" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Aylık gelir */}
      <div className={`${KART} bg-ink text-white`}>
        <div className={UST}>
          <span className={`${BASLIK} text-[#C3C6BC]`}>Aylık gelir · {gelir.ay}</span>
          <Degisim yuzde={gelir.degisimYuzde} />
        </div>
        <p className={BUYUK}>{tl.format(gelir.toplam)}</p>
        <Sparkline degerler={gelir.son12Ay} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#C3C6BC]">
          <span className="whitespace-nowrap">
            Donanım <b className="tabular-nums text-white">{kisaTl(gelir.donanim)}</b>
          </span>
          <span className="whitespace-nowrap">
            Lisans <b className="tabular-nums text-white">{kisaTl(gelir.lisans)}</b>
          </span>
        </div>
      </div>

      {/* 2. Aktif lisans */}
      <div className={`${KART} border border-line bg-card`}>
        <div className={UST}>
          <span className={`${BASLIK} text-muted`}>Aktif lisans</span>
          <Chip ton="ok">+{lisans.buAyYeni} bu ay</Chip>
        </div>
        <p className={BUYUK}>{sayi.format(toplamLisans)}</p>
        <div
          role="img"
          aria-label={`Basic ${lisans.basic}, Pro ${lisans.pro}, Pro+ ${lisans.proPlus}`}
          className="flex h-2.5 gap-[3px] overflow-hidden rounded-full"
        >
          <div className="bg-[#C9CCC2]" style={{ width: `${oran(lisans.basic)}%` }} />
          <div className="bg-ink" style={{ width: `${oran(lisans.pro)}%` }} />
          <div className="bg-blue" style={{ width: `${oran(lisans.proPlus)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span className="whitespace-nowrap">Basic <b className="tabular-nums text-ink">{lisans.basic}</b></span>
          <span className="whitespace-nowrap">Pro <b className="tabular-nums text-ink">{lisans.pro}</b></span>
          <span className="whitespace-nowrap">Pro+ <b className="tabular-nums text-ink">{lisans.proPlus}</b></span>
        </div>
      </div>

      {/* 3. Açık destek talebi */}
      <div className={`${KART} border border-line bg-card`}>
        <div className={UST}>
          <span className={`${BASLIK} text-muted`}>Açık destek talebi</span>
          {destek.yuksekOncelik > 0 && <Chip ton="warn">{destek.yuksekOncelik} yüksek öncelik</Chip>}
        </div>
        <p className={BUYUK}>{destek.acik}</p>
        <dl className="flex flex-col gap-1.5 text-xs text-muted">
          <div className="flex justify-between gap-3">
            <dt>Beklemede</dt>
            <dd className="font-bold tabular-nums text-ink">{destek.beklemede}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Bu hafta çözülen</dt>
            <dd className="font-bold tabular-nums text-ink">{destek.buHaftaCozulen}</dd>
          </div>
        </dl>
        <Link href="/destek" className="mt-auto whitespace-nowrap text-[13px] font-bold text-[#2338C9] hover:text-[#1A2A9E]">
          Destek kuyruğuna git →
        </Link>
      </div>

      {/* 4. Yenileme bekleyen lisans */}
      <div className={`${KART} border border-lime bg-lime-bg`}>
        <div className={UST}>
          <span className={`${BASLIK} text-[#3A4D00]`}>Yenileme bekleyen lisans</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-[#3A4D00]">
            30 gün
          </span>
        </div>
        <p className={BUYUK}>{yenileme.adet}</p>
        <p className="text-xs text-[#3A4D00]">
          Potansiyel gelir <b className="whitespace-nowrap tabular-nums">{tl.format(yenileme.potansiyelGelir)}</b>
        </p>
        <Link
          href="/cihaz-lisans?filtre=suresi-doluyor"
          className="mt-auto flex min-h-11 items-center justify-center whitespace-nowrap rounded-control bg-ink px-4 text-sm font-bold text-white transition-colors hover:bg-ink-soft"
        >
          Listeyi aç
        </Link>
      </div>
    </section>
  );
}

/* ---------- Bu dosyaya özel küçük parçalar ---------- */

function Degisim({ yuzde }: { yuzde: number }) {
  const artis = yuzde >= 0;
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-lime px-2.5 text-xs font-bold text-ink">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" aria-hidden="true" className={artis ? "" : "rotate-90"}>
        <path d="M7 17 17 7M7 7h10v10" />
      </svg>
      <span className="sr-only">{artis ? "Artış" : "Düşüş"}</span>%{Math.abs(yuzde).toLocaleString("tr-TR")}
    </span>
  );
}

function Sparkline({ degerler }: { degerler: number[] }) {
  if (degerler.length < 2) return null;
  const G = 220, Y = 44;
  const min = Math.min(...degerler), max = Math.max(...degerler);
  const aralik = max - min || 1;
  const noktalar = degerler
    .map((d, i) => `${((i / (degerler.length - 1)) * G).toFixed(1)},${(Y - 4 - ((d - min) / aralik) * (Y - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${G} ${Y}`} preserveAspectRatio="none" className="h-11 w-full" aria-hidden="true">
      <polyline points={noktalar} fill="none" stroke="var(--color-lime)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ui/chip.tsx'i yazdığınızda bunu silip onu import edebilirsiniz
function Chip({ ton, children }: { ton: "ok" | "warn"; children: React.ReactNode }) {
  const renk = ton === "ok" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn";
  return (
    <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${renk}`}>
      {children}
    </span>
  );
}
