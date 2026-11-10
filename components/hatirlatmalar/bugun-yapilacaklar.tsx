"use client";

// Genel bakıştaki "Bugün yapılacaklar" kartı: aktif kullanıcının gecikmiş ve bugünkü hatırlatmaları
import Card from "@/components/ui/card";
import HatirlatmaSatiri from "./hatirlatma-satiri";
import { useHatirlatmalar } from "./use-hatirlatmalar";

export default function BugunYapilacaklar() {
  const { veri, tamamla, ertele } = useHatirlatmalar();
  const bugun = veri?.simdi.slice(0, 10) ?? "";
  const liste = (veri?.liste ?? []).filter((h) => h.sorumluId === veri?.aktif.id && h.durum === "bekliyor" && h.zaman.slice(0, 10) <= bugun);
  return (
    <Card title="Bugün yapılacaklar" description={veri ? `${veri.aktif.ad} · ${liste.length} hatırlatma` : "Yükleniyor…"} action={{ href: "/hatirlatmalar", label: "Tümü" }}>
      {!veri ? (
        <div aria-busy="true" className="h-24 animate-pulse rounded-xl bg-bg motion-reduce:animate-none" />
      ) : liste.length ? (
        <ul className="flex flex-col gap-2">
          {liste.slice(0, 5).map((h) => (
            <HatirlatmaSatiri key={h.id} h={h} simdi={veri.simdi} sade onTamamla={(t) => tamamla(h.id, t)} onErtele={(s) => ertele(h.id, s)} />
          ))}
          {liste.length > 5 && <li className="text-xs font-semibold text-muted">+{liste.length - 5} hatırlatma daha</li>}
        </ul>
      ) : (
        <p className="text-sm text-muted">Bugün için bekleyen iş yok.</p>
      )}
    </Card>
  );
}
