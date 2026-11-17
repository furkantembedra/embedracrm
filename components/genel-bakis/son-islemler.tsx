// Son yapılan kayıt işlemleri (zaman çizelgesi)
import Card from "@/components/ui/card";

export type IslemTuru = "siparis" | "bayi" | "cihaz" | "lead" | "satis" | "destek";
export type Islem = { kim: string; ne: string; zaman: string; kaynak: string; tur: IslemTuru };

const NOKTA: Record<IslemTuru, string> = {
  siparis: "bg-lime-dark",
  bayi: "bg-blue",
  cihaz: "bg-ink",
  lead: "bg-[#E58A2B]",
  satis: "bg-blue",
  destek: "bg-[#7A5AF8]",
};

export default function SonIslemler({ veri }: { veri: Islem[] }) {
  return (
    <Card title="Son işlemler">
      {veri.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Henüz işlem yok.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {veri.map((i, n) => (
            <li key={n} className="flex gap-3">
              <span aria-hidden="true" className={`mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ${NOKTA[i.tur]}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-[13px] leading-snug">
                  <b>{i.kim}</b> {i.ne}
                </p>
                <p className="text-xs text-muted">
                  {i.zaman} · {i.kaynak}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
