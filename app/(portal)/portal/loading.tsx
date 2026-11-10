// Portal sayfaları oturum çerezini istek anında okur; sayfa geçişlerinde bu iskelet gösterilir.
export default function PortalYukleniyor() {
  return <div aria-busy="true" aria-label="Yükleniyor" className="h-80 animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none" />;
}
