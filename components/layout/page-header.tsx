// Sayfa başlığı, alt açıklama ve sağdaki butonlar
export default function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode; // sağ taraftaki butonlar
}) {
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
