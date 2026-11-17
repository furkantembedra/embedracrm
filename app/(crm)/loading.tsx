// CRM sayfaları bazı verileri istek anında hesaplar (bugünün çeyreği, "bu ay" gelir); sayfa geçişlerinde bu iskelet gösterilir.
export default function CrmYukleniyor() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-9 w-72 rounded-control bg-line" />
      <div className="h-40 rounded-card border border-line bg-card" />
      <div className="h-[420px] rounded-card border border-line bg-card" />
    </div>
  );
}
