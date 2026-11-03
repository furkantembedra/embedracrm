// Beyaz kart kutusu: başlık, alt açıklama ve sağ üstte isteğe bağlı bağlantı
import Link from "next/link";

export default function Card({
  title,
  description,
  action,
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`flex w-full min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-5 ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {title && <h2 className="text-[17px] font-extrabold leading-tight">{title}</h2>}
            {description && <p className="text-xs font-semibold text-muted">{description}</p>}
          </div>
          {action && (
            <Link
              href={action.href}
              className="ml-auto shrink-0 whitespace-nowrap text-[13px] font-bold text-info hover:text-[#1A2A9E]"
            >
              {action.label} →
            </Link>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
