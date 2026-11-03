// Durum etiketi. Örn: <Chip ton="err">Yüksek</Chip>

export type ChipTon = "ok" | "warn" | "err" | "info" | "lime" | "gray" | "ink";

const TON: Record<ChipTon, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  err: "bg-err-bg text-err",
  info: "bg-info-bg text-info",
  lime: "bg-lime-bg text-[#3A4D00]",
  gray: "bg-bg text-[#474A42]",
  ink: "bg-ink text-white",
};

export default function Chip({
  ton = "gray",
  className = "",
  children,
}: {
  ton?: ChipTon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${TON[ton]} ${className}`}
    >
      {children}
    </span>
  );
}
