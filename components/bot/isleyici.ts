// Konuşma işleyicisi + bot turu. Kuyruk (components/konusma/kuyruk.ts) botu bilmez; bot turunu çalıştıran işleyiciler
// (cron adresi /api/konusma/isleyici ve geliştirme döngüsü instrumentation.ts) bu sarmalayıcıyı kullanır.
// Webhook'taki after() hızlandırıcısı botu çalıştırmaz: bot turu son mesajdan 6 sn sonra vadesi gelir, webhook
// fonksiyonunu Claude çağrısıyla uzatmaya gerek yok; bir sonraki işleyici turu alır.
import { kuyruguIsle, type IsleyiciSonucu } from "@/components/konusma/kuyruk";
import { botTuru } from "./dongu";

export function konusmaIsleyicisi(o: { sureMs?: number; konusmaId?: number } = {}): Promise<IsleyiciSonucu> {
  return kuyruguIsle({ ...o, botTuru: (id) => botTuru(id) });
}
