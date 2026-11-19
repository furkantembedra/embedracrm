// Bot menüsü sayfalarının ortak parçaları: rol kapısı (sunucuda) ve iskelet sayfaların boş durum metni.
import Link from "next/link";
import { Lock } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { rolEksik } from "@/lib/oturum";
import { BOT_ROLLERI } from "./erisim";

/** Rol yetmiyorsa gösterilecek mesaj (oturum yoksa rolEksik fırlatır; layout da girişe yönlendirir). Rol yetiyorsa null. */
export async function botRolMesaji(): Promise<string | null> {
  return rolEksik(BOT_ROLLERI);
}

export function RolMesaji({ baslik, mesaj }: { baslik: string; mesaj: string }) {
  return (
    <>
      <PageHeader title={baslik} />
      <div role="alert" className="flex max-w-xl items-start gap-3 rounded-card border border-line bg-card p-5">
        <Lock size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
        <div className="flex flex-col gap-1">
          <b className="text-sm">Bot menüsü yalnızca Yönetici, Satış ve Pazarlama rollerine açık.</b>
          <span className="text-sm text-muted">{mesaj} Erişim gerekiyorsa yöneticinizden rolünüzü değiştirmesini isteyin.</span>
          <Link href="/genel-bakis" className="mt-1 self-start text-sm font-bold text-info hover:underline">Genel Bakış&apos;a dön</Link>
        </div>
      </div>
    </>
  );
}

export function BosSayfa({ baslik, aciklama, metin, komut }: { baslik: string; aciklama: string; metin: string; komut: string }) {
  return (
    <>
      <PageHeader title={baslik} description={aciklama} />
      <div className="flex max-w-2xl flex-col gap-2 rounded-card border border-dashed border-line-strong bg-card p-6">
        <b className="text-sm">Henüz hazır değil</b>
        <p className="text-sm text-muted">{metin}</p>
        <span className="text-xs font-semibold text-muted">Yol haritası: {komut}</span>
      </div>
    </>
  );
}
